/**
 * @rozie/target-solid — top-level emitter orchestrator.
 *
 * Mirrors emitReact.ts module-for-module with these key differences:
 *   - No CSS sidecar (Pitfall 3): EmitSolidResult has no css/globalCss fields.
 *   - splitProps universally applied (D-141): function param is always '_props'.
 *   - children() accessor for default slot (D-131).
 *   - Solid-flavored slot field shapes (D-132/D-133) in emitSlotDecl/emitSlotInvocation.
 *   - createEffect+onCleanup for listeners (no useEffect dep arrays).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import type { BlockMap } from '../../../core/src/ast/types.js';
import type { SourceMap } from 'magic-string';
import { splitBlocks } from '../../../core/src/splitter/splitBlocks.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { rewriteRozieImport } from '../../../core/src/codegen/rewriteRozieImport.js';
import { SolidImportCollector, RuntimeSolidImportCollector } from './rewrite/collectSolidImports.js';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitSlotDecl } from './emit/emitSlotDecl.js';
import { emitPropsInterface } from './emit/emitPropsInterface.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';

export interface EmitSolidOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available, otherwise
   * the legacy fallback path is taken.
   */
  blockOffsets?: BlockMap;
}

export interface EmitSolidResult {
  code: string;
  /**
   * magic-string SourceMap pointing emitted .tsx positions back to .rozie source.
   * Null when filename + source not provided.
   */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

export function emitSolid(ir: IRComponent, opts: EmitSolidOptions = {}): EmitSolidResult {
  // 1. Resolve registry + blockOffsets.
  const registry = opts.modifierRegistry ?? createDefaultRegistry();
  let resolvedBlockOffsets: BlockMap;
  if (opts.blockOffsets !== undefined) {
    resolvedBlockOffsets = opts.blockOffsets;
  } else if (opts.source !== undefined) {
    resolvedBlockOffsets = splitBlocks(opts.source, opts.filename ?? '');
  } else {
    resolvedBlockOffsets = {} as BlockMap;
  }

  // 2. Collectors.
  const solidImports = new SolidImportCollector();
  const runtimeImports = new RuntimeSolidImportCollector();
  solidImports.add('splitProps'); // D-141 universal

  // 3. Determine default-slot presence (D-131).
  const hasDefaultSlot = (ir.slots ?? []).some((s) => s.name === '');
  if (hasDefaultSlot) solidImports.add('children');

  // 4. Compose component-imports block from ir.components.
  let componentImportsBlock: string | undefined;
  const components = ir.components ?? [];
  const componentImportLines: string[] = components
    .filter((decl) => {
      // Filter self-references: Solid's named function declaration handles self-ref natively.
      const localName = 'localName' in decl
        ? (decl as { localName: string }).localName
        : (decl as { name: string }).name;
      return localName !== ir.name;
    })
    .map((decl) => {
      const localName = 'localName' in decl
        ? (decl as { localName: string }).localName
        : (decl as { name: string }).name;
      const importPath = 'importPath' in decl
        ? (decl as { importPath: string }).importPath
        : '';
      const rewritten = rewriteRozieImport(importPath, 'solid');
      return `import ${localName} from '${rewritten}';`;
    });
  if (componentImportLines.length > 0) {
    componentImportsBlock = componentImportLines.join('\n') + '\n';
  }

  // 5. Per-segment emit.
  const slotResult = emitSlotDecl(ir);
  const propsInterface = emitPropsInterface(ir, slotResult.fields);
  const scriptResult = emitScript(ir, { solidImports, runtimeImports, filename: opts.filename }, registry);
  const templateResult = emitTemplate(ir, { solid: solidImports, runtime: runtimeImports }, registry);
  const listenersResult = emitListeners(ir, { solid: solidImports, runtime: runtimeImports }, registry);
  const styleResult = emitStyle(ir.styles ?? { scopedRules: [], rootRules: [] }, opts.source ?? '');

  // 6. splitPropsCall — D-141 universal.
  // D-131: when a default slot is present, 'children' must also be split so
  // `local.children` is valid inside the `children(() => local.children)` call.
  const propKeys = (ir.props ?? []).map((p) => `'${p.name}'`);
  if (hasDefaultSlot && !propKeys.includes("'children'")) {
    propKeys.push("'children'");
  }
  const propNames = propKeys.join(', ');
  // When non-model defaults exist, emitScript emits `const _merged = mergeProps({...}, _props)`.
  // splitProps must use `_merged` so `local.*` gets the declared defaults.
  const propsTarget = scriptResult.mergePropsCall ? '_merged' : '_props';
  const splitPropsCall = `const [local, rest] = splitProps(${propsTarget}, [${propNames}]);\n`;

  // 7. Compose shell.
  // Merge script injections: template-event wraps + listener wraps go after user arrows.
  const script = [
    scriptResult.hookSection,
    scriptResult.userArrowsSection,
    ...templateResult.scriptInjections,
    ...listenersResult.scriptInjections,
  ]
    .filter((s) => s.trim().length > 0)
    .join('\n\n');

  // `JSX.Element` is always used in the function signature; the JSX namespace
  // must be explicitly imported as a type-only import from solid-js.
  const jsxTypeImport = `import type { JSX } from 'solid-js';\n`;
  // Prepend JSX type import before the value imports (or stand alone if none).
  const solidImportsStr = jsxTypeImport + solidImports.render();

  const shellParts = {
    componentName: ir.name,
    propsInterface,
    solidImports: solidImportsStr,
    runtimeImports: runtimeImports.render(),
    componentImportsBlock,
    ctxInterfaces: slotResult.ctxInterfaces,
    mergePropsCall: scriptResult.mergePropsCall ?? undefined,
    splitPropsCall,
    hasDefaultSlot,
    script,
    hookSectionLines: scriptResult.hookSectionLines,
    listenerEffects: listenersResult.code,
    styleJsx: styleResult.styleJsx,
    jsx: templateResult.jsx,
    rozieSource: opts.source ?? '',
    blockOffsets: resolvedBlockOffsets,
    scriptMap: scriptResult.scriptMap,
  };

  const shell = buildShell(shellParts);

  // 8. Compose source map.
  const finalMap =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(shell.ms, {
          filename: opts.filename,
          source: opts.source,
          scriptMap: shell.scriptMap,
          scriptOutputOffset: shell.scriptOutputOffset,
          userCodeLineOffset: shell.userCodeLineOffset,
        })
      : null;

  // 9. Aggregate diagnostics.
  const diagnostics: Diagnostic[] = [
    ...scriptResult.diagnostics,
    ...templateResult.diagnostics,
    ...listenersResult.diagnostics,
    ...slotResult.diagnostics,
    ...styleResult.diagnostics,
  ];

  return { code: shell.ms.toString(), map: finalMap, diagnostics };
}
