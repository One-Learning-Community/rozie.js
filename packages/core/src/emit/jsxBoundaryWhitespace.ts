/**
 * Shared JSX whitespace-parity helper for the two JSX-emitting targets
 * (React + Solid). Quick task 260709-f7q.
 *
 * ## The divergence
 *
 * The HTML-templating targets (Vue/Svelte/Angular/Lit) emit author text into an
 * HTML template context. For a text node that carries CONTENT, a trailing/leading
 * whitespace run is condensed to ONE significant space (Vue/Angular `condense`,
 * Svelte + browser `white-space: normal`). A component authored as
 *
 * ```
 * <label>mode
 *   <select>…</select></label>
 * ```
 *
 * therefore renders `mode <select>` (with a space) on all five non-JSX targets.
 *
 * JSX is different. Babel's `cleanJSXElementLiteralChild` STRIPS any leading or
 * trailing whitespace run of a JSX text child that contains a newline. So the
 * same `"mode\n  "` text child emits as `mode` on React/Solid — the space
 * vanishes, breaking cross-framework parity.
 *
 * ## The fix (this function)
 *
 * Restore the boundary space JSX would strip, as an explicit `{" "}` JSX child —
 * but only where a space is genuinely due, matching what the other targets emit:
 *
 *   - Only for a CONTENT-bearing text node. A WHITESPACE-ONLY node between tags
 *     is layout formatting: the project-wide rule (Svelte `isDroppableWhitespace`,
 *     Vue/Angular `condense`, and JSX itself) DROPS it when it contains a newline
 *     and keeps a lone newline-free space. JSX already does exactly that to a
 *     whitespace-only child verbatim, so such nodes are passed through untouched —
 *     never widened to `{" "}` (which would add a space no other target renders).
 *   - Only at a boundary with a RENDERED SIBLING (`hasPrev` / `hasNext`). At the
 *     parent's content edge HTML trims leading/trailing whitespace too.
 *   - Only when the boundary run contains a NEWLINE — exactly the case JSX strips.
 *     A plain single-line whitespace run is preserved by JSX verbatim and already
 *     matches the other targets, so it is left byte-identical (no churn).
 *
 * Internal whitespace is deliberately NOT touched: JSX collapses internal newline
 * runs to a single space at build time (matching HTML), and rewriting it would
 * both churn every multi-line text node and corrupt spliced-JSX text that some
 * emitters hand through as a synthetic static-text node (the r-match host-element
 * ladder). The transform is a no-op for any node without newline-bearing boundary
 * whitespace adjacent to a sibling.
 *
 * @param text     Raw static-text content (`TemplateStaticTextIR.text`).
 * @param hasPrev  True when a rendered sibling precedes this node in its parent.
 * @param hasNext  True when a rendered sibling follows this node in its parent.
 * @returns The JSX child string (verbatim when no boundary space is due).
 */
export function jsxBoundaryText(text: string, hasPrev: boolean, hasNext: boolean): string {
  const leadingWs = /^\s+/.exec(text)?.[0] ?? '';

  // Whitespace-only node (e.g. the `\n  ` between two sibling elements): layout
  // formatting. Pass through verbatim — JSX strips it when it holds a newline
  // (matching the drop rule the other five targets apply) and keeps a lone space
  // otherwise. Never widened to `{" "}`.
  if (leadingWs.length === text.length) return text;

  const trailingWs = /\s+$/.exec(text)?.[0] ?? '';
  const core = text.slice(leadingWs.length, text.length - trailingWs.length);
  const lead = hasPrev && leadingWs.includes('\n') ? '{" "}' : leadingWs;
  const trail = hasNext && trailingWs.includes('\n') ? '{" "}' : trailingWs;
  return lead + core + trail;
}
