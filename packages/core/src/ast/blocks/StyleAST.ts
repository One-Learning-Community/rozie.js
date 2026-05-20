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
   */
  kind?: 'rule' | 'portal-block';
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
   * Set only when `kind === 'portal-block'` — the inner selectors of the
   * `@portal NAME { ... }` block, flattened to bottom-level rules. Each
   * child's `loc` is the absolute span of its own `selector { body }`.
   */
  children?: StyleRule[];
}

export interface StyleAST {
  type: 'StyleAST';
  loc: SourceLoc;
  /** Raw CSS source (unmodified — postcss AST is held internally by parseStyle and not exposed in v1). */
  cssText: string;
  /** All top-level rules with :root-escape flagging. */
  rules: StyleRule[];
}
