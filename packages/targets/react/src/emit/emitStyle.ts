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
 * for byte-slice serialisation. Unlike Vue, the React target then runs the
 * scoped slice through `scopeCss` (component-scoped attribute rewriter) to
 * obtain Vue-equivalent component-scope semantics — Vite's CSS Modules
 * pipeline only hashes class names, so bare element selectors (`button { … }`)
 * would otherwise leak globally.
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
 * Note: CSS class hashing still happens at Vite bundle time (CSS Modules
 * pipeline); class-name tokens emitted here are un-hashed. The synthetic
 * `Foo.rozie.module.css` virtual id routed by `@rozie/unplugin` triggers
 * Vite's hashing pass on those class names. `scopeCss` adds an additional
 * attribute-selector layer that survives Vite's pipeline untouched.
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

  const rawScopedCss = stringifyRules(scopedRules, source);
  const moduleCss = scopeHash.length > 0 && rawScopedCss.length > 0
    ? scopeCss(rawScopedCss, scopeHash)
    : rawScopedCss;
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
