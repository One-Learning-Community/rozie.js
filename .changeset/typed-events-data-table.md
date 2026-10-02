---
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-vue": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-lit": patch
---

DataTable: all 17 event handlers, the imperative handle and the scoped-slot parameters now have real types instead of `(...args: any[]) => void`, `(...args: any[]) => any` and `any`.

- Events: the state events carry the matching TanStack Table type (`sort-change` → `SortingState`, `selection-change` → `RowSelectionState`, `page-change` → `PaginationState`, and likewise `expand-change`, `group-change`, `pin-change`, `reorder-change`, `resize-change`, `visibility-change`). The rest have exported payload types: `DataTableFilterChangePayload`, `DataTableActiveCellChangePayload`, `DataTableCellEditCommitPayload`, `DataTableRowEditCommitPayload`, `DataTableRowActivatePayload`, `DataTableRangeChangePayload`, `DataTableHistoryChangePayload` and `DataTableVisibleRangeChangePayload`.
- Handle: every verb now has a typed signature (for example `sortColumn(colId: string, desc?: boolean)`, `getActiveCell(): DataTableActiveCell`, `getSelectedRange(): DataTableRange`, `pinColumn(colId, 'left' | 'right' | false)`). `DataTableCellPosition`, `DataTableActiveCell`, `DataTableRange` and `DataTableGroupableColumn` are exported.
- Slots: the `#cell`, `#editor`, `#colHeader`, `#filter`, `#selectAll`, `#selectCell`, `#groupBar`, `#placeholder` and `#detail` parameters are typed (`columnId: string`, `commit: (value: any) => void`, `column: Column<any, unknown>`, …).

Row data has no generic, so row-data positions (`row`, `value`, `oldValue`, `newValue`) stay `any`. A handler written against a different payload shape may now be rejected by the type checker.
