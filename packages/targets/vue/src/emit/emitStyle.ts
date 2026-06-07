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
import { rewriteAllPortalBlocks } from '../../../../core/src/codegen/portalCss.js';

/**
 * Quick task 260520-bu7 — additional repeats of the portal scope attribute
 * selector for cross-target CSS-specificity compensation.
 *
 * Vue: 1. A competing consumer scoped-CSS rule gets `[data-v-<hash>]` appended
 * by Vue's `<style scoped>` compiler — one extra `(0,1,0)` specificity unit.
 * Repeating the `@portal` scope attribute once matches that delta so the
 * `@portal`-vs-consumer cascade resolves identically to the bare-attr targets.
 */
const PORTAL_SCOPE_REPEAT = 1;

export interface EmitStyleResult {
  /** Body of the `<style scoped>` block — never null; empty string when no scoped rules. */
  scoped: string;
  /** Body of the global `<style>` block, or null when no :root rules were extracted. */
  global: string | null;
  /**
   * Spike 004 — body of a SECOND, UNSCOPED `<style>` block emitted from
   * `@portal NAME { ... }` blocks. Null when the component has no @portal
   * blocks. Vue's `<style scoped>` auto-injects `[data-v-<hash>]` onto
   * template elements only; engine-created DOM has no such attribute, so the
   * @portal rules must live in an unscoped block where the
   * `[data-rozie-portal-<NAME>="<hash>"]` attribute is the sole scoping.
   */
  portal: string | null;
  diagnostics: Diagnostic[];
}

/**
 * Re-stringify a StyleSection.
 *
 * @param styles     — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source     — original .rozie source text. Required when scopedRules or
 *                     rootRules are non-empty (used to slice each rule's body
 *                     by absolute loc.start..loc.end). Empty StyleSection accepts
 *                     any source value (including empty string).
 * @param scopeHash  — Spike 004 per-component scope hash. Reused verbatim for
 *                     the `@portal` attribute selector. Empty string (default)
 *                     when the caller has no @portal blocks to scope.
 */
export function emitStyle(
  styles: StyleSection,
  source: string,
  scopeHash: string = '',
): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];
  const portalRules = (styles.portalRules ?? []) as StyleRule[];
  // Phase 34 — engine-DOM escape hatch. Bare `root-block` children append into
  // the unscoped second `<style>` block (no `scoped` attr) verbatim — never
  // through a scope rewrite. D-04/D-06.
  const engineRules = (styles.engineRules ?? []) as StyleRule[];
  const engineChildren = engineRules.flatMap((r) => r.children ?? []);

  const scoped = stringifyRules(scopedRules, source);
  const rootCss = rootRules.length > 0 ? stringifyRules(rootRules, source) : '';
  const engineCss = stringifyRules(engineChildren, source);
  const globalParts = [rootCss, engineCss].filter((s) => s.length > 0);
  const global = globalParts.length > 0 ? globalParts.join('\n') : null;

  const portalCss = rewriteAllPortalBlocks(portalRules, source, scopeHash, PORTAL_SCOPE_REPEAT);
  const portal = portalCss.length > 0 ? portalCss : null;

  return { scoped, global, portal, diagnostics };
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
    // Phase 17 (SPEC-R1 non-Lit arm / SPEC-R4a): `::part(name)` is a
    // cross-shadow-DOM mechanism that only has meaning on Lit. Vue byte-slices
    // each rule verbatim into `<style scoped>`, where a `::part` selector would
    // be inert/broken CSS. Skip the rule entirely so it is omitted from the
    // joined output (no stray empty line). Silent no-op — no diagnostic.
    // Independent of the `:deep` byte-slice path (SPEC-R5). Match only the
    // selector portion (before the first `{`) so a `::part(` appearing in a
    // declaration value or comment cannot false-drop an unrelated rule.
    if (slice.split('{', 1)[0]!.includes('::part(')) continue;
    parts.push(slice);
  }
  return parts.join('\n');
}
