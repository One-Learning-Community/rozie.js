# DataTable — the cross-framework headless data table

`DataTable` is Rozie's **headless, fully-accessible** data table / data grid — the `@rozie-ui` component that fills a real cross-framework toolchain gap. Sorting, global + per-column filtering, pagination, row selection, and full column management (visibility, resize, reorder, pinning) plus a sticky header are authored once in `DataTable.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is **`@tanstack/table-core`** — the *same* framework-agnostic state machine that powers TanStack Table — wired to each framework's reactivity **with no per-framework adapter**. `table-core` owns no DOM (it is a pure `createTable → setOptions → getRowModel` pull-based state machine), so `DataTable` is the controlled-state half of an engine wrapper with none of the DOM-mutation half: Rozie owns the author-side API (the nine two-way `r-model` slices, the `<Column>` declarative children, the per-column `#cell` / `#header` reactive templates, and the accessible chrome), table-core owns the row model, and the consumer just binds state.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/data-table` packages

`DataTable` ships as six pre-compiled, per-framework packages generated from a single `DataTable.rozie` source (plus the declarative `Column.rozie` child) via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/data-table-react` | `npm i @rozie-ui/data-table-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/react/README.md) |
| `@rozie-ui/data-table-vue` | `npm i @rozie-ui/data-table-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/vue/README.md) |
| `@rozie-ui/data-table-svelte` | `npm i @rozie-ui/data-table-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/svelte/README.md) |
| `@rozie-ui/data-table-angular` | `npm i @rozie-ui/data-table-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/angular/README.md) |
| `@rozie-ui/data-table-solid` | `npm i @rozie-ui/data-table-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/solid/README.md) |
| `@rozie-ui/data-table-lit` | `npm i @rozie-ui/data-table-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/lit/README.md) |

Each package carries `@tanstack/table-core` as a **peer dependency** (so you control the table-core version — it is never a bundled copy) plus only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The codegen also enforces a hard rule: each leaf imports **only** `@tanstack/table-core`, never a `@tanstack/<framework>-table` adapter — the single-core no-adapter design is the whole point of the family. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `DataTable.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Pass a `data` array, declare columns (either as `<Column>` children or via the `:columns` config array), and bind whichever state slices you want to control. Everything works **uncontrolled** out of the box — bind a slice only when you want to own it:

```rozie
<components>
{
  DataTable: './DataTable.rozie',
  Column: './Column.rozie',
}
</components>

<data>
{
  rows: [
    { id: 1, name: 'Ada Lovelace', email: 'ada@analytical.engine', status: 'active' },
    { id: 2, name: 'Alan Turing',  email: 'alan@bletchley.park',   status: 'active' },
    { id: 3, name: 'Grace Hopper', email: 'grace@navy.mil',        status: 'away'   },
  ],
  sorting: [],
}
</data>

<template>
  <DataTable :data="$data.rows" r-model:sorting="$data.sorting" selectionMode="multiple" stickyHeader>
    <Column field="name" header="Name" sortable filterable />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" sortable />

    <!-- One #cell slot on <DataTable>, dispatched by columnId -->
    <template #cell="{ columnId, value }">
      <StatusBadge r-if="columnId === 'status'" :status="value" />
      <template r-else>{{ value }}</template>
    </template>
  </DataTable>
</template>
```

Each `r-model:<slice>` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `DataTable` a state slice, the table writes the fresh slice back on every transition, and the framework reconciler picks it up — no `onChange → setState` wiring. Every slice also has an **uncontrolled fallback**: a slice you do not bind is managed internally (and its change event still fires regardless of binding, so you can observe transitions without two-way binding).

## The `<Column>` declarative API

A `<Column>` declares one column of the table. It is **renderless** — it draws nothing itself; it registers a column spec with the parent `<DataTable>` (via a `$provide`/`$inject` registry) on mount and unregisters on cleanup. The `<td>` / `<th>` hosts are framework-owned by the parent's keyed `r-for`.

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `field` | `String` | `''` | The row field this column reads (table-core `accessorKey`). |
| `header` | `String` | `''` | The header label (rendered when no `#header` template is supplied). |
| `id` | `String` | `''` | The column id. Defaults to `field` when omitted. |
| `sortable` | `Boolean` | `false` | Whether this column participates in click-to-sort. |
| `filterable` | `Boolean` | `false` | Whether this column shows a per-column filter input. |
| `pinned` | `String` | `''` | Initial pin side: `''` (unpinned) \| `'left'` \| `'right'`. |
| `width` | `String \| Number` | `''` | Optional fixed/initial column width (CSS length or px number). |

