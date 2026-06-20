/**
 * inlineScriptPartials — Phase 54 (R1/R2/R3) single-level script-partial inline.
 *
 * STUB (Plan 54-02 Task 1). Task 2 fills the body. See the unit contract in
 * `packages/core/src/ir/__tests__/inlineScriptPartials.test.ts`.
 *
 * @experimental — shape may change before v1.0
 */
import type { File } from '@babel/types';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ProducerResolver } from '../resolver/index.js';

/** Author-controlled script-partial extensions (D-01). */
export const PARTIAL_EXT = /\.(rzts|rzjs)$/;

/**
 * Whether an import specifier targets a `.rzts`/`.rzjs` script partial (a
 * COMPILE-TIME inline, NOT a module). Consulted by the unplugin/babel routing
 * (Plan 04) so a partial never produces a virtual id / sibling artifact.
 */
export function isPartialExtension(specifier: string): boolean {
  return PARTIAL_EXT.test(specifier);
}

/** Options for {@link inlineScriptPartials}. */
export interface InlineScriptPartialsOptions {
  /** Absolute (or relative-to-cwd) path of the host `.rozie` file. */
  hostFilename?: string;
  /** Producer resolver. When omitted, a fresh one is rooted at the host dir. */
  resolver?: ProducerResolver;
}

/** Result of {@link inlineScriptPartials}. `ast` is the SAME (mutated) File. */
export interface InlineScriptPartialsResult {
  ast: File;
  diagnostics: Diagnostic[];
}

/**
 * Inline every `.rzts`/`.rzjs` script partial referenced by `file`'s top-level
 * imports into `file.program.body` in place (sigils intact), removing the
 * partial import statements. Single-level only (Plan 03 adds recursion +
 * import hoist/dedup + collision diagnostics).
 *
 * STUB: returns the file unchanged until Task 2.
 */
export function inlineScriptPartials(
  file: File,
  _opts: InlineScriptPartialsOptions = {},
): InlineScriptPartialsResult {
  return { ast: file, diagnostics: [] };
}
