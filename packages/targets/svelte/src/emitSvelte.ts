/**
 * emitSvelte — Phase 5 Plan 02a Task 3.
 *
 * Top-level Svelte 5+ SFC emitter. Mirrors emitVue's coordinator orchestration:
 *
 *   1. emitScript          → { scriptBlock, scriptInjections, diagnostics }
 *   2. emitTemplate        → { template, scriptInjections, diagnostics }
 *   3. emitListeners       → { block, scriptInjections, diagnostics }
 *   4. emitStyle           → { block, diagnostics }
 *   5. mergeScript splices template + listener scriptInjections into the
 *      script body (debounce/throttle IIFE wrappers — `top` BEFORE the
 *      residual section, `bottom` AFTER).
 *   6. buildShell composes the SFC envelope via magic-string.
 *   7. composeSourceMap produces a real SourceMap referencing the .rozie
 *      source (when filename + source provided).
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-svelte` imports —
 * debounce / throttle / outsideClick all inline as IIFE.
 *
 * Per RESEARCH Pitfall 4: NO `on:event` syntax in emitted output. NO
 * `|preventDefault` modifier shorthand.
 *
 * Public surface (mirrors emitVue / emitReact): `emitSvelte(ir, opts) →
 * { code, map, diagnostics }`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, TemplateNode } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import { splitBlocks } from '../../../core/src/splitter/splitBlocks.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { rewriteRozieImport } from '../../../core/src/codegen/rewriteRozieImport.js';

/**
 * Phase 06.2 P2 — recursive walk over the IR template detecting any
 * `tagKind: 'self'` element (mirror of emitVue's helper). O(n) over the
 * IR tree; threat T-06.2-P2-04 mitigation.
 */
