/**
 * emitStyle — Solid target (P2 complete implementation).
 *
 * Pitfall 3 (Phase 06.3 RESEARCH.md): Solid has no CSS Modules pipeline
 * analogous to Vite's React CSS Modules. Instead, styles are emitted INLINE
 * as a `<style>` JSX element in the component's returned tree.
 *
 * Output:
 *   - Scoped rules → `<style>{scopedCss}</style>` (component-scoped styles).
 *     When a `scopeHash` is supplied, the rules are run through `scopeCss`
 *     first so every selector gets `[data-rozie-s-<hash>]` appended. The
 *     matching attribute is injected on every host element by
 *     `emitTemplateNode`. This delivers Vue/Svelte/Angular-equivalent
 *     per-component CSS isolation — without it, bare element selectors
 *     (`button { ... }`) would leak globally.
 *   - `:root { }` rules → `<style>{globalCss}</style>` (global escape-hatch
 *     rules, unscoped — same `:root` semantics as Svelte's `:global(:root)`).
 *   - `styleJsx`: JSX fragment containing the <style> element(s), or empty
 *     string when no styles exist.
 *
 * The returned `styleJsx` is inserted adjacent to the template JSX by the
 * shell's `buildShell()`, wrapped in a `<>...</>` fragment containing the
 * `<style>` block before the component template.
 *
 * CSS Rule Serialization:
 *   Same byte-slice approach as the React/Vue targets — slices each rule's
 *   bytes from the original .rozie source by absolute `loc.start..loc.end`.
 *   The slice goes through `scopeCss` when a hash is supplied (selector
 *   rewriting only — body bytes are preserved).
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { scopeCss } from './scopeCss.js';

export interface EmitStyleResult {
  /**
   * JSX fragment string (or empty string when no styles). Contains one or
   * two <style>{css}</style> elements wrapped in a React Fragment `<>...</>`.
   *
   * When non-empty, the shell wraps the entire component return in a fragment
   * that prepends this styleJsx before the user template JSX.
   */
  styleJsx: string;
  diagnostics: Diagnostic[];
}

/**
 * Slice each rule from the original .rozie source and join with newlines.
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

/**
 * Escape CSS text for inclusion in a JS template literal:
 *   - Backslash → \\
 *   - Backtick → \`
 *   - ${ → \${
 */
function escapeCssForTemplateLiteral(css: string): string {
  return css
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/**
 * Re-stringify a StyleSection into Solid-target inline <style> JSX.
 *
 * @param styles     — Phase 2 IR StyleSection (split by lowerStyles).
 * @param source     — original .rozie source text (for byte-slice serialization).
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
  const scopedCss = scopeHash.length > 0 && rawScopedCss.length > 0
    ? scopeCss(rawScopedCss, scopeHash)
    : rawScopedCss;
  const globalCss = rootRules.length > 0 ? stringifyRules(rootRules, source) : null;

  if (!scopedCss && !globalCss) {
    return { styleJsx: '', diagnostics };
  }

  const styleParts: string[] = [];

  if (scopedCss) {
    const escaped = escapeCssForTemplateLiteral(scopedCss);
    styleParts.push(`<style>{\`${escaped}\`}</style>`);
  }
  if (globalCss) {
    const escaped = escapeCssForTemplateLiteral(globalCss);
    styleParts.push(`<style>{\`${escaped}\`}</style>`);
  }

  const styleJsx = styleParts.join('\n');

  return { styleJsx, diagnostics };
}
