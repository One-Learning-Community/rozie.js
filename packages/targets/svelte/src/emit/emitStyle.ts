/**
 * emitStyle — Phase 5 Plan 02a Task 3 + pre-Phase-16 cleanup Item 2.
 *
 * Re-stringifies the IR's StyleSection into ONE Svelte 5 `<style>` block.
 *
 * The original Phase-5 emit handed scoped rules to Svelte's native class-hash
 * compiler verbatim. That mechanism only stamps its `.svelte-<hash>` class on
 * elements that lexically live in the same SFC compile unit, breaking any
 * consumer-side `class="foo"` rule that targets a child-component's root
 * element (the child's root carries the CHILD's hash, not the consumer's).
 * Item 2 of the pre-Phase-16 cleanup switches Svelte onto Rozie's own
 * `data-rozie-s-*` scoping mechanism (mirroring react/solid/lit/angular's
 * approach to the same problem), keeping the SFC-isolation guarantee while
 * letting consumer-side class-on-component rules propagate cleanly through
 * the auto-fallthrough machinery. The selector rewrite lives in
 * `./scopeCss.ts`; this module wraps the rewritten source in Svelte 5's
 * `:global { ... }` block so Svelte's compiler leaves the rewritten selectors
 * alone (no `.svelte-<hash>` appending). The `:global { }` block-form
 * opt-out is already the established pattern here for `@portal` blocks; the
 * Item-2 switch generalises it to all scoped rules.
 *
 * Per the new pipeline:
 *   - Scoped rules (StyleSection.scopedRules) → rewritten via `scopeCss` to
 *     append `[data-rozie-s-<hash>]` to every compound selector, then wrapped
 *     in `:global { ... }` to opt out of Svelte's native scoper.
 *   - Root rules (StyleSection.rootRules) — `:root { ... }` rules from
 *     Phase 1's parseStyle — wrap in `:global(:root) { ... }`. The
 *     `:global(...)` selector wrapper is Svelte's canonical idiom for "this
 *     rule should not be class-hashed." Unchanged from the Phase-5 emit.
 *   - @portal rules — already opt out via `:global { ... }`. Unchanged.
 *
 * Single `<style>` block (Svelte uses ONE block, unlike Vue's two-block
 * scoped+global split).
 *
 * Wave 0 finding: Phase 1's lowerStyles populates `StyleSection.scopedRules`
 * and `StyleSection.rootRules` with `StyleRule` objects (`{ selector, loc,
 * isRootEscape }`). The IR does NOT carry `cssText`; we receive the original
 * `.rozie` source via opts and SLICE each rule by its absolute loc.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { rewriteAllPortalBlocks } from '../../../../core/src/codegen/portalCss.js';
import { scopeCss } from './scopeCss.js';

/**
 * Quick task 260520-bu7 — additional repeats of the portal scope attribute
 * selector for cross-target CSS-specificity compensation.
 *
 * Pre-Item-2 (Phase-5 design): a competing consumer scoped-CSS rule got a
 * `.svelte-<hash>` scope class appended — one extra `(0,1,0)` specificity
 * unit — so the `@portal` scope attribute was repeated once to match.
 *
 * Post-Item-2 (kept at 1): scoped rules are now wrapped in `:global { ... }`
 * to opt out of Svelte's native scoper, but the `scopeCss` rewriter still
 * appends `[data-rozie-s-<hash>]` to every compound selector — same
 * `(0,1,0)` specificity unit, just under a different name. The portal
 * scope attribute repeat must therefore remain 1 to match. (Initial Item-2
 * implementation dropped this to 0 reasoning that "no more svelte-hash =
 * no more competing unit"; the regression surfaced on PortalListStyled ·
 * svelte where the `@portal item div { display: flex }` rule started
 * losing to the consumer's `.row` rule and broke a layout-dependent test.
 * Reverted in the same Item-2 follow-up.) VR matrix D-10 byte-identity is
 * still the empirical oracle.
 */
