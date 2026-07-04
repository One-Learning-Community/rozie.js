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
 * points at a more specific origin (e.g. a spliced `.rzts`/`.rzjs`
 * script-partial file) keeps that attribution. Byte-offset attribution for
 * partial-sourced diagnostics is a separate, not-yet-solved problem — see
 * inlineScriptPartials.ts R7; this pass only fills in the common host-file
 * case.
 *
 * Mutates `diagnostics` in place and returns the same array for call-site
 * chaining convenience.
 */
import type { Diagnostic } from './Diagnostic.js';

export function stampMissingFilename<T extends Diagnostic>(
  diagnostics: T[],
  filename: string | undefined,
): T[] {
  if (filename === undefined) return diagnostics;
  for (const d of diagnostics) {
    if (d.filename === undefined) d.filename = filename;
  }
  return diagnostics;
}
