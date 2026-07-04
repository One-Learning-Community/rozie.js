/**
 * Backfills `filename` on diagnostics that don't already carry one.
 *
 * Phase 1 (parser) diagnostics get `filename` threaded explicitly through
 * each sub-parser call. Phase 2+ (semantic/IR/validator) diagnostics are
 * built deep inside `analyzeAST`/`lowerToIR`/the post-lowering validators
 * with no knowledge of which host `.rozie` file is being compiled, so
 * `filename` is `undefined` on them by construction. Every pipeline
 * chokepoint (`lowerToIR`, `compile()`, each `@rozie/unplugin` per-target
 * pipeline) stamps the host filename in here once it is known.
 *
 * Never overwrites an already-set `filename` — a diagnostic that already
 * points at a more specific origin keeps that attribution.
 *
 * Prefers a loc-carried partial origin over the host fallback: when
 * `d.filename` is undefined, this sets `d.filename = d.loc.filename ?? filename`
 * — i.e. if the offending Babel node's loc carries a partial's absolute path
 * (inlineScriptPartials R7), that wins over the host `filename` argument even
 * when a host filename IS available. Applies `d.loc.filename` even when the
 * host `filename` arg is `undefined` (does not early-return before checking
 * `d.loc.filename`) — only leaves `d.filename` unset when BOTH are absent.
 *
 * Mutates `diagnostics` in place and returns the same array for call-site
 * chaining convenience.
 */
import type { Diagnostic } from './Diagnostic.js';

export function stampMissingFilename<T extends Diagnostic>(
  diagnostics: T[],
  filename: string | undefined,
): T[] {
  for (const d of diagnostics) {
    if (d.filename !== undefined) continue;
    const resolved = d.loc.filename ?? filename;
    if (resolved !== undefined) d.filename = resolved;
  }
  return diagnostics;
}
