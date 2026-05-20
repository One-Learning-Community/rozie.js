import type { SourceLoc } from '../ast/types.js';

/**
 * Diagnostic severity levels:
 * - `error`   — compilation cannot produce correct output; aborts emit.
 * - `warning` — emit succeeds but the author should look at something;
 *   surfaced to the user (e.g. via unplugin's `this.warn`).
 * - `info`    — non-actionable advisory: the compiler did something
 *   automatically and correctly, reported purely as an FYI. NOT surfaced
 *   via `this.warn`. Every consumer filters on `=== 'error'` / `=== 'warning'`
 *   explicitly, so `info` diagnostics fall through both and stay quiet.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

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
