/**
 * emitStyle — Plan 04-05 Task 1 (React target).
 *
 * Re-stringifies the IR's StyleSection (split into scopedRules vs rootRules
 * by Phase 1's parseStyle / Phase 2's lowerStyles) into TWO CSS strings
 * keyed by sibling-file routing for the React target:
 *
 *   - moduleCss → consumer-side imported for side effect as `import './Foo.css'`
 *     (plain attribute-scoped stylesheet — NOT a CSS Module; Phase 25)
 *   - globalCss → consumer-side imported as `import './Foo.global.css'` for side effect
 *
 * Mirrors Phase 3's `packages/targets/vue/src/emit/emitStyle.ts` algorithm
 * for byte-slice serialisation. Like Vue, the React target then runs the
 * scoped slice through `scopeCss` (component-scoped attribute rewriter) to
 * obtain Vue-equivalent component-scope semantics: every selector gets a
 * `[data-rozie-s-<hash>]` attribute appended, so bare element selectors
 * (`button { … }`) are component-scoped and do not leak globally.
 *
 * Wave 0 finding (Plan 03's Wave 0 / RESEARCH A5): the IR's StyleSection
 * does NOT carry the postcss AST or raw cssText — only `StyleRule` references
 * with byte offsets into the ORIGINAL `.rozie` source. We accept the source
 * text as a parameter and slice each rule by `loc.start..loc.end`.
 *
 * Routing:
 *   - `scopedRules` → byte-sliced from source, then run through `scopeCss`
 *     so every selector gets `[data-rozie-s-<hash>]` appended. The matching
 *     attribute is injected on every host element by `emitTemplateNode`.
 *   - `rootRules` → byte-sliced unchanged. The `:root { ... }` escape hatch
 *     stays global, mirroring Svelte's `:global(:root)` and Angular's
 *     `::ng-deep :root` patterns.
 *
 * Note (Phase 25): class-name tokens emitted here are plain strings — there is
 * NO CSS-Modules hashing. `@rozie/unplugin` routes the scoped slice as a plain
 * `Foo.rozie.css` stylesheet; isolation comes solely from the
 * `[data-rozie-s-<hash>]` attribute selectors `scopeCss` appends (matching the
 * other five targets). React was de-CSS-Modules'd because the `.module.css`
 * routing was redundant with attribute scoping and broke webpack css-loader's
 * pure-selector rule on bare-element selectors.
 *
 * Pitfall 6 v1 acceptable simplification: nested `@media (...) { :root {} }`
 * is NOT lifted to global because Phase 1's parseStyle only flags top-level
 * rules with `selector === ':root'` as `isRootEscape: true`.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { scopeCss } from './scopeCss.js';
import { rewriteAllPortalBlocks } from '../../../../core/src/codegen/portalCss.js';

/**
 * Quick task 260520-bu7 — additional repeats of the portal scope attribute
 * selector for cross-target CSS-specificity compensation.
 *
 * React: 1. A competing consumer scoped-CSS rule is run through `scopeCss`,
 * which appends `[data-rozie-s-<hash>]` to every selector — one extra
 * `(0,1,0)` specificity unit (CSS Modules class-renaming is specificity-
 * neutral, but Rozie's own `scopeCss` confinement layer is NOT). Repeating
 * the `@portal` scope attribute once matches that delta so the
 * `@portal`-vs-consumer cascade resolves identically to every other target.
 *
 * (The plan's first-guess `0` assumed CSS-Modules-only scoping; the VR
 * matrix oracle in Task 2 corrected it once `scopeCss`'s consumer-rule
 * `[data-rozie-s-*]` append was accounted for.)
 */
const PORTAL_SCOPE_REPEAT = 1;

export interface EmitStyleResult {
  /** CSS body for the sibling plain `.css` file (D-53). Empty string when no scoped rules. */
  moduleCss: string;
  /** CSS body for the sibling `.global.css` file (D-54), or null when no `:root` rules. */
  globalCss: string | null;
  diagnostics: Diagnostic[];
}

/**
 * Re-stringify a StyleSection into React-target sibling CSS strings.
 *
 * @param styles     — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source     — original .rozie source text. Required when scopedRules or
 *                     rootRules are non-empty (used to slice each rule's body
 *                     by absolute loc.start..loc.end). Empty StyleSection
 *                     accepts any source value (including empty string).
 * @param scopeHash  — per-component scope token (8-char hex). When provided,
 *                     every scoped rule's selector list is rewritten to include
 *                     `[data-rozie-s-<scopeHash>]`. When omitted (empty), the
 *                     emitter falls back to the unscoped byte-slice — kept for
 *                     back-compat with old callers that don't thread a hash.
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

  const rawScopedCss = stringifyRules(scopedRules, source);
  const scopedModuleCss = scopeHash.length > 0 && rawScopedCss.length > 0
    ? scopeCss(rawScopedCss, scopeHash)
    : rawScopedCss;

  // Spike 004 — @portal rules emit into the SAME `.module.css` file but as
  // BARE attribute selectors. They must NOT run through `scopeCss` (which
  // would append `[data-rozie-s-*]`) — the `[data-rozie-portal-<NAME>]`
  // attribute is their sole scoping. CSS Modules only hashes class names, so
  // bare attribute selectors survive the Vite pipeline untouched.
  const portalCss = rewriteAllPortalBlocks(portalRules, source, scopeHash, PORTAL_SCOPE_REPEAT);
  const moduleCss = portalCss.length > 0
    ? (scopedModuleCss.length > 0 ? `${scopedModuleCss}\n${portalCss}` : portalCss)
    : scopedModuleCss;

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
