# Deferred items — out of scope for the @rozie/cli spike

## Pre-existing typecheck error in @rozie/target-vue

`packages/targets/vue/src/rewrite/rewriteTemplateExpression.ts:111,142` —
`Parameter 'path' implicitly has an 'any' type` for the
`OptionalMemberExpression` and `CallExpression` visitors. The `MemberExpression`
visitor in the same `traverse()` call infers fine.

Reproduced on `main` *before* the CLI spike's changes via `git stash &&
pnpm --filter @rozie/target-vue typecheck`. Belongs to target-vue's backlog,
not the CLI spike. The CLI's tsc --noEmit pulls these errors in transitively
via its relative import of `../../../targets/vue/src/emitVue.js`, but the
CLI's own source typechecks clean.

Fix path (for the target-vue maintainer): either widen the visitor to
`OptionalMemberExpression(path: NodePath<t.OptionalMemberExpression>)` or
add an explicit `Visitor<{}>` annotation on the visitor object so each entry
inherits the right `NodePath<TNode>` type.

## Pre-existing console.warn in @rozie/target-vue's compose.ts

`packages/targets/vue/src/sourcemap/compose.ts:51` emits
`[rozie] Source map generated with empty mappings for ...` to stderr on
every emit. Tracked upstream as `WR-01`. Not caused by the CLI; harmless
because it lands on stderr (separate from the SFC output on stdout).
