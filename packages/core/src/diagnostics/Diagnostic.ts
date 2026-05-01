import type { SourceLoc } from '../ast/types.js';

export type DiagnosticSeverity = 'error' | 'warning';

/**
 * Stable diagnostic shape. Codes follow ROZxxx convention (D-07):
 * - ROZ001..ROZ099: Phase 1 (parser/syntax). See packages/core/src/diagnostics/codes.ts (Plan 04) for the namespace registry.
 * - ROZ100+: Phase 2 (semantic analysis).
 *
 * Diagnostics are collected, never thrown (D-08). Renderers read the optional
 * `frame` field for terminal output; if absent, callers compute it lazily via
 * @babel/code-frame using `loc` + the original source string.
 */
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  loc: SourceLoc;
  filename?: string;
  hint?: string;
  frame?: string;
  related?: Array<{ message: string; loc: SourceLoc }>;
}
