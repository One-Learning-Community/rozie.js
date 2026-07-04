/**
 * Shared Babel-node -> SourceLoc helper (Part 1 of the partial-origin
 * diagnostic-attribution fix).
 *
 * Every script/semantic call site that builds a `SourceLoc` from a Babel
 * node should go through this helper instead of hand-rolling
 * `{ start: node.start ?? 0, end: node.end ?? 0 }` — inlineScriptPartials'
 * R7 invariant guarantees that a spliced node's `loc.filename` is the
 * partial's absolute path (untouched by splicing/emit-line normalization),
 * so capturing it here lets diagnostics attribute to the true origin file.
 *
 * Respects `exactOptionalPropertyTypes`: the `filename` key is only added
 * when `node.loc?.filename` is a non-empty string — never assigned
 * `undefined`. Pure, tiny, and never throws.
 */
import type { SourceLoc } from '../ast/types.js';

export function locFromBabel(node: {
  start?: number | null;
  end?: number | null;
  loc?: { filename?: string } | null;
}): SourceLoc {
  const loc: SourceLoc = { start: node.start ?? 0, end: node.end ?? 0 };
  const filename = node.loc?.filename;
  if (typeof filename === 'string' && filename.length > 0) {
    loc.filename = filename;
  }
  return loc;
}