Because a bare boolean attribute on a child component (`<Column sortable />`) only coerces to `true` on Vue + Lit, **bind it** in the other targets — `:sortable="true"` (React/Solid/Angular/Svelte) — or rely on each consumer framework's own boolean-attribute convention.

### Two coexisting column-declaration forms

Columns may be declared via `<Column>` children **or** via the `:columns` config-array escape hatch **or both** — they resolve to the same internal column set via an **id-keyed last-write-wins union**: the `:columns` array is applied first (lower precedence), then the `<Column>` children override by id. Each config entry is `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`:

```rozie
<DataTable :data="$data.rows" :columns="[
  { field: 'name', header: 'Name', sortable: true },
  { field: 'email', header: 'Email' },
]" />
```

### Cell & header rendering — the parent `#cell` / `#colHeader` slot

A `<Column>` is **renderless** and carries **metadata only** — it never renders a cell itself. Custom cell and header rendering is a **single scoped slot on the parent `<DataTable>`**, `#cell` (scope `{ columnId, column, row, value }`) and `#colHeader` (scope `{ columnId, column, label }`), **dispatched by `columnId`**: you write one slot and switch on `columnId` to vary the render per column. A column the slot does not render (or any column when no slot is supplied) shows the plain accessor value — the fast path. This holds whether columns are declared as `<Column>` children or via the `:columns` array.

> **Why parent-level, not per-`<Column>`?** The `<td>` / `<th>` hosts are framework-owned by the parent's keyed `r-for`, and a renderless child cannot plain-render into a sibling's host. So the one `#cell` / `#colHeader` scoped slot lives on `<DataTable>` and dispatches by `columnId` (design decision **D-A**). The header slot is named `#colHeader` (not `#header`) because a `#header` slot lowers to a Svelte snippet prop named `header`, which collides with a common local.

```rozie
<DataTable :data="$data.rows">
  <Column field="status" header="Status" sortable />
  <!-- One slot, switched by columnId -->
  <template #cell="{ columnId, value }">
    <StatusBadge r-if="columnId === 'status'" :status="value" />
    <template r-else>{{ value }}</template>
  </template>
  <template #colHeader="{ columnId, label }">
    {{ label }}<span r-if="columnId === 'status'"> ⚑</span>
  </template>
</DataTable>
```

> **React / Solid / Lit render-prop form (the one documented cross-framework divergence).** On the JSX/property targets the slot surfaces as a prop holding a render function rather than a `<template>`: React `renderCell` / `renderColHeader`, Solid `cellSlot` / `colHeaderSlot` — `(ctx) => ReactNode` / `JSX.Element` — and Lit the `.cell` / `.colHeader` properties (a function returning a Lit template). The scope object (`{ columnId, column, row, value }` / `{ columnId, column, label }`) is identical across all six. Vue, Svelte (a `{#snippet cell()}`), and Angular (an `<ng-template #cell>`) use their native slot/snippet/template mechanism. See [usage examples](/components/data-table-usage) for the exact per-target snippet.

## API

### Props