const PORTAL_SCOPE_REPEAT = 1;

export interface EmitStyleResult {
  /** Body of the single `<style>` block (joined scoped + :global(:root) + @portal rules). */
  block: string;
  diagnostics: Diagnostic[];
}

/**
 * Emit a Svelte 5 `<style>` body. Returns `{ block: '', diagnostics: [] }`
 * when the StyleSection is empty.
 *
 * Spike 004 — `@portal NAME { ... }` rules emit INSIDE this same `<style>`
 * block (Svelte allows only one top-level block), wrapped in Svelte 5's
 * `:global { ... }` block syntax. That disables Svelte's per-class
 * scope-hashing for the portal selectors — engine-created DOM has no
 * Svelte-hashed classes, so the `[data-rozie-portal-<NAME>="<hash>"]`
 * attribute is the sole scoping mechanism.
 *
 * @param styles     — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source     — original .rozie source text (used to slice each rule's body).
 * @param scopeHash  — Spike 004 per-component scope hash for the `@portal`
 *                     attribute selector. Empty string (default) when there
 *                     are no @portal blocks.
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

  const portalCss = rewriteAllPortalBlocks(portalRules, source, scopeHash, PORTAL_SCOPE_REPEAT);

  if (scopedRules.length === 0 && rootRules.length === 0 && portalCss.length === 0) {
    return { block: '', diagnostics };
  }

  const parts: string[] = [];

  if (scopedRules.length > 0) {
    // Item-2: rewrite selectors via `scopeCss` to append the per-component
    // `data-rozie-s-<hash>` attribute, then wrap in `:global { ... }` so
    // Svelte's compiler leaves them alone (no `.svelte-<hash>` class append).
    // When `scopeHash` is empty (caller did not thread one — degenerate
    // test-only paths) fall back to verbatim emit; the cross-SFC propagation
    // story is moot when there's no consumer either.
    const scopedRaw = stringifyRules(scopedRules, source);
    if (scopeHash.length > 0) {
      const rewritten = scopeCss(scopedRaw, scopeHash);
      const indented = rewritten
        .split('\n')
        .map((l) => (l.length > 0 ? `  ${l}` : l))
        .join('\n');
      parts.push(`:global {\n${indented}\n}`);
    } else {
      parts.push(scopedRaw);
    }
  }

  // :root rules wrap inside :global(:root) { ... }
  if (rootRules.length > 0) {
    const rootBodies = rootRules.map((r) => sliceRuleBody(r, source));
    parts.push(`:global(:root) {\n${rootBodies.join('\n')}\n}`);
  }

  // Spike 004 — @portal rules wrap inside a Svelte 5 `:global { ... }` block.
  if (portalCss.length > 0) {
    const indented = portalCss
      .split('\n')
      .map((l) => (l.length > 0 ? `  ${l}` : l))
      .join('\n');
    parts.push(`:global {\n${indented}\n}`);
  }

  return { block: parts.join('\n\n'), diagnostics };
}

/** Slice each rule's bytes from the original .rozie source (full rule). */
function stringifyRules(rules: StyleRule[], source: string): string {
  if (rules.length === 0) return '';
  return rules.map((r) => source.slice(r.loc.start, r.loc.end)).join('\n');
}

/**
 * Slice ONLY the body (between `{` and `}`) from a `:root` rule. Used when
 * wrapping the body in `:global(:root) { ... }`.
 *
 * Falls back to the full rule slice if the brace structure can't be found.
 */
function sliceRuleBody(rule: StyleRule, source: string): string {
  const full = source.slice(rule.loc.start, rule.loc.end);
  const openIdx = full.indexOf('{');
  const closeIdx = full.lastIndexOf('}');
  if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) {
    return full;
  }
  return full.slice(openIdx + 1, closeIdx).trim();
}
