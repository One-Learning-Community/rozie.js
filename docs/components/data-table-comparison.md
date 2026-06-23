# Data table comparison

How `@rozie-ui/data-table` compares to the existing data-table / data-grid libraries across the six frameworks. The data table is the densest, most-requested UI surface there is — and like the listbox and slider it builds on a **single framework-agnostic state engine** (`@tanstack/table-core`), but unlike them it does so **without** the per-framework adapter every other TanStack consumer ships. Rozie wires `table-core` to all six reactivity systems by hand, once, and emits the *same* idiomatic `<DataTable>` + `<Column>` to each.

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
| **`@rozie-ui/data-table`** | `@rozie-ui/data-table-*` | a **component** | ✅ | ❌ **no adapter** | One source → all six, same props / twelve two-way slices / events / `<Column>` API / slots / handle. Built on `@tanstack/table-core` directly, wired by hand, with no `@tanstack/<fw>-table` adapter in any leaf. |

These libraries are **excellent** — on its home framework each is the obvious pick, and Rozie does not claim to out-feature AG Grid on enterprise grids or TanStack Table on React. The wedge is **consistency, coverage, and the no-adapter foundation**: TanStack ships a *separate* adapter (with a separate API surface and release cadence) per framework; AG Grid / MUI / PrimeVue are framework-specific styled grids; Lit / web components have nothing headless at all; and Angular's first-party `MatTable` is styled-only. Rozie gives all six the *same* idiomatic `<DataTable>` from one definition, sharing the exact `table-core` engine TanStack itself uses.

## Headless engine, no adapter: the foundation

The deepest design choice is **what sits between the framework and the row model**. Two camps:

- **Adapter-per-framework** (`@tanstack/react-table`, `@tanstack/vue-table`, `@tanstack/svelte-table`, …): each framework gets its own thin reactive adapter over the shared `@tanstack/table-core`. Idiomatic on its home framework — at the cost of a separate package, a separate API surface (hooks vs composables vs stores vs signals), and separate per-framework documentation, all of which can drift.
- **Styled, batteries-included grids** (AG Grid, MUI DataGrid, PrimeVue, Material): a complete grid with its own DOM, its own theming model, and its own (often paid) feature tiers. Fast to adopt, hard to re-skin to an arbitrary design system, and entirely framework-specific.