The full prop surface. The nine `model: true` slices (the **Two-way** column) are each an independent, optional two-way `r-model` with an uncontrolled fallback; with multiple model props the Angular output emits **no** `ControlValueAccessor` (the multi-model condition disables it — the per-prop `valueChange` outputs still drive each two-way binding).

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `data` | `Array` | `—` | | ✓ | The row data. A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher). |
| `columns` | `Array` | `[]` | | | Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. |
| `selectionMode` | `String` | `"none"` | | | Row-selection mode: `'none'` \| `'single'` \| `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header. |
| `sorting` | `Array` | `[]` | ✓ | | `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. |
| `globalFilter` | `String` | `''` | ✓ | | The global search string — narrows all columns. Surfaces through `filter-change`. |
| `columnFilters` | `Array` | `[]` | ✓ | | `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). |
| `pagination` | `Object` | `{…}` | ✓ | | `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome. |
| `manual` | `Boolean` | `false` | | | Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events. |
| `rowSelection` | `Object` | `{}` | ✓ | | `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). |
| `columnVisibility` | `Object` | `{}` | ✓ | | `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. |
| `columnSizing` | `Object` | `{}` | ✓ | | `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). |
| `columnOrder` | `Array` | `[]` | ✓ | | `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). |
| `columnPinning` | `Object` | `{…}` | ✓ | | `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. |
| `stickyHeader` | `Boolean` | `false` | | | Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container. |
| `interactionMode` | `String` | `"table"` | | | `'table'` (default, row-oriented) \| `'grid'`. `'grid'` lights up the full WAI-ARIA **[grid interaction mode](#grid-interaction-mode)** — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation. `'table'` is byte-behaviorally identical to a plain accessible table. |

### Models (the nine two-way slices)

Each slice is an independent, optional two-way `r-model` with its own uncontrolled fallback and its own change event (which fires **regardless** of whether the slice is bound). All nine state transitions are funneled through table-core; the table always writes a **fresh** value (never an in-place mutation, which would be silently dropped on React/Solid/Angular/Lit).

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `sorting` | `[{ id, desc }]` | `sort-change` | The sort state (header click; shift-click adds a secondary sort). |
| `globalFilter` | `string` | `filter-change` | The global search string — narrows all columns. |
| `columnFilters` | `[{ id, value }]` | `filter-change` | Per-column filter values (gated by each column's `filterable`). |
| `pagination` | `{ pageIndex, pageSize }` | `page-change` | The current page index + size. |
| `rowSelection` | `{ [rowId]: true }` | `selection-change` | The selected-row set (checkbox-only). |
| `columnVisibility` | `{ [colId]: boolean }` | `visibility-change` | Per-column shown/hidden state. |
| `columnSizing` | `{ [colId]: number }` | `resize-change` | Per-column widths (live during a resize drag). |
| `columnOrder` | `string[]` | `reorder-change` | The full column order. |
| `columnPinning` | `{ left: string[], right: string[] }` | `pin-change` | Per-side pinned-column ids. |

### Events

Every change event fires **regardless** of whether the matching `r-model` slice is bound (the uncontrolled-fallback contract), so you can observe transitions without two-way binding. The payload is the fresh slice value (`filter-change` carries `{ globalFilter }` or `{ columnFilters }` depending on which filter changed).

| Event | Description |
| --- | --- |
| `sort-change` | Fired when the sort state changes (header click / shift-click multi-sort / a `sortColumn`/`clearSorting` call). Payload: the fresh `SortingState` `[{ id, desc }]`. |
| `filter-change` | Fired when a filter changes. Payload `{ globalFilter }` for the global search box or `{ columnFilters }` for a per-column filter — both surface through this one event. |
| `page-change` | Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload: the fresh `{ pageIndex, pageSize }`. |
| `selection-change` | Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload: the fresh `RowSelectionState`. |
| `visibility-change` | Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload: the fresh `VisibilityState`. |
| `resize-change` | Fired live during a column resize drag (`columnResizeMode: 'onChange'`). Payload: the fresh `ColumnSizingState`. |
| `reorder-change` | Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload: the fresh `ColumnOrderState`. |
| `pin-change` | Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload: the fresh `ColumnPinningState`. |
| `activecell-change` | **Grid mode only.** Fired when the active cell moves (arrow-key navigation, a click-to-activate, or a `focusCell` call) — but **not** on a clamped no-op edge move. Payload: `{ rowIndex, colIndex }` (integer position over the visible model). See [Grid interaction mode](#grid-interaction-mode). |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism. Each verb drives `@tanstack/table-core` so the matching change event fires.

| Method | Description |
| --- | --- |
| `sortColumn` | Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Fires `sort-change`. |
| `clearSorting` | Clear all sorting — `clearSorting()`. Resets to the unsorted core row model. Fires `sort-change`. |
| `getColumnDefs` | Return the resolved `ColumnDef[]` (the id-keyed LWW union of the `:columns` array and the `<Column>` children). |
| `toggleAllRows` | Select or clear all (filtered) rows — `toggleAllRows(value)`. Fires `selection-change`. |
| `clearSelection` | Clear the row selection — `clearSelection()`. Fires `selection-change` with `{}`. |
| `getSelectedRows` | Return the original row data for the selected rows — `getSelectedRows()` → `unknown[]`. |
| `setPage` | Go to a 0-based page index — `setPage(idx)`. Fires `page-change`. |
| `setRowsPerPage` | Set the page size — `setRowsPerPage(size)`. Fires `page-change`. |
| `toggleColumnVisibility` | Show/hide a column — `toggleColumnVisibility(colId)`. Fires `visibility-change`. |
| `applyColumnOrder` | Set the full column order — `applyColumnOrder(order)`. Fires `reorder-change`. (Named `applyColumnOrder`, not `setColumnOrder`, to avoid colliding with React's auto-generated `columnOrder` model setter — ROZ524.) |
| `resetColumnSizing` | Reset all column widths to their defaults — `resetColumnSizing()`. Fires `resize-change`. |
| `pinColumn` | Pin a column to a side or unpin it — `pinColumn(colId, side)` where `side` is `'left'` \| `'right'` \| `false`. Fires `pin-change`. |
| `focusCell` | **Grid mode.** Move + DOM-focus the active cell by index — `focusCell(rowIndex, colIndex)` (coerced to integers and clamped to the visible model). Fires `activecell-change`. |
| `getActiveCell` | **Grid mode.** Return the current active-cell position — `getActiveCell()` → `{ rowIndex, colIndex }` (integers only; never a row object or DOM node). |
| `clearActiveCell` | **Grid mode.** Reset the roving position to the entry cell (`0,0`) and exit interaction mode — `clearActiveCell()`. Does not emit (a reset, not a navigation). |

### Slots

All slots live on the parent `<DataTable>` (a `<Column>` carries metadata only). The `cell` / `colHeader` slots are single renderers [dispatched by `columnId`](#cell-header-rendering-—-the-parent-cell-colheader-slot). On React/Solid these are render-prop props (`renderCell` / `renderColHeader` / `cellSlot` / `colHeaderSlot`) and on Lit the `.cell` / `.colHeader` properties — the one documented cross-framework divergence.

| Slot | Params | Description |
| --- | --- | --- |
| `cell` | `columnId, column, row, value` | Custom cell renderer — switch on `columnId` to vary per column. A column it does not render shows the plain accessor value. |
| `colHeader` | `columnId, column, label` | Custom header renderer — switch on `columnId`. Falls back to the plain `header` label. |
| `selectAll` | `checked, indeterminate, toggle` | Override the select-all header (only when `selectionMode="multiple"`). `indeterminate` is true on a partial selection. |
| `selectCell` | `row, checked, toggle` | Override the per-row select checkbox (only when `selectionMode="multiple"`). |

## Theming

Every value the component renders is a `--rozie-data-table-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. The public `--rozie-data-table-*` tokens are wired by `themes/base.css` onto the short internal `--rdt-*` tokens the component's scoped `<style>` actually reads — so the table renders zero-config without any theme import, and a theme swap re-skins it without touching structure. Override tokens at any ancestor scope:

