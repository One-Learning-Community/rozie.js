/**
 * isInTypePosition — shared TS-type-position ancestor guard.
 *
 * A `<script lang="ts">` Babel Program carries `TS*` nodes. `@babel/traverse`
 * descends into `TS*` subtrees by default, so a type reference like
 * `let x: SomeType` parses `SomeType` as an `Identifier` nested inside a
 * `TSTypeReference`. Every AST pass that mutates or collects `Identifier` /
 * `MemberExpression` nodes — `computeExpressionDeps` and every per-target
 * `rewriteScript` — must NOT touch identifiers that sit in TYPE position, or a
 * type-reference identifier colliding with a runtime name (`$computed` memo,
 * `$data` field, prop) gets mangled into a runtime accessor INSIDE a type
 * annotation, producing invalid TypeScript.
 *
 * `isInTypePosition` walks an Identifier's ancestor chain and returns true when
 * the identifier sits inside a TypeScript TYPE construct — a type annotation, a
 * type reference, an interface/alias declaration, a qualified type name, or the
 * type child of an `as` / angle-bracket assertion. The guard is deliberately
 * NARROW: it keys on type-position ancestry, not on "any ancestor is a TS node".
 * An `as`/assertion EXPRESSION still contributes the wrapped runtime
 * expression's deps/rewrites — only the type child is in type position, and
 * only that child is skipped.
 *
 * Phase 9 OQ-1 / WR-02 — single source of truth. Originally implemented inside
 * `reactivity/computeDeps.ts`; factored here so the per-target `rewriteScript`
 * identifier/member visitors reuse the IDENTICAL guard rather than each
 * re-deriving a narrower (or absent) check.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';

/**
 * True when `path` sits inside a TypeScript type construct. See the module
 * header for the precise set of type positions and the deliberate narrowness
 * of the check.
 *
 * Accepts any `NodePath` — the per-target `rewriteScript` passes call this from
 * both `Identifier` and `MemberExpression` visitors. The walk only reads
 * ancestry, so the path's own node kind is irrelevant: a `MemberExpression`
 * inside `typeof X.Y` (a `TSTypeQuery`) is correctly reported as type position.
 *
 * @param path - the NodePath under inspection.
 * @returns `true` if any ancestor places the node in type position.
 */
export function isInTypePosition(path: NodePath): boolean {
  let current: NodePath | null = path;
  let child: t.Node = path.node;
  while (current) {
    const node: t.Node = current.node;
    // Any TSType node (TSTypeReference, TSAnyKeyword, TSUnionType, …) — the
    // whole subtree is type-level. `t.isTSType` is the Babel alias covering
    // every type-expression node kind.
    if (t.isTSType(node)) return true;
    // A TS type annotation (`: SomeType`) — its `typeAnnotation` child is the
    // type. The annotation node itself is not a TSType, so check it explicitly.
    if (t.isTSTypeAnnotation(node)) return true;
    // Statement-position type declarations: `interface Foo {}` / `type Bar`.
    // Their entire body is type-level (the alias `id` IS runtime-shaped but is
    // a declaration name, not a free reference — never a dep regardless).
    if (
      t.isTSInterfaceDeclaration(node) ||
      t.isTSTypeAliasDeclaration(node) ||
      t.isTSInterfaceBody(node)
    ) {
      return true;
    }
    // Qualified type names (`A.B` inside a type) — the dotted segments are
    // Identifiers but live entirely at type level.
    if (t.isTSQualifiedName(node)) return true;
    // `expr as T` / `<T>expr`: only the TYPE child is type position. The
    // wrapped runtime expression must still be walked for its deps/rewrites, so
    // do NOT treat the assertion node itself as type position — only
    // short-circuit when we arrived here via the `typeAnnotation` child.
    if (
      (t.isTSAsExpression(node) || t.isTSTypeAssertion(node)) &&
      (node.typeAnnotation as t.Node) === child
    ) {
      return true;
    }
    child = node;
    current = current.parentPath;
  }
  return false;
}
