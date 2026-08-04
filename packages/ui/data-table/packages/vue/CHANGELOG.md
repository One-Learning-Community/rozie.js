# @rozie-ui/data-table-vue

## 0.2.3

### Patch Changes

- Stale-publish reconciliation. The published `0.2.2` tarball's `src/DataTable.vue` predates a regeneration that landed on `main` without a version bump, so the registry kept serving the pre-regeneration bytes. This release republishes the current generated output — verified purely internal source-comment cleanup (documentation of the grouping/pinning/windowing internals); every non-comment line is byte-identical to the previously published version. No behavior change, no API surface change.
- @rozie/runtime-vue@0.2.1 (unchanged — no runtime bump in this wave)

## 0.2.2

### Patch Changes

- @rozie/runtime-vue@0.2.1

## 0.2.1

### Patch Changes

- @rozie/runtime-vue@0.2.0

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
