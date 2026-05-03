/**
 * emitStyle — Plan 04-05 Task 1 (React target).
 *
 * Re-stringifies the IR's StyleSection (split into scopedRules vs rootRules
 * by Phase 1's parseStyle / Phase 2's lowerStyles) into TWO CSS strings
 * keyed by sibling-file routing for the React target:
 *
 *   - moduleCss → consumer-side imported as `import styles from './Foo.module.css'`
 *   - globalCss → consumer-side imported as `import './Foo.global.css'` for side effect
 *
 * Mirrors Phase 3's `packages/targets/vue/src/emit/emitStyle.ts` algorithm
 * verbatim — same StyleRule slice-by-loc strategy. Only the output naming
 * differs (`scoped`/`global` → `moduleCss`/`globalCss`) to align with the
 * D-67 emitReact result shape.
 *
 * Wave 0 finding (Plan 03's Wave 0 / RESEARCH A5): the IR's StyleSection
 * does NOT carry the postcss AST or raw cssText — only `StyleRule` references
 * with byte offsets into the ORIGINAL `.rozie` source. We accept the source
 * text as a parameter and slice each rule by `loc.start..loc.end`. The slice
 * is byte-identical to the original CSS rule body (preserves Risk 5
 * trust-erosion floor — comments, formatting, whitespace survive verbatim).
 *
 * Note: CSS class hashing happens at Vite bundle time (CSS Modules pipeline),
 * NOT here. This emitter outputs UN-hashed class names. The `@rozie/unplugin`
 * React branch routes the synthetic `Foo.rozie.module.css` virtual id back to
 * this emitter's `moduleCss` output; Vite then detects the `.module.css`
 * extension and applies its hashing pass naturally.
 *
 * Pitfall 6 v1 acceptable simplification: nested `@media (...) { :root {} }`
 * is NOT lifted to global because Phase 1's parseStyle only flags top-level
 * rules with `selector === ':root'` as `isRootEscape: true`. None of the 5
 * reference examples exercise nested :root.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitStyleResult {
  /** CSS body for the sibling `.module.css` file (D-53). Empty string when no scoped rules. */
  moduleCss: string;
  /** CSS body for the sibling `.global.css` file (D-54), or null when no `:root` rules. */
  globalCss: string | null;
  diagnostics: Diagnostic[];
}

/**
 * Re-stringify a StyleSection into React-target sibling CSS strings.
 *
 * @param styles  — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source  — original .rozie source text. Required when scopedRules or
 *                  rootRules are non-empty (used to slice each rule's body
 *                  by absolute loc.start..loc.end). Empty StyleSection
 *                  accepts any source value (including empty string).
 */
export function emitStyle(styles: StyleSection, source: string): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];

  const moduleCss = stringifyRules(scopedRules, source);
  const globalCss = rootRules.length > 0 ? stringifyRules(rootRules, source) : null;

  return { moduleCss, globalCss, diagnostics };
}

/**
 * Slice each rule's bytes from the original .rozie source and concatenate
 * with single-newline separators. Each rule's loc covers `selector { body }`
 * verbatim; we preserve that exactly so authored CSS comments and formatting
 * survive (Risk 5 trust-erosion floor).
 *
 * Returns empty string when `rules` is empty.
 */
function stringifyRules(rules: StyleRule[], source: string): string {
  if (rules.length === 0) return '';
  const parts: string[] = [];
  for (const rule of rules) {
    const slice = source.slice(rule.loc.start, rule.loc.end);
    parts.push(slice);
  }
  return parts.join('\n');
}
