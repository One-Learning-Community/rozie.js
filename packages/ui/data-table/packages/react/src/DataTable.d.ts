import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DataTableProps {
  /**
   * The row data (required). Two-way: a committed cell edit writes a fresh array back through r-model:data. Keep the reference stable — re-feed it directly, never map/clone it in a watcher.
   * @example
   * <DataTable r-model:data="rows" :columns="cols" />
   */
  data?: unknown[];
  defaultData?: unknown[];
  onDataChange?: (next: unknown[]) => void;
  /**
   * Config-array column fallback (lower precedence than <Column> children). Each entry: { id?, field, header?, sortable?, filterable?, pinned?, width? }. Columns may come from this array, from <Column> children, or both (id-keyed last-write-wins union).
   */
  columns?: unknown[];
  /**
   * Row-selection mode: 'none' | 'single' | 'multiple'. 'multiple' auto-injects a leading checkbox column with a select-all header.
   */
  selectionMode?: string;
  /**
   * Sorting state (SortingState = [{ id, desc }]). Two-way: writes funnel a fresh value through the sort-change event regardless of binding.
   */
  sorting?: unknown[];
  defaultSorting?: unknown[];
  onSortingChange?: (next: unknown[]) => void;
  /**
   * Global filter string — feeds getFilteredRowModel() and narrows ALL columns. Two-way: fires filter-change regardless of binding.
   */
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (next: string) => void;
  /**
   * Per-column filter state (ColumnFiltersState = [{ id, value }]). Each <Column> opts in via its filterable flag. Two-way: whole-array replace on write, fires filter-change.
   */
  columnFilters?: unknown[];
  defaultColumnFilters?: unknown[];
  onColumnFiltersChange?: (next: unknown[]) => void;
  /**
   * Pagination state ({ pageIndex, pageSize }) — feeds getPaginationRowModel(). Two-way: funnels a fresh object through page-change.
   */
  pagination?: Record<string, unknown>;
  defaultPagination?: Record<string, unknown>;
  onPaginationChange?: (next: Record<string, unknown>) => void;
  /**
   * Server-side hook: when true, sets manualPagination/manualFiltering/manualSorting — table-core trusts the consumer-supplied rows verbatim and only emits the change events (the consumer fetches each page).
   */
  manual?: boolean;
  /**
   * Opt-in gate for expandable rows. When true a leading chevron expander column auto-injects and every row can expand (the #detail seam) unless getSubRows is supplied. Bind :expandable="true" (a bare attr only coerces on Vue+Lit).
   */
  expandable?: boolean;
  /**
   * Expanded state (ExpandedState = { [rowId]: true } | true). The literal `true` expands ALL rows. Two-way: funnels a fresh value through expanded-change. Defaults to null so the uncontrolled + grouping auto-expand fallbacks stay reachable.
   */
  expanded?: (Record<string, unknown> | boolean) | null;
  defaultExpanded?: (Record<string, unknown> | boolean) | null;
  onExpandedChange?: (next: (Record<string, unknown> | boolean) | null) => void;
  /**
   * Table-level accessor (originalRow, index) => TData[] | undefined returning a row's child rows. When supplied (with expandable), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the #detail scoped slot is the expand mode.
   */
  getSubRows?: ((...args: unknown[]) => unknown) | null;
  /**
   * Opt-in gate for the HEADLESS #groupBar host region. Grouping itself is driven by the `grouping` model slice; this flag only gates the consumer-facing group-bar surface (no built-in drag UI).
   */
  groupable?: boolean;
  /**
   * Grouping state (GroupingState = string[]) — an ordered list of column ids (multi-column → nested groups). Two-way: funnels a fresh array through group-change. Defaults to null so the uncontrolled fallback + grouping auto-expand stay reachable.
   */
  grouping?: (unknown[]) | null;
  defaultGrouping?: (unknown[]) | null;
  onGroupingChange?: (next: (unknown[]) | null) => void;
  /**
   * Row-selection state (RowSelectionState = { [rowId]: true }). Driven by selectionMode chrome. Two-way: fires selection-change regardless of binding. Checkbox-only toggle — the row body does not select.
   */
  rowSelection?: Record<string, unknown>;
  defaultRowSelection?: Record<string, unknown>;
  onRowSelectionChange?: (next: Record<string, unknown>) => void;
  /**
   * Column visibility state (VisibilityState = { [colId]: boolean }). Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through visibility-change.
   */
  columnVisibility?: Record<string, unknown>;
  defaultColumnVisibility?: Record<string, unknown>;
  onColumnVisibilityChange?: (next: Record<string, unknown>) => void;
  /**
   * Column sizing state (ColumnSizingState = { [colId]: number }). A pointer-drag resize handle on resizable headers writes a fresh sizing object. Two-way: fires resize-change.
   */
  columnSizing?: Record<string, unknown>;
  defaultColumnSizing?: Record<string, unknown>;
  onColumnSizingChange?: (next: Record<string, unknown>) => void;
  /**
   * Column order state (ColumnOrderState = string[]). A header drag writes a fresh order array (immutable — never an in-place splice). Two-way: fires reorder-change.
   */
  columnOrder?: unknown[];
  defaultColumnOrder?: unknown[];
  onColumnOrderChange?: (next: unknown[]) => void;
  /**
   * Column pinning state (ColumnPinningState = { left: string[], right: string[] }). Pinned columns get position:sticky with computed offsets so they stay during horizontal scroll. Two-way: fires pin-change.
   */
  columnPinning?: Record<string, unknown>;
  defaultColumnPinning?: Record<string, unknown>;
  onColumnPinningChange?: (next: Record<string, unknown>) => void;
  /**
   * Pure-CSS sticky header gate. When true the <thead> sticks to the top of the scroll container.
   */
  stickyHeader?: boolean;
  /**
   * Forward-compat seam: 'table' (default, row-oriented) | 'grid' (cell keyboard navigation). RESERVED only — grid cell-nav is not implemented yet.
   * @deprecated Reserved forward-compat seam — grid cell-navigation is not implemented yet; do not rely on the `grid` mode.
   */
  interactionMode?: string;
  /**
   * Opt-in gate for vertical row windowing. When true the <tbody> renders a virtualized window via virtual-core; when false it is byte-identical to the non-windowed output.
   */
  virtual?: boolean;
  /**
   * Estimated row height in px — seeds virtual-core's estimateSize before measureElement refines actual heights. Only consulted when virtual is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS string (e.g. "480px") bounding the scroll container — applied inline and mirrored to --rozie-data-table-max-height (the prop wins; the token is the fallback). Empty → the container falls back to the token rule.
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
  renderFilter?: (params: { columnId: unknown; uniqueValues: unknown; minMax: unknown; setFilter: () => void }) => ReactNode;
  renderSelectCell?: (params: { row: unknown; checked: unknown; toggle: unknown }) => ReactNode;
  renderEditor?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown; commit: unknown; cancel: unknown }) => ReactNode;
  renderCell?: (params: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => ReactNode;
  renderSelectAll?: (params: { checked: unknown; indeterminate: unknown; toggle: () => void }) => ReactNode;
  renderColHeader?: (params: { columnId: unknown; column: unknown; label: unknown }) => ReactNode;
  renderColHeader?: (params: { columnId: unknown; column: unknown; label: unknown }) => ReactNode;
  renderFilter?: (params: { columnId: unknown; uniqueValues: unknown; minMax: unknown; setFilter: () => void }) => ReactNode;
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
  editCell: (...args: any[]) => any;
  commitEditing: (...args: any[]) => any;
  editRow: (...args: any[]) => any;
  getSelectedRange: (...args: any[]) => any;
}

declare const DataTable: React.ForwardRefExoticComponent<DataTableProps & React.RefAttributes<DataTableHandle>>;
export default DataTable;
