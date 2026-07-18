/**
 * partitionUserImports — Spike 001 B1 fix; Phase 9 Plan 09-04 extension.
 *
 * Walk a cloned Babel Program ONCE and bucket-sort top-level statements into
 * three buckets, preserving source order within each:
 *
 *   - `userImports`      — `ImportDeclaration` statements (value AND type-only).
 *   - `hoistedTypeDecls` — `TSInterfaceDeclaration` / `TSTypeAliasDeclaration`
 *                          statements (Phase 9 — `<script lang="ts">`).
 *   - `bodyStmts`        — every other top-level statement.
 *
 * Why imports are hoisted: the React/Solid/Angular/Lit emitters iterate
 * `cloned.program.body` and emit each statement INSIDE the per-target
 * component body (function body / constructor body / firstUpdated body). For
 * ES `ImportDeclaration` statements this produces `TS1232: An import
 * declaration can only be used at the top level of a namespace or module.`
 * This helper lets emitters lift user imports out of the per-target body and
 * route them to a module-top `ShellParts.userImports` field.
 *
 * Why interface/type declarations are hoisted (Phase 9 Plan 09-04 / RESEARCH
 * Pattern 5, Pitfall 2): Angular and Lit emit CLASS-BASED components. A
 * `<script lang="ts">` may declare a statement-position `interface X {}` /
 * `type Y = …`. If left in `bodyStmts` it falls through the emitter's
 * residual-statement loop into the CLASS BODY (Angular constructor, Lit
 * `firstUpdated()`), where an `interface`/`type` declaration is a TypeScript
 * syntax error (TS1068 / TS1184). Pulling these into `hoistedTypeDecls` lets
 * the emitter route them to module scope alongside the hoisted imports — the
 * same module-top placement the slot-context `interface` decls already get.
 *
 * Hoisting interface/type out of `bodyStmts` BEFORE the emitter runs its
 * identifier-rewrite pass also keeps that pass from mangling type-position
 * identifiers inside the interface body (e.g. a `count: number` property
 * signature being rewritten to `this.count(): number`).
 *
 * Type-only imports (`import type X from 'pkg'`) and value imports are treated
 * identically — both go in `userImports` — because both are `ImportDeclaration`
 * nodes (`import type` carries `importKind: 'type'`); module-top is the legal
 * placement for either.
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
  /**
   * Top-level `TSInterfaceDeclaration` / `TSTypeAliasDeclaration` statements
   * in source order. Class-based targets (Angular, Lit) emit these at module
   * scope — a type declaration inside a class body is a TS syntax error.
   * Always empty for an untyped `<script>` (no `interface`/`type` is ever
   * present), so the untyped emit path stays byte-identical.
   */
  hoistedTypeDecls: Array<t.TSInterfaceDeclaration | t.TSTypeAliasDeclaration>;
  /**
   * Every top-level statement that is NOT an `ImportDeclaration` and NOT a
   * statement-position `TSInterfaceDeclaration` / `TSTypeAliasDeclaration`,
   * in source order.
   */
  bodyStmts: t.Statement[];
}

/**
 * Quick task 260717-uvj — compare two Babel comment nodes by SOURCE POSITION
 * (type + starting line/column) rather than object reference. Mirrors the
 * proven `isSameSourceComment` helper in `svelte`/`vue`'s `emitScript.ts`
 * (quick 260714-orv), reused here for the userImports↔hoistedTypeDecls
 * partition-boundary seam.
 */
function isSameSourceComment(a: t.Comment, b: t.Comment): boolean {
  if (a === b) return true;
  if (!a.loc || !b.loc) return false;
  return (
    a.type === b.type &&
    a.loc.start.line === b.loc.start.line &&
    a.loc.start.column === b.loc.start.column
  );
}

export function partitionUserImports(file: t.File): PartitionedUserImports {
  const userImports: t.ImportDeclaration[] = [];
  const hoistedTypeDecls: Array<
    t.TSInterfaceDeclaration | t.TSTypeAliasDeclaration
  > = [];
  const bodyStmts: t.Statement[] = [];
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt)) {
      userImports.push(stmt);
    } else if (
      t.isTSInterfaceDeclaration(stmt) ||
      t.isTSTypeAliasDeclaration(stmt)
    ) {
      hoistedTypeDecls.push(stmt);
    } else {
      bodyStmts.push(stmt);
    }
  }
  // Quick task 260717-uvj — @babel/parser attaches a comment sitting at the
  // userImports↔hoistedTypeDecls partition boundary to BOTH neighbours as the
  // SAME source comment (last import's `trailingComments` AND first
  // hoisted-type-decl's `leadingComments`). Each bucket is rendered in a
  // SEPARATE `@babel/generator` pass by emitScript, so the shared comment
  // would otherwise print once per pass. Strip it from the last import's
  // trailing side — the type-decl's leading side still prints it exactly
  // once. Same `isSameSourceComment`-by-position precedent as 260714-orv's
  // `mirrorSpliceBoundaryComments`, gated STRICTLY to this one seam.
  if (userImports.length > 0 && hoistedTypeDecls.length > 0) {
    const lastImport = userImports[userImports.length - 1]!;
    const firstTypeDecl = hoistedTypeDecls[0]!;
    const firstTypeDeclLeading = firstTypeDecl.leadingComments;
    if (lastImport.trailingComments && firstTypeDeclLeading) {
      const deduped = lastImport.trailingComments.filter(
        (trailing) =>
          !firstTypeDeclLeading.some((leading) =>
            isSameSourceComment(trailing, leading),
          ),
      );
      lastImport.trailingComments = deduped.length > 0 ? deduped : null;
    }
  }
  return { userImports, hoistedTypeDecls, bodyStmts };
}
