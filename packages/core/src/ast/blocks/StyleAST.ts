/**
 * `<style>` block AST. Always-scoped per PROJECT.md key decisions; `:root { }`
 * is the unscoped escape hatch. Mixed `:root, .other { }` selectors are rejected
 * at parse time (ROZ081) per RESEARCH.md Pitfall 6.
 *
 * @experimental — shape may change before v1.0
 */
import type { SourceLoc } from '../types.js';

export interface StyleRule {
  /**
   * Discriminator. Absent (or `'rule'`) for a plain selector rule — today's
   * behavior, backward-compatible so existing rules need no migration.
   * `'portal-block'` for an `@portal NAME { ... }` at-rule block (Spike 004):
   * the block's inner selectors live in `children`, and `portalName` carries
   * the at-rule prelude argument.
   * `'root-block'` (Phase 34) for the engine-DOM escape hatch — a
   * `:root { .sel { ... } }` block whose NESTED selector rules live in
   * `children`, flattened bare (NO `:root` wrapper, NO scope attr). The pure
   * `:root` rule that carries any flat custom-property declarations is emitted
   * SEPARATELY through the unchanged `isRootEscape` path; the `root-block`
   * carries only the nested selector rules. Routed to `engineRules` at lowering.
   */
  kind?: 'rule' | 'portal-block' | 'root-block';
  /**
   * Raw selector text. For a plain rule this is the postcss selector verbatim
   * (including commas/whitespace). For a `portal-block` this is the at-rule
   * prelude verbatim (e.g. `@portal item`).
   */
  selector: string;
  /** Byte span of the rule (selector + braces + body), absolute offsets. */
  loc: SourceLoc;
  /** True if this rule's selector list contains exactly `:root` (escape hatch — emit unscoped). */
  isRootEscape: boolean;
  /** Set only when `kind === 'portal-block'` — the `@portal <NAME>` argument. */
  portalName?: string;
  /**
   * Set when `kind === 'portal-block'` (Spike 004) OR `kind === 'root-block'`
   * (Phase 34) — the inner selectors of the block, flattened to bottom-level
   * rules. For `portal-block` these are the `@portal NAME { ... }` inner
   * selectors; for `root-block` these are the `:root { ... }` NESTED selector
   * rules flattened bare (NO `:root` wrapper). Each child's `loc` is the
   * absolute span of its own `selector { body }`.
   */
  children?: StyleRule[];
}

export interface StyleAST {
  type: 'StyleAST';
  loc: SourceLoc;
  /**
   * The CSS source handed to the PostCSS scoping pass. For a plain `<style>`
   * block this is the raw style body verbatim. For `<style lang="scss">`
   * (Phase 10) this is the COMPILED plain CSS — `parseStyle` runs dart-sass
   * before `postcss.parse`, so nesting/`$variables`/mixins are already
   * flattened. The postcss AST itself is held internally by parseStyle and not
   * exposed in v1.
   */
  cssText: string;
  /** All top-level rules with :root-escape flagging. */
  rules: StyleRule[];
  /**
   * Resolved `lang="..."` attribute from the source `<style>` opening tag.
   * Phase 9 introduced this value via the generic SFC-block `lang=` substrate.
   * Phase 10 consumes `'scss'` — `parseStyle` performs compile-time SCSS-to-CSS
   * preprocessing and `cssText` holds the compiled plain CSS. `'css'` or absent
   * is the plain-CSS path (today's default — byte-identical). Resolved
   * case-insensitively and trimmed. Undefined (key omitted under
   * `exactOptionalPropertyTypes`) for a plain `<style>` block.
   */
  lang?: string;
}
