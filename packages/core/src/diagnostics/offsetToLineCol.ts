/**
 * Convert a byte offset within `source` to {line, column} (1-indexed line,
 * 0-indexed column). The single canonical helper used by every diagnostic
 * renderer in the toolchain (D-11): byte offsets are the primary representation
 * on AST nodes; line/column is computed lazily here at render time so we never
 * double-bookkeep during parsing.
 *
 * Phase 1 scale: O(offset) per call, well under 1ms for files <1MB.
 * If Phase 2 surfaces hot paths, cache lineStarts: number[] per source string
 * and binary-search.
 *
 * @example
 *   offsetToLineCol("ab\ncd", 3) // → { line: 2, column: 0 }
 */
export function offsetToLineCol(
  source: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 10 /* '\n' */) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: offset - lastNewline - 1 };
}
