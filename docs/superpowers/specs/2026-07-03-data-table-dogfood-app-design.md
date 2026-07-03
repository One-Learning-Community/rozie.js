# data-table dogfood app — design

**Date:** 2026-07-03
**Status:** Approved; architecture revised 2026-07-03 (see addendum)
**Author:** Dan Krieger + Claude

## Addendum (2026-07-03) — build it in `.rozie`, test cross-target

Revised at Dan's direction: instead of a hand-written Vue SFC consumer app,
author the super-demo **once as `examples/demos/DataTableSuperDemo.rozie`**
that composes `<DataTable>`/`<Column>`/drop-ins from source via `<components>`
(the proven pattern in the 34 existing `DataTable*Demo.rozie`), registered in
the VR host so it compiles to all six targets. Dan validates Vue first, then
flips `?example=DataTableSuper&target=<t>` to hand-test the compiled output of
each framework. This dogfoods the **compiler** (one source → six) as well as
the component. Trade-off accepted: this consumes DataTable **source**, not the
installed package — the installed-package/consumer-typecheck reality moves to
the separate pre-launch tarball smoke. Two constructs whose cross-target
support is unproven (the imperative-handle panel; runtime theme swap) are
built **isolated/portable** so they can't break a whole target's render, and
their per-target status becomes a dogfood finding. The blind spots the effort
targets (feature combinations, theming, "works like we want") are unchanged;
only the delivery vehicle changed. The plan below reflects this.

## Problem

`@rozie-ui/data-table` is the flagship component family and the launch's
"traction bet." Its automated coverage is strong — all 17 spec files are
behavioral (drive real clicks/keyboard, assert state; zero pure-screenshot),
~1,000 interaction assertions across all 6 targets. Yet the product owner is
"not convinced everything works like we want." The reason maps to three real
blind spots that "tests pass" hides:

1. **No feature-combination surface.** Every demo `.rozie` is atomized — one
   feature per cell, by design, to keep specs isolated. Nothing exercises grid
   mode + virtualization + editing + grouping + drop-ins **in one table
   simultaneously**, which is exactly where real apps break.
2. **Theming is entirely unexercised.** The `base` / `shadcn` / `material` /
   `bootstrap` skins ship in `packages/ui/data-table/src/themes/` but have **no
   demo and no test** touching them.
3. **No consumer-app dogfoods data-table.** The compiled, installed package only
   renders in the Vue docs pages; the other 5 targets are only ever built from
   source in the test host. "Does it work as an actually-installed dependency"
   is unproven for 5 of 6 targets (same class as the earlier data-table-vue
   consumer-typecheck gap).

These are judgment/UX and integration gaps that more green checks won't close —
the product owner needs to **drive a realistic combined surface by hand**.

## Goal

A single interactive app that wires **all** data-table features together —
including the untested combinations — consumed as a **real installed package**,
that Dan drives to judge "works like we want" and where we fix what breaks. Vue
first; all-six is a defined fast-follow.

## Non-goals

- Not a replacement for the behavioral spec suite (that stays the regression
  gate). This is exploratory hand-dogfooding.
- Not all six targets in v1. Vue proves the shape; the other five reuse the same
  feature matrix as a fast-follow.
- Not a published-to-npm / verdaccio install in v1. The interactive fix-loop
  consumes the built leaf via its package entry; a packed-tarball install smoke
  is a separate pre-launch check.

## Architecture

### Location & consumption model

- New standalone app at `examples/dogfood/data-table-vue/` — its own Vite +
  Vue 3 app, a workspace package (`@rozie-ui-dogfood/data-table-vue`, private).
- Depends on `@rozie-ui/data-table-vue` and imports **only** through the package
  entry (`@rozie-ui/data-table-vue` + `@rozie-ui/data-table-vue/themes/*.css`),
  resolving to the built `dist` + published `.d.ts` — **never from `src`**. This
  makes it a genuine consumer, catching exports-map / d.ts / CSS-import issues.
- Ships a `typecheck` script (`vue-tsc --noEmit`) so the consumer-typecheck
  class is caught, not just runtime behavior.
- Requires the leaf to be built first (`pnpm --filter @rozie-ui/data-table-vue
  build`); documented in the app README.
