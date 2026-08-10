# DataTable — overview & install

`DataTable` is Rozie's headless, fully-accessible data table / data grid: the same component, with the same props, twelve two-way state slices, events, imperative handle, and slots, in React, Vue, Svelte, Angular, Solid, and Lit.

## What you get

- **Sorting** — single & multi-column (shift-click)
- **Filtering** — global + per-column, plus headless **faceted filters**
- **Pagination** — client-side, or server-side via `manual` mode
- **Row selection** — single or multiple, with select-all
- **Column management** — visibility, resize, reorder, pinning
- **Sticky header**
- **Row virtualization** — windowed rendering, tested to 100,000 rows
- **Expandable rows & master-detail**
- **Grouping & aggregation** — multi-column, collapsible group rows
- **Inline editing** — single cell or full row, with validation
- **WAI-ARIA grid mode** — 2-D keyboard nav + cell range selection
- **Clipboard & undo/redo** — copy/cut/paste over cell ranges, plus an opt-in grid-wide edit history (the `undoable` prop; `undo`/`redo` verbs + `Ctrl+Z`)
- **Themeable** — CSS-variable tokens; shadcn/ui, Material 3, Bootstrap 5 bridges

Under the hood the "engine" is **`@tanstack/table-core`** — the *same* framework-agnostic state machine that powers TanStack Table — wired to each framework's reactivity **with no per-framework adapter**. `table-core` owns no DOM (it is a pure `createTable → setOptions → getRowModel` pull-based state machine), so `DataTable` is the controlled-state half of an engine wrapper with none of the DOM-mutation half: Rozie owns the author-side API (the twelve two-way `r-model` slices, the `<Column>` declarative children, the per-column `#cell` / `#header` reactive templates, and the accessible chrome), table-core owns the row model, and the consumer just binds state.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/data-table` packages

`DataTable` (plus its declarative `Column` child) ships as six pre-compiled, per-framework packages; install only the one for your framework. There is no build step and no Rozie toolchain to add:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/data-table-react` | `npm i @rozie-ui/data-table-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/react/README.md) |
| `@rozie-ui/data-table-vue` | `npm i @rozie-ui/data-table-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/vue/README.md) |
| `@rozie-ui/data-table-svelte` | `npm i @rozie-ui/data-table-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/svelte/README.md) |
| `@rozie-ui/data-table-angular` | `npm i @rozie-ui/data-table-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/angular/README.md) |
| `@rozie-ui/data-table-solid` | `npm i @rozie-ui/data-table-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/solid/README.md) |
| `@rozie-ui/data-table-lit` | `npm i @rozie-ui/data-table-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/lit/README.md) |

Each package carries **three required peers** besides its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`): `@tanstack/table-core` (the row-model engine), `@tanstack/virtual-core` (row windowing), and `@rozie-ui/popover-<target>` (the popover primitive behind the per-column header menus). All three are peers so you control the versions; none is a bundled copy. Install them alongside the framework package:

```bash
npm i @rozie-ui/data-table-react \
  @tanstack/table-core @tanstack/virtual-core @rozie-ui/popover-react
```

Each leaf imports **only** `@tanstack/table-core`, never a `@tanstack/<framework>-table` adapter; the single-core, no-adapter design is the whole point of the family.

## Explore the docs

This page is the front door. Each concept below has its own page — start at **Quick start**, then dive into whichever capability you need:

- [**Quick start**](/components/data-table-quick-start) — pass `data`, declare columns, and bind the state slices you want to control (everything works uncontrolled out of the box).
- [**Columns**](/components/data-table-columns) — the declarative `<Column>` API, the `:columns` config-array escape hatch, and the parent `#cell` / `#colHeader` rendering slots dispatched by `columnId`.
- [**Sort, filter & paginate**](/components/data-table-sort-filter-paginate) — click + shift-click multi-sort, global and per-column filtering, the pagination chrome, and the `manual` server-side hook.
- [**Faceted filtering**](/components/data-table-faceted-filtering) — the headless `#filter` slot's cross-filtered distinct values / numeric ranges and the `FilterText` / `FilterNumberRange` / `FilterSelect` drop-ins.
- [**Row selection**](/components/data-table-selection) — none / single / multiple selection, the auto-injected checkbox column, and select-all scoping to the filtered rows.
- [**Expandable rows & master-detail**](/components/data-table-expandable) — the `#detail` panel, nested sub-rows via `getSubRows`, multi-expand, and the imperative expand verbs.
- [**Grouping & aggregation**](/components/data-table-grouping) — multi-column grouping, the `aggregationFn` per column, collapsible group headers, and the headless `#groupBar`.
- [**Virtualization**](/components/data-table-virtualization) — opt-in vertical row windowing (tested to 100,000 rows) with `virtual` / `estimateRowHeight` / `maxHeight`.
- [**Editing**](/components/data-table-editing) — editable cells and full-row edit, the five built-in editor types, validation, and the `#editor` slot + drop-in editor components.
- [**Grid mode & keyboard**](/components/data-table-grid-mode) — the opt-in WAI-ARIA grid pattern (`role="grid"`, roving tab-stop, 2-D arrow-key navigation, cell range selection) and the accessibility contract.
- [**API reference**](/components/data-table-api) — the dense Props / Models / Events / Imperative handle / Slots tables.
- [**Theming**](/components/data-table-theming) — the `--rozie-data-table-*` CSS custom properties and the shadcn / Material 3 / Bootstrap 5 design-system bridges.
- [**Comparison**](/components/data-table-comparison) — how `@rozie-ui/data-table` stacks up against TanStack Table, AG Grid, PrimeVue, Material, and the per-framework grids.
- [**Per-framework usage code**](/components/data-table-usage) — the idiomatic consumption snippet for each of the six targets.
- [**Live demo**](/components/data-table-demo) — the real Vue package running in the page, plus the one `.rozie` source and all six generated outputs.

Under the hood the engine is `@tanstack/table-core` (a peer dependency you control), and every visual value is a `--rozie-data-table-*` CSS custom property with a built-in fallback — so the table renders zero-config without any theme import, and a theme swap re-skins it without touching structure. See [Theming](/components/data-table-theming) for the token vocabulary and the design-system bridges.

## See also

- [Data table comparison](/components/data-table-comparison) — how `@rozie-ui/data-table` stacks up against TanStack Table, AG Grid, PrimeVue, Material, and the per-framework grids.
- [DataTable — live demo](/components/data-table-demo) — the real Vue package running in the page, plus the one `.rozie` source and the six generated outputs.
- [`DataTable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/DataTable.rozie)
