# `@rozie-ui/data-table`

A headless, fully-accessible (WAI-ARIA) **data table** for React, Vue, Svelte, Solid, Lit, and Angular — sorting, filtering, pagination, row selection, column visibility / resize / reorder / pinning, sticky header, expandable + nested rows, grouping + aggregation, faceted filtering, row virtualization, inline editing, a spreadsheet-grade grid mode, and grid-wide undo/redo. Every visual value is a CSS custom property, so it re-skins to any design system.

The state engine is [`@tanstack/table-core`](https://tanstack.com/table) — the same framework-agnostic core behind TanStack Table — wired to each framework's native reactivity with **no per-framework adapter**. Windowing rides [`@tanstack/virtual-core`](https://tanstack.com/virtual).

> **This is the source-of-truth package (`private: true`) — you don't install it.** One [Rozie](https://github.com/One-Learning-Community/rozie.js) source (`src/DataTable.rozie`) compiles to six idiomatic, pre-built per-framework leaves. Install the leaf for your framework, not this package.

## Install the leaf for your framework

| Framework | Package | Peer dependencies |
| --- | --- | --- |
| React | [`@rozie-ui/data-table-react`](./packages/react) | `react` · `react-dom` · `@tanstack/table-core` · `@tanstack/virtual-core` · `@floating-ui/dom` |
| Vue | [`@rozie-ui/data-table-vue`](./packages/vue) | `vue` · `@tanstack/table-core` · `@tanstack/virtual-core` · `@floating-ui/dom` |
| Svelte | [`@rozie-ui/data-table-svelte`](./packages/svelte) | `svelte` · `@tanstack/table-core` · `@tanstack/virtual-core` · `@floating-ui/dom` |
| Solid | [`@rozie-ui/data-table-solid`](./packages/solid) | `solid-js` · `@tanstack/table-core` · `@tanstack/virtual-core` · `@floating-ui/dom` |
| Lit | [`@rozie-ui/data-table-lit`](./packages/lit) | `lit` · `@lit/context` · `@lit-labs/preact-signals` · `@preact/signals-core` · `@tanstack/table-core` · `@tanstack/virtual-core` · `@floating-ui/dom` |
| Angular | [`@rozie-ui/data-table-angular`](./packages/angular) | `@angular/core` · `@angular/common` · `@angular/forms` · `@tanstack/table-core` · `@tanstack/virtual-core` · `@floating-ui/dom` |

```bash
npm i @rozie-ui/data-table-react   # + its peers
```

Each leaf ships its own README with framework-idiomatic usage snippets for every feature below — start there. The full cross-framework reference lives in the [documentation site](https://github.com/One-Learning-Community/rozie.js) (`docs/components/data-table-*`).

```tsx
// React — columns as a config array OR <Column> children (id-keyed last-write-wins union)
import { useState } from 'react';
import { DataTable, Column } from '@rozie-ui/data-table-react';

const [sorting, setSorting] = useState([]);

<DataTable data={rows} sorting={sorting} onSortChange={setSorting} selectionMode="multiple" stickyHeader>
  <Column field="name"   header="Name"   sortable filterable />
  <Column field="email"  header="Email" />
  <Column field="status" header="Status" sortable />
</DataTable>
```

## Features

- **Data grid basics** — sorting (single + shift-click multi), global + per-column filtering, client pagination, and a `manual` mode for server-side sort/filter/paginate (with `rowCount` / `pageCount`).
- **Columns** — declare via a `:columns` config array, `<Column>` children, or both. Per-column visibility, resize, reorder, and left/right pinning (sticky offsets computed for you).
- **Selection** — `single` / `multiple` row selection with an auto-injected checkbox column and select-all header.
- **Expandable + nested rows** — a `#detail` panel under any open row, or depth-indented sub-rows via `getSubRows`. Multi-expand.
- **Grouping + aggregation** — an ordered, multi-column `grouping` model (nested groups) with per-column `aggregationFn` (built-in name or custom fn) and a **headless** `#groupBar`.
- **Faceted filtering** — cross-filtered distinct values + numeric min/max exposed to a **headless** `#filter` slot (build any checkbox list / range slider).
- **Virtualization** — opt-in vertical row windowing over the full filtered + sorted model, driven by `@tanstack/virtual-core`.
- **Editing** — inline cell editing with validation, full-row editing, and five built-in editors (text / number / select / checkbox / date) plus a `custom` editor slot.
- **Grid interaction mode** (`interactionMode="grid"`) — a WAI-ARIA `role="grid"` with a roving single tab-stop, 2-D APG arrow-key cell navigation, rectangular range selection, TSV clipboard copy / paste / cut, drag-fill, Delete/Backspace clear, and `Ctrl+A` / `Ctrl+Arrow`.
- **Undo / redo** — opt-in grid-wide history (`undoable`): every committed mutation (edit, paste, fill, cut, clear) is one `Ctrl/Cmd+Z` step, with `history-change` events to drive a toolbar.
- **Headless by default, batteries optional** — the component ships no built-in group-bar / facet / editor UI; opt-in **drop-in** components (`GroupBar`, `DetailPanel`, five `Editor*`, three `Filter*`) are additive named exports you use as-is or fork as a template.
- **Accessible + themeable** — WAI-ARIA throughout; every value is a `--rozie-data-table-*` custom property with ready-made `base.css` + `shadcn` / `material` / `bootstrap` bridges.

## The surface at a glance

- **28 props**, including twelve independent **two-way `r-model` slices** (`data` + eleven table-state slices) — each an optional two-way binding with an uncontrolled fallback.
- **15 change events** — every slice fires its change event *regardless* of whether it's bound, so you can observe transitions without two-way binding.
- **A 34-method imperative handle** (`$expose`) — `sortColumn`, `toggleAllRows`, `expandAll`, `applyGrouping`, `focusCell`, `editRow`, `undo`/`redo`, and more — grabbed via each framework's native ref mechanism.
- **8 scoped slots** — `cell`, `colHeader`, `selectAll`, `selectCell`, `detail`, `groupBar`, `filter`, `editor`.

> **One documented cross-framework divergence:** on React/Solid the scoped slots are render-prop props (`renderCell` / `renderEditor` / …); on Lit they are `.cell` / `.editor` properties; on Vue / Svelte / Angular they are ordinary named scoped slots. See any leaf README's *Slots* section.

Full reference: [Props / events / handle / slots](../../../docs/components/data-table-api.md) · [`<Column>` attributes](../../../docs/components/data-table-columns.md) · [Grid mode](../../../docs/components/data-table-grid-mode.md) · [Theming](../../../docs/components/data-table-theming.md).

## For contributors

This package is **authored once and compiled to six leaves** — you edit `src/`, never `packages/<target>/src/` (those are generated; the leaf READMEs carry a *"do not edit"* banner for exactly this reason).

```
src/
  DataTable.rozie        # the component — props, template, styles
  Column.rozie           # the <Column> metadata child
  Editor*.rozie          # drop-in cell editors (text/number/select/checkbox/date)
  Filter*.rozie          # drop-in facet filters (text/number-range/select)
  GroupBar.rozie         # drop-in group bar     DetailPanel.rozie  # drop-in detail panel
  *.rzts                 # script-partials inlined into <script> at compile
                         # (virtualization, edit lifecycle, grid nav, clipboard,
                         #  undo history, state assembly, …)
```

`.rzts` partials are compile-time script fragments that **dissolve** into each leaf's `<script>` (they are not standalone TS). Two source-only workspace packages compose in the same way — zero runtime dependency:

- [`@rozie-ui/headless-core`](../headless-core) — the shared `windowing.rzts` virtualization math.
- [`@rozie-ui/popover`](../popover) — vendored at codegen time (Option-B authoring-time vendoring) for the per-column header `⋯` menu; `@floating-ui/dom` is its shipped runtime cost (a peer dep on every leaf).

```bash
pnpm --filter @rozie-ui/data-table build   # codegen.mjs: parse-once → emit-6 → vendor themes → render 6 READMEs
pnpm --filter @rozie-ui/data-table test    # source unit tests (behavioral coverage lives in the VR matrix)
```

The real behavioral gate is the cross-framework **visual-regression matrix** in `tests/visual-regression/specs/data-table-*.spec.ts` (22 spec files, run against all six targets in the pinned CI container).

## License

MIT
