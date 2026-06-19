# @rozie-ui/data-table-vue

Idiomatic **vue** `DataTable` — a headless, fully-accessible (WAI-ARIA) data table (sorting, global + per-column filtering, pagination, row selection, column visibility / resize / reorder / pinning, sticky header) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The state engine is `@tanstack/table-core` — the SAME framework-agnostic core behind TanStack Table, wired to this framework's reactivity with NO per-framework adapter. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/data-table-vue
```

Peer dependencies: `vue + @tanstack/table-core`. Install them alongside this package.

## Usage

Columns may be declared as a `:columns` config array **or** as `<Column>` children (or both — an id-keyed last-write-wins union). Per-cell rendering is one parent `#cell` / `#colHeader` renderer on `<DataTable>`, dispatched by `columnId`, so it works the same with either column form.

### Columns as a config array

```vue
<script setup lang="ts">
import { ref } from 'vue';
import DataTable from '@rozie-ui/data-table-vue';

const rows = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ];
const columns = [
    { field: 'name',   header: 'Name',   sortable: true, filterable: true },
    { field: 'email',  header: 'Email' },
    { field: 'status', header: 'Status', sortable: true },
  ];
const sorting = ref<{ id: string; desc: boolean }[]>([]);
</script>

<template>
  <DataTable :data="rows" :columns="columns" v-model:sorting="sorting" selection-mode="multiple" sticky-header />
</template>
```

### Declarative `<Column>` children + a custom cell

```vue
<script setup lang="ts">
import { ref } from 'vue';
import DataTable, { Column } from '@rozie-ui/data-table-vue';

const rows = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ];
const sorting = ref<{ id: string; desc: boolean }[]>([]);
</script>

<template>
  <DataTable :data="rows" v-model:sorting="sorting" selection-mode="multiple" sticky-header>
    <Column field="name" header="Name" :sortable="true" :filterable="true" />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" :sortable="true" />

    <!-- One #cell slot on <DataTable>, dispatched by columnId (works with :columns too) -->
    <template #cell="{ columnId, value }">
      <span v-if="columnId === 'status'" class="badge">{{ value }}</span>
      <template v-else>{{ value }}</template>
    </template>
  </DataTable>
</template>
```

### Virtualized rows (windowing)

```vue
<script setup lang="ts">
import DataTable, { Column } from '@rozie-ui/data-table-vue';

const rows = Array.from({ length: 10_000 }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    email: `user${i + 1}@example.com`,
    status: i % 2 ? 'active' : 'away',
  }));
</script>

<template>
  <!-- PROP form — bound :maxHeight sizes the scroll container. -->
  <DataTable :data="rows" :virtual="true" maxHeight="400px">
    <Column field="name" header="Name" />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" />
  </DataTable>

  <!-- TOKEN form — the same height via the CSS custom property (prop wins when
       both are set; the token is the fallback). :estimateRowHeight tunes the seed. -->
  <DataTable
    :data="rows"
    :virtual="true"
    :estimateRowHeight="48"
    style="--rozie-data-table-max-height: 400px"
  >
    <Column field="name" header="Name" />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" />
  </DataTable>
</template>
```

## Theming

Every visual value is a `--rozie-data-table-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package (import `base.css` first, then a bridge):

```ts
import '@rozie-ui/data-table-vue/themes/base.css';
import '@rozie-ui/data-table-vue/themes/shadcn.css';    // or material.css, bootstrap.css
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
| `virtual` | `Boolean` | `false` |  |  |
| `estimateRowHeight` | `Number` | `40` |  |  |
| `maxHeight` | `String` | `''` |  |  |

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
| `activecell-change` | Fired (grid interaction mode only) whenever the active cell moves — by keyboard navigation or a `focusCell` call. One-way notification; payload is `{ rowIndex, colIndex }` integers over the visible model. Fires on every move including arrow keypresses (D-02). |

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
| `focusCell` | Move + focus the active cell (grid interaction mode) — `focusCell(rowIndex, colIndex)`, addressed by index over the visible model (D-03; args coerced to integers and clamped to bounds). Fires `activecell-change`. (Named `focusCell`, not `focus`: a bare `focus` verb shadows the inherited `HTMLElement.focus` on Lit — ROZ137.) |
| `getActiveCell` | Return the current active-cell position — `getActiveCell()` → `{ rowIndex, colIndex }` integers (no row data, no DOM node). |
| `clearActiveCell` | Reset the roving active-cell position to the entry cell and exit interaction mode — `clearActiveCell()`. The next Tab-in re-enters at the entry cell (D-01). (Named `clearActiveCell`, not `clear`: distinct from the listbox `clear` selection verb.) |

```vue
<script setup>
import { ref } from 'vue';
const tbl = ref();          // template ref
</script>

<template>
  <DataTable ref="tbl" :data="rows" />
  <button @click="tbl.clearSelection()">Clear</button>
</template>
```

## Slots

All rendering slots live on the parent `<DataTable>` (a `<Column>` carries metadata only). The `cell` / `colHeader` slots are single renderers dispatched by `columnId` — switch on it to vary the render per column; a column the slot does not render shows the plain accessor value. (On React/Solid these are render-prop props — `renderCell` / `renderColHeader` / `cellSlot` / `colHeaderSlot`; on Lit they are the `.cell` / `.colHeader` properties — the documented cross-framework divergence.)

| Slot | Params |
| --- | --- |
| (default) |  |
| selectAll | checked, indeterminate, toggle |
| colHeader | columnId, column, label |
| selectCell | row, checked, toggle |
| cell | columnId, column, row, value |
