/**
 * emitReact — top-level React 18+ functional-component emitter.
 *
 * Plan 04-02 wires emitScript + emitPropsInterface + shell.
 * Plan 04-03 fills in JSX template emission.
 * Plan 04-04 layers <listeners>-block lowering + listener wrappers between
 *   hookSection and userArrowsSection, plus lifecycleEffectsSection placement.
 * Plan 04-05 wires emitStyle + composeSourceMap (DX-01).
 *
 * Public surface (D-67): emitReact(ir, opts) → { code, css, globalCss?, map, diagnostics }.
 *
 * The CSS routing per D-53 + D-54 (Plan 04-05):
 *   - moduleCss → emitted alongside `.tsx` as a sibling `.module.css` file
 *     by `@rozie/unplugin`'s React-branch load hook. The `.tsx` body imports
 *     it via `import styles from './${name}.module.css';`.
 *   - globalCss → emitted alongside `.tsx` as a sibling `.global.css` file
 *     when the .rozie has `:root` rules. The `.tsx` body imports it for
 *     side effect via `import './${name}.global.css';`.
 *
 * Class hashing happens at Vite bundle time; emitStyle outputs UN-hashed
 * class names. The synthetic `.module.css` extension triggers Vite's
 * CSS-Modules pipeline naturally (see 04-05-SPIKE.md Path 2).
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
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';
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
  /** CSS body for the sibling `.module.css` file (D-53). Empty string when no scoped rules. */
  css: string;
  /** CSS body for the sibling `.global.css` file (D-54). Undefined when no `:root` rules. */
  globalCss?: string;
  /** magic-string SourceMap pointing emitted .tsx positions back to .rozie source. Null when filename + source not provided. */
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
  const listeners = emitListeners(
    ir,
    { react: reactImports, runtime: runtimeImports },
    registry,
  );

  // Plan 04-05: emit styles per D-53 + D-54. emitStyle requires the original
  // `.rozie` source text to slice rule bodies by absolute byte offset (the
  // IR's StyleSection only carries StyleRule.loc, not cssText). When
  // opts.source is missing, skip style emission entirely so back-compat with
  // older callers (Plan 04-02 tests) is preserved.
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source)
    : { moduleCss: '', globalCss: null as string | null, diagnostics: [] };
  const moduleCss = styleResult.moduleCss;
  const globalCss = styleResult.globalCss;
  const styleDiags = styleResult.diagnostics;

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

  // Plan 04-05: synthesize CSS Module + global CSS sibling-file imports.
  // Path 2 chosen per 04-05-SPIKE.md (synthetic `.module.css` extension that
  // Vite's CSS-Modules pipeline detects automatically).
  const cssModuleImport =
    moduleCss.length > 0 ? `import styles from './${ir.name}.module.css';` : null;
  const globalCssImport =
    globalCss !== null ? `import './${ir.name}.global.css';` : null;

  // Plan 04-04 composition order (Wave 0 spike Variant A):
  //   hookSection (state hooks)
  //     → userArrowsSection (useCallback wraps + plain helpers + computed)
  //     → lifecycleEffectsSection (lifecycle useEffects — moved here per
  //        Plan 04-04 to fix Plan 04-03 deferred TDZ limitation #1)
  //     → wrapper consts (`scriptInjections`, template + listener)
  //     → listener useEffect blocks (`listenerEffects`)
  //     → return JSX
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

  const code = ms.toString();

  // Plan 04-05: produce a real source map when filename + source are provided.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, { filename: opts.filename, source: opts.source })
      : null;

  return {
    code,
    css: moduleCss,
    globalCss: globalCss ?? undefined,
    map,
    diagnostics: [...scriptDiags, ...tmpl.diagnostics, ...listeners.diagnostics, ...styleDiags],
  };
}
