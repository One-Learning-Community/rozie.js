/**
 * lowerData — convert DataAST + BindingsTable to StateDecl[].
 *
 * Plan 02-05 Task 2.
 *
 * Iterates `bindings.data` (already collected by Plan 02-01 collectDataDecls)
 * and produces typed StateDecl entries. Each StateDecl carries the original
 * Babel Expression for the initializer (no clone; preserves source info).
 *
 * Per D-08 collected-not-thrown: never throws.
 *
 * @experimental — shape may change before v1.0
 */
import type { DataAST } from '../../ast/blocks/DataAST.js';
import type { BindingsTable } from '../../semantic/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { StateDecl } from '../types.js';

export function lowerData(
  _dataAst: DataAST,
  bindings: BindingsTable,
  _diagnostics: Diagnostic[],
): StateDecl[] {
  const out: StateDecl[] = [];
  for (const entry of bindings.data.values()) {
    out.push({
      type: 'StateDecl',
      name: entry.name,
      initializer: entry.initializer,
      sourceLoc: entry.sourceLoc,
    });
  }
  return out;
}
