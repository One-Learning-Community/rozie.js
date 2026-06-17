# @rozie-ui/data-table-svelte

Idiomatic **svelte** `DataTable` — a headless, fully-accessible (WAI-ARIA) data table (sorting, global + per-column filtering, pagination, row selection, column visibility / resize / reorder / pinning, sticky header) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The state engine is `@tanstack/table-core` — the SAME framework-agnostic core behind TanStack Table, wired to this framework's reactivity with NO per-framework adapter. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/data-table-svelte
```

Peer dependencies: `svelte + @tanstack/table-core`. Install them alongside this package.

## Usage

```svelte
<script lang="ts">
  import DataTable, { Column } from '@rozie-ui/data-table-svelte';

  const rows = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ];
  let sorting = $state<{ id: string; desc: boolean }[]>([]);
</script>

<DataTable data={rows} bind:sorting selectionMode="multiple" stickyHeader>
  <Column field="name" header="Name" sortable filterable />
  <Column field="email" header="Email" />
  <Column field="status" header="Status" sortable />
</DataTable>
```

## Theming

Every visual value is a `--rozie-data-table-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package (import `base.css` first, then a bridge):

```svelte
import '@rozie-ui/data-table-svelte/themes/base.css';
import '@rozie-ui/data-table-svelte/themes/shadcn.css';    // or material.css, bootstrap.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `data` | `Array` | `—` |  | ✓ |
| `columns` | `Array` | `[]` |  |  |
| `selectionMode` | `String` | `"none"` |  |  |
| `sorting` | `Array` | `[]` | ✓ |  |
| `globalFilter` | `String` | `''` | ✓ |  |
| `columnFilters` | `Array` | `[]` | ✓ |  |
| `pagination` | `Object` | `{…}` | ✓ |  |
| `manual` | `Boolean` | `false` |  |  |
| `rowSelection` | `Object` | `{}` | ✓ |  |
| `columnVisibility` | `Object` | `{}` | ✓ |  |
| `columnSizing` | `Object` | `{}` | ✓ |  |
| `columnOrder` | `Array` | `[]` | ✓ |  |
| `columnPinning` | `Object` | `{…}` | ✓ |  |
| `stickyHeader` | `Boolean` | `false` |  |  |
| `interactionMode` | `String` | `"table"` |  |  |

## Events

| Event | Description |
| --- | --- |
| `sort-change` | Fired when the sort state changes (header click / shift-click multi-sort / a `sortColumn`/`clearSorting` call). Payload is the fresh `SortingState` array `[{ id, desc }]`. |
| `filter-change` | Fired when a filter changes. Payload is `{ globalFilter }` for the global search box or `{ columnFilters }` (the fresh `ColumnFiltersState` `[{ id, value }]`) for a per-column filter — both surface through this one event. |
| `page-change` | Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload is the fresh `{ pageIndex, pageSize }` object. |
| `selection-change` | Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload is the fresh `RowSelectionState` `{ [rowId]: true }` object. |
| `visibility-change` | Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload is the fresh `VisibilityState` `{ [colId]: boolean }` object. |
| `resize-change` | Fired live during a column resize drag (`columnResizeMode: "onChange"`). Payload is the fresh `ColumnSizingState` `{ [colId]: number }` object. |
| `reorder-change` | Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload is the fresh `ColumnOrderState` `string[]`. |
| `pin-change` | Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload is the fresh `ColumnPinningState` `{ left: string[], right: string[] }` object. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `sortColumn` | Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Drives table-core so `sort-change` fires with the fresh `SortingState`. |
| `clearSorting` | Clear all sorting — `clearSorting()`. Resets to the unsorted core row model and fires `sort-change`. |
| `getColumnDefs` | Return the resolved `ColumnDef[]` (the id-keyed LWW union of the `:columns` config array and the `<Column>` children) — `getColumnDefs()`. |
| `toggleAllRows` | Select or clear all (filtered) rows — `toggleAllRows(value)`. Drives table-core so `selection-change` fires with the fresh `RowSelectionState`. |
| `clearSelection` | Clear the row selection — `clearSelection()`. Fires `selection-change` with `{}`. |
| `getSelectedRows` | Return the original row data for the currently-selected rows — `getSelectedRows()` → `unknown[]` (empty when nothing is selected). |
| `setPage` | Go to a 0-based page index — `setPage(idx)`. Drives table-core so `page-change` fires with the fresh `{ pageIndex, pageSize }`. |
| `setRowsPerPage` | Set the page size — `setRowsPerPage(size)`. Fires `page-change` with the fresh pagination object. |
| `toggleColumnVisibility` | Show/hide a column — `toggleColumnVisibility(colId)`. Drives table-core so `visibility-change` fires with the fresh `VisibilityState`. |
| `applyColumnOrder` | Set the full column order — `applyColumnOrder(order)` where `order` is a fresh `string[]`. Fires `reorder-change`. (Named `applyColumnOrder`, not `setColumnOrder`: a `set<ModelProp>` verb collides with React`s auto-generated `columnOrder` setter and an $expose verb is rename-protected — ROZ524.) |
| `resetColumnSizing` | Reset all column widths to their defaults — `resetColumnSizing()`. Fires `resize-change`. |
| `pinColumn` | Pin a column to a side or unpin it — `pinColumn(colId, side)` where `side` is `'left'` | `'right'` | `false`. Fires `pin-change` with the fresh `ColumnPinningState`. |

```svelte
<script>
  let tbl;                  // component instance via bind:this
</script>

<DataTable bind:this={tbl} data={rows} />
<button onclick={() => tbl.clearSelection()}>Clear</button>
```

## Slots

The `<Column>` child declares per-column `#cell` / `#header` render templates; the parent `<DataTable>` exposes the selection-chrome slots below. (On React, slots are a render-prop API — the one documented cross-framework divergence.)

| Slot | Params |
| --- | --- |
| (default) |  |
| selectAll | checked, indeterminate, toggle |
| selectCell | row, checked, toggle |
