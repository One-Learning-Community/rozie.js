import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

import type { Column as TableColumn, ColumnDef, ColumnFiltersState, ColumnOrderState, ColumnPinningState, ColumnSizingState, ExpandedState, GroupingState, PaginationState, RowSelectionState, SortingState, VisibilityState } from '@tanstack/table-core';

/** A cell position as integers over the visible (display-order) model. */
export interface DataTableCellPosition {
  rowIndex: number;
  colIndex: number;
}
/** The active (roving-focus) cell. A header cell reports `rowIndex: null` and `isHeader: true`. */
export interface DataTableActiveCell {
  rowIndex: number | null;
  colIndex: number;
  isHeader: boolean;
}
/** The rectangular cell-range selection. Both corners are `null` when there is no range. */
export interface DataTableRange {
  anchor: DataTableCellPosition | null;
  focus: DataTableCellPosition | null;
}
/** One data column offered to the `#groupBar` slot. */
export interface DataTableGroupableColumn {
  id: string;
  label: string;
}
/** One changed cell inside a row edit commit. */
export interface DataTableCellChange {
  columnId: string;
  oldValue: any;
  newValue: any;
}

/** The `activecell-change` payload. `isHeader` is set when the move landed on or left a header cell. */
export interface DataTableActiveCellChangePayload {
  rowIndex: number | null;
  colIndex: number;
  isHeader?: boolean;
}
/** The `cell-edit-commit` payload: one committed cell. */
export interface DataTableCellEditCommitPayload {
  rowId: string;
  columnId: string;
  oldValue: any;
  newValue: any;
}
/** The `row-edit-commit` payload: the row and every cell the save changed. */
export interface DataTableRowEditCommitPayload {
  rowId: string;
  changes: DataTableCellChange[];
}
/** The `filter-change` payload: `globalFilter` for the search box, `columnFilters` for a per-column filter. Exactly one key is set. */
export interface DataTableFilterChangePayload {
  globalFilter?: string;
  columnFilters?: ColumnFiltersState;
}
/** The `history-change` payload: undo/redo availability. */
export interface DataTableHistoryChangePayload {
  canUndo: boolean;
  canRedo: boolean;
}
/** The `range-change` payload: the new range corners (both `null` when the range cleared). */
export type DataTableRangeChangePayload = DataTableRange;
/** The `row-activate` payload. `row` is the original data object and `index` its position in the rendered model. */
export interface DataTableRowActivatePayload {
  row: any;
  index: number;
  trigger: 'keyboard' | 'click';
}
/** The `visible-range-change` payload: the rendered row window, `end` exclusive. */
export interface DataTableVisibleRangeChangePayload {
  start: number;
  end: number;
}

