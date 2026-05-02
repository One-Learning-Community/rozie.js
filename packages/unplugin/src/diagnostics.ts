/**
 * Vite-shaped error formatter (D-28).
 *
 * Compile errors throw Error objects shaped per Vite's plugin error contract:
 *
 *   { message, loc: { file, line, column }, frame: <code-frame>, plugin: 'rozie', code: 'ROZxxx' }
 *
 * Vite's dev-overlay highlights the offending `.rozie` line via `loc`; the
 * `frame` field renders a `@babel/code-frame`-style snippet. Reuses the
 * Phase 1 `renderDiagnostic` + `offsetToLineCol` helpers — single source of
 * truth for all .rozie error rendering.
 *
 * @experimental — shape may change before v1.0
 */

import { renderDiagnostic } from '../../core/src/diagnostics/frame.js';
import { offsetToLineCol } from '../../core/src/diagnostics/offsetToLineCol.js';
import type { Diagnostic } from '../../core/src/diagnostics/Diagnostic.js';
import type { SourceLoc } from '../../core/src/ast/types.js';

export interface ViteShapedError extends Error {
  loc: { file: string; line: number; column: number };
  frame: string;
  plugin: 'rozie';
  code: string;
}

/**
 * Build a Vite-shaped Error from one or more diagnostics. The first
 * error-severity diagnostic anchors the `loc` and `frame`; subsequent
 * errors get a "+N more" tail in the message.
 */
export function formatViteError(
  diagnostics: Diagnostic[],
  id: string,
  source: string,
): ViteShapedError {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const first = errors[0] ?? diagnostics[0];
  if (!first) {
    const fallback = new Error('[ROZ500] Internal: no diagnostic to format') as ViteShapedError;
    fallback.plugin = 'rozie';
    fallback.code = 'ROZ500';
    fallback.loc = { file: id, line: 1, column: 0 };
    fallback.frame = '';
    return fallback;
  }
  const { line, column } = offsetToLineCol(source, first.loc.start);
  const frame = renderDiagnostic(first, source);
  const tail = errors.length > 1 ? `\n(plus ${errors.length - 1} more error${errors.length - 1 === 1 ? '' : 's'} — fix and recompile)` : '';
  const message = `[${first.code}] ${first.message}${tail}`;
  const err = new Error(message) as ViteShapedError;
  err.loc = { file: id, line, column };
  err.frame = frame;
  err.plugin = 'rozie';
  err.code = first.code;
  return err;
}

/**
 * Convert a `SourceLoc` byte range to Vite's `{ id, line, column }` shape.
 * Used for `this.warn(...)` calls where we want the dev overlay to point
 * at the warning's source location.
 */
export function formatLoc(
  loc: SourceLoc,
  id: string,
  source: string,
): { id: string; line: number; column: number } {
  const { line, column } = offsetToLineCol(source, loc.start);
  return { id, line, column };
}
