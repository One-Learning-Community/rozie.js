# @rozie-ui/data-table-angular

## 0.2.1

### Patch Changes

- Stale-publish reconciliation. The published `0.2.0` tarball predates a regeneration that landed on `main` without a version bump, so the registry kept serving stale bytes across 11 files (`Column.ts`, `DataTable.ts`, the five `Editor*.ts` cell editors, the three `Filter*.ts` filter controls, and `GroupBar.ts`). This release republishes the current generated output. The drift is one mechanical, repo-wide theme, not 11 separate changes: every `Function`-typed input (`aggregationFn`, `validate`, `getSubRows`, each editor's `commit`/`cancel`, each filter's `setFilter`, `applyGrouping`/`clearGrouping`) is now widened from `(...args: unknown[]) => unknown` to `(...args: any[]) => any` — the Angular half of the emitter's function-prop type-lowering fix. The published `unknown`-typed signature rejected a consumer's own typed callback at the call site (`TS2345`, since `unknown` params/return are not assignable from/to a concrete function type); `any` accepts it. No runtime behavior change — these are compile-time-only input type annotations.

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
