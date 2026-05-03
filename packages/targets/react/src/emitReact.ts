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

  const { hookSection, userArrowsSection, diagnostics: scriptDiags } = emitScript(
    ir,
    { react: reactImports, runtime: runtimeImports },
  );

  // Plan 04-03: emit the template-side JSX, slot-prop fields + ctx interfaces.
  const tmpl = emitTemplate(
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

  // Plan 04-02 composition: hooks immediately followed by user arrows.
  // Plan 04-04 will replace this with the interleaved order:
  //   hookSection → userArrowsSection → listener wrapper consts → listener useEffects
  const script = [hookSection, userArrowsSection].filter((s) => s.length > 0).join('\n\n');

  const ms = buildShell({
    componentName: ir.name,
    propsInterface,
    reactImports: reactImports.render(),
    reactTypeImports,
    runtimeImports: runtimeImports.render(),
    cssModuleImport,
    globalCssImport,
    ctxInterfaces: tmpl.slotCtxInterfaces,
    scriptInjections: tmpl.scriptInjections,
    script,
    jsx: tmpl.jsx,
  });

  return {
    code: ms.toString(),
    css: '', // Plan 04-05 fills
    map: null, // Plan 04-05 wires composeSourceMap
    diagnostics: [...scriptDiags, ...tmpl.diagnostics],
  };
}
