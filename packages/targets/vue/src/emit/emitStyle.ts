/**
 * emitStyle — Phase 3 Plan 05 Task 1.
 *
 * Re-stringifies the IR's StyleSection (split into scopedRules vs rootRules
 * by Phase 1's parseStyle / Phase 2's lowerStyles) into two CSS strings, one
 * for `<style scoped>` and one for the global `<style>` block (when :root
 * rules are present per D-38).
 *
 * Wave 0 verification finding (RESEARCH A5): Phase 1's lowerStyles populates
 * `StyleSection.scopedRules` and `StyleSection.rootRules` with `StyleRule`
 * objects (`{ selector, loc, isRootEscape }`) — NOT postcss `Rule` objects.
 * The IR does NOT carry the original `cssText`. Therefore we receive the
 * original `.rozie` source text via opts and SLICE each rule by its absolute
 * loc.start..loc.end.
 *
 * The slice is byte-identical to the original CSS rule body. This preserves
 * Risk 5 trust-erosion floor: comments, formatting, and whitespace inside
 * each rule survive verbatim. The :root extraction (Pitfall 6 / D-38) is
 * already done at parse time; emitStyle just re-glues the rules in their
 * Phase 1-assigned bucket order.
 *
 * Pitfall 6 v1 acceptable simplification: nested `@media (...) { :root {} }`
 * is NOT lifted to global because Phase 1's parseStyle only flags top-level
 * rules with `selector === ':root'` as `isRootEscape: true`. None of the 5
 * reference examples exercise nested :root — see Pitfall-6 documentation
 * test in emitStyle.test.ts.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitStyleResult {
  /** Body of the `<style scoped>` block — never null; empty string when no scoped rules. */
  scoped: string;
  /** Body of the global `<style>` block, or null when no :root rules were extracted. */
  global: string | null;
  diagnostics: Diagnostic[];
}

/**
 * Re-stringify a StyleSection.
 *
 * @param styles  — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source  — original .rozie source text. Required when scopedRules or
 *                  rootRules are non-empty (used to slice each rule's body
 *                  by absolute loc.start..loc.end). Empty StyleSection accepts
 *                  any source value (including empty string).
 */
export function emitStyle(styles: StyleSection, source: string): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];

  const scoped = stringifyRules(scopedRules, source);
  const global = rootRules.length > 0 ? stringifyRules(rootRules, source) : null;

  return { scoped, global, diagnostics };
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
