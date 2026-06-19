# @rozie-ui/data-table-solid

Idiomatic **solid** `DataTable` — a headless, fully-accessible (WAI-ARIA) data table (sorting, global + per-column filtering, pagination, row selection, column visibility / resize / reorder / pinning, sticky header) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The state engine is `@tanstack/table-core` — the SAME framework-agnostic core behind TanStack Table, wired to this framework's reactivity with NO per-framework adapter. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/data-table-solid
```

Peer dependencies: `solid-js + @tanstack/table-core`. Install them alongside this package.

## Usage

Columns may be declared as a `:columns` config array **or** as `<Column>` children (or both — an id-keyed last-write-wins union). Per-cell rendering is one parent `#cell` / `#colHeader` renderer on `<DataTable>`, dispatched by `columnId`, so it works the same with either column form.

### Columns as a config array

```tsx
import { createSignal } from 'solid-js';
import { DataTable } from '@rozie-ui/data-table-solid';

export function Demo() {
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
  const [sorting, setSorting] = createSignal<{ id: string; desc: boolean }[]>([]);
  return (
    <DataTable data={rows} columns={columns} sorting={sorting()} onSortChange={setSorting} selectionMode="multiple" stickyHeader />
  );
}
```

### Declarative `<Column>` children + a custom cell

```tsx
import { createSignal } from 'solid-js';
import { DataTable, Column } from '@rozie-ui/data-table-solid';

export function Demo() {
  const rows = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ];
  const [sorting, setSorting] = createSignal<{ id: string; desc: boolean }[]>([]);
  return (
    <DataTable
      data={rows}
      sorting={sorting()}
      onSortChange={setSorting}
      selectionMode="multiple"
      stickyHeader
      cellSlot={({ columnId, value }) =>
        columnId === 'status' ? <StatusBadge status={value} /> : value
      }
    >
      <Column field="name" header="Name" sortable filterable />
      <Column field="email" header="Email" />
      <Column field="status" header="Status" sortable />
    </DataTable>
  );
}
```

### Virtualized rows (windowing)

```tsx
import { DataTable, Column } from '@rozie-ui/data-table-solid';

// PROP form — bound maxHeight sizes the scroll container.
export function Demo() {
  const rows = Array.from({ length: 10_000 }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    email: `user${i + 1}@example.com`,
    status: i % 2 ? 'active' : 'away',
  }));
  return (
    <DataTable data={rows} virtual maxHeight="400px">
      <Column field="name" header="Name" />
      <Column field="email" header="Email" />
      <Column field="status" header="Status" />
    </DataTable>
  );
}

// TOKEN form — the same height via the CSS custom property (the prop wins when
// both are set; the token is the fallback). estimateRowHeight tunes the seed:
// <DataTable data={rows} virtual estimateRowHeight={48}
//   style={{ '--rozie-data-table-max-height': '400px' }} />
```

### Editable cells (inline edit + validation)

```tsx
import { createSignal } from 'solid-js';
import { DataTable, Column } from '@rozie-ui/data-table-solid';

export function Demo() {
  // The component OWNS edit state — bind ONE model ('data') + listen for commits.
  const [rows, setRows] = createSignal([
    { id: 1, name: 'Alpha', qty: 3, status: 'active',   active: true,  score: 41 },
    { id: 2, name: 'Beta',  qty: 7, status: 'archived', active: false, score: 92 },
  ]);
  const statusOptions = [
    { value: 'active',   label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'pending',  label: 'Pending' },
  ];
  return (
    <DataTable
      interactionMode="grid"
      data={rows()}
      onDataChange={setRows}
      onCellEditCommit={(p) => console.log('cell commit', p)}
      onRowEditCommit={(p) => console.log('row commit', p)}
      // The #editor scoped slot is a render prop on Solid (the documented edge).
      editorSlot={({ columnId, value, commit, cancel }) =>
        columnId === 'score' ? (
          <span>
            <button onClick={() => commit(Number(value) - 1)}>−</button>
            <button onClick={() => commit(Number(value) + 1)}>+</button>
            <button onClick={() => cancel()}>esc</button>
          </span>
        ) : null
      }
    >
      <Column field="name" header="Name" editable editor="text" />
      <Column field="qty" header="Qty" editable editor="number"
        validate={(value) => Number(value) >= 0 || 'must be >= 0'} />
      <Column field="status" header="Status" editable editor="select" editorOptions={statusOptions} />
      <Column field="active" header="Active" editable editor="checkbox" />
      <Column field="score" header="Score" editable editor="custom" />
    </DataTable>
  );
}
```

## Theming

