/**
 * `<template>` block AST.
 *
 * Captures both static and dynamic attributes in raw form:
 * - kind: 'static'    — `class="counter"`
 * - kind: 'binding'   — `:class="{ hovering: $data.hovering }"` (prefix ':')
 * - kind: 'event'     — `@click.outside(...)` (prefix '@'; modifierChainText preserved verbatim)
 * - kind: 'directive' — `r-if="..."` / `r-for="item in items"` / `r-model="$data.x"` (prefix 'r-')
 *
 * Mustache `{{ ... }}` inside attribute values is preserved verbatim in `value`;
 * not pre-parsed in Phase 1. Phase 2 lowers it into expression bindings.
 *
 * @experimental — shape may change before v1.0
 */
import type { SourceLoc } from '../types.js';
import type { ModifierChain } from '../../modifier-grammar/parseModifierChain.js';

export type TemplateNode =
  | TemplateElement
  | TemplateText
  | TemplateInterpolation;

export interface TemplateElement {
  type: 'TemplateElement';
  tagName: string;
  attributes: TemplateAttr[];
  children: TemplateNode[];
  selfClosing: boolean;
  loc: SourceLoc;
}

export interface TemplateAttr {
  kind: 'static' | 'binding' | 'event' | 'directive';
  /** The raw attribute name, with prefix (e.g., 'class', ':class', '@click.outside(...)', 'r-if'). */
  rawName: string;
  /** Identifier portion (without prefix or modifier chain) — e.g., 'click' for '@click.outside(...)'. */
  name: string;
  /** Modifier chain text (e.g., '.outside($refs.x).stop'); empty for non-event/non-key-modifier attrs. */
  modifierChainText: string;
  /** Absolute byte offset in source where modifierChainText begins (or attribute end if no modifiers). */
  modifierChainBaseOffset: number;
  /**
   * Parsed modifier chain (populated by buildRozieAST in Plan 04). Only
   * meaningful when kind === 'event'; for other kinds, this is always [].
   * Never null — always present for consistent downstream consumption.
   * parseTemplate (Plan 03) sets this to [] at construction time; the AST
   * normalizer re-parses modifierChainText through the peggy grammar and
   * replaces with the structured chain.
   */
  chain: ModifierChain[];
  /** Raw attribute value (string between quotes), or null for boolean attributes. */
  value: string | null;
  /** Loc of the value text (between quotes), null when value === null. */
  valueLoc: SourceLoc | null;
  /** Full attribute span including name + value + quotes. */
  loc: SourceLoc;
}

export interface TemplateText {
  type: 'TemplateText';
  text: string;
  loc: SourceLoc;
}

export interface TemplateInterpolation {
  type: 'TemplateInterpolation';
  /** Raw text between `{{` and `}}` (whitespace preserved verbatim). */
  rawExpr: string;
  loc: SourceLoc;
}

export interface TemplateAST {
  type: 'TemplateAST';
  loc: SourceLoc;
  /** The block's children (multiple roots are allowed; <template> doesn't enforce single root in Phase 1). */
  children: TemplateNode[];
}
