/**
 * emitReact — top-level React 18+ functional-component emitter.
 *
 * Plan 04-02 (this file) wires emitScript + emitPropsInterface + shell.
 * Plan 04-03 fills in real JSX template emission.
 * Plan 04-04 layers <listeners>-block lowering + listener wrappers between
 *   hookSection and userArrowsSection.
 * Plan 04-05 wires emitStyle + composeSourceMap (DX-01).
 *
 * Public surface (D-67): emitReact(ir, opts) → { code, css, globalCss?, map, diagnostics }.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import type { SourceMap } from 'magic-string';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitScript } from './emit/emitScript.js';
import { emitPropsInterface } from './emit/emitPropsInterface.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { buildShell } from './emit/shell.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from './rewrite/collectReactImports.js';

export interface EmitReactOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
}

export interface EmitReactResult {
  code: string;
  css: string;
  globalCss?: string;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

export function emitReact(
  ir: IRComponent,
  opts: EmitReactOptions = {},
): EmitReactResult {
  const reactImports = new ReactImportCollector();
  const runtimeImports = new RuntimeReactImportCollector();
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  const { hookSection, userArrowsSection, lifecycleEffectsSection, diagnostics: scriptDiags } = emitScript(
    ir,
    { react: reactImports, runtime: runtimeImports },
  );

  // Plan 04-03: emit the template-side JSX, slot-prop fields + ctx interfaces.
  const tmpl = emitTemplate(
    ir,
    { react: reactImports, runtime: runtimeImports },
    registry,
  );

  // Plan 04-04: emit <listeners>-block entries (4-class A/B/C/D classifier).
  // Returns useEffect/useOutsideClick blocks (`code`) and Class C wrapper consts
  // (`scriptInjections`) that need to land AFTER user arrows. shell.ts already
  // slots scriptInjections AFTER user arrows per Wave 0 spike Variant A.
  const listeners = emitListeners(
    ir,
    { react: reactImports, runtime: runtimeImports },
    registry,
  );

  const propsInterface = emitPropsInterface(ir, tmpl.slotPropFields);

  // Build the type-only `import type { ReactNode } from 'react';` line if
  // the props interface or scriptInjections reference ReactNode.
  const referencesReactNode =
    propsInterface.includes('ReactNode') ||
    tmpl.slotCtxInterfaces.some((s) => s.includes('ReactNode')) ||
    tmpl.scriptInjections.some((s) => s.includes('ReactNode'));
  const reactTypeImports = referencesReactNode
    ? "import type { ReactNode } from 'react';\n"
    : '';

  // Plan 04-05 will produce these:
  const cssModuleImport = null;
  const globalCssImport = null;

  // Plan 04-04 composition order (Wave 0 spike Variant A):
  //   hookSection (state hooks)
  //     → userArrowsSection (useCallback wraps + plain helpers + computed)
  //     → lifecycleEffectsSection (lifecycle useEffects — moved here per
  //        Plan 04-04 to fix Plan 04-03 deferred TDZ limitation #1)
  //     → wrapper consts (`scriptInjections`, template + listener)
  //     → listener useEffect blocks (`listenerEffects`)
  //     → return JSX
  // Wrapper consts and lifecycle effects must be in scope when their dep
  // arrays evaluate, so all hooks-that-reference-helpers go AFTER
  // userArrowsSection.
  const script = [hookSection, userArrowsSection, lifecycleEffectsSection]
    .filter((s) => s.length > 0)
    .join('\n\n');

  const allScriptInjections = [...tmpl.scriptInjections, ...listeners.scriptInjections];

  const ms = buildShell({
    componentName: ir.name,
    propsInterface,
    reactImports: reactImports.render(),
    reactTypeImports,
    runtimeImports: runtimeImports.render(),
    cssModuleImport,
    globalCssImport,
    ctxInterfaces: tmpl.slotCtxInterfaces,
    scriptInjections: allScriptInjections,
    script,
    listenerEffects: listeners.code,
    jsx: tmpl.jsx,
  });

  return {
    code: ms.toString(),
    css: '', // Plan 04-05 fills
    map: null, // Plan 04-05 wires composeSourceMap
    diagnostics: [...scriptDiags, ...tmpl.diagnostics, ...listeners.diagnostics],
  };
}