Every visual value is a `--rozie-data-table-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package (import `base.css` first, then a bridge):

```tsx
import '@rozie-ui/data-table-solid/themes/base.css';
import '@rozie-ui/data-table-solid/themes/shadcn.css';    // or material.css, bootstrap.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `data` | `Array` | `—` | ✓ | ✓ |
| `columns` | `Array` | `[]` |  |  |
| `selectionMode` | `String` | `"none"` |  |  |
| `sorting` | `Array` | `[]` | ✓ |  |
| `globalFilter` | `String` | `''` | ✓ |  |
| `columnFilters` | `Array` | `[]` | ✓ |  |
| `pagination` | `Object` | `{…}` | ✓ |  |
| `manual` | `Boolean` | `false` |  |  |
| `expandable` | `Boolean` | `false` |  |  |
| `expanded` | `any` | `{}` | ✓ |  |
| `getSubRows` | `Function` | `null` |  |  |
| `groupable` | `Boolean` | `false` |  |  |
| `grouping` | `Array` | `[]` | ✓ |  |
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
| `expand-change` | Fired (phase 50) when the expanded-row set changes (an expander chevron toggle — click / Enter / Space — or a `toggleRowExpanded`/`expandAll`/`collapseAll` call). Fires exactly once per change (the echo-guarded write funnel dedups the React multi-render re-entry, D-07) and REGARDLESS of whether `r-model:expanded` is bound. Payload is the fresh `ExpandedState` — a `{ [rowId]: true }` object, or the `true` literal after `expandAll` (Pitfall 2: it is passed through verbatim — never `Object.keys` it without a `=== true` guard). Named `expand-change` (not `expanded-change`): the model:true `expanded` prop owns the `onExpandedChange` callback on the React/Solid Props interface, so the event stems off a distinct name to avoid a duplicate-identifier collision (the house convention every slice follows). |
| `group-change` | Fired (phase 50) when the grouping state changes (a consumer-built `#groupBar` apply/clear, mutating the `grouping` model, or an `applyGrouping`/`clearGrouping` call). Fires exactly once per change (the echo-guarded write funnel dedups the React multi-render re-entry, D-07) and REGARDLESS of whether `r-model:grouping` is bound. Payload is the fresh `GroupingState` — an ORDERED `string[]` of column ids (e.g. `["region","category"]` for nested groups), or `[]` when cleared. Named `group-change` (not `grouping-change`): the model:true `grouping` prop owns the `onGroupingChange` callback on the React/Solid Props interface, so the event stems off a distinct name to avoid a duplicate-identifier collision (the house convention every slice follows — sorting→sort-change, expanded→expand-change). |
| `filter-change` | Fired when a filter changes. Payload is `{ globalFilter }` for the global search box or `{ columnFilters }` (the fresh `ColumnFiltersState` `[{ id, value }]`) for a per-column filter — both surface through this one event. |
| `page-change` | Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload is the fresh `{ pageIndex, pageSize }` object. |
| `selection-change` | Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload is the fresh `RowSelectionState` `{ [rowId]: true }` object. |
| `visibility-change` | Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload is the fresh `VisibilityState` `{ [colId]: boolean }` object. |
| `resize-change` | Fired live during a column resize drag (`columnResizeMode: "onChange"`). Payload is the fresh `ColumnSizingState` `{ [colId]: number }` object. |
| `reorder-change` | Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload is the fresh `ColumnOrderState` `string[]`. |
| `pin-change` | Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload is the fresh `ColumnPinningState` `{ left: string[], right: string[] }` object. |
| `activecell-change` | Fired (grid interaction mode only) whenever the active cell moves — by keyboard navigation or a `focusCell` call. One-way notification; payload is `{ rowIndex, colIndex }` integers over the visible model. Fires on every move including arrow keypresses (D-02). |
| `range-change` | Fired (Phase 51 req-7 / D-07) whenever the rectangular cell-range selection changes — extended by `Shift+Arrow` / `Shift+Click` from the single `extendRange`/`setRangeFocus` call sites (React multi-emit dedup, D-07). One-way notification (the range is NOT a `model:true` slice — the model:true count stays at 10, leaving the Angular multi-model-CVA condition untouched); it is a SEPARATE layer from the row-selection slice and the two never corrupt each other. Payload is `getSelectedRange()` → `{ anchor, focus }` where each corner is a `{ rowIndex, colIndex }` index pair over the visible model (integers only — no row data, no DOM node), or `null` when no range is set. |
| `cell-edit-commit` | Fired (Phase 51) when an editable cell commits a NEW, validated value — once per committed cell, from the single `commitEdit` call site (a rejected/invalid commit fires nothing — D-01). Pairs with the `r-model:data` write (one fresh-array replace per commit). Payload is `{ rowId, columnId, oldValue, newValue }`. `cancel`/`Escape` and a validation failure emit nothing. |
| `row-edit-commit` | Fired (Phase 51 req-6 / D-06) when a FULL-ROW edit commits — once per row save, from the single `commitRow` call site (React multi-emit dedup, D-07). A row enters full-row edit via `Shift+F2` or the `editRow` verb (every editable cell edits at once); one save validates every edited cell (D-01 — a single failure blocks the whole row and emits nothing) then writes the bound `r-model:data` ONCE (a single fresh-array row-object replace with all changes applied) and fires this event ONCE. `Escape` reverts the whole row as a unit and emits nothing. Payload is `{ rowId, changes }` where `changes` is `[{ columnId, oldValue, newValue }]` for ONLY the columns whose value actually changed. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `sortColumn` | Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Drives table-core so `sort-change` fires with the fresh `SortingState`. |
| `clearSorting` | Clear all sorting — `clearSorting()`. Resets to the unsorted core row model and fires `sort-change`. |
| `toggleRowExpanded` | Toggle ONE row's expanded state (phase 50 req-3) — `toggleRowExpanded(rowId)` where `rowId` is the consumer's row `id` (the data field) OR the table-core row id (both resolve). Scans the core flat-row set so a collapsed parent is still resolvable. Drives table-core so `expand-change` fires with the fresh `ExpandedState`. Multi-expand: it does not collapse other open rows. |
| `expandAll` | Open every expandable row (phase 50 req-3) — `expandAll()`. Drives table-core (`toggleAllRowsExpanded(true)`) so `expand-change` fires; the payload may be the `true` expand-all literal (Pitfall 2). |
| `collapseAll` | Collapse every row (phase 50 req-3) — `collapseAll()`. Resets the expanded set to a blank state (`resetExpanded(true)` → `{}`) and fires `expand-change` with `{}`. |
| `getExpandedRows` | Return the original row data for the currently-expanded rows (phase 50 req-3) — `getExpandedRows()` → `unknown[]` (empty when nothing is expanded). The read-verb twin of the `expand-change` event. |
| `applyGrouping` | Set the full grouping — `applyGrouping(cols)` where `cols` is a fresh ORDERED `string[]` of column ids (multi-column → nested groups, e.g. `["region","category"]`). Drives table-core (`table.setGrouping`) so `group-change` fires with the fresh `GroupingState`. (Named `applyGrouping`, not `setGrouping`: a `set<ModelProp>` verb collides with React`s auto-generated `grouping` useState setter and an $expose verb is rename-protected — ROZ524; same `applyColumnOrder` precedent.) |
| `clearGrouping` | Clear all grouping — `clearGrouping()`. Resets to the ungrouped (flat) row model (`table.setGrouping([])`) and fires `group-change` with `[]`. |
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
| `editCell` | Programmatically open the editor on a cell (Phase 51) — `editCell(rowIndex, colIndex)`, addressed by index over the visible model (args coerced to integers + clamped). No-op on a non-editable cell. (Named `editCell`, not `edit`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.) |
| `commitEditing` | Programmatically commit the open editor (Phase 51) — `commitEditing()`. Runs the column validator; on success writes the bound `r-model:data` and fires one `cell-edit-commit`; on a validation failure keeps the editor open (D-01). No-op when no cell is editing. (Named `commitEditing`, not `commit`.) |
| `editRow` | Programmatically enter FULL-ROW edit on a body row (Phase 51 req-6 / D-06) — `editRow(rowIndex)`, addressed by index over the visible model (args coerced to integers + clamped). The API twin of the `Shift+F2` shortcut: every editable cell in the row enters edit at once. A later save commits the whole row in one `r-model:data` write + one `row-edit-commit`; `Escape` reverts the row as a unit. No-op on a row with no editable columns. (Named `editRow`, not `edit`/`editColumn`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.) |
| `getSelectedRange` | Return the current rectangular cell-range selection (Phase 51 req-7 / D-07) — `getSelectedRange()` → `{ anchor, focus }` where each corner is a `{ rowIndex, colIndex }` index pair over the visible model (integers only — no row data, no DOM node, T-49-02), or `{ anchor: null, focus: null }` when no range is set. The range is extended by `Shift+Arrow` / `Shift+Click` and is ONE-WAY (this read verb + the `range-change` event), NOT a `model:true` slice (D-07). (Named `getSelectedRange`, not `getRange`/`getSelection`: collision-clean against `getSelectedRows`, the verb/event/prop, and the Lit ROZ137 reserved sets.) |

```tsx
import { DataTable, type DataTableHandle } from '@rozie-ui/data-table-solid';

let handle: DataTableHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<DataTable ref={(h) => (handle = h)} data={rows} />;
handle?.toggleAllRows(true);
handle?.editRow(0);                       // full-row edit on row 0
const range = handle?.getSelectedRange(); // the active cell-range rectangle
```

## Slots

All rendering slots live on the parent `<DataTable>` (a `<Column>` carries metadata only). The `cell` / `colHeader` slots are single renderers dispatched by `columnId` — switch on it to vary the render per column; a column the slot does not render shows the plain accessor value. (On React/Solid these are render-prop props — `renderCell` / `renderColHeader` / `cellSlot` / `colHeaderSlot`; on Lit they are the `.cell` / `.colHeader` properties — the documented cross-framework divergence.)

| Slot | Params |
| --- | --- |
| (default) |  |
| groupBar | grouping, groupableColumns, applyGrouping, clearGrouping |
| selectAll | checked, indeterminate, toggle |
| colHeader | columnId, column, label |
| selectCell | row, checked, toggle |
| editor | columnId, column, row, value, commit, cancel |
| cell | columnId, column, row, value |
| detail | row |
