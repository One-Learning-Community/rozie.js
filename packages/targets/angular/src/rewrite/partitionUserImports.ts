/**
 * partitionUserImports — Spike 001 B1 fix.
 *
 * Walk a cloned Babel Program ONCE and bucket-sort top-level
 * `ImportDeclaration` statements into `userImports` and everything else into
 * `bodyStmts`. Source order is preserved within each bucket.
 *
 * Why: the React/Solid/Angular/Lit emitters iterate `cloned.program.body` and
 * emit each statement INSIDE the per-target component body (function body /
 * constructor body / firstUpdated body). For ES `ImportDeclaration` statements
 * this produces `TS1232: An import declaration can only be used at the top
 * level of a namespace or module.` This helper lets emitters lift user
 * imports out of the per-target body and route them to a new
 * `ShellParts.userImports` field placed at module top alongside the
 * target/runtime/component import sections.
 *
 * Type-only imports (`import type X from 'pkg'`) and value imports are
 * treated identically — both go in `userImports`.
 *
 * Convention: each of the 4 broken targets keeps its own byte-identical copy
 * of this helper, matching the existing per-target `cloneProgram.ts` /
 * `rewriteScript.ts` convention. The duplication is preferable to a shared
 * cross-target import because the helper has zero coupling to anything
 * target-specific.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';

export interface PartitionedUserImports {
  /** Top-level `ImportDeclaration` statements in source order. */
  userImports: t.ImportDeclaration[];
  /** Every non-`ImportDeclaration` top-level statement in source order. */
  bodyStmts: t.Statement[];
}

export function partitionUserImports(file: t.File): PartitionedUserImports {
  const userImports: t.ImportDeclaration[] = [];
  const bodyStmts: t.Statement[] = [];
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt)) {
      userImports.push(stmt);
    } else {
      bodyStmts.push(stmt);
    }
  }
  return { userImports, bodyStmts };
}