```css
.rozie-data-table {
  --rozie-data-table-header-bg: #f8fafc;
  --rozie-data-table-border: 1px solid #e2e8f0;
  --rozie-data-table-selection-accent: #6366f1;
  --rozie-data-table-sort-indicator-opacity: 0.8;
}
```

### Design-system bridges

Each package ships token presets that map the data-table tokens onto a known design system's published CSS variables — import `base.css` first, then a bridge:

```ts
import '@rozie-ui/data-table-react/themes/base.css';      // the documented default token set
import '@rozie-ui/data-table-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--muted…
import '@rozie-ui/data-table-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/data-table-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/themes/base.css). The structural rules (table layout, sticky-header positioning, pinned-column offsets, the resize-handle hit area) are behavior-critical and not consumer-overridable; only the cosmetic values flow through tokens.

## Grid interaction mode

By default `DataTable` is an accessible **table** — Tab steps between the native controls (sort buttons, checkboxes, filters, pagination). Set `interactionMode="grid"` to opt into the full WAI-ARIA **[grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)** pattern, where the whole grid is a single tab-stop and arrow keys move a roving active cell across both axes:

```rozie
<DataTable :data="$data.rows" interactionMode="grid" @activecell-change="onMove($event)">
  <Column field="name" header="Name" sortable />
  <Column field="email" header="Email" />
  <Column field="status" header="Status" sortable />
