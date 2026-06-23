# API reference

The full `DataTable` surface: props, the twelve two-way model slices, change events, the imperative handle, and the slots. For the `<Column>` attribute reference see [Columns](/components/data-table-columns); for the per-framework consumption code see the [usage page](/components/data-table-usage).

## Props

The full prop surface. The twelve `model: true` slices (the **Two-way** column — `data` plus the eleven state slices) are each an independent, optional two-way `r-model` with an uncontrolled fallback; with multiple model props the Angular output emits **no** `ControlValueAccessor` (the multi-model condition disables it — the per-prop `valueChange` outputs still drive each two-way binding).

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `data` | `Array` | `—` | ✓ | ✓ | The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher). |
| `columns` | `Array` | `[]` | | | Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. |
| `selectionMode` | `String` | `"none"` | | | Row-selection mode: `'none'` \| `'single'` \| `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header. |
| `sorting` | `Array` | `[]` | ✓ | | `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. |
| `globalFilter` | `String` | `''` | ✓ | | The global search string — narrows all columns. Surfaces through `filter-change`. |
| `columnFilters` | `Array` | `[]` | ✓ | | `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). |
| `pagination` | `Object` | `{…}` | ✓ | | `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome. |
| `manual` | `Boolean` | `false` | | | Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events. |
| `expandable` | `Boolean` | `false` | | | Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). |
| `expanded` | `any` | `null` | ✓ | | `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand. |
| `getSubRows` | `Function` | `null` | | | Table-level child-row accessor `(originalRow, index) => TData[] \| undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode. |
| `groupable` | `Boolean` | `false` | | | Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI). |
| `grouping` | `Array` | `null` | ✓ | | `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array. |
| `rowSelection` | `Object` | `{}` | ✓ | | `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). |
| `columnVisibility` | `Object` | `{}` | ✓ | | `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. |
| `columnSizing` | `Object` | `{}` | ✓ | | `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). |
| `columnOrder` | `Array` | `[]` | ✓ | | `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). |
| `columnPinning` | `Object` | `{…}` | ✓ | | `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. |
| `stickyHeader` | `Boolean` | `false` | | | Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container. |
| `interactionMode` | `String` | `"table"` | | | `'table'` (default, row-oriented) \| `'grid'`. `'grid'` lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)** — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation. `'table'` is byte-behaviorally identical to a plain accessible table. |
| `virtual` | `Boolean` | `false` | | | Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table. |
| `estimateRowHeight` | `Number` | `40` | | | Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` | | | A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback. |

For the per-column `<Column>` attributes (`field` / `header` / `sortable` / `filterable` / `pinned` / `width` / `groupable` / `aggregationFn` / `editable` / `editor` / `editorOptions` / `validate`), see the [Columns reference](/components/data-table-columns).

## Models (the twelve two-way slices)

Each slice is an independent, optional two-way `r-model` with its own uncontrolled fallback and its own change event (which fires **regardless** of whether the slice is bound). All twelve state transitions are funneled through table-core; the table always writes a **fresh** value (never an in-place mutation, which would be silently dropped on React/Solid/Angular/Lit). The first slice is `data` itself — a committed cell or row edit writes a fresh `data` array back; the remaining eleven are the table-state slices.

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `data` | `TData[]` | `data-change` | The row data. Two-way so committed cell/row edits flow back (uncontrolled fallback `dataDefault`). Always written as a fresh array, never mutated in place. |
| `sorting` | `[{ id, desc }]` | `sort-change` | The sort state (header click; shift-click adds a secondary sort). |
| `globalFilter` | `string` | `filter-change` | The global search string — narrows all columns. |
| `columnFilters` | `[{ id, value }]` | `filter-change` | Per-column filter values (gated by each column's `filterable`). |
| `pagination` | `{ pageIndex, pageSize }` | `page-change` | The current page index + size. |
| `rowSelection` | `{ [rowId]: true }` | `selection-change` | The selected-row set (checkbox-only). |
| `expanded` | `{ [rowId]: true } \| true` | `expand-change` | The expanded-row set (multi-expand; the `true` literal = all rows expanded). |
| `grouping` | `string[]` | `group-change` | The ordered grouping key list (multi-column → nested groups). `[]` is ungrouped. |
| `columnVisibility` | `{ [colId]: boolean }` | `visibility-change` | Per-column shown/hidden state. |
| `columnSizing` | `{ [colId]: number }` | `resize-change` | Per-column widths (live during a resize drag). |
| `columnOrder` | `string[]` | `reorder-change` | The full column order. |
| `columnPinning` | `{ left: string[], right: string[] }` | `pin-change` | Per-side pinned-column ids. |

## Events

Every change event fires **regardless** of whether the matching `r-model` slice is bound (the uncontrolled-fallback contract), so you can observe transitions without two-way binding. The payload is the fresh slice value (`filter-change` carries `{ globalFilter }` or `{ columnFilters }` depending on which filter changed).

| Event | Description |
| --- | --- |
| `sort-change` | Fired when the sort state changes (header click / shift-click multi-sort / a `sortColumn`/`clearSorting` call). Payload: the fresh `SortingState` `[{ id, desc }]`. |
| `filter-change` | Fired when a filter changes. Payload `{ globalFilter }` for the global search box or `{ columnFilters }` for a per-column filter — both surface through this one event. |
| `page-change` | Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload: the fresh `{ pageIndex, pageSize }`. |
| `selection-change` | Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload: the fresh `RowSelectionState`. |
| `expand-change` | Fired when the expanded-row set changes (an expander chevron toggle — click / Enter / Space — or a `toggleRowExpanded`/`expandAll`/`collapseAll` call). Fires exactly once per change. Payload: the fresh `ExpandedState` (`{ [rowId]: true }`, or the `true` literal after `expandAll` — pass through verbatim, never `Object.keys` without a `=== true` guard). Named `expand-change` (not `expanded-change`) so it does not collide with the `expanded` model's `onExpandedChange` callback on the React/Solid Props interface. |
| `group-change` | Fired when the grouping changes (a `#groupBar` apply/clear, mutating the `grouping` model, or an `applyGrouping`/`clearGrouping` call). Fires exactly once per change. Payload: the fresh `GroupingState` — an ordered `string[]` of column ids, or `[]` when cleared. Named `group-change` (not `grouping-change`) so it does not collide with the `grouping` model's `onGroupingChange` callback on the React/Solid Props interface. |
| `visibility-change` | Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload: the fresh `VisibilityState`. |
| `resize-change` | Fired live during a column resize drag (`columnResizeMode: 'onChange'`). Payload: the fresh `ColumnSizingState`. |
| `reorder-change` | Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload: the fresh `ColumnOrderState`. |
| `pin-change` | Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload: the fresh `ColumnPinningState`. |
| `activecell-change` | **Grid mode only.** Fired when the active cell moves (arrow-key navigation, a click-to-activate, or a `focusCell` call) — but **not** on a clamped no-op edge move. Payload: `{ rowIndex, colIndex }` (integer position over the visible model). See [Grid interaction mode](/components/data-table-grid-mode). |
| `cell-edit-commit` | Fired when an editable cell commits a new, **validated** value (Enter, a blur-commit, or a `commitEditing` call). Payload: `{ rowId, columnId, oldValue, newValue }`. **Not** fired on cancel (`Escape`) or a validation failure. See [Editing](/components/data-table-editing). |
| `row-edit-commit` | Fired when a full-row edit commits all its changes at once (Enter in row-edit mode or an `editRow` save). Payload: `{ rowId, changes }` where `changes` is `[{ columnId, oldValue, newValue }]` for the columns whose value actually changed. **Not** fired on `Escape` or a validation failure. |
| `range-change` | **Grid mode only.** Fired when the rectangular cell-range selection changes (extended via `Shift+Arrow` / `Shift+Click`). Payload: `{ anchor, focus }` — each corner a `{ rowIndex, colIndex }` index pair over the visible model, or `{ anchor: null, focus: null }` when no range is set. One-way (this event + the `getSelectedRange` verb), never a `model:true` slice. |

## Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism. Each verb drives `@tanstack/table-core` so the matching change event fires.

| Method | Description |
| --- | --- |
| `sortColumn` | Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Fires `sort-change`. |
| `clearSorting` | Clear all sorting — `clearSorting()`. Resets to the unsorted core row model. Fires `sort-change`. |
| `getColumnDefs` | Return the resolved `ColumnDef[]` (the id-keyed LWW union of the `:columns` array and the `<Column>` children). |
| `toggleAllRows` | Select or clear all (filtered) rows — `toggleAllRows(value)`. Fires `selection-change`. |
| `clearSelection` | Clear the row selection — `clearSelection()`. Fires `selection-change` with `{}`. |
| `getSelectedRows` | Return the original row data for the selected rows — `getSelectedRows()` → `unknown[]`. |
| `toggleRowExpanded` | Toggle one row's expanded state — `toggleRowExpanded(rowId)` (the data `id` field or the table-core row id; both resolve). Multi-expand (does not collapse other rows). Fires `expand-change`. |
| `expandAll` | Open every expandable row — `expandAll()`. Fires `expand-change` (payload may be the `true` literal). |
| `collapseAll` | Collapse every row — `collapseAll()`. Resets the expanded set to `{}`. Fires `expand-change`. |
| `getExpandedRows` | Return the original row data for the currently-expanded rows — `getExpandedRows()` → `unknown[]` (empty when nothing is expanded). |
| `applyGrouping` | Set the full grouping — `applyGrouping(cols)` where `cols` is an ordered `string[]` of column ids (multi-column → nested groups). Fires `group-change`. (Named `applyGrouping`, not `setGrouping`, to avoid colliding with React's auto-generated `grouping` model setter — ROZ524.) |
| `clearGrouping` | Clear all grouping — `clearGrouping()`. Resets to the ungrouped (flat) row model. Fires `group-change` with `[]`. |
| `setPage` | Go to a 0-based page index — `setPage(idx)`. Fires `page-change`. |
| `setRowsPerPage` | Set the page size — `setRowsPerPage(size)`. Fires `page-change`. |
| `toggleColumnVisibility` | Show/hide a column — `toggleColumnVisibility(colId)`. Fires `visibility-change`. |
| `applyColumnOrder` | Set the full column order — `applyColumnOrder(order)`. Fires `reorder-change`. (Named `applyColumnOrder`, not `setColumnOrder`, to avoid colliding with React's auto-generated `columnOrder` model setter — ROZ524.) |
| `resetColumnSizing` | Reset all column widths to their defaults — `resetColumnSizing()`. Fires `resize-change`. |
| `pinColumn` | Pin a column to a side or unpin it — `pinColumn(colId, side)` where `side` is `'left'` \| `'right'` \| `false`. Fires `pin-change`. |
| `getFacetedUniqueValues` | Return a column's **cross-filtered** distinct values — `getFacetedUniqueValues(colId)` → `unknown[]` (keys only; occurrence counts are not exposed). Reflects rows passing all *other* active column filters. Empty array when unavailable. Inert (the faceted models stay off-path) until this verb or the `#filter` slot reads a facet. See [Faceted filtering](/components/data-table-faceted-filtering). |
| `getFacetedMinMaxValues` | Return a numeric column's **cross-filtered** `[min, max]` range — `getFacetedMinMaxValues(colId)` → `[number, number] \| null`. `null` when unavailable or non-numeric. The read twin handed to the `#filter` slot for a numeric range slider. |
| `editCell` | **Editing.** Open the editor on a cell — `editCell(rowIndex, colIndex)` (index-addressed over the visible model; args coerced to integers + clamped). No-op on a non-editable cell. |
| `commitEditing` | **Editing.** Commit the open editor — `commitEditing()`. Runs the column validator; on success writes `r-model:data` and fires one `cell-edit-commit`; on a validation failure keeps the editor open. No-op when no cell is editing. |
| `editRow` | **Editing.** Enter full-row edit on a body row — `editRow(rowIndex)` (the API twin of `Shift+F2`): every editable cell in the row opens at once; a later save commits the whole row in one `r-model:data` write + one `row-edit-commit`. No-op on a row with no editable columns. |
| `getSelectedRange` | Return the current rectangular cell-range selection — `getSelectedRange()` → `{ anchor, focus }` (each corner a `{ rowIndex, colIndex }` index pair, or `{ anchor: null, focus: null }`). One-way (this verb + `range-change`), never a `model:true` slice. |
| `focusCell` | **Grid mode.** Move + DOM-focus the active cell by index — `focusCell(rowIndex, colIndex)` (coerced to integers and clamped to the visible model). Fires `activecell-change`. |
| `getActiveCell` | **Grid mode.** Return the current active-cell position — `getActiveCell()` → `{ rowIndex, colIndex }` (integers only; never a row object or DOM node). |
| `clearActiveCell` | **Grid mode.** Reset the roving position to the entry cell (`0,0`) and exit interaction mode — `clearActiveCell()`. Does not emit (a reset, not a navigation). |

## Slots

All slots live on the parent `<DataTable>` (a `<Column>` carries metadata only). The `cell` / `colHeader` slots are single renderers [dispatched by `columnId`](/components/data-table-columns#cell-header-rendering-—-the-parent-cell-colheader-slot). On React/Solid these are render-prop props (`renderCell` / `renderColHeader` / `cellSlot` / `colHeaderSlot`) and on Lit the `.cell` / `.colHeader` properties — the one documented cross-framework divergence.

| Slot | Params | Description |
| --- | --- | --- |
| `cell` | `columnId, column, row, value` | Custom cell renderer — switch on `columnId` to vary per column. A column it does not render shows the plain accessor value. |
| `colHeader` | `columnId, column, label` | Custom header renderer — switch on `columnId`. Falls back to the plain `header` label. |
| `selectAll` | `checked, indeterminate, toggle` | Override the select-all header (only when `selectionMode="multiple"`). `indeterminate` is true on a partial selection. |
| `selectCell` | `row, checked, toggle` | Override the per-row select checkbox (only when `selectionMode="multiple"`). |
| `detail` | `row` | Custom expanded-row content rendered under an expanded row (only when `expandable` and no `getSubRows`). The React render-prop edge (documented divergence). |
| `groupBar` | `grouping, groupableColumns, applyGrouping, clearGrouping` | **Headless** group-bar (only when `groupable`). Receives the ordered `grouping` array, the `groupableColumns` (`[{ id, label }]`), and the `applyGrouping`/`clearGrouping` helpers so a consumer builds any bar/drag UI. The default render is a non-interactive styled-token reflection (empty when ungrouped); the component ships **no** drag affordance. The React render-prop edge (documented divergence). |
| `filter` | `columnId, uniqueValues, minMax, setFilter` | **Headless** faceted-filter UI (only when a column is `filterable`). `uniqueValues` is the cross-filtered distinct values (`unknown[]`, keys only); `minMax` is the cross-filtered numeric `[min, max]` (or `null`); `setFilter(columnId, value)` applies a column filter through the same funnel the built-in input uses (`value` of `null`/`''` clears it). Build a checkbox list / range slider and call `setFilter` (or drive `columnFilters` directly) — the slot fires no event. See [Faceted filtering](/components/data-table-faceted-filtering). The React render-prop edge (documented divergence). Pair it with the [drop-in filter components](/components/data-table-faceted-filtering#drop-in-filter-components). |
| `editor` | `columnId, column, row, value, commit, cancel` | Custom cell editor (a column with `editor="custom"`, or to override the built-in editor). `value` is the current draft; `commit(newValue)` validates + commits (fires `cell-edit-commit`); `cancel()` closes without saving; `column`/`row` are opaque passthroughs. Pair it with the [drop-in editor components](/components/data-table-editing#drop-in-editor-components). The React render-prop edge (documented divergence). |

## See also

- [Columns](/components/data-table-columns) — the `<Column>` attribute reference and cell/header rendering.
- [Theming](/components/data-table-theming) — the `--rozie-data-table-*` token vocabulary.
- [Per-framework usage code](/components/data-table-usage) — the idiomatic consumption snippet per target.
