import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DataTableProps {
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable r-model:data="rows" :columns="cols" />
   */
  data?: unknown[];
  defaultData?: unknown[];
  onDataChange?: (next: unknown[]) => void;
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union).
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
   * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Bind `:expandable="true"` (a bare attr only coerces on Vue+Lit).
   */
  expandable?: boolean;
  /**
   * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
   */
  expanded?: (Record<string, unknown> | boolean) | null;
  defaultExpanded?: (Record<string, unknown> | boolean) | null;
  onExpandedChange?: (next: (Record<string, unknown> | boolean) | null) => void;
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  getSubRows?: ((...args: unknown[]) => unknown) | null;
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  groupable?: boolean;
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
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
   * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` (GA since Phase 63) — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
   */
  interactionMode?: string;
  /**
   * Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table.
   */
  virtual?: boolean;
  /**
   * Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
   */
  maxHeight?: string;
  onSortChange?: (...args: unknown[]) => void;
  onExpandChange?: (...args: unknown[]) => void;
  onGroupChange?: (...args: unknown[]) => void;
  onFilterChange?: (...args: unknown[]) => void;
  onPageChange?: (...args: unknown[]) => void;
  onSelectionChange?: (...args: unknown[]) => void;
  onVisibilityChange?: (...args: unknown[]) => void;
  onResizeChange?: (...args: unknown[]) => void;
  onReorderChange?: (...args: unknown[]) => void;
  onPinChange?: (...args: unknown[]) => void;
  onActivecellChange?: (...args: unknown[]) => void;
  onRangeChange?: (...args: unknown[]) => void;
  onCellEditCommit?: (...args: unknown[]) => void;
  onRowEditCommit?: (...args: unknown[]) => void;
  children?: ReactNode;
  renderGroupBar?: (params: { grouping: unknown; groupableColumns: unknown; applyGrouping: () => void; clearGrouping: () => void }) => ReactNode;
  renderSelectAll?: (params: { checked: unknown; indeterminate: unknown; toggle: () => void }) => ReactNode;
  renderColHeader?: (params: { columnId: unknown; column: unknown; label: unknown }) => ReactNode;
  renderColHeader?: (params: { columnId: unknown; column: unknown; label: unknown }) => ReactNode;
  renderSelectCell?: (params: { row: unknown; checked: unknown; toggle: unknown }) => ReactNode;
  renderCell?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => ReactNode;
  renderEditor?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown; commit: unknown; cancel: unknown }) => ReactNode;
  renderCell?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => ReactNode;
  renderDetail?: (params: { row: unknown }) => ReactNode;
  renderSelectAll?: (params: { checked: unknown; indeterminate: unknown; toggle: () => void }) => ReactNode;
  renderColHeader?: (params: { columnId: unknown; column: unknown; label: unknown }) => ReactNode;
  renderColHeader?: (params: { columnId: unknown; column: unknown; label: unknown }) => ReactNode;
  renderSelectCell?: (params: { row: unknown; checked: unknown; toggle: unknown }) => ReactNode;
  renderCell?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => ReactNode;
  renderEditor?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown; commit: unknown; cancel: unknown }) => ReactNode;
  renderCell?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => ReactNode;
  renderDetail?: (params: { row: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface DataTableHandle {
  sortColumn: (...args: any[]) => any;
  clearSorting: (...args: any[]) => any;
  toggleRowExpanded: (...args: any[]) => any;
  expandAll: (...args: any[]) => any;
  collapseAll: (...args: any[]) => any;
  getExpandedRows: (...args: any[]) => any;
  applyGrouping: (...args: any[]) => any;
  clearGrouping: (...args: any[]) => any;
  getFacetedUniqueValues: (...args: any[]) => any;
  getFacetedMinMaxValues: (...args: any[]) => any;
  getColumnDefs: (...args: any[]) => any;
  toggleAllRows: (...args: any[]) => any;
  clearSelection: (...args: any[]) => any;
  getSelectedRows: (...args: any[]) => any;
  setPage: (...args: any[]) => any;
  setRowsPerPage: (...args: any[]) => any;
  toggleColumnVisibility: (...args: any[]) => any;
  applyColumnOrder: (...args: any[]) => any;
  resetColumnSizing: (...args: any[]) => any;
  pinColumn: (...args: any[]) => any;
  focusCell: (...args: any[]) => any;
  getActiveCell: (...args: any[]) => any;
  clearActiveCell: (...args: any[]) => any;
  getRowIndexRelativeToPage: (...args: any[]) => any;
  editCell: (...args: any[]) => any;
  commitEditing: (...args: any[]) => any;
  editRow: (...args: any[]) => any;
  getSelectedRange: (...args: any[]) => any;
  cut: (...args: any[]) => any;
}

declare const DataTable: React.ForwardRefExoticComponent<DataTableProps & React.RefAttributes<DataTableHandle>>;
export default DataTable;
