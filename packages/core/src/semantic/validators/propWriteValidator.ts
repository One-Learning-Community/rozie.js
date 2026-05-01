/**
 * SEM-02 / ROZ200 — Static prop-write validator (STUB; Plan 02-02 Task 2 lands the implementation).
 *
 * Plan 02-02 Task 1 lays this no-op stub so analyze.ts typechecks cleanly
 * before Task 2 runs. The real validator detects writes to non-`model` props
 * across AssignmentExpression (any operator, including compound and logical-
 * assign) and UpdateExpression (++/--) per Pitfall 3.
 *
 * Per D-08 collected-not-thrown: NEVER throws.
 */
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { BindingsTable } from '../types.js';

export function runPropWriteValidator(
  _ast: RozieAST,
  _bindings: BindingsTable,
  _diagnostics: Diagnostic[],
): void {
  // No-op until Task 2 lands the implementation.
}
