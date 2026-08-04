# @rozie-ui/data-table-react

## 0.2.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  This is the largest ripple in the wave — 19 synced refs across both shipped components:
  - **Prop reads** (`DataTable`) — `getSubRows`, `manual` and `virtual`. Switching to manual pagination/sorting, toggling virtualization, or supplying a new `getSubRows` after mount is now observed by the mount-registered table wiring.
  - **Helper calls** (`DataTable`, 14) — `clampActiveCell`, `currentData`, `currentState`, `effectiveColumnFilters`, `effectiveGlobalFilter`, `effectiveSorting`, `focusCellWhenReady`, `indexOfRowIn`, `isGrid`, `syncIndeterminate`, `tableColumns`, `virtualizerOptions`, `windowSource`, `writePagination`. The mount-time table/virtualizer wiring now reads live filter, sort, pagination and windowing state instead of the snapshot taken at mount.
  - **Helper calls** (`Column`, 2) — `buildSpec` and `colId`.

  In practice this is what makes a grid whose columns, filters or data source change after first paint keep its active-cell tracking, windowing and pagination writes consistent.
- `Column`'s mount effect no longer emits the `react-hooks/exhaustive-deps` suppression.
- No `$emit` handler prop was affected. No API surface change.
- @rozie/runtime-react@0.2.3

## 0.2.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The public `.d.ts` no longer types `applyGrouping`/`clearGrouping` (on `renderGroupBar`), `toggle` (on `renderSelectAll`), or `setFilter` (on `renderFilter`) as `unknown` — all four resolve to top-level script functions and now type callable (`(...args: any[]) => any`), reversing the 0.3.0 regression that broke a strict-TS consumer calling `setFilter` per the documented API. No runtime behavior change; type surface only.

## 0.2.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.2.2

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.2.1

### Patch Changes

- @rozie/runtime-react@0.2.0

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