export interface DataTableProps {
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through the two-way `data` binding (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable data={rows} onDataChange={setRows} columns={cols} />
   */
  data?: unknown[];
  defaultData?: unknown[];
  onDataChange?: (next: unknown[]) => void;
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union). A `pinned` value of `'left'` or `'right'` is applied once as the table's initial `columnPinning` state — identical to `<Column pinned>` — which also REORDERS that column, since table-core orders visible cells `[left-pinned, center, right-pinned]`. A consumer who has already expressed a pin (an initial two-way `columnPinning` model value or an interactive pin) owns the slice and this declaration is ignored.
   */
  columns?: unknown[];
  /**
   * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
   */
  selectionMode?: string;
  /**
   * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
   */
  sorting?: unknown[];
  defaultSorting?: unknown[];
  onSortingChange?: (next: unknown[]) => void;
  /**
   * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
   */
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (next: string) => void;
  /**
   * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
   */
  columnFilters?: unknown[];
  defaultColumnFilters?: unknown[];
  onColumnFiltersChange?: (next: unknown[]) => void;
  /**
   * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
   */
  pagination?: Record<string, unknown>;
  defaultPagination?: Record<string, unknown>;
  onPaginationChange?: (next: Record<string, unknown>) => void;
  /**
   * Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page).
   */
  manual?: boolean;
  /**
   * Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset.
   */
  rowCount?: (number) | null;
  /**
   * Explicit total page count for `manual` pagination; overrides rowCount-derived count.
   */
  pageCount?: (number) | null;
  /**
   * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Pass `expandable` as a real boolean — a valueless attribute only coerces to `true` on Vue and Lit.
   */
  expandable?: boolean;
  /**
   * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
   */
  expanded?: (Record<string, unknown> | boolean) | null;
  defaultExpanded?: (Record<string, unknown> | boolean) | null;
  onExpandedChange?: (next: (Record<string, unknown> | boolean) | null) => void;
  /**
   * Row identity `(originalRow, index, parentRow?) => string | number` — the key `rowSelection`, `expanded` and the per-row caches use. Default null → table-core keys rows by position (`"0"`, `"1"`, … and `"0.1"` for sub-rows), so inserting or removing rows above a selected or expanded row moves that state onto whatever row now sits at its index. Supply it whenever rows can be added or removed while state is held (server push, live lists); the result is coerced to a string.
   */
  getRowId?: ((...args: any[]) => any) | null;
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  getSubRows?: ((...args: any[]) => any) | null;
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  groupable?: boolean;
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding the two-way `grouping` model (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
   */
  grouping?: (unknown[]) | null;
  defaultGrouping?: (unknown[]) | null;
  onGroupingChange?: (next: (unknown[]) | null) => void;
  /**
   * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
   */
  rowSelection?: Record<string, unknown>;
  defaultRowSelection?: Record<string, unknown>;
  onRowSelectionChange?: (next: Record<string, unknown>) => void;
  /**
   * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
   */
  columnVisibility?: Record<string, unknown>;
  defaultColumnVisibility?: Record<string, unknown>;
  onColumnVisibilityChange?: (next: Record<string, unknown>) => void;
  /**
   * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
   */
  columnSizing?: Record<string, unknown>;
  defaultColumnSizing?: Record<string, unknown>;
  onColumnSizingChange?: (next: Record<string, unknown>) => void;
  /**
   * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
   */
  columnOrder?: unknown[];
  defaultColumnOrder?: unknown[];
  onColumnOrderChange?: (next: unknown[]) => void;
  /**
   * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
   */
  columnPinning?: Record<string, unknown>;
  defaultColumnPinning?: Record<string, unknown>;
  onColumnPinningChange?: (next: Record<string, unknown>) => void;
  /**
   * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
   */
  stickyHeader?: boolean;
  /**
   * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
   */
  interactionMode?: string;
  /**
   * Grid mode only. When `true`, a plain click on an **editable** cell opens its editor immediately (single-click-to-edit) instead of just activating the cell. Default `false` keeps click-to-activate (double-click opens the editor). Shift+click (range selection) and clicks on non-editable cells are unaffected.
   */
  singleClickEdit?: boolean;
  /**
   * Grid mode. When `true`, every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Default `false` records no history and Ctrl+Z/Y are inert.
   */
  undoable?: boolean;
  /**
   * The maximum number of undo steps retained (oldest evicted past this depth). Only consulted when `undoable` is `true`.
   */
  undoLimit?: number;
  /**
   * Opt-in windowing grammar: `false` (default, off — byte-identical to a non-virtual table) | `true` or `'rows'` (vertical row windowing; `true` is byte-behavior-identical to every existing consumer, zero churn) | `'columns'` (horizontal column windowing) | `'both'` (both axes windowed). Row windowing renders only the visible slice of rows inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Column windowing renders only the visible slice of leaf columns inside the same `rdt-scroll` container. An unrecognised string behaves as `false`.
   */
  virtual?: boolean | string;
  /**
   * Estimated row height (px) — the first-paint seed for the windowing engine before any row has been measured. Only consulted when rows are windowed. When `autoMeasure` is `true`, later renders progressively refine the estimate from measured content; when `autoMeasure` is `false` this remains the explicit override for every render.
   */
  estimateRowHeight?: number;
  /**
   * Opt-in content-driven row-size estimation. When `true`, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` converges to the true content total on a large table with variable-height rows. Falls back to `estimateRowHeight` before any row has been measured. Default `false` keeps the estimate fixed at `estimateRowHeight` for every render (today's behavior).
   */
  autoMeasure?: boolean;
  /**
   * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
   */
  maxHeight?: string;
  onActivecellChange?: (payload: DataTableActiveCellChangePayload) => void;
  onCellEditCommit?: (payload: DataTableCellEditCommitPayload) => void;
  onExpandChange?: (payload: ExpandedState) => void;
  onFilterChange?: (payload: DataTableFilterChangePayload) => void;
  onGroupChange?: (payload: GroupingState) => void;
  onHistoryChange?: (payload: DataTableHistoryChangePayload) => void;
  onPageChange?: (payload: PaginationState) => void;
  onPinChange?: (payload: ColumnPinningState) => void;
  onRangeChange?: (payload: DataTableRangeChangePayload) => void;
  onReorderChange?: (payload: ColumnOrderState) => void;
  onResizeChange?: (payload: ColumnSizingState) => void;
  onRowActivate?: (payload: DataTableRowActivatePayload) => void;
  onRowEditCommit?: (payload: DataTableRowEditCommitPayload) => void;
  onSelectionChange?: (payload: RowSelectionState) => void;
  onSortChange?: (payload: SortingState) => void;
  onVisibilityChange?: (payload: VisibilityState) => void;
  onVisibleRangeChange?: (payload: DataTableVisibleRangeChangePayload) => void;
  children?: ReactNode;
  renderGroupBar?: (params: { grouping: string[]; groupableColumns: DataTableGroupableColumn[]; applyGrouping: (cols: string[]) => void; clearGrouping: () => void }) => ReactNode;
  renderSelectAll?: (params: { checked: boolean; indeterminate: boolean; toggle: (event: any) => void }) => ReactNode;
  renderPlaceholder?: (params: { index: number; columnId: string }) => ReactNode;
  renderSelectCell?: (params: { row: any; checked: boolean; toggle: (event: any) => void }) => ReactNode;
  renderDetail?: (params: { row: any }) => ReactNode;
  renderColHeader?: (params: { columnId: string; column: TableColumn<any, unknown>; label: string }) => ReactNode;
  renderFilter?: (params: { columnId: string; value: any; uniqueValues: any[]; minMax: [number, number] | null; columnLabel: string; setFilter: (columnId: string, value: any) => void }) => ReactNode;
  renderCell?: (params: { columnId: string; column: TableColumn<any, unknown>; row: any; value: any }) => ReactNode;
  renderEditor?: (params: { columnId: string; column: TableColumn<any, unknown>; row: any; value: any; commit: (value: any) => void; cancel: () => void; columnLabel: string; autofocus: boolean }) => ReactNode;
  slots?: { [key: `colHeader-${string}`]: ((params: { columnId: string; column: TableColumn<any, unknown>; label: string }) => ReactNode) | undefined; [key: `filter-${string}`]: ((params: { columnId: string; value: any; uniqueValues: any[]; minMax: [number, number] | null; columnLabel: string; setFilter: (columnId: string, value: any) => void }) => ReactNode) | undefined; [key: `cell-${string}`]: ((params: { columnId: string; column: TableColumn<any, unknown>; row: any; value: any }) => ReactNode) | undefined; [key: `editor-${string}`]: ((params: { columnId: string; column: TableColumn<any, unknown>; row: any; value: any; commit: (value: any) => void; cancel: () => void; columnLabel: string; autofocus: boolean }) => ReactNode) | undefined; [key: string]: ((...args: any[]) => ReactNode) | undefined; };
}

export interface DataTableHandle {
  sortColumn: (colId: string, desc?: boolean) => void;
  clearSorting: () => void;
  toggleRowExpanded: (rowId: string | number) => void;
  expandAll: () => void;
  collapseAll: () => void;
  getExpandedRows: () => any[];
  applyGrouping: (cols: string[]) => void;
  clearGrouping: () => void;
  getFacetedUniqueValues: (colId: string) => any[];
  getFacetedMinMaxValues: (colId: string) => [number, number] | null;
  getColumnDefs: () => ColumnDef<any, any>[];
  toggleAllRows: (value?: boolean) => void;
  clearSelection: () => void;
  getSelectedRows: () => any[];
  setPage: (idx: number) => void;
  setRowsPerPage: (size: number) => void;
  toggleColumnVisibility: (colId: string) => void;
  applyColumnOrder: (order: string[]) => void;
  resetColumnSizing: () => void;
  pinColumn: (colId: string, side: 'left' | 'right' | false) => void;
  focusCell: (rowIndex: number, colIndex: number) => void;
  getActiveCell: () => DataTableActiveCell;
  clearActiveCell: () => void;
  scrollToRow(index: any, options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' | 'instant'; }): void;
  getScrollElement: () => HTMLElement | null;
  getRowIndexRelativeToPage: (absRow?: number) => number;
  editCell: (rowIndex: number, colIndex: number) => void;
  commitEditing: () => void;
  editRow: (rowIndex: number) => void;
  getSelectedRange: () => DataTableRange;
  cut: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

declare const DataTable: React.ForwardRefExoticComponent<DataTableProps & React.RefAttributes<DataTableHandle>>;
export default DataTable;
