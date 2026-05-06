/**
 * emitStyle — Phase 5 Plan 02a Task 3.
 *
 * Re-stringifies the IR's StyleSection into ONE Svelte 5 `<style>` block.
 * Per RESEARCH Pattern 5:
 *
 *   - Scoped rules (StyleSection.scopedRules) → emitted verbatim. Svelte's
 *     compiler automatically class-hashes selectors at compile time; no
 *     `scoped` attribute needed.
 *   - Root rules (StyleSection.rootRules) — `:root { ... }` rules from
 *     Phase 1's parseStyle — wrap in `:global(:root) { ... }`. The
 *     `:global(...)` selector wrapper is Svelte's canonical idiom for "this
 *     rule should not be class-hashed."
 *
 * Single `<style>` block (Svelte uses ONE block, unlike Vue's two-block
 * scoped+global split). The :root rules inline inside the same block, just
 * wrapped with `:global(:root)`.
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

export interface EmitStyleResult {
  /** Body of the single `<style>` block (joined scoped + :global(:root) rules). */
  block: string;
  diagnostics: Diagnostic[];
}

/**
 * Emit a Svelte 5 `<style>` body. Returns `{ block: '', diagnostics: [] }`
 * when the StyleSection is empty.
 *
 * @param styles  — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source  — original .rozie source text (used to slice each rule's body).
 */
export function emitStyle(styles: StyleSection, source: string): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];

  if (scopedRules.length === 0 && rootRules.length === 0) {
    return { block: '', diagnostics };
  }

  const parts: string[] = [];

  if (scopedRules.length > 0) {
    parts.push(stringifyRules(scopedRules, source));
  }

  // :root rules wrap inside :global(:root) { ... }
  if (rootRules.length > 0) {
    const rootBodies = rootRules.map((r) => sliceRuleBody(r, source));
    parts.push(`:global(:root) {\n${rootBodies.join('\n')}\n}`);
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