Rozie picks a third spot: it wires `@tanstack/table-core` — the *same* state machine the official adapters wrap — to all six reactivity systems **once**, by hand, inside `DataTable.rozie`, and emits an idiomatic component per target. `table-core` owns no DOM (it is a pure `createTable → setOptions → getRowModel` pull-based machine), so the table markup is plain accessible HTML the framework owns, and Rozie's per-target emitter does the reactivity wiring that the adapters would otherwise each hand-write. The codegen enforces that no leaf ever imports a `@tanstack/<fw>-table` adapter — the single-core design is a build-time invariant.

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
| Cell range selection (grid mode) | ❌ | ❌ | ❌ | ❌ | ✅ (AG) | ❌ | ✅ `Shift+Arrow` / `Shift+Click` |
| APG grid keyboard navigation (`role="grid"`) | ❌ | ⚠️ (PrimeVue) | ❌ | ❌ | ✅ (AG) | ❌ | ✅ `interactionMode="grid"` |
| Declarative `<Column>` surface | ⚠️ defs array | ✅ (PrimeVue) | ⚠️ | ⚠️ | ⚠️ | — | ✅ `<Column>` + `:columns` |
| Custom cell / header rendering | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ parent `#cell` / `#colHeader`, `columnId`-dispatched (React/Solid render-prop, Lit property) |
| Server-side (manual) mode | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ `manual` |
| No per-framework adapter | ❌ | ❌ | ❌ | ❌ | ❌ | — | ✅ single `table-core` |
| Idiomatic two-way state binding | ⚠️ state+onChange | ✅ `v-model` | ⚠️ stores | ⚠️ signal | ⚠️ | — | ✅ twelve `r-model` slices |
| Zero-config styling, re-skinnable | ⚠️ unstyled | ⚠️ themed | ⚠️ | ⚠️ | styled-only | — | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* headless data table to begin with. Each leaf is a real, idiomatic component for its framework, not a wrapper you assemble.
- **The same component surface everywhere.** Where TanStack offers hooks (React), composables (Vue), stores (Svelte), and signals (Solid) — four mental models over the *same* core — `@rozie-ui/data-table` is one `<DataTable>` + `<Column>` with the same props, twelve two-way slices, events, slots, and imperative handle on all six.
- **No per-framework adapter.** Every leaf wires `@tanstack/table-core` directly; the codegen forbids any `@tanstack/<fw>-table` import. You get the exact engine TanStack uses without the adapter-per-framework maintenance surface — and `table-core` is your peer dependency, so you control its version.
- **Twelve independent two-way state slices, controlled *or* uncontrolled.** Data (so committed edits flow back), sorting, global filter, column filters, pagination, row selection, expansion, grouping, column visibility / sizing / order / pinning — each is an optional `r-model` you bind only if you want to own it, and each change event fires regardless of binding so you can observe transitions either way.
- **Inline editing, cell + full-row, on all six targets.** Mark a `<Column editable>` and bind `r-model:data`: the component owns the edit state and writes a fresh `data` array back on commit. Five built-in editor types (`text` / `number` / `select` / `checkbox` / `date`), synchronous per-column validation announced via aria-live, full-row edit (`Shift+F2`), and a headless `#editor` slot with opt-in drop-in editor components — where TanStack ships only the row-model state and leaves the editors to you.
- **A declarative `<Column>` API** (the PrimeVue-shaped surface) *and* a `:columns` config-array escape hatch, resolved by an id-keyed last-write-wins union — plus custom cell/header rendering via a single parent `#cell` / `#colHeader` scoped slot dispatched by `columnId` (a render-prop on React/Solid and a property on Lit, the one documented divergence).
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-data-table-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5 — no required CSS import.
- **Opt-in WAI-ARIA grid mode, identical on all six targets.** Set `interactionMode="grid"` for the full [APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) — `role="grid"`, a roving single tab-stop, and 2-D arrow-key cell navigation that survives a re-sort / filter / page change / column hide-reorder-pin (the active cell is tracked as a `{ rowIndex, colIndex }` pair over the visible model, never a stored DOM node). It is drivable and observable via the `focusCell` / `getActiveCell` / `clearActiveCell` handle verbs and the `activecell-change` event, and the behavioral contract is locked by a cross-framework VR matrix. The default `interactionMode="table"` stays a plain accessible table, byte-for-byte unchanged.
- **Opt-in vertical row windowing, on all six targets.** Set `virtual` (with an optional `maxHeight` / `--rozie-data-table-max-height` and `estimateRowHeight`) to render only the visible slice of a large dataset inside a bounded scroll container — windowing the full filtered + sorted (pre-pagination) model, with `aria-rowcount` / `aria-rowindex` mapping the full model, variable-height rows measured (no cumulative drift), and sticky-header + pinned-column geometry preserved. Built on the framework-agnostic `@tanstack/virtual-core` wired by hand — **no per-framework virtual adapter** — and **tested to 100,000 rows** on all six targets by a DOM/behavioral VR matrix (`tests/visual-regression/specs/data-table-virtual.spec.ts`). The default `virtual="false"` is byte-identical to a non-virtual table.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **AG Grid's enterprise depth.** [AG Grid](https://www.ag-grid.com/) ships tree data, pivoting, integrated charting, and a deep server-side row model. `@rozie-ui/data-table` now covers row grouping + aggregation, expandable rows / master-detail, faceted filtering, inline editing, and cell range selection on top of the common surface (sort / filter / paginate / select / column management) plus a `manual` server-side hook — but not AG's full enterprise feature set (tree data, pivoting, integrated charting, deep server-side row model).
- **Horizontal (column) virtualization + dynamic auto-measure.** Vertical **row** windowing ships and is GA on all six targets — set `virtual` and large datasets render only the visible slice (**tested to 100,000 rows**). What remains deferred is the orthogonal pieces: **horizontal/column virtualization** (a very wide column set still renders every column), and **dynamic auto-measurement beyond `measureElement`** — variable row heights are measured via `measureElement`, but there is no content-driven auto-sizing pass past it. Use `estimateRowHeight` to seed the row estimate for now.
- **`@rozie-ui/data-table` is `0.1.0`.** The surface (23 props / 12 two-way slices / 14 events / ~25-verb handle / declarative `<Column>` + `columnId`-dispatched cell/header slots / selection / detail / group-bar / filter / editor slots) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established libraries.

## Try it

The [`@rozie-ui/data-table` overview & install](/components/data-table) documents the `@rozie-ui/data-table-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/data-table-react`, etc.) — and links each concept page; the [API reference](/components/data-table-api) carries the dense prop / slice / event / handle tables. The state engine is `@tanstack/table-core` (a peer dependency you control); there is **no required CSS** — a fully-tokenised skin ships inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/data-table-demo) runs the real Vue package in the page.

## Cross-references

- [DataTable — overview & install](/components/data-table) — the package install table and the section index linking quick start, `<Column>` API, theming, and the full API reference.
- [DataTable — live demo](/components/data-table-demo) — the real Vue package running in the page (sort + filter + paginate + select + column management), plus the one `.rozie` source and all six generated outputs.
- [`DataTable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/DataTable.rozie)
- [Listbox — headless select / combobox](/components/listbox-comparison) and [Slider — headless slider / range](/components/slider-comparison) — the sibling no-engine headless families.
