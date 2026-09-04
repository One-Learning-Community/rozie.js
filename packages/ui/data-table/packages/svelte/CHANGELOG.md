# @rozie-ui/data-table-svelte

## 0.2.5

### Patch Changes

- 287dbf2: All six `@rozie-ui/data-table-<target>` leaves widen their `@rozie-ui/popover-<target>` peer dependency from `^0.1.0` to `^0.1.0 || ^0.2.0`.

  **Why both, not just the new one.** Combobox moves its own popover peer to `^0.2.0` in this same wave. A caret range on a 0.x version pins the minor, so leaving data-table's range at `^0.1.0` would give any consumer installing both the combobox family and the data-table family two mutually exclusive ranges for the same `@rozie-ui/popover-<target>` package — an unsatisfiable peer pair. Forcing data-table forward to `^0.2.0` alone would avoid that conflict but strand existing data-table consumers on a popover upgrade they have no reason to take, since data-table does not use any of popover's five new props. Admitting both ranges is the option that resolves the conflict without an unnecessary forced upgrade.

  **Why it is safe to admit both.** Data-table composes a `<Popover>` at exactly two sites in source (`DataTable.rozie`), and both are byte-identical, binding only four props: `trigger="click"`, `placement="bottom-end"`, `strategy="fixed"`, `:offset="4"`. All four are present, unchanged, in both `0.1.x` and `0.2.0` — data-table binds none of popover's five new props (`bare`, `disablePositioning`, `keepMounted`, `matchWidth`, `disableDismiss`). The one behavioral change in this wave that touches existing consumers — `aria-haspopup`/`aria-expanded` gating on `hasGestureTrigger()` — only affects `trigger="manual"` popovers; data-table's `trigger="click"` stays on the gesture-trigger branch and sees no ARIA change in either version.

  **Scope of the change.** There is no runtime, API, or DOM change in `@rozie-ui/data-table-<target>` itself. The entire leaf diff is the one peer dependency range line per target, six lines total. This changeset is deliberately separate from the popover-promotion changeset covering combobox and popover: it is its own story about data-table's peer contract, not a restatement of theirs.
  - @rozie/runtime-svelte@0.7.1

## 0.2.4

### Patch Changes

- @rozie/runtime-svelte@0.7.0

## 0.2.3

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.2.2

### Patch Changes

- Stale-publish reconciliation. The published `0.2.1` tarball's `src/DataTable.svelte` predates a regeneration that landed on `main` without a version bump, so the registry kept serving the pre-regeneration bytes. This release republishes the current generated output — verified purely internal source-comment cleanup (documentation of the grouping/pinning/windowing internals); every non-comment line is byte-identical to the previously published version. No behavior change, no API surface change.
- @rozie/runtime-svelte@0.2.2 (unchanged — no runtime bump in this wave)

## 0.2.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
