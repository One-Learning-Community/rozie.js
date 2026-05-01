/**
 * Shared helper for Babel-driven parsers (parseProps, parseData, parseScript,
 * parseListeners). Centralizes the Pitfall 2 mitigation: the three Babel
 * position options (`startIndex`, `startLine`, `startColumn`) MUST always be
 * passed together — never pass `startLine`/`startColumn` without
 * `startIndex` or Babel will compute a wrong byte offset for inner nodes.
 *
 * Also exposes `babelLocToRozieLoc` (Pitfall 5 mitigation): convert a Babel
 * SourceLocation (with `line`/`column`/`index`) into a Rozie `SourceLoc`
 * (byte offsets only). Never copy Babel's `loc` object whole into Rozie AST
 * nodes — its shape will silently change between major versions.
 */
import { offsetToLineCol } from '../diagnostics/offsetToLineCol.js';
import type { SourceLoc } from '../ast/types.js';

export interface BabelParserPosition {
  startIndex: number;
  startLine: number;
  startColumn: number;
}

/**
 * Compute the three Babel parser position options together.
 *
 * @param source - the full .rozie source string
 * @param contentLoc - the byte span of the block content within `source`
 * @returns `{ startIndex, startLine, startColumn }` ready to spread into
 *          `parse()` / `parseExpression()` options
 */
export function parserPositionFor(
  source: string,
  contentLoc: SourceLoc,
): BabelParserPosition {
  const { line, column } = offsetToLineCol(source, contentLoc.start);
  return {
    startIndex: contentLoc.start,
    startLine: line,
    startColumn: column,
  };
}

/**
 * Convert a Babel SourceLocation (with `loc.start.index` / `loc.end.index`
 * absolute byte offsets — populated when `startIndex` is passed at parse
 * time) into a Rozie SourceLoc. Falls back to `node.start`/`node.end` when
 * `loc` is missing (some Babel TS-emitted variants drop it on synthetic
 * nodes).
 */
export function babelLocToRozieLoc(node: {
  loc?: { start: { index?: number }; end: { index?: number } } | null;
  start?: number | null;
  end?: number | null;
}): SourceLoc {
  const start = node.loc?.start.index ?? node.start ?? 0;
  const end = node.loc?.end.index ?? node.end ?? 0;
  return { start, end };
}
