/**
 * `<listeners>` block AST. D-15 stage 1: each entry preserves the modifier
 * chain TEXT verbatim alongside the absolute byte offset of the leading dot.
 * The PEG parse over modifier-chain text runs in Plan 04.
 *
 * @experimental — shape may change before v1.0
 */
import type { Expression } from '@babel/types';
import type { SourceLoc } from '../types.js';

export interface ListenerEntry {
  /** Original key text (e.g., "document:click.outside($refs.triggerEl, $refs.panelEl)"). */
  rawKey: string;
  /** Loc of the rawKey string within the .rozie file (excluding surrounding quotes). */
  rawKeyLoc: SourceLoc;
  /** Target identifier — text before the ':' in rawKey, or '$el' if absent. */
  target: string;
  /** Event identifier — between ':' and the first '.' (or end of rawKey). */
  event: string;
  /**
   * Modifier-chain text — substring from the first '.' to end-of-rawKey,
   * INCLUDING the leading dot. Empty string if no modifiers. Plan 04 feeds
   * this through the peggy grammar to produce ModifierChain[].
   */
  modifierChainText: string;
  /** Absolute byte offset in the .rozie file where modifierChainText begins. */
  modifierChainBaseOffset: number;
  /** AST of the value (right-hand side) — Babel Expression node. */
  value: Expression;
  /** Loc of the full ObjectProperty in the .rozie file. */
  loc: SourceLoc;
}

export interface ListenersAST {
  type: 'ListenersAST';
  loc: SourceLoc;
  entries: ListenerEntry[];
}
