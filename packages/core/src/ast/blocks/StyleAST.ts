/**
 * `<style>` block AST. Always-scoped per PROJECT.md key decisions; `:root { }`
 * is the unscoped escape hatch. Mixed `:root, .other { }` selectors are rejected
 * at parse time (ROZ081) per RESEARCH.md Pitfall 6.
 *
 * @experimental — shape may change before v1.0
 */
import type { SourceLoc } from '../types.js';

export interface StyleRule {
  /** Raw selector text from postcss (preserved verbatim, including commas/whitespace). */
  selector: string;
  /** Byte span of the rule (selector + braces + body), absolute offsets. */
  loc: SourceLoc;
  /** True if this rule's selector list contains exactly `:root` (escape hatch — emit unscoped). */
  isRootEscape: boolean;
}

export interface StyleAST {
  type: 'StyleAST';
  loc: SourceLoc;
  /** Raw CSS source (unmodified — postcss AST is held internally by parseStyle and not exposed in v1). */
  cssText: string;
  /** All top-level rules with :root-escape flagging. */
  rules: StyleRule[];
}
