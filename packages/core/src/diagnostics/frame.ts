/**
 * Diagnostic renderer wrapping `@babel/code-frame.codeFrameColumns` (D-06).
 *
 * Per D-06, every parse error renders with line/column context, a caret marker,
 * the stable ROZxxx code, and the user-facing message. Per D-11, byte offsets
 * are the primary on-AST representation; line/column is computed lazily here
 * via `offsetToLineCol` (Plan 02).
 *
 * Resilience contract: `renderDiagnostic` NEVER throws. On any
 * codeFrameColumns failure (out-of-range loc, malformed source, etc.), it
 * falls back to a plaintext "no source available" message with the code and
 * message preserved.
 */
import { codeFrameColumns } from '@babel/code-frame';
import type { Diagnostic } from './Diagnostic.js';
import { offsetToLineCol } from './offsetToLineCol.js';

export interface RenderDiagnosticOpts {
  /** Emit ANSI color codes for terminal output (default: false — clean for tests). */
  highlightCode?: boolean;
  /** Source-context lines BEFORE the offending line (default: 2). */
  linesAbove?: number;
  /** Source-context lines AFTER the offending line (default: 2). */
  linesBelow?: number;
}

/**
 * Render a Diagnostic for terminal display. Output format:
 *
 *   [error] ROZ010 Counter.rozie:5:12
 *      3 | <props>
 *      4 | {
 *   >  5 |   bad: ??? syntax error,
 *        |   ^^^
 *      6 | }
 *      7 | </props>
 *      ROZ010: Invalid JS expression in <props>
 *   hint: Wrap your prop declarations in `{ ... }`.
 */
export function renderDiagnostic(
  diagnostic: Diagnostic,
  source: string,
  opts: RenderDiagnosticOpts = {},
): string {
  const { highlightCode = false, linesAbove = 2, linesBelow = 2 } = opts;
  const startLC = offsetToLineCol(source, diagnostic.loc.start);
  const endLC = offsetToLineCol(source, diagnostic.loc.end);

  const filenameLabel = diagnostic.filename ?? '<input>';
  const header = `[${diagnostic.severity}] ${diagnostic.code} ${filenameLabel}:${startLC.line}:${startLC.column}`;

  let frame: string;
  try {
    frame = codeFrameColumns(
      source,
      {
        // @babel/code-frame columns are 1-INDEXED; offsetToLineCol returns 0-indexed columns.
        start: { line: startLC.line, column: startLC.column + 1 },
        end: { line: endLC.line, column: endLC.column + 1 },
      },
      {
        highlightCode,
        linesAbove,
        linesBelow,
        message: `${diagnostic.code}: ${diagnostic.message}`,
      },
    );
  } catch {
    frame = `${diagnostic.code}: ${diagnostic.message} (no source available at offset ${diagnostic.loc.start})`;
  }

  const hintLine = diagnostic.hint ? `\nhint: ${diagnostic.hint}` : '';
  return `${header}\n${frame}${hintLine}`;
}
