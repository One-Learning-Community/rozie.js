/**
 * AST normalizer — wraps splitter (Plan 02) + per-block parsers (Plan 03) +
 * peggy modifier grammar (Plan 04 Task 1) into a unified `RozieAST`.
 *
 * Responsibilities:
 *   1. Compose the seven block sub-ASTs into the locked `RozieAST` wrapper.
 *   2. Run the peggy modifier grammar over preserved modifier-chain TEXT on:
 *      a) `<listeners>` entries (D-15 stage 2)
 *      b) `<template>` event attributes (recursive walk)
 *      The same grammar serves both — lining up MOD-03's Phase-2 promise of
 *      a shared modifier registry between the two sites.
 *   3. Accumulate diagnostics from peggy parse failures (collected, not thrown
 *      — D-08).
 *
 * The normalizer does NOT re-parse blocks — it consumes the per-block parser
 * results as inputs. ROZ001 (missing envelope) is emitted upstream by parse()
 * via splitBlocks; if `blocks.rozie` is absent here, the normalizer returns
 * `ast: null` and `parse()` decides how to surface that.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST, BlockMap } from './types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { PropsAST } from './blocks/PropsAST.js';
import type { DataAST } from './blocks/DataAST.js';
import type { ScriptAST } from './blocks/ScriptAST.js';
import type { ListenersAST, ListenerEntry } from './blocks/ListenersAST.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from './blocks/TemplateAST.js';
import type { StyleAST } from './blocks/StyleAST.js';
import { parseModifierChain } from '../modifier-grammar/parseModifierChain.js';

export interface NormalizeInput {
  blocks: BlockMap;
  props: PropsAST | null;
  data: DataAST | null;
  script: ScriptAST | null;
  listeners: ListenersAST | null;
  template: TemplateAST | null;
  style: StyleAST | null;
}

/**
 * Compose all per-block parser outputs into a unified `RozieAST`. Runs the
 * peggy modifier grammar over modifier-chain text on listener entries and
 * template event attributes, populating their `chain: ModifierChain[]` fields.
 *
 * Diagnostics from peggy are accumulated and returned alongside the AST. The
 * function NEVER throws (D-08).
 */
export function buildRozieAST(input: NormalizeInput): {
  ast: RozieAST | null;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const { blocks } = input;

  if (!blocks.rozie) {
    // Caller (parse()) handles ROZ001 emission upstream via splitBlocks.
    return { ast: null, diagnostics };
  }

  const enrichedListeners = input.listeners
    ? enrichListeners(input.listeners, diagnostics)
    : null;
  const enrichedTemplate = input.template
    ? enrichTemplate(input.template, diagnostics)
    : null;

  // Determine the final RozieAST `loc.end` — prefer the splitter's envelope
  // end (covers full <rozie>...</rozie> span). The splitter populates this on
  // </rozie> close.
  const rozieLoc = blocks.rozie.loc;

  const ast: RozieAST = {
    type: 'RozieAST',
    name: blocks.rozie.name,
    loc: rozieLoc,
    props: input.props,
    data: input.data,
    script: input.script,
    listeners: enrichedListeners,
    template: enrichedTemplate,
    style: input.style,
    // Phase 06.1 Plan 01: thread BlockMap through so per-target buildShell()
    // implementations can anchor MagicString.overwrite() at .rozie byte
    // offsets (DX-04). The splitter's `diagnostics` field is intentionally
    // dropped here — diagnostics are aggregated upstream by parse().
    blocks,
  };

  return { ast, diagnostics };
}

function enrichListeners(
  listeners: ListenersAST,
  diagnostics: Diagnostic[],
): ListenersAST {
  const enrichedEntries: ListenerEntry[] = listeners.entries.map((entry) => {
    const { chain, diagnostics: chainDiags } = parseModifierChain(
      entry.modifierChainText,
      entry.modifierChainBaseOffset,
    );
    diagnostics.push(...chainDiags);
    return { ...entry, chain: chain ?? [] };
  });
  return { ...listeners, entries: enrichedEntries };
}

function enrichTemplate(
  tpl: TemplateAST,
  diagnostics: Diagnostic[],
): TemplateAST {
  return { ...tpl, children: tpl.children.map((n) => enrichNode(n, diagnostics)) };
}

function enrichNode(node: TemplateNode, diagnostics: Diagnostic[]): TemplateNode {
  if (node.type !== 'TemplateElement') return node;
  const el = node as TemplateElement;
  const enrichedAttrs: TemplateAttr[] = el.attributes.map((attr) =>
    enrichAttr(attr, diagnostics),
  );
  const enrichedChildren = el.children.map((c) => enrichNode(c, diagnostics));
  return {
    ...el,
    attributes: enrichedAttrs,
    children: enrichedChildren,
  };
}

function enrichAttr(attr: TemplateAttr, diagnostics: Diagnostic[]): TemplateAttr {
  if (attr.kind !== 'event') return { ...attr, chain: [] };
  const { chain, diagnostics: chainDiags } = parseModifierChain(
    attr.modifierChainText,
    attr.modifierChainBaseOffset,
  );
  diagnostics.push(...chainDiags);
  return { ...attr, chain: chain ?? [] };
}