function templateContainsSelfReference(node: TemplateNode | null): boolean {
  if (!node) return false;
  switch (node.type) {
    case 'TemplateElement': {
      if (node.tagKind === 'self') return true;
      for (const child of node.children) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateConditional': {
      for (const branch of node.branches) {
        for (const child of branch.body) {
          if (templateContainsSelfReference(child)) return true;
        }
      }
      return false;
    }
    case 'TemplateLoop': {
      for (const child of node.body) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateSlotInvocation': {
      for (const child of node.fallback) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateFragment': {
      for (const child of node.children) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}
import type { SourceMap } from 'magic-string';
import { emitScript, type SvelteScriptInjection } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';

export interface EmitSvelteOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available.
   */
  blockOffsets?: BlockMap;
}

export interface EmitSvelteResult {
  code: string;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Splice scriptInjections (debounce/throttle wrappers) into the script body.
 *
 * `position: 'top'` — splice BEFORE the residual section (so listener IIFE
 * wrappers are declared before the $effect block that attaches them).
 *
 * `position: 'bottom'` — splice AFTER the residual section (so template-event
 * debounce wrappers see the user-declared handler arrow in scope).
 *
 * Plan 02a v1: a simple top/bottom splicer is sufficient — all injections
 * have one of those two positions. Imports aren't part of the script body
 * (Svelte's $effect / $state / $derived runes are compile-time, no imports).
 */
function mergeScriptInjections(
  script: string,
  injections: SvelteScriptInjection[],
): string {
  if (injections.length === 0) return script;

  const topDecls = injections.filter((i) => i.position === 'top').map((i) => i.decl);
  const bottomDecls = injections
    .filter((i) => i.position === 'bottom')
    .map((i) => i.decl);

  const head = topDecls.length > 0 ? topDecls.join('\n\n') + '\n\n' : '';
  const tail = bottomDecls.length > 0 ? '\n\n' + bottomDecls.join('\n\n') : '';

  return head + script + tail;
}

export function emitSvelte(
  ir: IRComponent,
  opts: EmitSvelteOptions = {},
): EmitSvelteResult {
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // 1. Script-side emission.
  // Phase 06.1 P2: thread filename for sourceFileName + capture scriptMap + preambleSectionLines.
  const scriptOpts: { filename?: string } = {};
  if (opts.filename !== undefined) scriptOpts.filename = opts.filename;
  const {
    scriptBlock,
    scriptInjections: scriptOwnInjections,
    scriptMap,
    preambleSectionLines,
    diagnostics: scriptDiags,
  } = emitScript(ir, scriptOpts);

  // 2. Template-side emission. Returns scriptInjections for any debounce/
  //    throttle wrappers needed by template @event modifiers.
  const {
    template,
    scriptInjections: tmplInjections,
    diagnostics: tmplDiags,
  } = emitTemplate(ir, registry);

  // 3. <listeners>-block emission. Returns its own scriptInjections for
  //    debounce/throttle wrappers needed by Class C listeners.
  const {
    block: listenerBlock,
    scriptInjections: listenerInjections,
    diagnostics: listenerDiags,
  } = emitListeners(ir.listeners, ir, registry);

  // 4. Style-block emission.
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source)
    : { block: '', diagnostics: [] as Diagnostic[] };

  // 5. Compose the script body: scriptBlock + listenerBlock + injections.
  // Listener $effect blocks are appended AFTER the lifecycle $effect blocks
  // (which are at the end of scriptBlock from emitScript) so listener
  // attachment runs after lifecycle setup.
  const allInjections: SvelteScriptInjection[] = [
    ...scriptOwnInjections,
    ...tmplInjections,
    ...listenerInjections,
  ];

  const scriptWithListeners =
    listenerBlock.length > 0
      ? scriptBlock.trimEnd() + '\n\n' + listenerBlock
      : scriptBlock;

  const finalScript = mergeScriptInjections(scriptWithListeners, allInjections);

  // 6. Compose the SFC envelope via magic-string.
  // Phase 06.1 Plan 01 (DX-04) — anchor MagicString at .rozie source bytes via
  // overwrite() per block. blockOffsets resolution order:
  //   1. opts.blockOffsets (caller threaded splitBlocks result through)
  //   2. derive from opts.source via splitBlocks()
  //   3. degenerate empty BlockMap (legacy fallback path).
  let resolvedBlockOffsets: BlockMap;
  if (opts.blockOffsets !== undefined) {
    resolvedBlockOffsets = opts.blockOffsets;
  } else if (opts.source !== undefined) {
    resolvedBlockOffsets = splitBlocks(opts.source, opts.filename);
  } else {
    resolvedBlockOffsets = {};
  }

  // Phase 06.2 P2 (D-117 updated 2026-05-07 + D-118): synthesize
  // top-of-script component-import lines for both wrapper composition AND
  // self-reference. Self-import idiom (NOT `<svelte:self>`).
  // Defensive `?? []` guards pre-P1 hand-rolled IRs.
  const components = ir.components ?? [];
  const componentImportsLines: string[] = components.map((decl) => {
    const rewritten = rewriteRozieImport(decl.importPath, 'svelte');
    return `import ${decl.localName} from '${rewritten}';`;
  });
  const hasSelfReference = templateContainsSelfReference(ir.template);
  // When tagKind: 'self' appears AND the outer name isn't already in the
  // components table, synthesize the additional self-import line.
  if (
    hasSelfReference &&
    !components.some((c) => c.localName === ir.name)
  ) {
    componentImportsLines.push(`import ${ir.name} from './${ir.name}.svelte';`);
  }
  const componentImportsBlock =
    componentImportsLines.length > 0
      ? componentImportsLines.join('\n') + '\n'
      : '';

  const { ms, scriptOutputOffset, userCodeLineOffset, scriptMap: shellScriptMap } = buildShell({
    script: finalScript,
    template,
    styleBlock: styleResult.block,
    rozieSource: opts.source ?? '',
    blockOffsets: resolvedBlockOffsets,
    scriptMap,
    preambleSectionLines,
    componentImportsBlock,
  });

  const code = ms.toString();

  // 7. Phase 06.1 P2 (D-109): composeSourceMap chains shell map + scriptMap
  // via composeMaps().
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, {
          filename: opts.filename,
          source: opts.source,
          scriptMap: shellScriptMap,
          scriptOutputOffset,
          userCodeLineOffset,
        })
      : null;

  return {
    code,
    map,
    diagnostics: [
      ...scriptDiags,
      ...tmplDiags,
      ...listenerDiags,
      ...styleResult.diagnostics,
    ],
  };
}
