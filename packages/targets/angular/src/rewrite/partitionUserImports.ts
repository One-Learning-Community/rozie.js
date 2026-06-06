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
   * Angular-only (template≠module scope alias). Local binding names of every
   * VALUE import specifier (default, namespace, and named) across all
   * `userImports`. EXCLUDES type-only imports (`import type …`, which TS erases)
   * and type-only named specifiers (`import { type X }`).
   *
   * Angular AOT resolves a bare template-binding identifier against the
   * COMPONENT INSTANCE, but these imports are hoisted to module scope and are
   * not class members — so a `<script>` value-import referenced inside a
   * template expression (`:options="{ plugins: [listPlugin] }"`) is `undefined`
   * at runtime AND gets tree-shaken (its only reference lives in the separate
   * template compilation context). The Angular emitter intersects this set with
   * the identifiers appearing in the emitted template/listener expressions and
   * emits a `protected readonly <name> = <name>;` alias field so the unchanged
   * bare template reference resolves against `this` and the import stays live.
   *
   * The other five targets share one scope (React/Solid emit JSX in the import's
   * module; Vue/Svelte are single-file; Lit's `html\`\`` is a class method in
   * module scope), so they never read this — it is populated unconditionally but
   * consumed Angular-only.
   */
  valueImportNames: Set<string>;
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

export function partitionUserImports(file: t.File): PartitionedUserImports {
  const userImports: t.ImportDeclaration[] = [];
  const hoistedTypeDecls: Array<
    t.TSInterfaceDeclaration | t.TSTypeAliasDeclaration
  > = [];
  const bodyStmts: t.Statement[] = [];
  const valueImportNames = new Set<string>();
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt)) {
      userImports.push(stmt);
      // A whole `import type … from …` declaration is type-only — TS erases it,
      // so none of its locals can ever be a runtime value to alias.
      if (stmt.importKind !== 'type') {
        for (const spec of stmt.specifiers) {
          // `import { type X }` named specifiers are also type-only.
          if (
            t.isImportSpecifier(spec) &&
            spec.importKind === 'type'
          ) {
            continue;
          }
          valueImportNames.add(spec.local.name);
        }
      }
    } else if (
      t.isTSInterfaceDeclaration(stmt) ||
      t.isTSTypeAliasDeclaration(stmt)
    ) {
      hoistedTypeDecls.push(stmt);
    } else {
      bodyStmts.push(stmt);
    }
  }
  return { userImports, hoistedTypeDecls, bodyStmts, valueImportNames };
}
