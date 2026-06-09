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
  /**
   * Resolved `lang="..."` attribute on the block's opening tag, if present.
   * Phase 9: the generic SFC-block `lang=` substrate. `<script lang="ts">`
   * consumes it this phase; `<style lang="scss">` reuses it in a later phase.
   * Absent (key omitted under `exactOptionalPropertyTypes`) when the opening
   * tag carried no `lang` attribute.
   */
  lang?: string;
}

export interface BlockMap {
  rozie?: {
    name: string;
    /**
     * Phase 14 — the `inherit-attrs` boolean attribute on the `<rozie>` tag.
     * `false` opts the component out of cross-framework attribute fallthrough.
     * Absent (key omitted under `exactOptionalPropertyTypes`) when the tag
     * carried no `inherit-attrs` attribute — treated as `true` downstream.
     */
    inheritAttrs?: boolean;
    /**
     * Phase 15 — the `inherit-listeners` boolean attribute on the `<rozie>`
     * tag. `false` opts the component out of cross-framework LISTENER
     * fallthrough. INDEPENDENT of `inheritAttrs`. Absent (key omitted under
     * `exactOptionalPropertyTypes`) when the tag carried no
     * `inherit-listeners` attribute — treated as `true` downstream.
     */
    inheritListeners?: boolean;
    /**
     * Phase 26 (D-12) — the `safe-interpolation` boolean attribute on the
     * `<rozie>` tag. `false` opts the component out of the cross-target
     * `rozieDisplay` wrap (raw per-target interpolation emit). The local
     * envelope override: precedence is envelope attr > global
     * `safeInterpolation` compiler option > default `true`.
     *
     * Forward-declared HERE so Plan 03's `annotateDisplayWrap` wiring in
     * `lowerToIR` can read `ast.blocks.rozie?.safeInterpolation` and compile
     * before Plan 06 (the splitter envelope-attribute capture) lands. Until
     * Plan 06 populates it, the splitter never sets this key, so it resolves to
     * `undefined` and the global/default precedence applies. Absent (key
     * omitted under `exactOptionalPropertyTypes`) when the tag carried no
     * `safe-interpolation` attribute.
     */
    safeInterpolation?: boolean;
    /**
     * Item 3 (engine-CSS shadow bridge) — the `adopt-document-styles` boolean
     * attribute on the `<rozie>` tag. When present, a SHADOW-DOM target (Lit)
     * clones the document's same-origin stylesheets into the component's
     * shadow root at first render, so global CSS the consumer imported (an
     * engine's stylesheet, e.g. `cropperjs/dist/cropper.css` /
     * `maplibre-gl/dist/maplibre-gl.css`) reaches the engine-created DOM that
     * lives INSIDE the shadow boundary. NO-OP on the 5 light-DOM targets
     * (React/Vue/Svelte/Angular/Solid) — there the engine DOM is in light DOM
     * and the global CSS already applies. Absent (key omitted under
     * `exactOptionalPropertyTypes`) when the tag carried no attribute — treated
     * as `false` downstream.
     */
    adoptDocumentStyles?: boolean;
    loc: SourceLoc;
  };
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
