/**
 * Byte-offset source location. line/column are computed lazily from the
 * source string at diagnostic-render time (D-11). Always populate both
 * fields from the original .rozie file's absolute byte offsets.
 */
export interface SourceLoc {
  start: number;
  end: number;
}

/**
 * Output of the SFC block splitter (Plan 02). Each block carries the raw
 * content text, the absolute byte span of the content (between '>' of
 * opening tag and '<' of closing tag), and the absolute byte span of the
 * full block including its tags.
 */
export interface BlockEntry {
  content: string;
  contentLoc: SourceLoc;
  loc: SourceLoc;
}

export interface BlockMap {
  rozie?: { name: string; loc: SourceLoc };
  props?: BlockEntry;
  data?: BlockEntry;
  script?: BlockEntry;
  listeners?: BlockEntry;
  template?: BlockEntry;
  style?: BlockEntry;
  /** Phase 06.2 P1 — `<components>` block (component composition). */
  components?: BlockEntry;
}

// Plan 03 lands the concrete per-block AST shapes; we re-export them here so
// the RozieAST wrapper resolves to the real types without circular blockers.
export type { PropsAST } from './blocks/PropsAST.js';
export type { DataAST } from './blocks/DataAST.js';
export type { ScriptAST } from './blocks/ScriptAST.js';
export type { ListenersAST, ListenerEntry } from './blocks/ListenersAST.js';
export type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
  TemplateText,
  TemplateInterpolation,
} from './blocks/TemplateAST.js';
export type { StyleAST, StyleRule } from './blocks/StyleAST.js';
export type { ComponentsAST } from './blocks/ComponentsAST.js';

// Local references for the RozieAST wrapper field types.
import type { PropsAST } from './blocks/PropsAST.js';
import type { DataAST } from './blocks/DataAST.js';
import type { ScriptAST } from './blocks/ScriptAST.js';
import type { ListenersAST } from './blocks/ListenersAST.js';
import type { TemplateAST } from './blocks/TemplateAST.js';
import type { StyleAST } from './blocks/StyleAST.js';
import type { ComponentsAST } from './blocks/ComponentsAST.js';

/**
 * Top-level RozieAST shape. Per-block AST shapes (PropsAST, ScriptAST, etc.)
 * are filled in by Plan 03; Plan 04 weaves them into a populated `RozieAST`
 * via the central `parse()` coordinator.
 *
 * @experimental — shape may change before v1.0
 */
export interface RozieAST {
  type: 'RozieAST';
  name: string;
  loc: SourceLoc;
  props: PropsAST | null;
  data: DataAST | null;
  script: ScriptAST | null;
  listeners: ListenersAST | null;
  template: TemplateAST | null;
  style: StyleAST | null;
  /**
   * Phase 06.2 P1 — parsed `<components>` block (component composition).
   * `null` when the block is absent; populated when a `<components>` block
   * was parsed successfully (D-114/D-115).
   */
  components: ComponentsAST | null;
  /**
   * Block byte offsets from splitBlocks() — required by per-target buildShell()
   * to anchor MagicString at the original `.rozie` source text (Phase 06.1 P1).
   * Carries the same shape returned by splitBlocks() (a BlockMap with optional
   * per-block entries; envelope at `rozie`). Phase 06.1 Plan 01.
   */
  blocks: BlockMap;
}
