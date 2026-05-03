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
import { emitScript } from './emit/emitScript.js';
import { emitPropsInterface } from './emit/emitPropsInterface.js';
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
  _opts: EmitReactOptions = {},
): EmitReactResult {
  const reactImports = new ReactImportCollector();
  const runtimeImports = new RuntimeReactImportCollector();

  const { hookSection, userArrowsSection, diagnostics: scriptDiags } = emitScript(
    ir,
    { react: reactImports, runtime: runtimeImports },
  );
  const propsInterface = emitPropsInterface(ir);

  // Plan 04-03 will fill in actual JSX:
  const jsx = 'return null;';

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
    runtimeImports: runtimeImports.render(),
    cssModuleImport,
    globalCssImport,
    script,
    jsx,
  });

  return {
    code: ms.toString(),
    css: '', // Plan 04-05 fills
    map: null, // Plan 04-05 wires composeSourceMap
    diagnostics: scriptDiags,
  };
}