- `pnpm-workspace.yaml` must gain an `examples/dogfood/*` glob (currently only
  `examples/consumers/*` and `examples/playground` are registered) or pnpm won't
  see the package.

### The kitchen-sink table

One `<DataTable>` on a realistic synthetic dataset (~1,500 rows; an orders /
employees shape with mixed column types: string, number, currency, enum/select,
boolean, date — so every editor and filter drop-in has a natural column). Row
count is chosen so virtualization is meaningful.

A **control panel** flips features on in combination:

| Control | Wires |
|---|---|
| Interaction mode | `interactionMode`: `table` ↔ `grid` (roving tab-stop, 2-D arrow nav, range select, clipboard copy/paste/cut, fill-drag, RTL) |
| Virtualization | `virtual` + `estimateRowHeight` + `maxHeight` |
| Grouping | `r-model:grouping` + `groupable` columns + `GroupBar` drop-in (`#groupBar`) |
| Selection | `selectionMode`: `none` / `single` / `multiple` (+ `r-model:rowSelection`) |
| Editing | `editable` columns + the 5 editor drop-ins per column type (`EditorText/Number/Select/Checkbox/Date` → `#editor`) |
| Column filters | `FilterText` / `FilterNumberRange` / `FilterSelect` drop-ins (`#filter`) |
| Faceted filter | `getFacetedUniqueValues` / `getFacetedMinMaxValues` feeding `FilterSelect` |
| Expandable | `expandable` + `r-model:expanded` + `DetailPanel` drop-in (`#detail`) |
| Pagination | client ↔ `manual` (server-simulated slice) |
| Column ops | pin / visibility / resize / reorder (via models + header controls) |
| **Theme** | switch `base` / `shadcn` / `material` / `bootstrap` at runtime ← blind-spot coverage |

Toggles that are genuinely mutually exclusive (e.g. grid-mode grouping is
treegrid) are modeled as such in the UI; the goal is to reach every reachable
combination, not to force invalid ones.

### Instrumentation (so "like we want" is judgeable)

- **State readouts** beside the table: live JSON/compact view of every two-way
  model — `sorting`, `columnFilters`, `globalFilter`, `rowSelection`,
  `grouping`, `expanded`, `pagination`, `columnPinning/Visibility/Sizing/Order`,
  and (grid mode) active cell / selected range. Dan watches state flow as he
  interacts.
- **Imperative-handle panel**: buttons driving the `$expose` verbs by hand —
  `expandAll`, `collapseAll`, `clearSelection`, `getSelectedRows`, `setPage`,
  `focusCell`, `commitEditing`, `editRow`, `cut`, `applyGrouping`,
  `resetColumnSizing`, `pinColumn`, etc. — so the ~30-verb API surface is
  exercised interactively.

## Bug-fix protocol

A bug hit in Vue consumption is almost always in the shared `.rozie` / `.rzts`
source, not the Vue emit. Fix at root → rebless the leaves (`build --force` +
dist-parity rebless per the established emitter-change flow) → it lands for all
six. Adjacent cleanup in-scope: remove the stale `interactionMode`
`deprecated: "grid cell-navigation is not implemented yet"` annotation
(`DataTable.rozie` ~line 394), which is wrong since Phase 63 and would mislead
anyone reading the API while dogfooding.

## Success criteria

- Dan can open one Vue app and reach every data-table feature **and their
  combinations** (grid + virtual + editing + grouping + drop-ins together) from
  one table, plus switch all four themes live.
- The app consumes the **built leaf package** (not source) and passes
  `vue-tsc --noEmit` as a real consumer.
- Every `$expose` verb is reachable from the imperative panel.
- Bugs surfaced during dogfooding are fixed at the source root and reblessed
  across targets.

## Fast-follow (out of scope for v1)

- `examples/dogfood/data-table-{react,svelte,angular,solid,lit}/` — same feature
  matrix, one host app per framework (the host is inherently per-framework —
  that's the real consumer experience).
- Pre-launch packed-tarball / verdaccio install smoke for the leaf.
- Theming: once driven, promote a `DataTableThemingDemo.rozie` + a behavioral
  theme-switch spec to close the automated blind spot permanently.
