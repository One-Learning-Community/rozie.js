---
surface_hash: ffb9dac3239e
---

# Data table comparison

How `@rozie-ui/data-table` compares to the existing data-table / data-grid libraries across the six frameworks. The data table is the densest, most-requested UI surface there is. Like the listbox and slider it builds on a single framework-agnostic state engine (`@tanstack/table-core`), but unlike them it does so without the per-framework adapter every other TanStack consumer ships. Rozie wires `table-core` to all six reactivity systems directly and ships the same idiomatic `<DataTable>` + `<Column>` to each: the same props, two-way state slices, events, slots, and handle.

> Research snapshot: 2026-06-23. The data-grid landscape moves quickly; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Shape | Headless | Adapter per framework | Notes |
| --- | --- | --- | :---: | :---: | --- |
| **React** | TanStack Table (`@tanstack/react-table`), AG Grid React, MUI DataGrid | hooks / components | ✅ (TanStack) | ✅ separate adapter | Deepest ecosystem. TanStack Table is the headless gold standard — but `@tanstack/react-table` is a React-specific adapter over `table-core`; AG Grid / MUI are styled, batteries-included grids. |
| **Vue** | `@tanstack/vue-table`, PrimeVue DataTable, Element Plus, Vuetify | components | ✅ (TanStack) | ✅ separate adapter | TanStack's Vue adapter, plus several styled component grids. PrimeVue's is the closest "declarative `<Column>`" surface. |
| **Svelte** | `@tanstack/svelte-table`, Svelte Headless Table | actions / stores | ✅ | ✅ separate adapter | A separate adapter again; Svelte Headless Table is a community alternative with its own mental model. |
| **Solid** | `@tanstack/solid-table` | components | ✅ | ✅ separate adapter | TanStack's Solid adapter; little else first-party. |
| **Angular** | `@tanstack/angular-table`, AG Grid Angular, Angular Material `MatTable` | components / directives | ⚠️ | ✅ separate adapter | TanStack's Angular adapter is newer; `MatTable` is a styled Material component (not headless behaviour you re-skin); AG Grid is the enterprise default. |
| **Lit / web components** | *(none headless)* | — | ❌ | — | No headless data table primitive. You hand-roll the row model + ARIA, or wrap AG Grid's vanilla build yourself. |
| **`@rozie-ui/data-table`** | `@rozie-ui/data-table-*` | a **component** | ✅ | ❌ **no adapter** | Same API on all six: props, twelve two-way slices, events, `<Column>` API, slots, handle. Built on `@tanstack/table-core` directly, with no `@tanstack/<fw>-table` adapter in any leaf. |

On its home framework each of these is a solid pick, and Rozie does not claim to out-feature AG Grid on enterprise grids or TanStack Table on React. The case for Rozie is consistency, coverage, and the no-adapter foundation: TanStack ships a *separate* adapter (with a separate API surface and release cadence) per framework; AG Grid / MUI / PrimeVue are framework-specific styled grids; Lit / web components have nothing headless at all; and Angular's first-party `MatTable` is styled-only. Rozie gives all six the same idiomatic `<DataTable>`, sharing the exact `table-core` engine TanStack itself uses.

## Headless engine, no adapter: the foundation

The deepest design choice is what sits between the framework and the row model. Two camps:

- **Adapter-per-framework** (`@tanstack/react-table`, `@tanstack/vue-table`, `@tanstack/svelte-table`, …): each framework gets its own thin reactive adapter over the shared `@tanstack/table-core`. Idiomatic on its home framework, at the cost of a separate package, a separate API surface (hooks vs composables vs stores vs signals), and separate per-framework documentation, all of which can drift.
- **Styled, batteries-included grids** (AG Grid, MUI DataGrid, PrimeVue, Material): a complete grid with its own DOM, its own theming model, and its own (often paid) feature tiers. Fast to adopt, hard to re-skin to an arbitrary design system, and entirely framework-specific.

