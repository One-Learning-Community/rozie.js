/**
 * readme-type-cell.mjs — the ONE shared helper every
 * `packages/ui/<family>/scripts/readme.mjs` uses to print a TypeScript type
 * into a Markdown TABLE cell (typed-surface P1, final fix wave M1).
 *
 * A printed type can span several lines (object literal types) and contain
 * `|` (unions). Either one breaks a GFM table row: a newline ends the row, and
 * an unescaped `|` — even inside a code span — splits the cell. This collapses
 * all whitespace runs to one space and escapes `|` as `\|`, then wraps the text
 * in a code span.
 */

/**
 * @param {string} typeText - the printed TS type (e.g. `printTSType(node)`)
 * @returns {string} a single-line Markdown code span safe inside a table cell
 */
export function typeCodeCell(typeText) {
  const oneLine = String(typeText).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  return `\`${oneLine}\``;
}