</DataTable>
```

What flips on:

- **Roles.** The root becomes `role="grid"` and body cells become `role="gridcell"` (headers stay `role="columnheader"`). `'table'` mode keeps `role="table"` / `role="cell"`, byte-for-byte unchanged.
- **Roving tab-stop.** Exactly one cell carries `tabindex="0"` at a time; the rest are `tabindex="-1"`. Tab moves focus *into* the grid (landing on the active cell) and a second Tab moves *out* — the grid is one stop in the page tab order, not one-stop-per-cell. There is **no focus-steal on mount**: the entry cell waits for the first Tab/click.
- **2-D keyboard navigation (APG).** `ArrowLeft/Right/Up/Down` move one cell; `Home`/`End` jump to the row's first/last cell; `Ctrl+Home`/`Ctrl+End` jump to the first/last cell of the grid; `PageUp`/`PageDown` jump by a row page. `ArrowUp` from the first body row crosses into the header row. Every index is clamped to the visible model — a move past an edge is a no-op (and does **not** emit `activecell-change`).
- **Cell-level interaction.** `Enter` (or `F2`) focuses the active cell's first interactive control; `Tab`/`Shift+Tab` then cycle *within* the cell (focus containment); `Escape` returns focus to the cell and resumes navigation. Keys are only intercepted while a cell is focused — a caret inside an in-cell `<input>` reached without `Enter` keeps its native behavior.
- **Mouse + roving model stay in sync.** Clicking a cell makes it the active cell (the roving `tabindex="0"` follows), so the next arrow key continues from where you clicked.
- **Index-addressed, sort/filter-stable.** The active cell is tracked as a `{ rowIndex, colIndex }` pair over the *visible* model — never a stored DOM node — so it survives a re-sort, filter, page change, or column hide/reorder/pin (it clamps to the new bounds rather than getting lost). Hidden columns are simply absent from the navigable order.

Drive and observe it imperatively via the [`focusCell`](#imperative-handle) / `getActiveCell` / `clearActiveCell` handle verbs and the [`activecell-change`](#events) event. The exact behavioral contract is locked by a cross-framework VR matrix (`tests/visual-regression/specs/data-table-grid.spec.ts`) proving REQ-1..7 identically on all six targets.

## Accessibility

- Semantic ARIA table roles throughout: `role="table"` / `role="rowgroup"` / `role="row"` / `role="columnheader"` / `role="cell"`, with `aria-sort` (the string-safe `'ascending'` \| `'descending'` \| `'none'`) on sortable headers.
- **Every interactive control is a native, focusable element** with an accessible name — the sort buttons, the select-all + per-row checkboxes, the pagination prev/next + page-size `<select>`, the global + per-column filter inputs, the column-visibility `<details>` disclosure, the per-header pin buttons, and the edge resize handles. There is no div-with-click-only control.
- The keyboard / focus surface is the **table-oriented** default (Tab between the native controls). Opt into [`interactionMode="grid"`](#grid-interaction-mode) for the full WAI-ARIA **grid** pattern — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation — on top of the same accessible chrome.
- Select-all scopes to the filtered rows (the TanStack default) and shows the indeterminate state on a partial selection.

## See also

- [Data table comparison](/components/data-table-comparison) — how `@rozie-ui/data-table` stacks up against TanStack Table, AG Grid, PrimeVue, Material, and the per-framework grids.
- [DataTable — live demo](/components/data-table-demo) — the real Vue package running in the page, plus the one `.rozie` source and all six generated outputs.
- [`DataTable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/DataTable.rozie)