Rozie picks a third spot: it wires `@tanstack/table-core`, the *same* state machine the official adapters wrap, to all six reactivity systems once, by hand, inside `DataTable.rozie`, and emits an idiomatic component per target. `table-core` owns no DOM (it is a pure `createTable → setOptions → getRowModel` pull-based machine), so the table markup is plain accessible HTML the framework owns, and Rozie's per-target emitter does the reactivity wiring that the adapters would otherwise each hand-write. The codegen enforces that no leaf ever imports a `@tanstack/<fw>-table` adapter: the single-core design is a build-time invariant.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (TanStack) | Vue (TanStack / PrimeVue) | Svelte (TanStack) | Solid (TanStack) | Angular (Material / AG) | Lit (none) | **`@rozie-ui/data-table`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Headless row model | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ (`table-core`) |
| Sorting (multi-sort) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ shift-click |
| Global + per-column filtering | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ `filter-change` |
| Pagination | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ `page-change` |
| Row selection | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ `selectionMode` |
| Column visibility / resize / reorder / pin | ✅ | ✅ | ✅ | ✅ | ✅ (AG) | ❌ | ✅ four slices |
| Sticky header | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ✅ `stickyHeader` |
| Row virtualization (windowing) | ✅ (TanStack Virtual) | ✅ (TanStack Virtual) | ✅ (TanStack Virtual) | ✅ (TanStack Virtual) | ✅ (AG) | ❌ | ✅ `virtual` (tested to 100,000 rows) |
| Expandable rows / master-detail | ✅ | ✅ | ✅ | ✅ | ✅ (AG) | ❌ | ✅ `expandable` + `#detail` / `getSubRows` |
| Grouping + aggregation | ✅ | ✅ | ✅ | ✅ | ✅ (AG) | ❌ | ✅ `grouping` + `aggregationFn` |
| Faceted filtering | ✅ | ✅ | ✅ | ✅ | ✅ (AG) | ❌ | ✅ headless `#filter` + drop-ins |
| Inline editing (cell + full-row) | ⚠️ assemble | ⚠️ (PrimeVue ✅) | ⚠️ assemble | ⚠️ assemble | ✅ (AG) | ❌ | ✅ five editors + validation |
| Cell range selection + clipboard (grid mode) | ❌ | ❌ | ❌ | ❌ | ✅ (AG) | ❌ | ✅ `Shift+Arrow` / `Shift+Click` + `Ctrl+C` / `Ctrl+X` / `Ctrl+V` (range-tiling paste) |
| APG grid keyboard navigation (`role="grid"`) | ❌ | ⚠️ (PrimeVue) | ❌ | ❌ | ✅ (AG) | ❌ | ✅ `interactionMode="grid"` |
| Declarative `<Column>` surface | ⚠️ defs array | ✅ (PrimeVue) | ⚠️ | ⚠️ | ⚠️ | — | ✅ `<Column>` + `:columns` |
| Custom cell / header rendering | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ parent `#cell` / `#colHeader`, `columnId`-dispatched (React/Solid render-prop, Lit property) |
| Server-side (manual) mode | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ `manual` |
| No per-framework adapter | ❌ | ❌ | ❌ | ❌ | ❌ | — | ✅ single `table-core` |
| Idiomatic two-way state binding | ⚠️ state+onChange | ✅ `v-model` | ⚠️ stores | ⚠️ signal | ⚠️ | — | ✅ twelve `r-model` slices |
| Zero-config styling, re-skinnable | ⚠️ unstyled | ⚠️ themed | ⚠️ | ⚠️ | styled-only | — | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages for all six frameworks**, including Lit / web components, which have *no* headless data table to begin with. Each leaf is a real, idiomatic component for its framework, not a wrapper you assemble.
- **The same component surface everywhere.** Where TanStack offers hooks (React), composables (Vue), stores (Svelte), and signals (Solid), four mental models over the *same* core, `@rozie-ui/data-table` is one `<DataTable>` + `<Column>` with the same props, twelve two-way slices, events, slots, and imperative handle on all six: one grid to learn, document, and migrate across your stack.
- **No per-framework adapter.** Every leaf wires `@tanstack/table-core` directly; the codegen forbids any `@tanstack/<fw>-table` import. You get the exact engine TanStack uses without the adapter-per-framework maintenance surface, and `table-core` is your peer dependency, so you control its version.
- **Twelve independent two-way state slices, controlled *or* uncontrolled.** Data (so committed edits flow back), sorting, global filter, column filters, pagination, row selection, expansion, grouping, column visibility / sizing / order / pinning. Each is an optional `r-model` you bind only if you want to own it, and each change event fires regardless of binding so you can observe transitions either way.
- **Inline editing, cell + full-row, on all six targets.** Mark a `<Column editable>` and bind `r-model:data`: the component owns the edit state and writes a fresh `data` array back on commit. Five built-in editor types (`text` / `number` / `select` / `checkbox` / `date`), synchronous per-column validation announced via aria-live, full-row edit (`Shift+F2`), and a headless `#editor` slot with opt-in drop-in editor components, where TanStack ships only the row-model state and leaves the editors to you.
- **A declarative `<Column>` API** (the PrimeVue-shaped surface) *and* a `:columns` config-array escape hatch, resolved by an id-keyed last-write-wins union, plus custom cell/header rendering via a single parent `#cell` / `#colHeader` scoped slot dispatched by `columnId` (a render-prop on React/Solid and a property on Lit, the one documented divergence).
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-data-table-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5, with no required CSS import.
- **Opt-in WAI-ARIA grid mode, identical on all six targets.** Set `interactionMode="grid"` for the full [APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/): `role="grid"`, a roving single tab-stop, and 2-D arrow-key cell navigation that survives re-sorts, filters, page changes, and column hide/reorder/pin. Cell ranges carry full spreadsheet clipboard semantics (`Ctrl+C` copy, `Ctrl+X` cut, `Ctrl+V` range-tiling paste with per-column coercion + validation), and the active cell is drivable and observable through dedicated handle verbs and events. The default `interactionMode="table"` stays a plain accessible table, byte-for-byte unchanged. See [Grid mode](/components/data-table-grid-mode) for the full keyboard, clipboard, and active-cell contract.
- **Opt-in vertical row windowing, on all six targets.** Set `virtual` to render only the visible slice of a large dataset inside a bounded scroll container, windowing the full filtered + sorted model with correct `aria-rowcount` / `aria-rowindex`, measured variable-height rows, and sticky-header + pinned-column geometry preserved. It is built on the framework-agnostic `@tanstack/virtual-core` with no per-framework virtual adapter, and tested to 100,000 rows on all six targets. The default `virtual="false"` is byte-identical to a non-virtual table. See [Virtualization](/components/data-table-virtualization) for the windowing model and its boundaries.
- **Opt-in grid-wide undo/redo, identical on all six targets.** Set `undoable` (grid mode) and every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Y`), replayed through the same `writeData` funnel every mutation already commits through. A bounded `undoLimit` caps memory, an external dataset swap clears history, and the `undo` / `redo` / `canUndo` / `canRedo` / `clearHistory` verbs plus the `history-change` event let you wire your own toolbar. No incumbent ships cross-framework undo/redo over a headless grid at all.

## What Rozie defers {#what-rozie-defers}

- **AG Grid's enterprise depth.** [AG Grid](https://www.ag-grid.com/) ships tree data, pivoting, integrated charting, and a deep server-side row model. `@rozie-ui/data-table` now covers row grouping + aggregation, expandable rows / master-detail, faceted filtering, inline editing, and cell range selection on top of the common surface (sort / filter / paginate / select / column management) plus a `manual` server-side hook, but not AG's full enterprise feature set.
- **Horizontal (column) virtualization + dynamic auto-measure.** Vertical row windowing ships and is GA on all six targets (tested to 100,000 rows). What remains deferred is the orthogonal pieces: horizontal/column virtualization (a very wide column set still renders every column), and content-driven auto-measurement beyond `measureElement`. Use `estimateRowHeight` to seed the row estimate for now.
- **`@rozie-ui/data-table` is pre-1.0** and younger and less battle-tested than the established libraries. The full prop / slice / event / handle surface is documented in the [API reference](/components/data-table-api).

## Try it

The [`@rozie-ui/data-table` overview & install](/components/data-table) documents the `@rozie-ui/data-table-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/data-table-react`, etc.) — and links each concept page; the [API reference](/components/data-table-api) carries the dense prop / slice / event / handle tables. The state engine is `@tanstack/table-core` (a peer dependency you control); there is no required CSS — a fully-tokenised skin ships inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/data-table-demo) runs the real Vue package in the page.

## Cross-references

- [DataTable — overview & install](/components/data-table) — the package install table and the section index linking quick start, `<Column>` API, theming, and the full API reference.
- [DataTable — live demo](/components/data-table-demo) — the real Vue package running in the page (sort + filter + paginate + select + column management), plus the one `.rozie` source and all six generated outputs.
- [`DataTable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/DataTable.rozie)
- [Listbox — headless select / combobox](/components/listbox-comparison) and [Slider — headless slider / range](/components/slider-comparison) — the sibling no-engine headless families.
