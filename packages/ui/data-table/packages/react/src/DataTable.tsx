import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieContext, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './DataTable.css';
import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, getExpandedRowModel, getGroupedRowModel,
// Faceted filtering (phase 50 reqs 8-9, D-03). All three are supplied UNCONDITIONALLY
// (mirrors the expand/group models) — inert until a consumer READS a column facet via the
// getFaceted* $expose verbs or the #filter slot props, so byte-identical-off (req-10) holds.
// getFacetedUniqueValues/getFacetedMinMaxValues default impls are CROSS-FILTERED out of the
// box (D-03 — reflect rows passing all OTHER active column filters); unique values + min/max
// ONLY — occurrence counts are deliberately NOT exposed (Array.from(map.keys()) — D-03).
getFacetedRowModel,
// Aliased to make<…> so the bare names `getFacetedUniqueValues`/`getFacetedMinMaxValues`
// are FREE for the $expose verb helpers below. The $expose IR carries only the verb NAME
// (the `key:value` alias is discarded — ExposedMethod.name), so an exposed
// `getFacetedUniqueValues` lowers to the shorthand `{ getFacetedUniqueValues }`, which MUST
// resolve to the in-scope helper, NOT this table-core factory import (the collision that made
// the verb return the factory fn instead of the keys array — roundout facet block).
getFacetedUniqueValues as makeFacetedUniqueValues, getFacetedMinMaxValues as makeFacetedMinMaxValues } from '@tanstack/table-core';
// Vertical row windowing (phase 53). A3: this static import line is emitted UNCONDITIONALLY
// (virtual-core is a peer dep the consumer installs); byte-identical-off (req-1) is satisfied
// by ALL virtual-core RUNTIME references sitting behind `if ($props.virtual)` / a `virtualizer`
// guard so they never execute when off — the import token is the only static virtual-core
// presence. NO per-framework adapter (the codegen guard forbids @tanstack/<fw>-virtual).
// Vertical row windowing (phase 53). A3: this static import line is emitted UNCONDITIONALLY
// (virtual-core is a peer dep the consumer installs); byte-identical-off (req-1) is satisfied
// by ALL virtual-core RUNTIME references sitting behind `if ($props.virtual)` / a `virtualizer`
// guard so they never execute when off — the import token is the only static virtual-core
// presence. NO per-framework adapter (the codegen guard forbids @tanstack/<fw>-virtual).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

interface GroupBarCtx { grouping: any; groupableColumns: any; applyGrouping: any; clearGrouping: any; }

interface SelectAllCtx { checked: any; indeterminate: any; toggle: any; }

interface ColHeaderCtx { columnId: any; column: any; label: any; }

interface FilterCtx { columnId: any; uniqueValues: any; minMax: any; setFilter: any; }

interface SelectCellCtx { row: any; checked: any; toggle: any; }

interface CellCtx { columnId: any; column: any; row: any; value: any; }

interface EditorCtx { columnId: any; column: any; row: any; value: any; commit: any; cancel: any; }

interface DetailCtx { row: any; }

interface DataTableProps {
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable r-model:data="rows" :columns="cols" />
   */
  data: any[];
  defaultData?: any[];
  onDataChange?: (data: any[]) => void;
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union).
   */
  columns?: any[];
  /**
   * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
   */
  selectionMode?: string;
  /**
   * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
   */
  sorting?: any[];
  defaultSorting?: any[];
  onSortingChange?: (sorting: any[]) => void;
  /**
   * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
   */
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (globalFilter: string) => void;
  /**
   * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
   */
  columnFilters?: any[];
  defaultColumnFilters?: any[];
  onColumnFiltersChange?: (columnFilters: any[]) => void;
  /**
   * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
   */
  pagination?: Record<string, any>;
  defaultPagination?: Record<string, any>;
  onPaginationChange?: (pagination: Record<string, any>) => void;
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
  expanded?: (Record<string, any> | boolean) | null;
  defaultExpanded?: (Record<string, any> | boolean) | null;
  onExpandedChange?: (expanded: (Record<string, any> | boolean) | null) => void;
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  getSubRows?: ((...args: any[]) => any) | null;
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  groupable?: boolean;
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
   */
  grouping?: (any[]) | null;
  defaultGrouping?: (any[]) | null;
  onGroupingChange?: (grouping: (any[]) | null) => void;
  /**
   * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
   */
  rowSelection?: Record<string, any>;
  defaultRowSelection?: Record<string, any>;
  onRowSelectionChange?: (rowSelection: Record<string, any>) => void;
  /**
   * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
   */
  columnVisibility?: Record<string, any>;
  defaultColumnVisibility?: Record<string, any>;
  onColumnVisibilityChange?: (columnVisibility: Record<string, any>) => void;
  /**
   * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
   */
  columnSizing?: Record<string, any>;
  defaultColumnSizing?: Record<string, any>;
  onColumnSizingChange?: (columnSizing: Record<string, any>) => void;
  /**
   * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
   */
  columnOrder?: any[];
  defaultColumnOrder?: any[];
  onColumnOrderChange?: (columnOrder: any[]) => void;
  /**
   * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
   */
  columnPinning?: Record<string, any>;
  defaultColumnPinning?: Record<string, any>;
  onColumnPinningChange?: (columnPinning: Record<string, any>) => void;
  /**
   * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
   */
  stickyHeader?: boolean;
  /**
   * `'table'` (default, row-oriented) | `'grid'`. `'grid'` lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)** — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation. `'table'` is byte-behaviorally identical to a plain accessible table.
   * @deprecated Reserved forward-compat seam — grid cell-navigation is not implemented yet; do not rely on the `grid` mode.
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
  onSortChange?: (...args: any[]) => void;
  onExpandChange?: (...args: any[]) => void;
  onGroupChange?: (...args: any[]) => void;
  onFilterChange?: (...args: any[]) => void;
  onPageChange?: (...args: any[]) => void;
  onSelectionChange?: (...args: any[]) => void;
  onVisibilityChange?: (...args: any[]) => void;
  onResizeChange?: (...args: any[]) => void;
  onReorderChange?: (...args: any[]) => void;
  onPinChange?: (...args: any[]) => void;
  onActivecellChange?: (...args: any[]) => void;
  onRangeChange?: (...args: any[]) => void;
  onCellEditCommit?: (...args: any[]) => void;
  onRowEditCommit?: (...args: any[]) => void;
  children?: ReactNode;
  renderGroupBar?: (ctx: GroupBarCtx) => ReactNode;
  renderSelectAll?: (ctx: SelectAllCtx) => ReactNode;
  renderColHeader?: (ctx: ColHeaderCtx) => ReactNode;
  renderFilter?: (ctx: FilterCtx) => ReactNode;
  renderSelectCell?: (ctx: SelectCellCtx) => ReactNode;
  renderCell?: (ctx: CellCtx) => ReactNode;
  renderEditor?: (ctx: EditorCtx) => ReactNode;
  renderDetail?: (ctx: DetailCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
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

const DataTable = forwardRef<DataTableHandle, DataTableProps>(function DataTable(_props: DataTableProps, ref): JSX.Element {
  const __ctx_data_table_columns = rozieContext("data-table:columns");
  const __defaultColumns = useState(() => (() => [])())[0];
  const props: Omit<DataTableProps, 'columns' | 'selectionMode' | 'manual' | 'expandable' | 'getSubRows' | 'groupable' | 'stickyHeader' | 'interactionMode' | 'virtual' | 'estimateRowHeight' | 'maxHeight'> & { columns: any[]; selectionMode: string; manual: boolean; expandable: boolean; getSubRows: ((...args: any[]) => any) | null; groupable: boolean; stickyHeader: boolean; interactionMode: string; virtual: boolean; estimateRowHeight: number; maxHeight: string } = {
    ..._props,
    columns: _props.columns ?? __defaultColumns,
    selectionMode: _props.selectionMode ?? 'none',
    manual: _props.manual ?? false,
    expandable: _props.expandable ?? false,
    getSubRows: _props.getSubRows ?? null,
    groupable: _props.groupable ?? false,
    stickyHeader: _props.stickyHeader ?? false,
    interactionMode: _props.interactionMode ?? 'table',
    virtual: _props.virtual ?? false,
    estimateRowHeight: _props.estimateRowHeight ?? 40,
    maxHeight: _props.maxHeight ?? '',
  };
  const table = useRef<any>(null);
  const refreshRowModel = useRef<any>(null);
  const virtualizer = useRef<any>(null);
  const pendingEditFollow = useRef<any>(null);
  const gridRoot = useRef<any>(null);
  const gridScrollEl = useRef<any>(null);
  const virtualizerCleanup = useRef<any>(null);
  const expandedTouched = useRef(false);
  const programmatic = useRef(0);
  const remeasurePending = useRef(false);
  const gridEmptyFallback = useRef(false);
  const rangeActive = useRef(false);
  const selectAllBox = useRef<any>(null);
  const fillDragMove = useRef<any>(null);
  const fillDragUp = useRef<any>(null);
  const fillDragging = useRef(false);
  const lastData = useRef<any>(null);
  const lastDataLen = useRef(-1);
  const editTransition = useRef(false);
  const [data, setData] = useControllableState({
    value: props.data,
    defaultValue: props.defaultData ?? [],
    onValueChange: props.onDataChange,
  });
  const [sorting, setSorting] = useControllableState({
    value: props.sorting,
    defaultValue: props.defaultSorting ?? (() => [])(),
    onValueChange: props.onSortingChange,
  });
  const [globalFilter, setGlobalFilter] = useControllableState({
    value: props.globalFilter,
    defaultValue: props.defaultGlobalFilter ?? '',
    onValueChange: props.onGlobalFilterChange,
  });
  const [columnFilters, setColumnFilters] = useControllableState({
    value: props.columnFilters,
    defaultValue: props.defaultColumnFilters ?? (() => [])(),
    onValueChange: props.onColumnFiltersChange,
  });
  const [pagination, setPagination] = useControllableState({
    value: props.pagination,
    defaultValue: props.defaultPagination ?? (() => ({
    pageIndex: 0,
    pageSize: 10
  }))(),
    onValueChange: props.onPaginationChange,
  });
  const [expanded, setExpanded] = useControllableState({
    value: props.expanded,
    defaultValue: props.defaultExpanded ?? null,
    onValueChange: props.onExpandedChange,
  });
  const [grouping, setGrouping] = useControllableState({
    value: props.grouping,
    defaultValue: props.defaultGrouping ?? null,
    onValueChange: props.onGroupingChange,
  });
  const [rowSelection, setRowSelection] = useControllableState({
    value: props.rowSelection,
    defaultValue: props.defaultRowSelection ?? (() => ({}))(),
    onValueChange: props.onRowSelectionChange,
  });
  const [columnVisibility, setColumnVisibility] = useControllableState({
    value: props.columnVisibility,
    defaultValue: props.defaultColumnVisibility ?? (() => ({}))(),
    onValueChange: props.onColumnVisibilityChange,
  });
  const [columnSizing, setColumnSizing] = useControllableState({
    value: props.columnSizing,
    defaultValue: props.defaultColumnSizing ?? (() => ({}))(),
    onValueChange: props.onColumnSizingChange,
  });
  const [columnOrder, setColumnOrder] = useControllableState({
    value: props.columnOrder,
    defaultValue: props.defaultColumnOrder ?? (() => [])(),
    onValueChange: props.onColumnOrderChange,
  });
  const [columnPinning, setColumnPinning] = useControllableState({
    value: props.columnPinning,
    defaultValue: props.defaultColumnPinning ?? (() => ({
    left: [],
    right: []
  }))(),
    onValueChange: props.onColumnPinningChange,
  });
  const _expandableRef = useRef(props.expandable);
  _expandableRef.current = props.expandable;
  const _selectionModeRef = useRef(props.selectionMode);
  _selectionModeRef.current = props.selectionMode;
  const _dataRef = useRef(data);
  _dataRef.current = data;
  const _paginationRef = useRef(pagination);
  _paginationRef.current = pagination;
  const [dataDefault, setDataDefault] = useState<any[]>([]);
  const [sortingDefault, setSortingDefault] = useState<any[]>([]);
  const [globalFilterDefault, setGlobalFilterDefault] = useState('');
  const [columnFiltersDefault, setColumnFiltersDefault] = useState<any[]>([]);
  const [paginationDefault, setPaginationDefault] = useState({
    pageIndex: 0,
    pageSize: 10
  });
  const [rowSelectionDefault, setRowSelectionDefault] = useState<Record<string, any>>({});
  const [expandedDefault, setExpandedDefault] = useState<Record<string, any>>({});
  const [groupingDefault, setGroupingDefault] = useState<any[]>([]);
  const [columnVisibilityDefault, setColumnVisibilityDefault] = useState<Record<string, any>>({});
  const [columnSizingDefault, setColumnSizingDefault] = useState<Record<string, any>>({});
  const [columnOrderDefault, setColumnOrderDefault] = useState<any[]>([]);
  const [columnPinningDefault, setColumnPinningDefault] = useState({
    left: [],
    right: []
  });
  const [columnSizingInfo, setColumnSizingInfo] = useState({
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: []
  });
  const [colReg, setColReg] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<any[]>([]);
  const [headerGroups, setHeaderGroups] = useState<any[]>([]);
  const [rowModelVer, setRowModelVer] = useState(0);
  const [windowVer, setWindowVer] = useState(0);
  const [activeRow, setActiveRow] = useState(0);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const [activeIsHeader, setActiveIsHeader] = useState(false);
  const [activeHeaderLevel, setActiveHeaderLevel] = useState(0);
  const [activeInControl, setActiveInControl] = useState(false);
  const [editingRow, setEditingRow] = useState(-1);
  const [editingCol, setEditingCol] = useState(-1);
  const [draftValue, setDraftValue] = useState<any>(null);
  const [invalidMsg, setInvalidMsg] = useState('');
  const [editVer, setEditVer] = useState(0);
  const [editingRowIndex, setEditingRowIndex] = useState<any>(null);
  const [rowDraft, setRowDraft] = useState<Record<string, any>>({});
  const [rangeAnchor, setRangeAnchor] = useState<any>(null);
  const [rangeFocus, setRangeFocus] = useState<any>(null);
  const [pasteAnnounce, setPasteAnnounce] = useState('');
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);

  // ── Grid interaction-mode constants + DOM root (phase 49, REQ-2/6) ────────────────────
  // Fixed PageUp/PageDown row step (D-06). Phase 53 swaps this for the visible-window size
  // via the same focusActiveCell() scroll-into-view seam — kept a top-level const so that
  // later change is a one-line edit.
  const GRID_PAGE_STEP = 10;
  // The stable table-root element, captured in $onMount (the ONLY ROZ123-safe place to read
  // $el / query DOM across all six). focusActiveCell() resolves cells off this root; it is
  // shadow-safe because the query runs from INSIDE the component's own scope (the listbox
  // querySelector-off-root precedent, proven ×6 by plan 01's probe). NEVER read in a
  // computed/template binding (ROZ123).
  function groupingActiveDefault() {
    return ((grouping != null ? grouping : groupingDefault) || []).length > 0;
  }
  const currentState = useCallback((): any => ({
    sorting: sorting != null ? sorting : sortingDefault,
    globalFilter: globalFilter != null ? globalFilter : globalFilterDefault,
    columnFilters: columnFilters != null ? columnFilters : columnFiltersDefault,
    pagination: pagination != null ? pagination : paginationDefault,
    rowSelection: rowSelection != null ? rowSelection : rowSelectionDefault,
    // expanded (phase 50 req-1/3): ExpandedState ({ [rowId]: true } | the `true` expand-all
    // literal). Passed to table-core verbatim — never Object.keys'd without a `=== true`
    // guard (Pitfall 2). Falls back to $data.expandedDefault when r-model:expanded is unbound.
    // GROUPING AUTO-EXPAND (req-4): when grouping is active and the consumer has neither bound
    // `expanded` nor toggled a group yet (!expandedTouched), default to the `true` expand-all
    // literal so the grouped subtree is visible by default; the first toggle latches
    // expandedTouched and the user's expanded state wins thereafter. Non-grouping path is
    // unchanged → byte-identical-off (the table + the expandable-rows feature both keep
    // $data.expandedDefault).
    expanded: expanded != null ? expanded : groupingActiveDefault() && !expandedTouched.current ? true : expandedDefault,
    // grouping (phase 50 reqs 4-7): GroupingState = ordered string[] of column ids. Falls back
    // to $data.groupingDefault when r-model:grouping is unbound. table-core's getGroupedRowModel
    // is inert when this is empty (byte-identical-off, req-10).
    grouping: grouping != null ? grouping : groupingDefault,
    columnVisibility: columnVisibility != null ? columnVisibility : columnVisibilityDefault,
    columnSizing: columnSizing != null ? columnSizing : columnSizingDefault,
    columnOrder: columnOrder != null ? columnOrder : columnOrderDefault,
    columnPinning: columnPinning != null ? columnPinning : columnPinningDefault,
    // columnSizingInfo: table-core's transient resize-gesture state. We pass an
    // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
    // `column.getIsResizing()` / `getResizeHandler()` read
    // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
    // absent. Seed the default shape (matches table-core's
    // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
    // every render. Not a two-way model slice (transient gesture state, not consumer
    // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
    columnSizingInfo: columnSizingInfo
  }), [columnFilters, columnFiltersDefault, columnOrder, columnOrderDefault, columnPinning, columnPinningDefault, columnSizing, columnSizingDefault, columnSizingInfo, columnVisibility, columnVisibilityDefault, expanded, expandedDefault, globalFilter, globalFilterDefault, grouping, groupingActiveDefault, groupingDefault, pagination, paginationDefault, rowSelection, rowSelectionDefault, sorting, sortingDefault]);
  const currentData = useCallback((): any => data != null ? data : dataDefault, [data, dataDefault]);
  function isSafeKey(k: any) {
    return k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  }
  function wrapAggregationFn(fn: any) {
    if (typeof fn === 'string') return fn;
    if (typeof fn !== 'function') return undefined;
    return (columnId: any, leafRows: any, childRows: any) => {
      try {
        return fn(columnId, leafRows, childRows);
      } catch (err: any) {
        return undefined;
      }
    };
  }
  function buildConfigDef(c: any) {
    if (!c) return null;
    // Grouped (multi-level) header column: an entry carrying a `columns` array. table-core's
    // getHeaderGroups() yields ONE extra header-row level per group depth — the parent group
    // header spans its leaf children (B12). The group id falls back to its header text so it
    // stays addressable (no accessor; group columns carry no data).
    if (Array.isArray(c.columns)) {
      const gid = c.id != null ? c.id : c.header;
      if (gid == null) return null;
      const id = String(gid);
      if (!isSafeKey(id)) return null;
      const kids = [];
      for (const child of c.columns as any) {
        const cd = buildConfigDef(child);
        if (cd) kids.push(cd);
      }
      if (!kids.length) return null;
      return {
        id,
        header: c.header != null ? c.header : id,
        columns: kids
      };
    }
    const rawId = c.id != null ? c.id : c.field;
    if (rawId == null) return null;
    const id = String(rawId);
    if (!isSafeKey(id)) return null;
    return {
      id,
      accessorKey: c.field != null ? c.field : id,
      header: c.header != null ? c.header : id,
      enableSorting: c.sortable === true,
      // per-column filter opt-in (req-5). table-core gates the filter input + value
      // funnel on enableColumnFilter; a column with filterable !== true cannot be
      // filtered (and renders no per-column filter input in the chrome below).
      enableColumnFilter: c.filterable === true,
      filterable: c.filterable === true,
      // Expandable-rows reserved per-column metadata (phase 50, D-04).
      expandable: c.expandable === true,
      // Grouping (phase 50 reqs 4-7): groupable defaults TRUE (opt-OUT via groupable:false)
      // so every data column is offered to the headless #groupBar by default; the per-column
      // aggregationFn (built-in name OR custom fn) flows straight onto the ColumnDef (D-05),
      // a custom fn defensively wrapped (T-50-04).
      groupable: c.groupable !== false,
      aggregationFn: wrapAggregationFn(c.aggregationFn),
      pinned: c.pinned != null ? c.pinned : '',
      width: c.width != null ? c.width : '',
      // Editable-cell config (Phase 51) → ColumnDef.meta, the table-core per-column
      // metadata carrier the display↔editor branch + runValidator read. Off by default.
      meta: {
        editable: c.editable === true,
        editor: c.editor != null ? c.editor : 'text',
        editorOptions: c.editorOptions != null ? c.editorOptions : [],
        validate: typeof c.validate === 'function' ? c.validate : null
      }
    };
  }
  function columnDefs() {
    const byId = Object.create(null);
    const order = [];
    const cfg = props.columns || [];
    for (const c of cfg as any) {
      const def = buildConfigDef(c);
      if (!def) continue;
      const id = def.id;
      if (!(id in byId)) order.push(id);
      byId[id] = def;
    }
    const reg = colReg || {};
    for (const id in reg) {
      if (!isSafeKey(id)) continue;
      const spec = reg[id];
      if (!spec) continue;
      if (!(id in byId)) order.push(id);
      byId[id] = {
        id,
        accessorKey: spec.field != null ? spec.field : id,
        header: spec.header != null ? spec.header : id,
        enableSorting: spec.sortable === true,
        enableColumnFilter: spec.filterable === true,
        filterable: spec.filterable === true,
        // Expandable-rows reserved per-column metadata (phase 50, D-04).
        expandable: spec.expandable === true,
        // Grouping (phase 50 reqs 4-7) — same shape as the config branch (D-05 / T-50-04).
        groupable: spec.groupable !== false,
        aggregationFn: wrapAggregationFn(spec.aggregationFn),
        pinned: spec.pinned != null ? spec.pinned : '',
        width: spec.width != null ? spec.width : '',
        // Editable-cell config (Phase 51) → ColumnDef.meta from the <Column> registry spec.
        meta: {
          editable: spec.editable === true,
          editor: spec.editor != null ? spec.editor : 'text',
          editorOptions: spec.editorOptions != null ? spec.editorOptions : [],
          validate: typeof spec.validate === 'function' ? spec.validate : null
        }
      };
    }
    const out = [];
    for (const id of order as any) if (byId[id]) out.push(byId[id]);
    return out;
  }
  // The constant id of the auto-injected leading checkbox column (D-04). Distinct from
  // any consumer column id (the registry/config guard never produces a leading "__").
  const SELECT_COL_ID = '__rdt_select';

  // The constant id of the auto-injected leading chevron expander column (phase 50, D-04).
  // Distinct from any consumer column id (the registry/config guard never produces a leading
  // "__"). Injected AFTER the select column (so order is [select, expander, ...userCols]).
  // The constant id of the auto-injected leading chevron expander column (phase 50, D-04).
  // Distinct from any consumer column id (the registry/config guard never produces a leading
  // "__"). Injected AFTER the select column (so order is [select, expander, ...userCols]).
  const EXPANDER_COL_ID = '__rdt_expander';

  // The table-core ColumnDef set actually fed to createTable / setOptions: the resolved
  // user columns, PLUS a LEADING checkbox column when selectionMode is 'single' OR
  // 'multiple' (D-04). The select column carries enableSorting/enableColumnFilter:false
  // and an isSelectColumn marker the template uses to render checkbox chrome (NOT an
  // accessor value). 'none' injects nothing. In 'single' mode the per-row checkbox
  // renders but the select-all HEADER checkbox is suppressed (selecting a row caps at
  // ≤1 via enableMultiRowSelection:false) — a single-select needs a per-row control,
  // not a select-all, so without injecting the column single mode would expose NO
  // selection UI at all.
  function selectionEnabled() {
    return props.selectionMode === 'single' || props.selectionMode === 'multiple';
  }
  const tableColumns = useCallback(() => {
    const cols = columnDefs();
    // Expander column (phase 50, D-04): injected LEADING when expandable, carrying an
    // isExpanderColumn marker the template uses to render the chevron toggle (NOT an accessor
    // value). enableSorting/enableColumnFilter:false (it is chrome, not data). Off by default
    // → byte-identical-off (req-10).
    let withExpander = cols;
    if (props.expandable === true) {
      const expanderCol = {
        id: EXPANDER_COL_ID,
        enableSorting: false,
        enableColumnFilter: false,
        filterable: false,
        isExpanderColumn: true,
        pinned: '',
        width: ''
      };
      withExpander = [expanderCol].concat(cols);
    }
    if (selectionEnabled()) {
      const selectCol = {
        id: SELECT_COL_ID,
        enableSorting: false,
        enableColumnFilter: false,
        filterable: false,
        isSelectColumn: true,
        pinned: '',
        width: ''
      };
      return [selectCol].concat(withExpander);
    }
    return withExpander;
  }, [columnDefs, props.expandable, selectionEnabled]);
  function writeSorting(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setSortingDefault(next); // fresh array only (never in-place)
    setSorting(next); // two-way emit if bound (no-op-diff if not)
    props.onSortChange && props.onSortChange(next);
    programmatic.current--;
  }
  function applyUpdater(updater: any, current: any) {
    return typeof updater === 'function' ? updater(current) : updater;
  }
  function writeExpanded(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    // Latch the grouping auto-expand default (req-4): the FIRST expand/collapse toggle means
    // the user now owns the expanded state, so currentState() stops defaulting grouped rows to
    // the `true` expand-all literal and honors $data.expandedDefault from here on.
    expandedTouched.current = true;
    setExpandedDefault(next); // fresh value only (never in-place)
    setExpanded(next); // two-way emit if bound (no-op-diff if not)
    // Event stem is `expand-change`, NOT `expanded-change`: the model:true `expanded`
    // prop auto-generates an `onExpandedChange` callback on the React/Solid flat Props
    // interface, and an `expanded-change` event would camelCase to the SAME identifier
    // → duplicate-identifier TS2300 (the model-prop==emit-name collision class). Every
    // sibling slice avoids this by stemming the event off a DISTINCT name (sorting→
    // sort-change, rowSelection→selection-change); `expanded`→`expand-change` follows suit.
    props.onExpandChange && props.onExpandChange(next);
    programmatic.current--;
  }
  function writeGrouping(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setGroupingDefault(next); // fresh ordered array only (never in-place push)
    setGrouping(next); // two-way emit if bound (no-op-diff if not)
    props.onGroupChange && props.onGroupChange(next);
    programmatic.current--;
  }
  function writeGlobalFilter(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setGlobalFilterDefault(next);
    setGlobalFilter(next);
    props.onFilterChange && props.onFilterChange({
      globalFilter: next
    });
    programmatic.current--;
  }
  function writeColumnFilters(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnFiltersDefault(next);
    setColumnFilters(next);
    props.onFilterChange && props.onFilterChange({
      columnFilters: next
    });
    programmatic.current--;
  }
  function writePagination(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setPaginationDefault(next);
    setPagination(next);
    props.onPageChange && props.onPageChange(next);
    programmatic.current--;
  }
  function writeRowSelection(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setRowSelectionDefault(next);
    setRowSelection(next);
    props.onSelectionChange && props.onSelectionChange(next);
    programmatic.current--;
  }
  function writeColumnVisibility(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnVisibilityDefault(next);
    setColumnVisibility(next);
    props.onVisibilityChange && props.onVisibilityChange(next);
    programmatic.current--;
  }
  function writeColumnSizing(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnSizingDefault(next);
    setColumnSizing(next);
    props.onResizeChange && props.onResizeChange(next);
    programmatic.current--;
  }
  function writeColumnOrder(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnOrderDefault(next);
    setColumnOrder(next);
    props.onReorderChange && props.onReorderChange(next);
    programmatic.current--;
  }
  function writeColumnPinning(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnPinningDefault(next);
    setColumnPinning(next);
    props.onPinChange && props.onPinChange(next);
    programmatic.current--;
  }
  function writeData(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setDataDefault(next); // fresh array only (never in-place)
    setData(next); // two-way emit if bound (no-op-diff if not)
    programmatic.current--;
  }
  function columnFilterValue(colId: any) {
    const cf = currentState().columnFilters || [];
    for (const f of cf as any) if (f && f.id === colId) return f.value != null ? f.value : '';
    return '';
  }
  function setColumnFilter(colId: any, value: any) {
    const prev = currentState().columnFilters || [];
    const next = [];
    for (const f of prev as any) if (f && f.id !== colId) next.push(f);
    if (value != null && value !== '') next.push({
      id: colId,
      value
    });
    writeColumnFilters(next);
  }
  const onSortingChangeCb = useCallback((updater: any) => {
    writeSorting(applyUpdater(updater, currentState().sorting));
  }, [applyUpdater, currentState, writeSorting]);
  const onExpandedChangeCb = useCallback((updater: any) => {
    writeExpanded(applyUpdater(updater, currentState().expanded));
  }, [applyUpdater, currentState, writeExpanded]);
  const onGroupingChangeCb = useCallback((updater: any) => {
    writeGrouping(applyUpdater(updater, currentState().grouping));
  }, [applyUpdater, currentState, writeGrouping]);
  const onGlobalFilterChangeCb = useCallback((updater: any) => {
    writeGlobalFilter(applyUpdater(updater, currentState().globalFilter));
  }, [applyUpdater, currentState, writeGlobalFilter]);
  const onColumnFiltersChangeCb = useCallback((updater: any) => {
    writeColumnFilters(applyUpdater(updater, currentState().columnFilters));
  }, [applyUpdater, currentState, writeColumnFilters]);
  const onPaginationChangeCb = useCallback((updater: any) => {
    writePagination(applyUpdater(updater, currentState().pagination));
  }, [applyUpdater, currentState, writePagination]);
  const onRowSelectionChangeCb = useCallback((updater: any) => {
    writeRowSelection(applyUpdater(updater, currentState().rowSelection));
  }, [applyUpdater, currentState, writeRowSelection]);
  const onColumnVisibilityChangeCb = useCallback((updater: any) => {
    writeColumnVisibility(applyUpdater(updater, currentState().columnVisibility));
  }, [applyUpdater, currentState, writeColumnVisibility]);
  const onColumnSizingChangeCb = useCallback((updater: any) => {
    writeColumnSizing(applyUpdater(updater, currentState().columnSizing));
  }, [applyUpdater, currentState, writeColumnSizing]);
  const onColumnOrderChangeCb = useCallback((updater: any) => {
    writeColumnOrder(applyUpdater(updater, currentState().columnOrder));
  }, [applyUpdater, currentState, writeColumnOrder]);
  const onColumnPinningChangeCb = useCallback((updater: any) => {
    writeColumnPinning(applyUpdater(updater, currentState().columnPinning));
  }, [applyUpdater, currentState, writeColumnPinning]);
  const onColumnSizingInfoChangeCb = useCallback((updater: any) => {
    const next = applyUpdater(updater, columnSizingInfo);
    setColumnSizingInfo(prev => next != null ? next : prev);
  }, [applyUpdater, columnSizingInfo]);
  const windowSource = useCallback(() => {
    if (!table.current) return [];
    if (props.virtual) return table.current.getPrePaginationRowModel().rows;
    return table.current.getRowModel().rows;
  }, [props.virtual]);
  function scheduleRemeasure() {
    if (remeasurePending.current) return;
    remeasurePending.current = true;
    let ranMicro = false;
    const microPass = () => {
      remeasureWindow();
    };
    const rafPass = () => {
      remeasurePending.current = false;
      remeasureWindow();
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) remeasurePending.current = false;else setTimeout(rafPass, 0);
  }
  function pinnedEditIndex() {
    if (editingRow >= 0) return editingRow;
    if (editingRowIndex != null) return editingRowIndex;
    return -1;
  }
  function pinnedMeasurement(pin: any) {
    if (!virtualizer.current || pin < 0) return null;
    const ms = virtualizer.current.getMeasurements();
    return ms && ms[pin] ? ms[pin] : null;
  }
  const remeasureWindow = useCallback(() => {
    if (!virtualizer.current || !gridRoot.current) return;
    // Bail ONLY while a PROGRAMMATIC scroll is in flight: virtualizer.scrollState is non-null
    // exclusively during scrollToIndex / scrollToOffset (the D-12 scroll-then-focus seam) and
    // null for ordinary user/scrollTop-driven scrolling (verified virtual-core@3.17.1: set in
    // scrollToIndex L992, cleared to null on reconcile L378). Measuring mid-scrollToIndex lets
    // resizeItem nudge the offset and starve the scroll target (the Solid off-window focus
    // regression); the next settled onChange re-measures the stable window. Manual-scroll
    // recycling (the CR-01 case) has scrollState === null, so it measures normally.
    if (virtualizer.current.scrollState) return;
    const trs = gridRoot.current.querySelectorAll('tbody.rdt-tbody > tr[data-index]');
    for (const tr of trs as any) virtualizer.current.measureElement(tr);
  }, []);
  function virtualItemKey(i: any) {
    const src = windowSource();
    return src && src[i] ? src[i].id : undefined;
  }
  const virtualizerOptions = useCallback((): any => ({
    count: windowSource().length,
    getScrollElement: () => gridScrollEl.current,
    estimateSize: () => props.estimateRowHeight,
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    measureElement,
    overscan: 8,
    getItemKey: virtualItemKey,
    onChange: () => {
      setWindowVer(prev => prev + 1);
      // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
      // virtual-core only observe()s a node you explicitly hand to measureElement (it does
      // NOT auto-discover rendered rows — measureElement is the SOLE caller of
      // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
      // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
      // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
      // so the new <tr> set is in the DOM before we measure. Safe from an infinite
      // measure→onChange→measure loop: measureElement is idempotent on an already-observed
      // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
      // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
      // re-measure is a no-op.
      scheduleRemeasure();
    }
  }), [props.estimateRowHeight, scheduleRemeasure, virtualItemKey, windowSource]);
  function pinMeasurement(pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null {
    return pinnedMeasurement(pin);
  }
  function windowedRows() {
    // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
    // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
    // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
    // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
    // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
    // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
    // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
    // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
    // first re-run that picks up the now-non-null virtualizer.
    // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
    // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
    void windowVer;
    void editVer;
    if (!virtualizer.current) {
      // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
      // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
      // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
      // rows appear on the first onChange after _didMount.
      if (!props.virtual) {
        const rowList = rows || [];
        return rowList.map((r: any) => ({
          vi: null,
          row: r
        }));
      }
      return [];
    }
    const items = virtualizer.current.getVirtualItems();
    const rowList = rows || [];
    // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
    // shrink window where the virtualizer count is stale relative to $data.rows on the async
    // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
    // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
    const out = items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
    // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
    // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
    // into another full-model row), LEADING the slice when it sits above the window and TRAILING
    // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
    // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
    // into the real windowing.
    const pin = pinnedEditIndex();
    if (pin >= 0 && rowList[pin]) {
      let inWindow = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].index === pin) {
          inWindow = true;
          break;
        }
      }
      if (!inWindow) {
        const pm = pinMeasurement(pin);
        const firstStart = items.length ? items[0].start : 0;
        const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
        const pinnedEntry = {
          vi: pm != null ? pm : {
            index: pin
          },
          row: rowList[pin],
          pinned: true
        };
        if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
      }
    }
    return out;
  }
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void windowVer;
    void editVer;
    if (!props.virtual || !virtualizer.current) return 0;
    const items = virtualizer.current.getVirtualItems();
    let pad = items.length ? items[0].start : 0;
    // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
    // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
    // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
    }
    return pad < 0 ? 0 : pad;
  }
  function padBottom() {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
    // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
    // on pin/unpin.
    void windowVer;
    void editVer;
    if (!props.virtual || !virtualizer.current) return 0;
    const items = virtualizer.current.getVirtualItems();
    if (!items.length) return 0;
    let pad = virtualizer.current.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
      // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
      // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
      // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
      // the offset comparison only if the measurement lacks an index (defensive).
      const lastItemIdx = items[items.length - 1].index;
      const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
      if (pm && !inWindow && below) {
        // below the window → it trailed the slice; subtract its height from the trailing spacer.
        if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
      }
    }
    return pad < 0 ? 0 : pad;
  }
  function pmIndexInWindow(items: any, idx: any) {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  }
  function rowIsOutsideWindow(r: any) {
    if (!props.virtual || !virtualizer.current) return false;
    const items = virtualizer.current.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  }
  const reFeed = useCallback(() => {
    if (!table.current) return;
    table.current.setOptions((prev: any) => ({
      ...prev,
      data: currentData(),
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: props.selectionMode !== 'none',
      enableMultiRowSelection: props.selectionMode === 'multiple',
      // Re-pass the expand model fns + callback (Pitfall 4 — virtual-core/table-core's
      // setOptions REPLACES, so an omitted fn would drop the model on re-feed; on React the
      // onExpandedChange callback must re-capture fresh currentState each cycle, F6).
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (props.getSubRows || undefined) as any,
      getRowCanExpand: props.expandable === true && props.getSubRows == null ? () => true : undefined,
      onExpandedChange: onExpandedChangeCb,
      // Grouping auto-expand (phase 50 req-4): table-core's autoResetExpanded defaults TRUE, so a
      // POST-MOUNT setGrouping (the consumer #groupBar / applyGrouping verb) auto-fires
      // onExpandedChange({}) to reset the expanded set. That spurious reset funnels through
      // writeExpanded and would LATCH expandedTouched=true — defeating the grouping auto-expand
      // default (currentState().expanded would fall back to {} → nested group subtrees collapsed).
      // Disabling it makes post-mount grouping behave like initial grouping (subtrees auto-expanded
      // until the FIRST real user toggle). Inert for the plain/expand-only table (no grouping/sort/
      // filter mutation triggers an auto-reset there); explicit expandAll/collapseAll/toggle verbs
      // are unaffected (they fire regardless of this flag).
      autoResetExpanded: false,
      // Re-pass the grouped row model + callback (Pitfall 4 — setOptions REPLACES, so an
      // omitted fn would drop the model on re-feed; on React onGroupingChange must re-capture
      // fresh currentState each cycle, F6).
      getGroupedRowModel: getGroupedRowModel(),
      onGroupingChange: onGroupingChangeCb,
      // Re-pass the 3 faceted models (Pitfall 4 — setOptions REPLACES, so an omitted fn would
      // drop the model on re-feed; on React the faceted closures must re-capture so exposed
      // unique values + min/max update when an upstream filter changes, F6 / req-8 cross-filter).
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: makeFacetedUniqueValues(),
      getFacetedMinMaxValues: makeFacetedMinMaxValues(),
      // Re-pass the per-slice callbacks so React captures fresh currentState each cycle
      // (table-core keeps the prior callbacks otherwise → mount-time stale closure, F6).
      onSortingChange: onSortingChangeCb,
      onGlobalFilterChange: onGlobalFilterChangeCb,
      onColumnFiltersChange: onColumnFiltersChangeCb,
      onPaginationChange: onPaginationChangeCb,
      onRowSelectionChange: onRowSelectionChangeCb,
      onColumnVisibilityChange: onColumnVisibilityChangeCb,
      onColumnSizingChange: onColumnSizingChangeCb,
      onColumnOrderChange: onColumnOrderChangeCb,
      onColumnPinningChange: onColumnPinningChangeCb,
      onColumnSizingInfoChange: onColumnSizingInfoChangeCb
    }));
    if (refreshRowModel.current) refreshRowModel.current();
  }, [currentData, currentState, onColumnFiltersChangeCb, onColumnOrderChangeCb, onColumnPinningChangeCb, onColumnSizingChangeCb, onColumnSizingInfoChangeCb, onColumnVisibilityChangeCb, onExpandedChangeCb, onGlobalFilterChangeCb, onGroupingChangeCb, onPaginationChangeCb, onRowSelectionChangeCb, onSortingChangeCb, props.expandable, props.getSubRows, props.selectionMode, tableColumns]);
  const onHeaderSort = useCallback((colId: any, evt: any) => {
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (!col || !col.getCanSort()) return;
    const multi = !!(evt && evt.shiftKey);
    // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
    col.toggleSorting(undefined, multi);
  }, []);
  function tick() {
    return rowModelVer;
  }
  function ariaSortFor(colId: any) {
    if (tick() < 0 || !table.current) return 'none';
    const col = table.current.getColumn(colId);
    if (!col) return 'none';
    const dir = col.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }
  function sortIndicator(colId: any) {
    if (tick() < 0 || !table.current) return '';
    const col = table.current.getColumn(colId);
    if (!col) return '';
    const dir = col.getIsSorted();
    if (dir === 'asc') return '▲';
    if (dir === 'desc') return '▼';
    return '';
  }
  function defFor(colId: any) {
    const defs = columnDefs();
    for (const d of defs as any) if (d.id === colId) return d;
    return null;
  }
  function visibleCellsFor(row: any) {
    return rowModelVer >= 0 ? row.getVisibleCells() : [];
  }
  function editMetaOf(colId: any) {
    const d = defFor(colId);
    return d && d.meta ? d.meta : null;
  }
  function columnEditable(colId: any) {
    const m = editMetaOf(colId);
    return !!(m && m.editable === true);
  }
  function editorTypeOf(colId: any) {
    const m = editMetaOf(colId);
    return m && m.editor != null ? m.editor : 'text';
  }
  function editorOptionsOf(colId: any) {
    const m = editMetaOf(colId);
    return m && m.editorOptions != null ? m.editorOptions : [];
  }
  function hasEditorSlot(colId: any) {
    return editorTypeOf(colId) === 'custom' && !!(props.renderEditor ?? props.slots?.["editor"]);
  }
  function columnIsFilterable(colId: any) {
    const d = defFor(colId);
    return !!(d && d.filterable);
  }
  function headerLabel(colId: any) {
    const d = defFor(colId);
    return d ? d.header : colId;
  }
  function headerWidth(colId: any) {
    if (tick() < 0 || !table.current) return null;
    const col = table.current.getColumn(colId);
    if (!col) return null;
    const w = col.getSize();
    return w != null && w > 0 ? w + 'px' : null;
  }
  const onResizeStart = useCallback((colId: any, evt: any) => {
    // stop here (NOT a `.stop` modifier) — the Angular `.stop`-in-@for hoist is broken (F5).
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table.current) return;
    const header = findHeader(colId);
    if (!header || !header.getResizeHandler) return;
    const handler = header.getResizeHandler();
    if (handler) handler(evt);
  }, [findHeader]);
  function findHeader(colId: any) {
    const groups = headerGroups || [];
    for (const hg of groups as any) {
      const hs = hg.headers || [];
      for (const h of hs as any) if (h && h.column && h.column.id === colId) return h;
    }
    return null;
  }
  function columnIsResizing(colId: any) {
    if (tick() < 0 || !table.current) return false;
    const header = findHeader(colId);
    return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
  }
  function columnIsVisible(colId: any) {
    if (tick() < 0 || !table.current) return true;
    const col = table.current.getColumn(colId);
    return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
  }
  const onToggleVisibility = useCallback((colId: any) => {
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (col && col.toggleVisibility) col.toggleVisibility();
  }, []);
  function allLeafColumns() {
    if (tick() < 0 || !table.current) return [];
    const cols = table.current.getAllLeafColumns ? table.current.getAllLeafColumns() : [];
    const out = [];
    for (const c of cols as any) {
      if (!c || c.id === SELECT_COL_ID) continue;
      out.push({
        id: c.id,
        label: headerLabel(c.id),
        visible: !!(c.getIsVisible && c.getIsVisible())
      });
    }
    return out;
  }
  function columnPinSide(colId: any) {
    if (tick() < 0 || !table.current) return false;
    const col = table.current.getColumn(colId);
    if (!col || !col.getIsPinned) return false;
    return col.getIsPinned();
  }
  const onPinColumn = useCallback((colId: any, side: any, evt: any) => {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (col && col.pin) col.pin(side);
  }, []);
  function pinStyle(colId: any) {
    if (tick() < 0 || !table.current) return '';
    const col = table.current.getColumn(colId);
    if (!col || !col.getIsPinned) return '';
    const side = col.getIsPinned();
    if (side === 'left') {
      const left = col.getStart ? col.getStart('left') : 0;
      return 'position:sticky;left:' + left + 'px;z-index:1;';
    }
    if (side === 'right') {
      const right = col.getAfter ? col.getAfter('right') : 0;
      return 'position:sticky;right:' + right + 'px;z-index:1;';
    }
    return '';
  }
  function thStyle(colId: any) {
    let s = '';
    const w = headerWidth(colId);
    if (w) s += 'width:' + w + ';';
    s += pinStyle(colId);
    return s;
  }
  const onGlobalFilterInput = useCallback((evt: any) => {
    const value = evt && evt.target ? evt.target.value : '';
    if (table.current) {
      table.current.setGlobalFilter(value);
      return;
    }
    writeGlobalFilter(value);
  }, [writeGlobalFilter]);
  const onColumnFilterInput = useCallback((colId: any, evt: any) => {
    const value = evt && evt.target ? evt.target.value : '';
    setColumnFilter(colId, value);
  }, [setColumnFilter]);
  function globalFilterValue() {
    const v = currentState().globalFilter;
    return v != null ? v : '';
  }
  function pageIndex() {
    if (tick() >= 0 && table.current) return table.current.getState().pagination.pageIndex;
    const p = currentState().pagination;
    return p && p.pageIndex != null ? p.pageIndex : 0;
  }
  function pageSize() {
    if (tick() >= 0 && table.current) return table.current.getState().pagination.pageSize;
    const p = currentState().pagination;
    return p && p.pageSize != null ? p.pageSize : 10;
  }
  function pageCount() {
    if (tick() < 0 || !table.current) return 1;
    const c = table.current.getPageCount();
    return c != null && c > 0 ? c : 1;
  }
  function canPrevPage() {
    return !!(tick() >= 0 && table.current && table.current.getCanPreviousPage());
  }
  function canNextPage() {
    return !!(tick() >= 0 && table.current && table.current.getCanNextPage());
  }
  const onPrevPage = useCallback(() => {
    if (table.current) table.current.previousPage();
  }, []);
  const onNextPage = useCallback(() => {
    if (table.current) table.current.nextPage();
  }, []);
  const onPageSizeChange = useCallback((evt: any) => {
    if (!table.current) return;
    const v = evt && evt.target ? evt.target.value : '';
    const n = parseInt(v, 10);
    table.current.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
  }, []);
  function isSelectColumn(colId: any) {
    return colId === SELECT_COL_ID;
  }
  function isExpanderColumn(colId: any) {
    return colId === EXPANDER_COL_ID;
  }
  function rowCanExpand(row: any) {
    return !!(tick() >= 0 && row && row.getCanExpand && row.getCanExpand());
  }
  function rowIsExpanded(row: any) {
    return !!(tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());
  }
  function rowShowsDetail(row: any) {
    return props.getSubRows == null && rowIsExpanded(row);
  }
  const onToggleExpand = useCallback((row: any, evt: any) => {
    if (!row || !row.toggleExpanded) return;
    // Capture the owning row element BEFORE the toggle so DOM focus can be restored after the
    // expanded-state re-render. On Solid the expander <td>/<button> is RECREATED on that
    // re-render (the reference-keyed cell <For> receives fresh table-core cell instances each
    // pull — the <tr> persists but its cells are rebuilt), which drops DOM focus to <body> and
    // breaks keyboard activation (Enter/Space on the focused expander leaves nothing focused).
    // Re-focusing the (possibly-recreated) expander in the SAME row keeps the control focused —
    // the focusActiveCell imperative-refocus precedent. The rAF defers past the synchronous
    // reactive flush so the fresh node exists. Harmless on the targets that keep the node
    // (Vue/React/Svelte/Angular/Lit re-focus the same element → no-op).
    const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest('tr') : null;
    row.toggleExpanded();
    if (ownerRow && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const btn = ownerRow.querySelector('[data-expander]');
        if (btn) btn.focus();
      });
    }
  }, []);
  function bodyCellStyle(row: any, colId: any) {
    const base = pinStyle(colId);
    if (isExpanderColumn(colId) && row && row.depth) {
      const pad = 'padding-left:' + (0.5 + row.depth * 1.25) + 'rem';
      return base ? base + ';' + pad : pad;
    }
    return base;
  }
  function rowIsGrouped(row: any) {
    return !!(tick() >= 0 && row && row.getIsGrouped && row.getIsGrouped());
  }
  function groupingActive() {
    return tick() >= 0 && (currentState().grouping || []).length > 0;
  }
  function cellIsGrouped(cellCtx: any) {
    return !!(tick() >= 0 && cellCtx && cellCtx.getIsGrouped && cellCtx.getIsGrouped());
  }
  function cellIsAggregated(cellCtx: any) {
    return !!(tick() >= 0 && cellCtx && cellCtx.getIsAggregated && cellCtx.getIsAggregated());
  }
  function groupSubRowCount(row: any) {
    return row && row.subRows ? row.subRows.length : 0;
  }
  function groupingKeys() {
    return currentState().grouping || [];
  }
  function groupableColumns() {
    const out = [];
    const defs = columnDefs();
    for (const d of defs as any) {
      if (!d || d.groupable === false) continue;
      out.push({
        id: d.id,
        label: d.header != null ? d.header : d.id
      });
    }
    return out;
  }
  const stopEvent = useCallback((evt: any) => {
    if (evt && evt.stopPropagation) evt.stopPropagation();
  }, []);
  function isAllRowsSelected() {
    return !!(tick() >= 0 && table.current && table.current.getIsAllRowsSelected());
  }
  function isSomeRowsSelected() {
    return !!(tick() >= 0 && table.current && table.current.getIsSomeRowsSelected());
  }
  const onToggleAllRows = useCallback((evt: any) => {
    if (!table.current) return;
    table.current.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
  }, []);
  function rowIsSelected(row: any) {
    if (!row) return false;
    const id = row.id;
    const sel = currentState().rowSelection || {};
    if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
    return !!(row.getIsSelected && row.getIsSelected());
  }
  const onToggleRow = useCallback((row: any, evt: any) => {
    if (!row || !row.toggleSelected) return;
    row.toggleSelected(!!(evt && evt.target && evt.target.checked));
  }, []);
  const syncIndeterminate = useCallback(() => {
    if (!__rozieRoot.current || !__rozieRoot.current!.querySelector) return;
    selectAllBox.current = __rozieRoot.current!.querySelector('.rdt-select-all');
    if (selectAllBox.current) selectAllBox.current.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
  }, [isAllRowsSelected, isSomeRowsSelected]);
  function sortColumn(colId: any, desc: any) {
    if (table.current) table.current.getColumn(colId) && table.current.getColumn(colId).toggleSorting(desc, false);
  }
  function clearSorting() {
    if (table.current) table.current.resetSorting(true);
  }
  function getColumnDefs() {
    return columnDefs();
  }
  function toggleAllRows(value: any) {
    if (table.current) table.current.toggleAllRowsSelected(value);
  }
  function clearSelection() {
    if (table.current) table.current.resetRowSelection(true);
  }
  function getSelectedRows() {
    return table.current ? table.current.getSelectedRowModel().rows.map((r: any) => r.original) : [];
  }
  function setPage(idx: any) {
    if (table.current) table.current.setPageIndex(idx);
  }
  function setRowsPerPage(size: any) {
    if (table.current) table.current.setPageSize(size);
  }
  function toggleColumnVisibility(colId: any) {
    if (table.current) {
      const c = table.current.getColumn(colId);
      if (c && c.toggleVisibility) c.toggleVisibility();
    }
  }
  function applyColumnOrder(order: any) {
    if (table.current) table.current.setColumnOrder(order);
  }
  function resetColumnSizing() {
    if (table.current) table.current.resetColumnSizing(true);
  }
  function pinColumn(colId: any, side: any) {
    if (table.current) {
      const c = table.current.getColumn(colId);
      if (c && c.pin) c.pin(side);
    }
  }
  function getRowIndexRelativeToPage(absRow: any) {
    const abs = absRow == null ? toAbsRow(activeRow) : Math.trunc(Number(absRow)) || 0;
    if (props.virtual) return abs;
    return abs - pageRowOffset();
  }
  function cut() {
    return cutRange();
  }
  const isGrid = useCallback(() => props.interactionMode === 'grid', [props.interactionMode]);
  function tableRole() {
    return isGrid() ? 'grid' : 'table';
  }
  function cellRole() {
    return isGrid() ? 'gridcell' : 'cell';
  }
  function rowIndexOf(row: any) {
    return tick() >= 0 ? (rows || []).indexOf(row) : -1;
  }
  function colIndexOf(row: any, cellCtx: any) {
    return tick() >= 0 ? visibleCellsFor(row).indexOf(cellCtx) : -1;
  }
  function headerColIndexOf(hg: any, header: any) {
    return (hg && hg.headers ? hg.headers : []).indexOf(header);
  }
  function pageRowOffset() {
    if (!isGrid() || props.virtual) return 0;
    return pageIndex() * pageSize();
  }
  function toAbsRow(localRow: any) {
    return localRow + pageRowOffset();
  }
  function absRowIndexOf(row: any) {
    return rowIndexOf(row) + pageRowOffset();
  }
  function prePaginationRowCount() {
    if (!table.current || props.virtual) return bodyRowCount();
    const pm = table.current.getPrePaginationRowModel();
    return pm && pm.rows ? pm.rows.length : bodyRowCount();
  }
  function cellTabindex(rowKey: any, colIndex: any, level = null) {
    if (!isGrid()) return null;
    // B6: an empty / all-filtered grid (no body rows) must STILL be keyboard-reachable. Fall
    // the single roving tab-stop back to the FIRST leaf-header cell so the grid never has ZERO
    // tab-stops (a keyboard trap). Only the leaf-level header col 0 carries the tab-stop.
    if (bodyRowCount() === 0) {
      return rowKey === '__header' && colIndex === 0 && level === headerLeafLevel() ? 0 : -1;
    }
    // B12: when a header cell is active, address it by BOTH its level AND its colIndex so a
    // grouped multi-level header carries exactly ONE tab-stop. The pre-fix level-blind compare
    // lit BOTH the parent (level 0) and the leaf (level 1) at the same colIndex → multiple
    // tab-stops (the roving invariant broke under grouped headers).
    if (activeIsHeader) {
      if (rowKey !== '__header') return -1;
      return colIndex === activeColIndex && level === activeHeaderLevel ? 0 : -1;
    }
    const isActive = rowKey === String(activeRow) && colIndex === activeColIndex;
    return isActive ? 0 : -1;
  }
  function resolveCellEl(rowKey: any, colIndex: any, level = null) {
    if (!gridRoot.current) return null;
    // B12: a grouped multi-level header has MULTIPLE cells sharing data-row="__header" at the
    // same data-col-index across levels (parent vs leaf). Disambiguate header lookups by the
    // integer data-header-level so resolveCellEl('__header', 0) no longer returns the FIRST DOM
    // match (the parent) when the leaf is meant. level is an integer (NO consumer string is
    // interpolated — T-49-01 stays safe); body lookups pass level=null → the selector is
    // byte-unchanged.
    let sel = '[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]';
    if (rowKey === '__header' && level != null) sel = sel + '[data-header-level="' + level + '"]';
    return gridRoot.current.querySelector(sel);
  }
  function focusActiveCell(nextRow = null, nextCol = null, nextIsHeader = null, nextLevel = null) {
    if (!isGrid() || !gridRoot.current) return;
    const r = nextRow == null ? activeRow : nextRow;
    const c = nextCol == null ? activeColIndex : nextCol;
    // B12: thread the FRESH post-write header level (the grouped-header analog of the
    // nextIsHeader threading) so a leaf↔parent header move resolves the cell at the correct
    // level, never the async-stale $data.activeHeaderLevel re-read (React ROZ138 / Angular signal).
    const lvl = nextLevel == null ? activeHeaderLevel : nextLevel;
    // Thread the FRESH post-write isHeader flag (the plan-01-PROVEN contract): a header
    // crossing sets $data.activeIsHeader inside moveRow, but React's setState (ROZ138) and
    // Angular's signal write are async within one handler — re-reading $data.activeIsHeader
    // here returns the PRE-write value, resolving focus to the BODY cell instead of the
    // header. Callers pass the fresh isHeader local; falls back to $data when omitted.
    const header = nextIsHeader == null ? activeIsHeader : nextIsHeader;
    // ── phase 53 scroll-then-focus (D-12): when windowing AND the target body row is OUTSIDE the
    // rendered window, scroll it in first, then defer focus to AFTER the new window commits (the
    // double-rAF — a single rAF can fire before React's async commit, Pitfall 4). Header cells and
    // in-window rows keep the synchronous path below (table-mode / non-windowed stay byte-stable).
    // The guard reads the resolved `header` (NOT the raw `nextIsHeader`) so an omitted-arg call
    // while a header cell is active falls back to $data.activeIsHeader and skips the scroll path.
    if (props.virtual && virtualizer.current && !header && rowIsOutsideWindow(r)) {
      virtualizer.current.scrollToIndex(r, {
        align: 'center'
      });
      // Bounded rAF-poll-until-cell-present (D-12): scrollToIndex → virtual-core onChange → windowVer
      // bump → the framework commits the scrolled-in row. On React that commit is async (setState →
      // reconcile) and for a far scroll (e.g. row 4000) spans several frames — a one-shot double-rAF
      // fires BEFORE resolveCellEl can find the cell, so focus is silently lost (the deterministic
      // React off-window-focus failure). Poll resolveCellEl for up to ~30 frames: the five
      // fast-committing targets resolve on the first attempt (behavior unchanged), React retries
      // across the few frames its async commit needs. The poll ONLY focuses (never measures), so it
      // cannot re-introduce the remeasure-vs-scroll fight. Inside the $props.virtual guard only.
      let focusAttempts = 0;
      const focusWhenReady = () => {
        const el = resolveCellEl(String(r), c);
        if (el) {
          el.focus();
          return;
        }
        focusAttempts = focusAttempts + 1;
        if (focusAttempts >= 30) return;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusWhenReady);else setTimeout(focusWhenReady, 16);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusWhenReady);else setTimeout(focusWhenReady, 0);
      return;
    }
    const rowKey = header ? '__header' : String(r);
    const el = resolveCellEl(rowKey, c, header ? lvl : null);
    if (el) el.focus();
  }
  function totalRowCount() {
    if (!table.current) return (rows || []).length;
    const fm = table.current.getFilteredRowModel();
    return fm && fm.rows ? fm.rows.length : (rows || []).length;
  }
  function visibleColCount() {
    // NB: local is `rowList` (NOT `rows`) — the React emitter lowers `$data.rows` to the bare
    // state binding `rows`, so a `const rows = $data.rows` self-shadows it (TS2448 TDZ). Same
    // self-shadow class as the deconflictPropShadows finding; avoid the $data-key name as a local.
    const rowList = rows || [];
    if (rowList.length) return rowList[0].getVisibleCells().length;
    const hg = headerGroups || [];
    return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
  }
  function bodyRowCount() {
    return (rows || []).length;
  }
  function clamp(v: any, lo: any, hi: any) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function headerLeafLevel() {
    const hg = headerGroups || [];
    return hg.length ? hg.length - 1 : 0;
  }
  function headerAt(level: any, colIndex: any) {
    const hg = headerGroups || [];
    const grp = hg[level];
    if (!grp || !grp.headers) return null;
    return grp.headers[colIndex] || null;
  }
  function parentHeaderColIndex(level: any, colIndex: any) {
    if (level <= 0) return -1;
    const h = headerAt(level, colIndex);
    if (!h || !h.column || !h.column.parent) return -1;
    const parentId = h.column.parent.id;
    const hg = headerGroups || [];
    const pg = hg[level - 1];
    if (!pg || !pg.headers) return -1;
    for (let i = 0; i < pg.headers.length; i++) {
      const ph = pg.headers[i];
      if (ph && ph.column && ph.column.id === parentId) return i;
    }
    return -1;
  }
  function firstChildHeaderColIndex(level: any, colIndex: any) {
    const h = headerAt(level, colIndex);
    if (!h || !h.column) return -1;
    const kids = h.column.columns || [];
    if (!kids.length) return -1;
    const childId = kids[0].id;
    const hg = headerGroups || [];
    const cg = hg[level + 1];
    if (!cg || !cg.headers) return -1;
    for (let i = 0; i < cg.headers.length; i++) {
      const ch = cg.headers[i];
      if (ch && ch.column && ch.column.id === childId) return i;
    }
    return -1;
  }
  function moveCol(delta: any) {
    const max = visibleColCount() - 1;
    const nextCol = clamp(activeColIndex + delta, 0, max < 0 ? 0 : max);
    setActiveColIndex(nextCol);
    return nextCol;
  }
  function moveRow(delta: any) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const leafLevel = headerLeafLevel();
    if (activeIsHeader) {
      if (delta > 0) {
        // B12 — Down: from a PARENT header level, descend to its FIRST child leaf header (one
        // level down); from the LEAF header level, drop into the body (row 0). A header-level
        // move re-targets activeColIndex (parent↔child column indices differ), so the fresh
        // col is RETURNED for the caller to thread into the focus seam (NOT re-read from $data).
        if (activeHeaderLevel < leafLevel) {
          const childCol = firstChildHeaderColIndex(activeHeaderLevel, activeColIndex);
          if (childCol >= 0) {
            const nextLevel = activeHeaderLevel + 1;
            setActiveHeaderLevel(nextLevel);
            setActiveColIndex(childCol);
            return {
              row: activeRow,
              col: childCol,
              isHeader: true,
              level: nextLevel
            };
          }
        }
        // At the leaf header: an empty grid has no body to drop into → stay put.
        if (bodyRowCount() === 0) return {
          row: activeRow,
          col: activeColIndex,
          isHeader: true,
          level: activeHeaderLevel
        };
        // B17: crossing from the leaf header INTO the body consumes ONE step; the REMAINING
        // (delta-1) continues the descent, so PageDown (delta=GRID_PAGE_STEP) lands a real
        // page-down body row, NOT row 0 (== ArrowDown). ArrowDown (delta=1) still lands row 0
        // (delta-1 = 0); clamped to the page-last body row.
        const landRow = clamp(delta - 1, 0, maxRow);
        setActiveIsHeader(false);
        setActiveRow(landRow);
        return {
          row: landRow,
          col: activeColIndex,
          isHeader: false,
          level: 0
        };
      }
      // B12 — Up: from the leaf (or any non-top) header level, ascend to the PARENT header that
      // spans the active column; at the top level (or no real parent) stay put. The parent col
      // index differs from the leaf's, so the fresh col is RETURNED (threaded into focus).
      const parentCol = parentHeaderColIndex(activeHeaderLevel, activeColIndex);
      if (parentCol >= 0) {
        const nextLevel = activeHeaderLevel - 1;
        setActiveHeaderLevel(nextLevel);
        setActiveColIndex(parentCol);
        return {
          row: activeRow,
          col: parentCol,
          isHeader: true,
          level: nextLevel
        };
      }
      return {
        row: activeRow,
        col: activeColIndex,
        isHeader: true,
        level: activeHeaderLevel
      };
    }
    // In the body: an upward move from row 0 crosses into the LEAF header level (the header row
    // adjacent to the body). The body col index aligns 1:1 with the leaf header col index, so
    // activeColIndex carries over unchanged.
    if (delta < 0 && activeRow === 0) {
      setActiveIsHeader(true);
      setActiveHeaderLevel(leafLevel);
      return {
        row: activeRow,
        col: activeColIndex,
        isHeader: true,
        level: leafLevel
      };
    }
    const nextRow = clamp(activeRow + delta, 0, maxRow);
    setActiveRow(nextRow);
    setActiveIsHeader(false);
    return {
      row: nextRow,
      col: activeColIndex,
      isHeader: false,
      level: 0
    };
  }
  function gotoColEdge(toEnd: any) {
    const max = visibleColCount() - 1;
    const nextCol = toEnd ? max < 0 ? 0 : max : 0;
    setActiveColIndex(nextCol);
    return nextCol;
  }
  function gotoStart() {
    setActiveIsHeader(false);
    setActiveRow(0);
    setActiveColIndex(0);
    return {
      row: 0,
      col: 0
    };
  }
  function gotoEnd() {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const max = visibleColCount() - 1;
    const maxCol = max < 0 ? 0 : max;
    setActiveIsHeader(false);
    setActiveRow(maxRow);
    setActiveColIndex(maxCol);
    return {
      row: maxRow,
      col: maxCol
    };
  }
  function currentCellEl() {
    const rowKey = activeIsHeader ? '__header' : String(activeRow);
    return resolveCellEl(rowKey, activeColIndex, activeIsHeader ? activeHeaderLevel : null);
  }
  function focusables(cellEl: any) {
    if (!cellEl || !cellEl.querySelectorAll) return [];
    const list = Array.prototype.slice.call(cellEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
    return list.filter((n: any) => !n.disabled);
  }
  function enterControl() {
    const cellEl = currentCellEl();
    const list = focusables(cellEl);
    if (!list.length) return;
    setActiveInControl(true);
    list[0].focus();
  }
  function cycleWithinCell(cellEl: any, forward: any) {
    const list = focusables(cellEl);
    if (!list.length) return;
    const active = gridRoot.current ? gridRoot.current.getRootNode().activeElement : null;
    const cur = list.indexOf(active);
    let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
    if (i >= list.length) i = 0;
    if (i < 0) i = list.length - 1;
    list[i].focus();
  }
  const { onActivecellChange: _rozieProp_onActivecellChange } = props;
    const onGridKeyDown = useCallback((e: any) => {
    if (!isGrid() || !e) return;
    const key = e.key;
    // Editing mode (phase 51, Pitfall 5): an OPEN editor owns Tab/Enter/Escape (+ caret keys)
    // via its local onEditorKeyDown handler. This top check (BEFORE activeInControl) returns
    // early so the grid nav keymap never hijacks an arrow/Tab/Enter while editing — the three
    // modes (editing / in-control / navigation) stay mutually exclusive and ordered.
    if (editingRow >= 0) return;
    // Full-row edit (phase 51 req-6): an OPEN row editor owns Enter/Escape/Tab via the cell
    // editors' local onEditorKeyDown. Return early (before activeInControl) so the grid nav
    // keymap never hijacks while a row is in edit — the three modes stay mutually exclusive.
    if (editingRowIndex != null) return;
    // Interaction mode (D-08): Tab cycles within the cell, Escape exits. Focus containment.
    if (activeInControl) {
      if (key === 'Escape') {
        e.preventDefault();
        setActiveInControl(false);
        // Return focus to the OWNING cell (no move happened) — pass the current indices
        // explicitly (the React-emitted seam types both params as required; a zero-arg call
        // is TS2554). Reading $data here is safe: no write to activeRow/activeColIndex precedes it.
        focusActiveCell(activeRow, activeColIndex);
      } else if (key === 'Tab') {
        e.preventDefault();
        cycleWithinCell(currentCellEl(), !e.shiftKey);
      }
      return;
    }
    // WR-05: in navigation mode, only hijack arrow/Home/End/Page keys when focus is ON a
    // grid cell. An inner control reached WITHOUT Enter (e.g. a header filter <input> the
    // user clicked into directly, or a per-cell control tabbed/clicked to) must keep its
    // NATIVE key behavior — caret movement, option cycling, etc. e.target is the deepest
    // focused node; if it is not itself a [data-grid-cell], let the event pass through.
    const tgt = e.target;
    if (!tgt || !tgt.hasAttribute || !tgt.hasAttribute('data-grid-cell')) return;
    // Navigation mode — compute fresh locals, write $data inside the helper, thread them out.
    // nextIsHeader is threaded alongside nextRow/nextCol so the focus seam never re-reads the
    // async-stale $data.activeIsHeader after a header crossing (React ROZ138 / Angular signal —
    // plan-01 Pitfall 2). moveRow returns the fresh { row, isHeader }; every other branch lands
    // in the body (isHeader = false). WR-06: snapshot the PRE-move indices so the emit below
    // fires ONLY on a real move (a clamped no-op edge move leaves them identical).
    const prevRow = activeRow;
    const prevCol = activeColIndex;
    const prevIsHeader = activeIsHeader;
    const prevLevel = activeHeaderLevel;
    let nextRow = prevRow;
    let nextCol = prevCol;
    let nextIsHeader = prevIsHeader;
    // B12: the fresh post-write header LEVEL (the grouped-header analog of nextIsHeader) is
    // threaded into the focus seam so a leaf↔parent header move lands focus at the correct
    // level. moveRow returns it; the non-vertical branches keep the pre-move level.
    let nextLevel = prevLevel;
    // ── Cell-range extend (phase 51 req-7 / D-07) — Shift+Arrow extends the rectangle from
    // the active cell's leading edge. Tested BEFORE the plain arrows (a Shift+Arrow must NOT
    // fall through to a plain navigation move). Body cells only (no range from a header). The
    // extendRange call owns focus + the range-change emit, so return immediately. ──────────
    if (key === 'ArrowRight' && e.shiftKey && !activeIsHeader) {
      e.preventDefault();
      extendRange(0, 1);
      return;
    } else if (key === 'ArrowLeft' && e.shiftKey && !activeIsHeader) {
      e.preventDefault();
      extendRange(0, -1);
      return;
    } else if (key === 'ArrowDown' && e.shiftKey && !activeIsHeader) {
      e.preventDefault();
      extendRange(1, 0);
      return;
    } else if (key === 'ArrowUp' && e.shiftKey && !activeIsHeader) {
      e.preventDefault();
      extendRange(-1, 0);
      return;
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      clearRange();
      nextCol = moveCol(1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      clearRange();
      nextCol = moveCol(-1);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      clearRange();
      const m = moveRow(1);
      nextRow = m.row;
      nextCol = m.col;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      clearRange();
      const m = moveRow(-1);
      nextRow = m.row;
      nextCol = m.col;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'PageDown') {
      e.preventDefault();
      const m = moveRow(GRID_PAGE_STEP);
      nextRow = m.row;
      nextCol = m.col;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'PageUp') {
      e.preventDefault();
      const m = moveRow(-GRID_PAGE_STEP);
      nextRow = m.row;
      nextCol = m.col;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'Home') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const s = gotoStart();
        nextRow = s.row;
        nextCol = s.col;
        nextIsHeader = false;
      } else {
        nextCol = gotoColEdge(false);
      }
    } else if (key === 'End') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const en = gotoEnd();
        nextRow = en.row;
        nextCol = en.col;
        nextIsHeader = false;
      } else {
        nextCol = gotoColEdge(true);
      }
    }
    // ── Clipboard (phase 51 req-8 / D-03) — Ctrl/Cmd+C copies the range as TSV; Ctrl/Cmd+V
    // pastes TSV into the range under the D-03 skip rule. Placed BEFORE the printable-key
    // edit-entry branch (which excludes ctrl/meta) so the shortcuts are never swallowed as a
    // type-to-edit char. Copy/paste act on the whole range (or the single active cell). B11:
    // gated by clipboardActiveAllowed() (== !activeIsHeader) so a header-active Ctrl+C/Ctrl+V
    // falls through to NATIVE behavior — never preventDefault'd, never a silent body mutation
    // (copyRange/pasteRange also self-guard; the verb guard is what plan 63-09's Cut reuses). ──
    else if ((key === 'c' || key === 'C') && (e.ctrlKey || e.metaKey) && clipboardActiveAllowed()) {
      e.preventDefault();
      copyRange();
      return;
    } else if ((key === 'v' || key === 'V') && (e.ctrlKey || e.metaKey) && clipboardActiveAllowed()) {
      e.preventDefault();
      pasteRange();
      return;
    }
    // ── C3 (phase 63 wave-9) — Ctrl/Cmd+X CUTS the range: copy the range as TSV then clear the
    // source cells through the SAME write-funnel as paste (one writeData). Same B11 gate as
    // Ctrl+C/Ctrl+V (clipboardActiveAllowed) so a header-active Ctrl+X falls through to NATIVE cut
    // and never silently clears a body cell (cutRange also self-guards). Placed beside the C/V
    // shortcuts, BEFORE the printable-key edit-entry branch (which excludes ctrl/meta). ──
    else if ((key === 'x' || key === 'X') && (e.ctrlKey || e.metaKey) && clipboardActiveAllowed()) {
      e.preventDefault();
      cutRange();
      return;
    }
    // ── Full-row edit entry (phase 51 req-6 / D-06) — Shift+F2 on an editable active cell puts
    // EVERY editable cell in the active row into edit at once. Tested BEFORE the plain F2 branch
    // (a Shift+F2 must NOT fall through to single-cell F2). Shift+F2 was chosen for the lowest
    // collision risk against the Phase-49 keymap. Gated by isActiveCellEditable() (the row has
    // at least the active editable column); a non-editable active cell falls through unchanged.
    else if (key === 'F2' && e.shiftKey && isActiveCellEditable()) {
      e.preventDefault();
      beginRowEdit((rows || [])[activeRow]);
      return;
    }
    // ── Edit-entry (phase 51 req-1/3, D-05) — BEFORE the reserved enterControl branch.
    // Gated by isActiveCellEditable(): a non-editable active cell falls through to
    // enterControl (the Phase-49 behavior is unchanged). F2/Enter seed the EXISTING value
    // (in-place edit); a single printable char (no Ctrl/Meta/Alt) REPLACES the value.
    else if ((key === 'Enter' || key === 'F2') && isActiveCellEditable()) {
      e.preventDefault();
      beginEdit(activeRow, activeColIndex, null);
      return;
    } else if (isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // B24: a printable key only SEEDS a draft on a free-text editor (text/number). A
      // checkbox/select/date editor must NOT take the typed char as its value (it would
      // force-check the checkbox, seed a garbage select option, or corrupt the date) — open
      // those with the EXISTING value (seed=null), identical to the F2/Enter in-place entry.
      e.preventDefault();
      const editType = editorTypeOf(activeCellColumnId());
      const seed = editType === 'text' || editType === 'number' ? key : null;
      beginEdit(activeRow, activeColIndex, seed);
      return;
    }
    // ── C2 (phase 63 wave-8): Enter on a GROUP-HEADER cell toggles that group's collapse/
    // expand (APG treegrid). A group cell is NON-editable (isActiveCellEditable=false, the
    // verified invariant) so it never hits the edit branches above and would otherwise fall to
    // enterControl() — which merely FOCUSES the group-toggle button (requiring a second key).
    // Route it to the SAME onToggleExpand path the chevron uses (group rows ride the expand
    // model) so one Enter toggles the group. Body cells only (a header-active Enter is unchanged);
    // ($data.rows || [])[$data.activeRow] is the active flattened row (page-relative non-virtual /
    // full-model virtual — both index $data.rows). Placed BEFORE the reserved enterControl branch.
    else if (key === 'Enter' && !activeIsHeader && rowIsGrouped((rows || [])[activeRow])) {
      e.preventDefault();
      // C2 (phase 63 wave-11) — re-seat focus after the group collapse/expand re-render so the
      // active cell never drops focus OUT of the grid. onToggleExpand flips the expand model →
      // the tbody re-renders (the group's leaf rows appear/disappear). The active GROUP-HEADER
      // row index is UNCHANGED (a group header is never hidden by its OWN collapse), but on the
      // fine-grained-reactive targets (Solid especially) that re-render REPLACES the active cell's
      // DOM node, dropping keyboard focus into <body> — the active STATE stays on the group header
      // while DOM focus is lost (the treegrid collapsed-coherence gap; the 63-07 Solid grouping-
      // settling fragility class). Capture the active coords BEFORE the toggle (React-stale-safe —
      // onToggleExpand's expand-model write is an async setState on React) and re-seat focus via the
      // SAME deferred rAF-poll recovery B25 uses (resolveCellEl retries across the async re-render
      // until the group-header cell re-commits). The 5 sync targets resolve on attempt 1 (focus is
      // already there → a harmless no-op re-focus); Solid retries until its grouping graph settles.
      const grpRow = activeRow;
      const grpCol = activeColIndex;
      onToggleExpand((rows || [])[activeRow], e);
      recoverGridFocus(String(grpRow), grpCol, null);
      return;
    } else if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      enterControl();
      return;
    } else return;
    // THE seam — built from the SAME fresh post-write locals (Pitfall 2). Always re-assert
    // focus on the resolved cell (harmless on a no-op clamp; corrects any drift otherwise).
    focusActiveCell(nextRow, nextCol, nextIsHeader, nextLevel);
    // WR-06: the D-02 activecell-change event fires ONLY when the resolved cell actually
    // changed. A clamped no-op edge move (ArrowLeft at col 0, ArrowDown at the page-last
    // row, …) leaves the indices identical → no spurious emit (a no-op is not a navigation).
    // B12: a header-LEVEL move (leaf↔parent, same colIndex) is a real navigation too.
    // C1 (phase 63 wave-6): the emitted rowIndex is the ABSOLUTE display-order index (toAbsRow) —
    // keyboard nav never crosses a page (D-06), so nextRow is in the current page slice and
    // toAbsRow adds the live page offset (0 in virtual mode where activeRow is already absolute).
    // The change-detection comparison stays in the PAGE-RELATIVE space (nextRow vs prevRow).
    if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader || nextLevel !== prevLevel) {
      _rozieProp_onActivecellChange && _rozieProp_onActivecellChange({
        rowIndex: toAbsRow(nextRow),
        colIndex: nextCol
      });
    }
  }, [_rozieProp_onActivecellChange, activeCellColumnId, activeColIndex, activeHeaderLevel, activeInControl, activeIsHeader, activeRow, beginEdit, beginRowEdit, clearRange, clipboardActiveAllowed, copyRange, currentCellEl, cutRange, cycleWithinCell, editingRow, editingRowIndex, editorTypeOf, enterControl, extendRange, focusActiveCell, gotoColEdge, gotoEnd, gotoStart, isActiveCellEditable, isGrid, moveCol, moveRow, onToggleExpand, pasteRange, recoverGridFocus, rowIsGrouped, rows, toAbsRow]);
  const syncActiveFromEvent = useCallback((e: any) => {
    if (!isGrid() || !e) return;
    const tgt = e.target;
    if (!tgt || !tgt.closest) return;
    const cellEl = tgt.closest('[data-grid-cell]');
    if (!cellEl) return;
    const rowAttr = cellEl.getAttribute('data-row');
    const colAttr = cellEl.getAttribute('data-col-index');
    if (rowAttr == null || colAttr == null) return;
    const col = parseInt(colAttr, 10);
    if (!Number.isFinite(col)) return;
    const isHeader = rowAttr === '__header';
    setActiveIsHeader(isHeader);
    if (isHeader) {
      // B12: a click/focus onto a grouped header cell must capture its header LEVEL too, so the
      // roving model + a subsequent ArrowUp/ArrowDown resolve from the correct level (not a stale
      // one). data-header-level is an integer marker on the <th>; fall back to the leaf level.
      const lvlAttr = cellEl.getAttribute('data-header-level');
      const lvl = lvlAttr != null ? parseInt(lvlAttr, 10) : headerLeafLevel();
      setActiveHeaderLevel(Number.isFinite(lvl) ? lvl : headerLeafLevel());
    } else {
      const row = parseInt(rowAttr, 10);
      if (Number.isFinite(row)) setActiveRow(row);
    }
    setActiveColIndex(col);
    // A plain focus collapses any range back to the single active cell — EXCEPT (a) the
    // programmatic settle of an in-flight extendRange (rangeTransition): that focus move lands
    // ON the new range-focus corner and must NOT wipe the range we just set; and (b) the
    // focusin that follows a Shift+Click (rangeClickPending): @mousedown already set the range
    // BEFORE this focusin fires, and a focusin carries no reliable shiftKey, so the @mousedown
    // path owns the shift case and flags it here so the collapse is skipped.
    if (rangeTransition) {
      rangeTransition = false;
    } else if (rangeClickPending) {
      rangeClickPending = false;
    } else {
      clearRange();
    }
    // The cell box (not an inner control) receiving focus = navigation mode.
    if (tgt === cellEl) setActiveInControl(false);
  }, [clearRange, headerLeafLevel, isGrid]);
  const onGridMouseDown = useCallback((e: any) => {
    if (!isGrid() || !e || !e.shiftKey) return;
    const tgt = e.target;
    if (!tgt || !tgt.closest) return;
    const cellEl = tgt.closest('[data-grid-cell]');
    if (!cellEl) return;
    const rowAttr = cellEl.getAttribute('data-row');
    const colAttr = cellEl.getAttribute('data-col-index');
    if (rowAttr == null || colAttr == null || rowAttr === '__header') return;
    const row = parseInt(rowAttr, 10);
    const col = parseInt(colAttr, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    setRangeFocus$local(row, col);
    setActiveIsHeader(false);
    setActiveRow(row);
    setActiveColIndex(col);
    rangeClickPending = true;
  }, [isGrid, setRangeFocus$local]);
  const onGridFocusOut = useCallback((e: any) => {
    if (!isGrid() || !activeInControl) return;
    const next = e ? e.relatedTarget : null;
    const cellEl = currentCellEl();
    if (!cellEl || !next || !cellEl.contains(next)) setActiveInControl(false);
  }, [activeInControl, currentCellEl, isGrid]);
  function recoverGridFocus(rowKey: any, col: any, level: any) {
    if (!gridRoot.current) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = resolveCellEl(rowKey, col, level);
      if (el) {
        el.focus();
        return;
      }
      attempts = attempts + 1;
      if (attempts >= 30) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  }
  const clampActiveCell = useCallback((rowCount: any, colCount: any) => {
    if (!isGrid()) return;
    // B8/B23 React-stale guard: the bounds come from the FRESH model the caller (refreshRowModel)
    // just derived and passes in — NEVER re-read $data.rows here. `$data.rows = nextRows` is an
    // async useState on React, so bodyRowCount()/visibleColCount() would see the PRE-change model
    // and SKIP a legitimate shrink-clamp (a filter-to-fewer left the active cell / range corners
    // out of bounds on React only). Falls back to the live helpers when called without bounds.
    const colN = colCount != null ? colCount : visibleColCount();
    const rowN = rowCount != null ? rowCount : bodyRowCount();
    // B25: BEFORE re-indexing, detect whether DOM focus currently rests on a BODY cell that the
    // shrink will REMOVE (its row index exceeds the new bounds). We run synchronously BEFORE the
    // framework commits the new tbody (refreshRowModel calls us right after `$data.rows = nextRows`
    // — true on all six, incl React's async setState), so the doomed cell + its focus are still
    // observable in the OLD DOM. Only then do we arm a focus RECOVERY (after the re-render), so a
    // programmatic shrink (collapseAll/pageSize/data swap) never drops keyboard focus to <body>.
    // Focus elsewhere — a header sort button, an external control, an unfocused grid — is NOT a
    // doomed body cell, so recovery never STEALS focus on a routine re-sort/filter.
    // The recovery TARGET is derived from the doomed cell's OWN DOM coords (doomedRow/doomedCol),
    // NOT $data.activeRow/activeColIndex — those are React-stale (ROZ138) when a focusCell + the
    // shrink run inside one synchronous handler (focusCell's setActiveRow has not committed). The
    // DOM coords are always fresh.
    let recoverFocus = false;
    let doomedRow = -1;
    let doomedCol = 0;
    if (gridRoot.current) {
      const rootNode = gridRoot.current.getRootNode ? gridRoot.current.getRootNode() : null;
      const focusedEl = rootNode ? rootNode.activeElement : null;
      const focusedCell = focusedEl && focusedEl.closest ? focusedEl.closest('[data-grid-cell]') : null;
      if (focusedCell && gridRoot.current.contains(focusedCell)) {
        const fRowAttr = focusedCell.getAttribute('data-row');
        const fColAttr = focusedCell.getAttribute('data-col-index');
        if (fRowAttr != null && fRowAttr !== '__header') {
          const fr = parseInt(fRowAttr, 10);
          const fc = parseInt(fColAttr, 10);
          if (Number.isFinite(fr) && fr > rowN - 1) {
            recoverFocus = true;
            doomedRow = fr;
            doomedCol = Number.isFinite(fc) ? fc : 0;
          }
        }
      }
    }
    const maxCol = colN - 1;
    const col = clamp(activeColIndex, 0, maxCol < 0 ? 0 : maxCol);
    if (col !== activeColIndex) setActiveColIndex(col);
    // B6: an empty / all-filtered grid has NO body cell to hold the active cell. Park the active
    // cell on the leaf-header fallback (col 0) so the roving tab-stop stays on a REAL cell (never
    // an absent body cell → focus lost into <body>), and flag it so the next non-empty refresh
    // re-seats a body cell. The cellTabindex empty-fallback keeps exactly one header tab-stop.
    if (rowN <= 0) {
      setActiveIsHeader(true);
      setActiveHeaderLevel(headerLeafLevel());
      setActiveColIndex(0);
      // B6 — `gridEmptyFallback` is a plain component-scope `let` (NOT $data): clampActiveCell is
      // reached through the mount-time refreshRowModel closure, so a `$data` READ here binds the
      // async-stale mount-time value on React (setState is async — the rangeActive / B23-nextRows
      // class). A synchronously-written plain `let` is read FRESH on all six so the empty→non-empty
      // recovery branch below actually runs on React too.
      gridEmptyFallback.current = true;
      clampRange(rowN - 1, colN - 1);
      // B25 does NOT actively focus in the EMPTY-grid case: B6 already keeps the grid keyboard-
      // reachable via the roving tab-stop on the header fallback (a tabindex=0, not a focus grab).
      // Moving DOM focus here would steal focus AND — on React — the fallback's @focusin
      // (setActiveIsHeader true) races the next clear-filter re-seat, leaving the tab-stop stuck on
      // the header. Focus recovery is for a shrink that leaves a VALID BODY cell to land on (below).
      return;
    }
    // B6 recovery: the body model returned. If we were parked on the empty-grid header fallback,
    // re-seat a valid BODY active cell (row 0) so the roving tab-stop lands back on a real body
    // cell. A user-driven header position (not the empty fallback) is left untouched.
    if (gridEmptyFallback.current) {
      gridEmptyFallback.current = false;
      setActiveIsHeader(false);
      setActiveRow(0);
    }
    if (!activeIsHeader) {
      const lastRow = rowN - 1;
      const maxRow = lastRow < 0 ? 0 : lastRow;
      const row = clamp(activeRow, 0, maxRow);
      if (row !== activeRow) setActiveRow(row);
    }
    // B8: clamp the range-selection corners to the same FRESH bounds (a sort/filter/paginate that
    // shrank the model would otherwise leave a stale rectangle → phantom copy rows + an
    // out-of-bounds getSelectedRange). Reconcile-only (no range-change emit here, B18/B19).
    clampRange(rowN - 1, colN - 1);
    // B25: recover DOM focus onto the re-indexed valid cell (deferred until the new model renders)
    // when the shrink removed the focused cell. The target is the DOOMED cell's own coords clamped
    // into the fresh bounds (React-stale-safe — see the doomedRow/doomedCol note above).
    if (recoverFocus) {
      const recRow = clamp(doomedRow, 0, rowN - 1);
      const recCol = clamp(doomedCol, 0, maxCol < 0 ? 0 : maxCol);
      recoverGridFocus(String(recRow), recCol, null);
    }
  }, [activeColIndex, activeIsHeader, activeRow, bodyRowCount, clamp, clampRange, headerLeafLevel, isGrid, recoverGridFocus, visibleColCount]);
  // ══ Cell-range selection (phase 51 plan 04 / req-7 / D-07) ═══════════════════════════════
  // A rectangular cell range over the FULL visible model, addressed BY INDEX PAIRS
  // (rangeAnchor/rangeFocus = { rowIndex, colIndex }) — NEVER a stored DOM node, so the
  // highlight reattaches to the correct cells across virtualization recycling (the
  // activeRow/activeColIndex invariant). ONE-WAY (D-07): exposed via getSelectedRange +
  // range-change, NOT a model:true slice. Coexists with — and is visually distinct from —
  // the row-selection slice (the two never touch each other's state).

  // inRange(rIdx, cIdx): is the cell at the visible-model index pair inside the current
  // rectangle? Pure index math (the min/max box of anchor+focus). False when no range —
  // the byte-identical-off guard for the range markup (no anchor/focus → no :data-in-range).
  // rangeTransition: set true while extendRange/setRangeFocus moves DOM focus to the new
  // range-focus corner. That focus move fires @focusin → syncActiveFromEvent with NO shiftKey
  // (a programmatic focus carries no modifier), which would otherwise clearRange() and wipe the
  // range we just set. The flag suppresses that collapse for the in-flight focus settle (the
  // editTransition blur-guard precedent). A top-level let → React hoists to useRef.
  let rangeTransition = false;
  // rangeClickPending: set by onGridMouseDown on a Shift+Click (the range is set off the
  // pointer event's shiftKey BEFORE the cell's focusin fires); the follow-up focusin reads it
  // to SKIP the range-collapse (a focusin carries no reliable shiftKey). Reset on consumption.
  // rangeClickPending: set by onGridMouseDown on a Shift+Click (the range is set off the
  // pointer event's shiftKey BEFORE the cell's focusin fires); the follow-up focusin reads it
  // to SKIP the range-collapse (a focusin carries no reliable shiftKey). Reset on consumption.
  let rangeClickPending = false;
  // B19: a SYNCHRONOUS mirror of "a range currently exists" — extendRange/setRangeFocus set it
  // true, clearRange/clampRange-to-empty set it false. clearRange is invoked TWICE in one plain-
  // arrow keydown (the explicit collapse + the focusin that follows the programmatic focus move);
  // on React `$data.rangeAnchor = null` is an async setState, so the SECOND clearRange's
  // `$data.rangeAnchor == null` guard reads the STALE (pre-write) range and fires a duplicate
  // range-change. This module-let is written synchronously (no setState async), so the second
  // clearRange sees `rangeActive === false` and returns → exactly ONE range-change per real drop
  // across all six targets. A top-level let → React hoists to useRef.
  function inRange(rIdx: any, cIdx: any) {
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a || !f) return false;
    const r0 = a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex;
    const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
    const c0 = a.colIndex < f.colIndex ? a.colIndex : f.colIndex;
    const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
    return rIdx >= r0 && rIdx <= r1 && cIdx >= c0 && cIdx <= c1;
  }
  function getSelectedRange() {
    // B8: clamp the corners to the CURRENT bounds ON READ so the verb (and the range-change emit
    // payload) never reports a corner past a shrunken model — React-stale-safe (the eager
    // refreshRowModel clamp is async-defeated on React; this read-time clamp is the guarantee).
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a && !f) return {
      anchor: null,
      focus: null
    };
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return {
      anchor: null,
      focus: null
    };
    const clampCorner = (c: any) => c == null ? null : {
      rowIndex: clamp(c.rowIndex, 0, maxRow),
      colIndex: clamp(c.colIndex, 0, maxCol)
    };
    return {
      anchor: clampCorner(a),
      focus: clampCorner(f)
    };
  }
  function isFillHandleCell(rIdx: any, cIdx: any) {
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a || !f) return false;
    const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
    const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
    return rIdx === r1 && cIdx === c1;
  }
  function emitRangeChange(anchor: any, focus: any) {
    props.onRangeChange && props.onRangeChange({
      anchor,
      focus
    });
  }
  function extendRange(dRow: any, dCol: any) {
    if (activeIsHeader) return;
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return;
    // Seed the anchor + focus from the active cell on the FIRST extend (no range yet).
    let anchor = rangeAnchor;
    let focus = rangeFocus;
    const hadRange = !!(anchor && focus);
    if (!anchor || !focus) {
      anchor = {
        rowIndex: activeRow,
        colIndex: activeColIndex
      };
      focus = {
        rowIndex: activeRow,
        colIndex: activeColIndex
      };
    }
    const nextRow = clamp(focus.rowIndex + dRow, 0, maxRow);
    const nextCol = clamp(focus.colIndex + dCol, 0, maxCol);
    const nextFocus = {
      rowIndex: nextRow,
      colIndex: nextCol
    };
    setRangeAnchor(anchor);
    setRangeFocus(nextFocus);
    rangeActive.current = true;
    // Keep the active cell tracking the moving focus corner (so a follow-up F2 / arrow acts
    // from the range's leading edge, the spreadsheet convention).
    setActiveRow(nextRow);
    setActiveColIndex(nextCol);
    // Suppress the focus-move's @focusin clearRange (no shiftKey on a programmatic focus): the
    // settle on the new focus corner is part of THIS range extension, not a fresh navigation.
    rangeTransition = true;
    focusActiveCell(nextRow, nextCol, false);
    // B18: emit range-change ONLY on an actual change. A clamped no-op (a range already exists
    // and the focus corner did not move — Shift+Arrow into the grid boundary) is not a selection
    // change → no emit. Seeding a brand-new range (no prior range) is always a change (the
    // rectangle came into existence) even if its first corner is a degenerate 1×1.
    if (!hadRange || nextRow !== focus.rowIndex || nextCol !== focus.colIndex) {
      emitRangeChange(anchor, nextFocus);
    }
  }
  function setRangeFocus$local(rIdx: any, cIdx: any) {
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return;
    let anchor = rangeAnchor;
    if (!anchor) anchor = {
      rowIndex: activeRow,
      colIndex: activeColIndex
    };
    const r = clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow);
    const c = clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol);
    const nextFocus = {
      rowIndex: r,
      colIndex: c
    };
    setRangeAnchor(anchor);
    setRangeFocus(nextFocus);
    rangeActive.current = true;
    emitRangeChange(anchor, nextFocus);
  }
  function clearRange() {
    // B19: gate on the SYNCHRONOUS rangeActive mirror, NOT a $data re-read. clearRange runs twice
    // in one plain-arrow keydown (explicit collapse + the focusin after the programmatic focus
    // move); on React `$data.rangeAnchor = null` is async, so a `$data.rangeAnchor == null` guard
    // would let the SECOND call through and emit a duplicate range-change. rangeActive flips
    // synchronously → the second call returns here.
    if (!rangeActive.current) return;
    rangeActive.current = false;
    setRangeAnchor(null);
    setRangeFocus(null);
    emitRangeChange(null, null);
  }
  function clampRange(maxRowArg: any, maxColArg: any) {
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a && !f) return;
    // Bounds passed from the FRESH model (clampActiveCell → refreshRowModel's nextRows) so the
    // shrink-clamp is React-stale-safe; fall back to the live helpers for a direct call.
    const maxRow = maxRowArg != null ? maxRowArg : bodyRowCount() - 1;
    const maxCol = maxColArg != null ? maxColArg : visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) {
      setRangeAnchor(null);
      setRangeFocus(null);
      rangeActive.current = false;
      return;
    }
    if (a) {
      const ar = clamp(a.rowIndex, 0, maxRow);
      const ac = clamp(a.colIndex, 0, maxCol);
      if (ar !== a.rowIndex || ac !== a.colIndex) setRangeAnchor({
        rowIndex: ar,
        colIndex: ac
      });
    }
    if (f) {
      const fr = clamp(f.rowIndex, 0, maxRow);
      const fc = clamp(f.colIndex, 0, maxCol);
      if (fr !== f.rowIndex || fc !== f.colIndex) setRangeFocus({
        rowIndex: fr,
        colIndex: fc
      });
    }
  }
  function announce(msg: any) {
    setPasteAnnounce(msg != null ? msg : '');
  }
  function clipboardActiveAllowed() {
    return !activeIsHeader;
  }
  function fieldOfColId(colId: any) {
    const d = defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  }
  function normalizedRange() {
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a || !f) return null;
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return null;
    const ar = clamp(a.rowIndex, 0, maxRow);
    const ac = clamp(a.colIndex, 0, maxCol);
    const fr = clamp(f.rowIndex, 0, maxRow);
    const fc = clamp(f.colIndex, 0, maxCol);
    return {
      r0: ar < fr ? ar : fr,
      r1: ar > fr ? ar : fr,
      c0: ac < fc ? ac : fc,
      c1: ac > fc ? ac : fc
    };
  }
  function escapeTsvField(s: any) {
    if (s.indexOf('\t') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0 || s.indexOf('"') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  function rangeToTsv() {
    const box = normalizedRange();
    const r0 = box ? box.r0 : activeRow;
    const r1 = box ? box.r1 : activeRow;
    const c0 = box ? box.c0 : activeColIndex;
    const c1 = box ? box.c1 : activeColIndex;
    const lines = [];
    for (let r = r0; r <= r1; r++) {
      const cells = [];
      for (let c = c0; c <= c1; c++) {
        const v = cellValueAt(r, c);
        cells.push(escapeTsvField(v == null ? '' : String(v)));
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
  function parseTsv(text: any) {
    const str = text != null ? String(text) : '';
    // CR-03: length guard BEFORE the parse — an empty string is a no-op, and a pathologically
    // large clipboard payload (>2M chars) is rejected outright (DoS-shaped input) before the
    // single-pass scan allocates a cell-per-character grid.
    if (str === '' || str.length > 2000000) return [];
    // B10: a quote-aware single-pass state machine (replaces the naive split, which corrupted a
    // cell containing a tab/newline). A field that OPENS with a double-quote is "quoted": tabs,
    // newlines, and doubled quotes ("") inside it are literal content until the closing quote;
    // an unquoted field ends at the next tab/newline. CR/LF and CRLF all delimit a row.
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    const n = str.length;
    while (i < n) {
      const ch = str[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < n && str[i + 1] === '"') {
            field = field + '"';
            i = i + 2;
            continue;
          }
          inQuotes = false;
          i = i + 1;
          continue;
        }
        field = field + ch;
        i = i + 1;
        continue;
      }
      if (ch === '"' && field === '') {
        inQuotes = true;
        i = i + 1;
        continue;
      }
      if (ch === '\t') {
        row.push(field);
        field = '';
        i = i + 1;
        continue;
      }
      if (ch === '\r') {
        if (i + 1 < n && str[i + 1] === '\n') i = i + 1;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i = i + 1;
        continue;
      }
      if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i = i + 1;
        continue;
      }
      field = field + ch;
      i = i + 1;
    }
    // Flush the trailing field + row.
    row.push(field);
    rows.push(row);
    // Drop a single trailing empty row (a TSV that ends with a newline → a phantom [''] row).
    if (rows.length > 1) {
      const last = rows[rows.length - 1];
      if (last.length === 1 && last[0] === '') rows.pop();
    }
    return rows;
  }
  function copyRange() {
    // B11: never copy from a header-active state (the reusable clipboard guard).
    if (!clipboardActiveAllowed()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) return;
    try {
      const p = navigator.clipboard.writeText(rangeToTsv());
      if (p && p.catch) p.catch(() => {});
    } catch (err: any) {/* best-effort copy */}
  }
  function applyGridToRange(grid: any, originRow: any, originCol: any) {
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return {
      wrote: 0,
      total: 0
    };
    let total = 0;
    let wrote = 0;
    const committed = [];
    // Build the fresh data array incrementally so the whole paste is ONE writeData.
    let next = currentData();
    for (let gr = 0; gr < grid.length; gr++) {
      const r = originRow + gr;
      if (r > maxRow) break;
      const cols = grid[gr] || [];
      for (let gc = 0; gc < cols.length; gc++) {
        const c = originCol + gc;
        if (c > maxCol) break;
        total = total + 1;
        const colId = columnIdAt(r, c);
        if (colId == null || !columnEditable(colId)) continue;
        const rowObj = rowOriginalAt(r);
        // B9: coerce the raw TSV string to the target column's type at commit (mirrors B3's
        // single-cell commit coercion) — a numeric column commits a real Number, an empty cell
        // commits null; every other editor type passes through verbatim. No mixed/garbage types
        // ever reach the model (T-63-03-01). Validation then runs on the COERCED value.
        const value = coerceCellValue(colId, cols[gc]);
        // T-51-01: validate the pasted value as plain DATA before any write.
        if (runValidator(colId, value, rowObj) !== true) continue;
        const field = fieldOfColId(colId);
        const srcIndex = sourceIndexOfRow(r);
        const oldValue = rowObj ? rowObj[field] : null;
        next = replaceRowValue(next, srcIndex, field, value);
        committed.push({
          rowId: rowIdAt(r),
          columnId: colId,
          oldValue,
          newValue: value
        });
        wrote = wrote + 1;
      }
    }
    if (wrote > 0) {
      editTransition.current = true;
      writeData(next);
      editTransition.current = false;
      // One cell-edit-commit per COMMITTED cell (the per-cell event contract, D-03).
      for (let i = 0; i < committed.length; i++) props.onCellEditCommit && props.onCellEditCommit(committed[i]);
    }
    // WR-02: announce the N-of-M summary only when at least one cell was written. When the paste
    // targeted real cells but every one was skipped (validation-failed / non-editable), announce a
    // distinct validation-failed message instead of a misleading "0 of M cells pasted".
    if (wrote > 0) announce(wrote + ' of ' + total + ' cells pasted');else if (total > 0) announce('No cells pasted — ' + total + ' cells were invalid or read-only');
    return {
      wrote,
      total
    };
  }
  function rowOriginalAt(rowIndex: any) {
    const rowList = rows || [];
    const row = rowList[rowIndex];
    return row ? row.original : null;
  }
  function rowIdAt(rowIndex: any) {
    const rowList = rows || [];
    const row = rowList[rowIndex];
    return row ? row.id : null;
  }
  function tileGridToBox(grid: any, box: any) {
    const srcRows = grid.length;
    const srcCols = srcRows > 0 ? grid[0].length : 0;
    if (srcRows <= 0 || srcCols <= 0) return grid;
    const boxRows = box.r1 - box.r0 + 1;
    const boxCols = box.c1 - box.c0 + 1;
    const rows = boxRows > srcRows ? boxRows : srcRows;
    const cols = boxCols > srcCols ? boxCols : srcCols;
    const out = [];
    for (let r = 0; r < rows; r++) {
      const srcLine = grid[r % srcRows] || [];
      const line = [];
      for (let c = 0; c < cols; c++) {
        const v = srcLine[c % srcCols];
        line.push(v != null ? v : '');
      }
      out.push(line);
    }
    return out;
  }
  function pasteRange() {
    // B11: never paste into a header-active state (the reusable clipboard guard) — a header
    // anchor would silently write body row 0 at the header's column.
    if (!clipboardActiveAllowed()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) return;
    // CR-02 (ROZ138): SNAPSHOT the destination SYNCHRONOUSLY, before the clipboard read resolves.
    // C3: the destination is the SELECTED RANGE (the tiling target) when one exists, else the
    // single active cell. $data.rangeAnchor/rangeFocus + activeRow/activeColIndex are useState-backed
    // on React; re-reading them inside the async .then() returns the mount-render stale value, so a
    // selection/cell move between Ctrl+V and the read resolving would anchor the paste wrong. Capture
    // the box + anchor now and pass them into tileGridToBox / applyGridToRange.
    const box = normalizedRange();
    const anchorRow = box ? box.r0 : activeRow;
    const anchorCol = box ? box.c0 : activeColIndex;
    const destBox = box || {
      r0: anchorRow,
      r1: anchorRow,
      c0: anchorCol,
      c1: anchorCol
    };
    let p: any = null;
    try {
      p = navigator.clipboard.readText();
    } catch (err: any) {
      return;
    }
    if (!p || !p.then) return;
    p.then((text: any) => {
      const grid = parseTsv(text);
      if (!grid.length) return;
      // C3: tile the clipboard block to fill the destination range (single→range fill,
      // smaller-tiles-into-larger); a clipboard larger than the box pastes its full block.
      const tiled = tileGridToBox(grid, destBox);
      applyGridToRange(tiled, anchorRow, anchorCol);
    }).catch(() => {});
  }
  function cutRange() {
    if (!clipboardActiveAllowed()) return;
    // Snapshot the source rectangle synchronously (same ROZ138 concern as pasteRange).
    const box = normalizedRange();
    const r0 = box ? box.r0 : activeRow;
    const r1 = box ? box.r1 : activeRow;
    const c0 = box ? box.c0 : activeColIndex;
    const c1 = box ? box.c1 : activeColIndex;
    // Copy first (best-effort) — rangeToTsv() reads the CURRENT range/active cell NOW, before the clear.
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        const cp = navigator.clipboard.writeText(rangeToTsv());
        if (cp && cp.catch) cp.catch(() => {});
      } catch (err: any) {/* best-effort copy */}
    }
    // Clear the source: a grid of empty strings sized to the range, applied at the top-left.
    const grid = [];
    for (let r = r0; r <= r1; r++) {
      const cols = [];
      for (let c = c0; c <= c1; c++) cols.push('');
      grid.push(cols);
    }
    applyGridToRange(grid, r0, c0);
  }
  function tileIndex(i: any, lo: any, hi: any) {
    const span = hi - lo + 1;
    if (span <= 1) return lo;
    let k = (i - lo) % span;
    if (k < 0) k = k + span;
    return lo + k;
  }
  function fillRange(sourceBox: any, endCell: any) {
    // B7 (React-stale-safe): compute the EXTENDED rectangle from the gesture's FRESH endpoints —
    // the pre-drag sourceBox (∪) the drag's final end cell — NOT a $data.rangeFocus re-read. On
    // React the `up` closure captured at pointerdown reads the PRE-move range (the rectangle never
    // grows), so deriving the box from the threaded endpoints is what makes the fill cover the
    // dragged cells on React. Falls back to normalizedRange() for a no-gesture (programmatic) call.
    let box;
    if (sourceBox && sourceBox.r0 != null && endCell) {
      let r0 = sourceBox.r0;
      let r1 = sourceBox.r1;
      let c0 = sourceBox.c0;
      let c1 = sourceBox.c1;
      if (endCell.r < r0) r0 = endCell.r;
      if (endCell.r > r1) r1 = endCell.r;
      if (endCell.c < c0) c0 = endCell.c;
      if (endCell.c > c1) c1 = endCell.c;
      box = {
        r0,
        r1,
        c0,
        c1
      };
    } else {
      box = normalizedRange();
    }
    if (!box) return;
    const src = sourceBox && sourceBox.r0 != null ? sourceBox : {
      r0: box.r0,
      r1: box.r0,
      c0: box.c0,
      c1: box.c0
    };
    const grid = [];
    for (let r = box.r0; r <= box.r1; r++) {
      const cols = [];
      for (let c = box.c0; c <= box.c1; c++) {
        const sr = tileIndex(r, src.r0, src.r1);
        const sc = tileIndex(c, src.c0, src.c1);
        const v = cellValueAt(sr, sc);
        cols.push(v == null ? '' : String(v));
      }
      grid.push(cols);
    }
    applyGridToRange(grid, box.r0, box.c0);
  }
  const teardownFillDrag = useCallback(() => {
    if (typeof document !== 'undefined') {
      if (fillDragMove.current) document.removeEventListener('pointermove', fillDragMove.current);
      if (fillDragUp.current) document.removeEventListener('pointerup', fillDragUp.current);
    }
    fillDragMove.current = null;
    fillDragUp.current = null;
    fillDragging.current = false;
  }, []);
  function cellIndexFromPoint(clientX: any, clientY: any) {
    if (typeof document === 'undefined' || !document.elementFromPoint) return null;
    let el = document.elementFromPoint(clientX, clientY);
    // Pierce OPEN shadow roots (Lit): document.elementFromPoint retargets to the shadow HOST, so
    // a drag over the Lit data-table's shadow content would otherwise resolve the host (no cell)
    // and the fill never extends. Descend into each shadowRoot's own elementFromPoint until the
    // deepest element. No-op on the 5 light-DOM targets (el.shadowRoot is null).
    while (el && el.shadowRoot && el.shadowRoot.elementFromPoint) {
      const inner = el.shadowRoot.elementFromPoint(clientX, clientY);
      if (!inner || inner === el) break;
      el = inner;
    }
    if (!el || !el.closest) return null;
    const cellEl = el.closest('[data-grid-cell]');
    if (!cellEl) return null;
    const rowAttr = cellEl.getAttribute('data-row');
    const colAttr = cellEl.getAttribute('data-col-index');
    if (rowAttr == null || colAttr == null || rowAttr === '__header') return null;
    const r = parseInt(rowAttr, 10);
    const c = parseInt(colAttr, 10);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return {
      r,
      c
    };
  }
  const onFillHandlePointerDown = useCallback((e: any) => {
    if (!e) return;
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    fillDragging.current = true;
    // B7: snapshot the PRE-DRAG rectangle (the fill SOURCE) NOW, before pointermove grows the
    // range via setRangeFocus. fillRange reads each source column's own value off THIS box, so an
    // up/left drag copies from the real origin (not the post-drag corner that would flip to a
    // target cell). Captured per-gesture in the closure (no module-let needed).
    const sourceBox = normalizedRange();
    // B7: track the LAST cell the drag reached so fillRange computes the extended rectangle from
    // the gesture's fresh endpoint (React's `up` closure can't re-read the grown $data range).
    let lastCell = sourceBox ? {
      r: sourceBox.r1,
      c: sourceBox.c1
    } : null;
    const move = (ev: any) => {
      if (!fillDragging.current) return;
      const cell = cellIndexFromPoint(ev.clientX, ev.clientY);
      // B20: dedup by target cell. setRangeFocus emits range-change, so calling it on EVERY
      // pointermove (the pointer fires many per cell) spams the event with identical payloads.
      // Only extend (and emit) when the pointer enters a DIFFERENT cell than the last — lastCell
      // seeds from the pre-drag bottom-right corner, so a move that stays on the source corner
      // or re-enters the same cell is suppressed (the range is unchanged).
      if (cell && (!lastCell || cell.r !== lastCell.r || cell.c !== lastCell.c)) {
        lastCell = cell;
        setRangeFocus$local(cell.r, cell.c);
      }
    };
    const up = () => {
      // teardownFillDrag clears fillDragging + removes both listeners (CR-04 shared path).
      teardownFillDrag();
      fillRange(sourceBox, lastCell);
    };
    // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
    fillDragMove.current = move;
    fillDragUp.current = up;
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
  }, [cellIndexFromPoint, fillRange, normalizedRange, setRangeFocus$local, teardownFillDrag]);
  function activeCellColumnId() {
    if (activeIsHeader) return null;
    const rowList = rows || [];
    const row = rowList[activeRow];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[activeColIndex];
    return cell && cell.column ? cell.column.id : null;
  }
  function isActiveCellEditable() {
    const colId = activeCellColumnId();
    return colId != null && columnEditable(colId);
  }
  function isEditing(rowIndex: any, colIndex: any) {
    if (editVer < 0) return false;
    if (editingRowIndex != null && editingRowIndex === rowIndex) {
      const colId = columnIdAt(rowIndex, colIndex);
      return colId != null && columnEditable(colId);
    }
    return editingRow === rowIndex && editingCol === colIndex;
  }
  function cellAriaInvalid(rowIndex: any, colIndex: any): 'true' | null {
    return isEditing(rowIndex, colIndex) && !!invalidMsg ? 'true' : null;
  }
  function runValidator(colId: any, value: any, row: any) {
    const m = editMetaOf(colId);
    const v = m ? m.validate : null;
    if (typeof v !== 'function') return true;
    let r: any = null;
    try {
      r = v(value, row);
    } catch (err: any) {
      return 'Invalid value';
    }
    if (r === true) return true;
    if (typeof r === 'string') return r;
    return 'Invalid value';
  }
  function setInvalid(msg: any) {
    setInvalidMsg(msg != null ? msg : '');
  }
  function replaceRowValue(rows: any, rowIndex: any, field: any, value: any) {
    const src = rows || [];
    const out = [];
    for (let i = 0; i < src.length; i++) {
      if (i === rowIndex) {
        // WR-03: own-property spread, NOT `for (const k in orig)` which walks the prototype chain
        // and would copy inherited enumerable props of typed/class-instance row objects.
        out.push({
          ...(src[i] || {}),
          [field]: value
        });
      } else {
        out.push(src[i]);
      }
    }
    return out;
  }
  function sourceIndexOfRow(visibleRowIndex: any) {
    const rowList = rows || [];
    const row = rowList[visibleRowIndex];
    if (!row) return visibleRowIndex;
    const orig = row.original;
    const data = currentData() || [];
    const idx = data.indexOf(orig);
    return idx >= 0 ? idx : visibleRowIndex;
  }
  function editingColumnId() {
    const rowList = rows || [];
    const row = rowList[editingRow];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[editingCol];
    return cell && cell.column ? cell.column.id : null;
  }
  function editingColumnField() {
    const colId = editingColumnId();
    if (colId == null) return null;
    const d = defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  }
  function editingCellValue() {
    const rowList = rows || [];
    const row = rowList[editingRow];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[editingCol];
    return cell ? cell.getValue() : null;
  }
  function editingRowOriginal() {
    const rowList = rows || [];
    const row = rowList[editingRow];
    return row ? row.original : null;
  }
  function editingRowId() {
    const rowList = rows || [];
    const row = rowList[editingRow];
    return row ? row.id : null;
  }
  function focusEditorWhenReady(selectAll = true) {
    if (!gridRoot.current) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = gridRoot.current ? gridRoot.current.querySelector('[data-editing-cell]') : null;
      if (el) {
        el.focus();
        if (selectAll && el.select) {
          try {
            el.select();
          } catch (e: any) {}
        }
        return;
      }
      attempts = attempts + 1;
      if (attempts >= 30) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  }
  function columnIdAt(rowIndex: any, colIndex: any) {
    const rowList = rows || [];
    const row = rowList[rowIndex];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[colIndex];
    return cell && cell.column ? cell.column.id : null;
  }
  function cellValueAt(rowIndex: any, colIndex: any) {
    const rowList = rows || [];
    const row = rowList[rowIndex];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[colIndex];
    return cell ? cell.getValue() : null;
  }
  function beginEdit(rowIndex: any, colIndex: any, seed: any) {
    const colId = columnIdAt(rowIndex, colIndex);
    if (colId == null || !columnEditable(colId)) return;
    setInvalid('');
    // Single-cell and full-row edit are mutually exclusive (D-06): entering a single-cell
    // editor clears any row-edit state so isEditing never resolves both modes for one cell.
    setEditingRowIndex(null);
    setRowDraft({});
    setEditingRow(rowIndex);
    setEditingCol(colIndex);
    setDraftValue(seed != null ? seed : cellValueAt(rowIndex, colIndex));
    setActiveInControl(true);
    setEditVer(prev => prev + 1);
    // B2: a seeded (type-to-edit) entry must NOT select-all — keep the caret after the
    // seeded char so subsequent typing appends instead of replacing it.
    focusEditorWhenReady(seed == null);
  }
  const focusCellWhenReady = useCallback((row: any, col: any) => {
    if (!gridRoot.current) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = resolveCellEl(String(row), col);
      if (el) {
        el.focus();
        return;
      }
      attempts = attempts + 1;
      if (attempts >= 30) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  }, [resolveCellEl]);
  const indexOfRowIn = useCallback((rows: any, rowOriginal: any, rowId: any) => {
    const list = rows || [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r) continue;
      if (rowId != null && r.id === rowId) return i;
      if (rowOriginal != null && r.original === rowOriginal) return i;
    }
    return -1;
  }, [rows]);
  function endEdit() {
    setEditingRow(-1);
    setEditingCol(-1);
    setDraftValue(null);
    setInvalidMsg('');
    setActiveInControl(false);
    setEditVer(prev => prev + 1);
  }
  function endRowEdit() {
    setEditingRowIndex(null);
    setRowDraft({});
    setInvalidMsg('');
    setActiveInControl(false);
    setEditVer(prev => prev + 1);
  }
  function coerceCellValue(colId: any, raw: any) {
    if (editorTypeOf(colId) !== 'number') return raw;
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }
  function commitEdit(overrideValue = undefined, skipFocusReturn = false) {
    if (editingRow < 0) return false;
    const colId = editingColumnId();
    if (colId == null) {
      endEdit();
      return false;
    }
    const field = editingColumnField();
    const oldValue = editingCellValue();
    const rowOriginal = editingRowOriginal();
    const rowId = editingRowId();
    // B3: coerce by the column's editor type BEFORE validation + write so the validator
    // and the model both see the typed value (number/null), not the raw draft string.
    const rawValue = overrideValue !== undefined ? overrideValue : draftValue;
    const newValue = coerceCellValue(colId, rawValue);
    const err = runValidator(colId, newValue, rowOriginal);
    if (err !== true) {
      // D-01: reject — keep the editor open, announce, re-trap focus, NEVER write the model.
      setInvalid(err);
      focusEditorWhenReady();
      return false;
    }
    setInvalid('');
    const srcIndex = sourceIndexOfRow(editingRow);
    const next = replaceRowValue(currentData(), srcIndex, field, newValue);
    // Snapshot the EDITING cell to return focus to BEFORE endEdit clears editing state.
    const focusRow = editingRow;
    const focusCol = editingCol;
    // Guard the teardown blur: writeData/endEdit re-render unmounts the editor → its blur
    // must NOT re-enter commitEdit (double cell-edit-commit). Cleared after the focus return.
    editTransition.current = true;
    writeData(next);
    // Exactly one emit per commit, from this single call site (writeData does NOT emit).
    props.onCellEditCommit && props.onCellEditCommit({
      rowId,
      columnId: colId,
      oldValue,
      newValue
    });
    endEdit();
    editTransition.current = false;
    // Defer the focus return so the display↔editor re-render commits first (async on
    // React/Solid/Lit) — the cell is focusable with its roving tabindex only after the
    // editor unmounts and the display branch (+ tabindex) re-renders. Skipped on a
    // Tab-advance (the caller immediately opens the next editor and focuses THAT).
    // B23: do NOT focus the FIXED old index here — under an active sort/filter the committed row
    // RELOCATES, and focusCellWhenReady(oldRow,col) would land on whatever row now sits at the old
    // index (or drop to <body>). Instead record a pending follow-request the refreshRowModel pass
    // consumes AFTER the row model re-derives: it resolves the row's NEW display index from the
    // fresh model (React-stale-safe) and focuses THAT cell; the @focusin sync then re-seats the
    // active-cell state so it and DOM focus stay coherent. With no sort/filter the row keeps its
    // index → byte-behaviorally identical to before.
    if (skipFocusReturn !== true) pendingEditFollow.current = {
      rowOriginal,
      rowId,
      col: focusCol
    };
    return true;
  }
  function cancelEdit() {
    if (editingRow < 0) return;
    // CR-01: capture from the EDITING pair (authoritative), NOT the active-cell indices — a
    // Tab-advance writes activeRow/activeColIndex to the NEXT cell BEFORE opening its editor, so
    // an Escape on the just-opened editor would otherwise return focus to the Tab-target cell
    // instead of the cell being cancelled. commitEdit already snapshots editingRow/editingCol.
    const focusRow = editingRow;
    const focusCol = editingCol;
    editTransition.current = true;
    endEdit();
    editTransition.current = false;
    focusCellWhenReady(focusRow, focusCol);
  }
  function editableColumnsForRow(rowIndex: any) {
    const rowList = rows || [];
    const row = rowList[rowIndex];
    if (!row) return [];
    const cells = visibleCellsFor(row);
    const out = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const colId = cell && cell.column ? cell.column.id : null;
      if (colId == null || !columnEditable(colId)) continue;
      const d = defFor(colId);
      const field = d ? d.accessorKey != null ? d.accessorKey : colId : colId;
      // colIndex = the VISIBLE-cell index (the data-col-index the editor cell renders under).
      // Carried so the row-mode Tab containment (B21) + the validation-failure focus (B22)
      // can address a SPECIFIC editor by column, not just the first [data-editing-cell].
      out.push({
        colId,
        field,
        colIndex: c
      });
    }
    return out;
  }
  function focusRowEditorAt(rowIndex: any, colIndex: any) {
    if (!gridRoot.current) return;
    let attempts = 0;
    const tryFocus = () => {
      const cellEl = resolveCellEl(String(rowIndex), colIndex);
      const ed = cellEl && cellEl.querySelector ? cellEl.querySelector('[data-editing-cell]') : null;
      if (ed) {
        ed.focus();
        if (ed.select) {
          try {
            ed.select();
          } catch (e: any) {}
        }
        return;
      }
      attempts = attempts + 1;
      if (attempts >= 30) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  }
  function beginRowEdit(row: any) {
    const rowIndex = rowIndexOf(row);
    if (rowIndex < 0) return;
    const editable = editableColumnsForRow(rowIndex);
    if (editable.length === 0) return;
    // Clear any single-cell editor first (mutual exclusivity).
    setEditingRow(-1);
    setEditingCol(-1);
    setDraftValue(null);
    setInvalid('');
    // Seed each editable cell's draft from its current value.
    const draft = {};
    const rowList = rows || [];
    const r = rowList[rowIndex];
    const orig = r ? r.original : null;
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      draft[ec.colId] = orig ? orig[ec.field] : null;
    }
    setRowDraft(draft);
    setEditingRowIndex(rowIndex);
    setActiveInControl(true);
    setEditVer(prev => prev + 1);
    focusEditorWhenReady();
  }
  function commitRow() {
    if (editingRowIndex == null) return false;
    const rowIndex = editingRowIndex;
    const editable = editableColumnsForRow(rowIndex);
    if (editable.length === 0) {
      endRowEdit();
      return false;
    }
    const rowList = rows || [];
    const r = rowList[rowIndex];
    const rowOriginal = r ? r.original : null;
    const rowId = r ? r.id : null;
    const draft = rowDraft || {};
    // Validate every edited column FIRST (D-01: a single failure blocks the whole row commit).
    // B3 (Rule 1): coerce each draft by the column's editor type BEFORE validation + write — a
    // 'number' editor must commit a real Number/null, never the raw editor STRING (the single-cell
    // commitEdit already coerces via coerceCellValue; the row path silently committed strings →
    // a number column ended up holding '99'). Coerce once here so the validator and the model both
    // see the typed value, identical to the single-cell funnel.
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      const err = runValidator(ec.colId, coerceCellValue(ec.colId, draft[ec.colId]), rowOriginal);
      if (err !== true) {
        setInvalid(err);
        // B22: focus the OFFENDING column's editor (the one whose validator rejected), NOT
        // unconditionally the first editor (focusEditorWhenReady resolves the first
        // [data-editing-cell] in DOM order). ec.colIndex is the offending cell's visible col.
        focusRowEditorAt(rowIndex, ec.colIndex);
        return false;
      }
    }
    setInvalid('');
    // Build the changes payload (only the columns whose value actually changed) + the field→
    // value map for the single row-object replace.
    const changes = [];
    const fieldValues = {};
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      // B3 (Rule 1): commit the TYPE-COERCED value (number editor → Number/null), not the raw draft
      // string — matches the single-cell commitEdit funnel so a row column never holds a stray string.
      const newValue = coerceCellValue(ec.colId, draft[ec.colId]);
      const oldValue = rowOriginal ? rowOriginal[ec.field] : null;
      fieldValues[ec.field] = newValue;
      if (oldValue !== newValue) changes.push({
        columnId: ec.colId,
        oldValue,
        newValue
      });
    }
    // ONE fresh-array replace of the SINGLE row object with all field values applied at once.
    const srcIndex = sourceIndexOfRow(rowIndex);
    const next = replaceRowValues(currentData(), srcIndex, fieldValues);
    // Snapshot the active COLUMN to return focus to (the whole row is in edit, so the
    // active-cell column is the roving focus target), BEFORE endRowEdit clears editing state.
    const focusCol = activeColIndex;
    editTransition.current = true;
    writeData(next);
    // EXACTLY ONE emit per row commit, from THIS single call site (React multi-emit dedup, D-07).
    props.onRowEditCommit && props.onRowEditCommit({
      rowId,
      changes
    });
    endRowEdit();
    editTransition.current = false;
    // WR-01/B23 (review): a FULL-ROW commit can RELOCATE its row under an active sort/filter, exactly
    // like the single-cell commitEdit. Do NOT focus the FIXED old index — focusCellWhenReady(rowIndex,
    // col) would land on whatever DIFFERENT row now occupies the old index (or drop to <body>) AND leave
    // $data.activeRow stale, so the @focusin sync writes the WRONG activeRow (IN-02 — roving model +
    // DOM focus incoherent on the next keystroke). Instead record a pending follow-request the
    // refreshRowModel pass consumes AFTER the row model re-derives: it resolves the committed row's NEW
    // display index by IDENTITY (rowId FIRST — stable across a re-sort; rowOriginal as fallback, since
    // the fresh-spread replace changes the row object) and re-seats focus on THAT cell via the DOM-only
    // poll (React-stale-safe). With no sort/filter the row keeps its index → byte-behaviorally identical.
    pendingEditFollow.current = {
      rowOriginal,
      rowId,
      col: focusCol
    };
    return true;
  }
  function cancelRow() {
    if (editingRowIndex == null) return;
    const focusRow = activeRow;
    const focusCol = activeColIndex;
    editTransition.current = true;
    endRowEdit();
    editTransition.current = false;
    focusCellWhenReady(focusRow, focusCol);
  }
  function replaceRowValues(rows: any, rowIndex: any, fieldValues: any) {
    const src = rows || [];
    const fv = fieldValues || {};
    const out = [];
    for (let i = 0; i < src.length; i++) {
      if (i === rowIndex) {
        // WR-03: own-property spread (orig then the field→value map), NOT a `for..in`
        // prototype-walking copy. Spread copies own enumerable props only.
        out.push({
          ...(src[i] || {}),
          ...fv
        });
      } else {
        out.push(src[i]);
      }
    }
    return out;
  }
  function nextEditableCell(fromRow: any, fromCol: any) {
    const rowList = rows || [];
    const rowCount = rowList.length;
    if (rowCount === 0) return null;
    let r = fromRow;
    let c = fromCol + 1;
    while (r < rowCount) {
      const row = rowList[r];
      const cells = row ? visibleCellsFor(row) : [];
      while (c < cells.length) {
        const cell = cells[c];
        const cid = cell && cell.column ? cell.column.id : null;
        if (cid != null && columnEditable(cid)) return {
          row: r,
          col: c
        };
        c = c + 1;
      }
      r = r + 1;
      c = 0;
    }
    return null;
  }
  function prevEditableCell(fromRow: any, fromCol: any) {
    const rowList = rows || [];
    const rowCount = rowList.length;
    if (rowCount === 0) return null;
    let r = fromRow;
    let c = fromCol - 1;
    while (r >= 0) {
      const row = rowList[r];
      const cells = row ? visibleCellsFor(row) : [];
      while (c >= 0) {
        const cell = cells[c];
        const cid = cell && cell.column ? cell.column.id : null;
        if (cid != null && columnEditable(cid)) return {
          row: r,
          col: c
        };
        c = c - 1;
      }
      r = r - 1;
      if (r >= 0) {
        const prow = rowList[r];
        const pcells = prow ? visibleCellsFor(prow) : [];
        c = pcells.length - 1;
      }
    }
    return null;
  }
  function inRowEdit() {
    return editingRowIndex != null;
  }
  function editorValueFor(colId: any) {
    return inRowEdit() ? rowDraft ? rowDraft[colId] : null : draftValue;
  }
  function editorCheckedFor(colId: any) {
    return !!(inRowEdit() ? rowDraft ? rowDraft[colId] : null : draftValue);
  }
  function editorCommitFor(colId: any) {
    return (value: any) => {
      if (inRowEdit()) {
        setRowDraft$local(colId, value);
        return;
      }
      commitEdit(value);
    };
  }
  function editorCancelFor() {
    return () => {
      if (inRowEdit()) {
        cancelRow();
        return;
      }
      cancelEdit();
    };
  }
  const onCellEditorInput = useCallback((colId: any, evt: any) => {
    const v = evt && evt.target ? evt.target.value : '';
    if (inRowEdit()) {
      setRowDraft$local(colId, v);
      return;
    }
    setDraftValue(v);
  }, [inRowEdit, setRowDraft$local]);
  const onCellEditorCheckbox = useCallback((colId: any, evt: any) => {
    const v = !!(evt && evt.target && evt.target.checked);
    if (inRowEdit()) {
      setRowDraft$local(colId, v);
      return;
    }
    setDraftValue(v);
  }, [inRowEdit, setRowDraft$local]);
  function setRowDraft$local(colId: any, value: any) {
    const src = rowDraft || {};
    const next = {};
    for (const k in src) next[k] = src[k];
    next[colId] = value;
    setRowDraft(next);
  }
  function rowEditTab(target: any, backward: any) {
    const rowIndex = editingRowIndex;
    if (rowIndex == null) return;
    const editable = editableColumnsForRow(rowIndex);
    if (editable.length === 0) return;
    const cols = editable.map((ec: any) => ec.colIndex);
    const cell = target && target.closest ? target.closest('[data-grid-cell]') : null;
    const curAttr = cell ? cell.getAttribute('data-col-index') : null;
    const cur = curAttr != null ? parseInt(curAttr, 10) : -1;
    let pos = cols.indexOf(cur);
    if (pos < 0) pos = 0;
    const len = cols.length;
    const nextPos = backward ? (pos - 1 + len) % len : (pos + 1) % len;
    focusRowEditorAt(rowIndex, cols[nextPos]);
  }
  const onEditorKeyDown = useCallback((e: any) => {
    if (!e) return;
    const key = e.key;
    // Full-row mode (req-6): Enter from ANY cell editor commits the WHOLE row at once (ONE
    // model write + ONE row-edit-commit); Escape reverts the whole row. Tab moves between the
    // row's editors NATIVELY (no commit-per-cell) — let the browser advance focus, so we don't
    // preventDefault it here.
    if (inRowEdit()) {
      if (key === 'Enter') {
        e.preventDefault();
        commitRow();
      } else if (key === 'Escape') {
        e.preventDefault();
        cancelRow();
      }
      // B21: CONTAIN Tab within the editing row. Native Tab escapes the row at its first/last
      // editor (leaving editingRowIndex set so onGridKeyDown stays frozen → keyboard trap). Take
      // Tab over entirely and cycle between the row's editors WITH WRAP (forward off the last →
      // first; Shift+Tab off the first → last). Cross-target-safe (no reliance on the native DOM
      // tab order across a Lit shadow boundary).
      else if (key === 'Tab') {
        e.preventDefault();
        rowEditTab(e.target, e.shiftKey);
      }
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      commitEdit(undefined);
    } else if (key === 'Tab') {
      e.preventDefault();
      // Resolve the advance target from the EDITING pair (the cell that is open), not the
      // active cell (they match here, but the editing pair is authoritative). B4: Shift+Tab
      // moves BACKWARD (prevEditableCell), a plain Tab FORWARD (nextEditableCell). Snapshot
      // the editing pair BEFORE commit (commitEdit resets it to -1).
      const fromRow = editingRow;
      const fromCol = editingCol;
      const target = e.shiftKey ? prevEditableCell(fromRow, fromCol) : nextEditableCell(fromRow, fromCol);
      // skipFocusReturn=true: don't bounce focus back to the committed cell — we advance
      // straight into the next editable cell's editor below. Use the RETURN value (not a
      // re-read of $data.editingRow — async-stale on React) to gate the advance: a validation
      // failure returns false and keeps the editor open (the user must fix the value first).
      const committed = commitEdit(undefined, true);
      if (committed && target) {
        setActiveRow(target.row);
        setActiveColIndex(target.col);
        beginEdit(target.row, target.col, null);
      } else if (committed) {
        // B5: no editable cell in the Tab direction (grid start/end) — keep focus INSIDE the
        // grid by returning it to the just-committed cell instead of letting it drop to <body>.
        focusCellWhenReady(fromRow, fromCol);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [beginEdit, cancelEdit, cancelRow, commitEdit, commitRow, editingCol, editingRow, focusCellWhenReady, inRowEdit, nextEditableCell, prevEditableCell, rowEditTab]);
  const onEditorBlur = useCallback((e: any) => {
    // Full-row mode (req-6): blur NEVER commits — the row commits as a UNIT only on an
    // explicit Enter / save / editRow-driven flow (a per-cell blur-commit would split the row
    // into N writes + N events, violating the one-write/one-event contract). Tabbing between
    // the row's own editors is a normal focus move, not a commit.
    if (inRowEdit()) return;
    if (editingRow < 0 || editTransition.current) return;
    const next = e ? e.relatedTarget : null;
    // A null relatedTarget is an unmount-blur (the editor left the DOM) or a focus drop the
    // keyboard path owns; committing here would double-count (WR-04: the OLD editor's blur on
    // a Tab-advance fires with a TRANSIENT null relatedTarget while it unmounts). Keep the
    // conservative null=skip behavior.
    if (next == null) return;
    // Focus moving OUTSIDE the grid (a click into another widget) → commit (D-01 reject keeps
    // the editor open on an invalid value).
    if (!(gridRoot.current && gridRoot.current.contains && gridRoot.current.contains(next))) {
      commitEdit(undefined);
      return;
    }
    // Focus stays INSIDE the grid. B1: distinguish a controlled keyboard transition (the
    // keyboard handler already committed) from a genuine click-away to ANOTHER grid cell
    // (which must commit + close so the grid is not wedged with an open editor).
    const nextCell = next.closest ? next.closest('[data-grid-cell]') : null;
    const fromCell = e && e.target && e.target.closest ? e.target.closest('[data-grid-cell]') : null;
    // Same cell (an inner control / the editing cell itself on an Enter focus-return) → a
    // controlled move; skip. Also skip when either cell can't be resolved (an unmounting
    // editor has no owning cell — the Tab-advance remount-blur path, never a click-away).
    if (!nextCell || !fromCell || nextCell === fromCell) return;
    // A Tab-advance already committed the old editor and opened the next one, so the live
    // editing pair has MOVED off the blurring editor's cell; only a click-away leaves the
    // editing pair still ON fromCell. Skip when they differ (the keyboard path owns it — no
    // double commit, WR-04).
    const fromRow = fromCell.getAttribute('data-row');
    const fromCol = fromCell.getAttribute('data-col-index');
    if (fromRow !== String(editingRow) || fromCol !== String(editingCol)) return;
    // Genuine click-away to another grid cell → commit + close. skipFocusReturn=true so the
    // commit does NOT bounce focus back to the just-committed editing cell (which would fight
    // the click destination). The commit's writeData re-renders the table and can DROP DOM
    // focus on the fine-grained targets (Solid keyed-row replace). Re-seat focus on the CLICK
    // DESTINATION cell ONLY IF the re-render actually dropped it — a single deferred check
    // (not a 30-frame poll) so a target whose click-focus SURVIVED (Lit) is never re-focused
    // late, which would steal focus back from a subsequent navigation.
    const destRow = nextCell.getAttribute('data-row');
    const destCol = nextCell.getAttribute('data-col-index');
    commitEdit(undefined, true);
    const reseatDestFocus = () => {
      if (!gridRoot.current || destRow == null || destCol == null || destRow === '__header') return;
      const root = gridRoot.current.getRootNode ? gridRoot.current.getRootNode() : null;
      const act = root && root.activeElement ? root.activeElement : null;
      // Focus already landed inside the grid (the click-focus survived the re-render) — leave it.
      if (act && gridRoot.current.contains && gridRoot.current.contains(act)) return;
      const el = resolveCellEl(destRow, parseInt(destCol, 10));
      if (el) el.focus();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reseatDestFocus);else setTimeout(reseatDestFocus, 0);
  }, [commitEdit, editingCol, editingRow, inRowEdit, resolveCellEl]);
  function editCell(rowIndex: any, colIndex: any) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const maxCol = visibleColCount() - 1;
    const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    setActiveIsHeader(false);
    setActiveRow(r);
    setActiveColIndex(c);
    beginEdit(r, c, null);
  }
  function commitEditing() {
    if (editingRow >= 0) commitEdit(undefined);
  }
  function editRow(rowIndex: any) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const rowList = rows || [];
    const row = rowList[r];
    if (!row) return;
    setActiveIsHeader(false);
    setActiveRow(r);
    beginRowEdit(row);
  }
  function focusAbsCellWhenReady(absRow: any, localRow: any, col: any) {
    if (!gridRoot.current) return;
    let attempts = 0;
    const want = String(absRow + 1);
    const tryFocus = () => {
      const el = resolveCellEl(String(localRow), col);
      if (el) {
        const rowEl = el.closest ? el.closest('[role="row"]') : null;
        const ari = rowEl ? rowEl.getAttribute('aria-rowindex') : null;
        if (ari === want) {
          el.focus();
          return;
        }
      }
      attempts = attempts + 1;
      if (attempts >= 60) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  }
  function focusCell(rowIndex: any, colIndex: any) {
    // B16: isGrid()-gate the verb. In 'table' mode there is no roving active cell, so focusCell
    // is a NO-OP (never an activecell-change emit) — the keyboard path (onGridKeyDown) is already
    // isGrid-gated; the exposed verb must mirror that so a consumer's focusCell on a table-mode
    // instance does not leak a spurious activecell-change.
    if (!isGrid()) return;
    const maxCol = visibleColCount() - 1;
    const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    // C1: clamp the ABSOLUTE row index to the full filtered+sorted (pre-pagination) bounds.
    const absLast = prePaginationRowCount() - 1;
    const absRow = clamp(Math.trunc(Number(rowIndex)) || 0, 0, absLast < 0 ? 0 : absLast);
    // B14: snapshot the PRE-write ABSOLUTE position so the activecell-change emit fires ONLY on a
    // real move (mirrors the keyboard path's WR-06 suppression). A no-op focusCell to the already-
    // active cell must NOT emit; a header→body landing (prevIsHeader) is a real move.
    const prevAbs = toAbsRow(activeRow);
    const prevIsHeader = activeIsHeader;
    if (props.virtual) {
      // Virtual mode: $data.activeRow IS the full pre-pagination index (the wr.vi.index space), so
      // the absolute index maps 1:1. focusActiveCell already runs the D-12 off-window scroll-then-
      // focus path (scrollToIndex(absRow) → deferred-rAF focus) when the row is outside the window.
      setActiveIsHeader(false);
      setActiveInControl(false);
      setActiveRow(absRow);
      setActiveColIndex(c);
      focusActiveCell(absRow, c, false);
    } else {
      // Paginated mode: resolve the page that HOLDS the absolute row, switch to it, then focus the
      // in-page cell. The page-relative local row = absRow - page*pageSize is what the non-virtual
      // body's data-row markers (and the roving tabindex) address.
      const size = pageSize();
      const targetPage = size > 0 ? Math.floor(absRow / size) : 0;
      const localRow = absRow - targetPage * size;
      const switched = targetPage !== pageIndex();
      if (switched) setPage(targetPage);
      setActiveIsHeader(false);
      setActiveInControl(false);
      setActiveRow(localRow);
      setActiveColIndex(c);
      if (switched) {
        // The switched-in page renders ASYNC — poll until the (localRow, c) cell carries the
        // TARGET page's absolute aria-rowindex (absRow+1) before focusing, so the OLD page's
        // same-indexed cell is never grabbed-then-removed (drop-to-<body>). DOM-only, React-safe.
        focusAbsCellWhenReady(absRow, localRow, c);
      } else {
        // Same page: re-seat focus synchronously (the REQ-5 idiom — re-focus after a button click).
        // Thread isHeader=false explicitly (focusActiveCell would otherwise re-read the React/Angular
        // async-stale $data.activeIsHeader, landing on a header when a sort button was last clicked).
        focusActiveCell(localRow, c, false);
      }
    }
    if (absRow !== prevAbs || prevIsHeader) {
      props.onActivecellChange && props.onActivecellChange({
        rowIndex: absRow,
        colIndex: c
      });
    }
  }
  function getActiveCell() {
    return activeIsHeader ? {
      rowIndex: null,
      colIndex: activeColIndex,
      isHeader: true
    } : {
      rowIndex: toAbsRow(activeRow),
      colIndex: activeColIndex,
      isHeader: false
    };
  }
  function clearActiveCell() {
    if (!isGrid()) return;
    setActiveIsHeader(false);
    setActiveInControl(false);
    setActiveRow(0);
    setActiveColIndex(0);
  }
  function toggleRowExpanded(rowId: any) {
    if (!table.current) return;
    const target = String(rowId);
    const flat = table.current.getCoreRowModel().flatRows;
    for (const r of flat as any) {
      if (r.id === target || r.original && String(r.original.id) === target) {
        r.toggleExpanded();
        return;
      }
    }
  }
  function expandAll() {
    if (!table.current) return;
    table.current.toggleAllRowsExpanded(true);
  }
  function collapseAll() {
    if (!table.current) return;
    table.current.resetExpanded(true);
  }
  function getExpandedRows() {
    if (!table.current) return [];
    const out = [];
    const flat = table.current.getCoreRowModel().flatRows;
    for (const r of flat as any) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
    return out;
  }
  function applyGrouping(cols: any) {
    if (table.current) table.current.setGrouping(cols);
  }
  function clearGrouping() {
    if (table.current) table.current.setGrouping([]);
  }
  function getFacetedUniqueValues(colId: any) {
    if (tick() < 0 || !table.current) return [];
    const col = table.current.getColumn(colId);
    if (!col || !col.getFacetedUniqueValues) return [];
    const map = col.getFacetedUniqueValues(); // Map<any, number>
    return map ? Array.from(map.keys()) : []; // KEYS only — counts deferred (D-03)
  }
  function getFacetedMinMaxValues(colId: any) {
    if (tick() < 0 || !table.current) return null;
    const col = table.current.getColumn(colId);
    if (!col || !col.getFacetedMinMaxValues) return null;
    return col.getFacetedMinMaxValues() || null; // [number, number] | null
  }

  useEffect(() => {
    // Seed the uncontrolled `data` fallback (Phase 51 req-4) from the initial prop so an
    // edit committed BEFORE the consumer ever pushes new rows (or when the consumer passes
    // a one-way `:data`) has a base array to whole-array-replace. currentData() then sources
    // the bound prop when controlled, this fallback otherwise.
    setDataDefault(_dataRef.current || []);
    // Build the table instance HERE so the closures below capture the live `table`.
    table.current = createTable({
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      // currentData() = the bound prop when controlled, else the uncontrolled $data.dataDefault
      // (Phase 51 req-4 — so a committed edit's writeData re-feed is observed either way).
      data: currentData(),
      columns: tableColumns(),
      state: currentState(),
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      // Expandable rows (phase 50, D-04): the expanded row model is supplied UNCONDITIONALLY
      // (mirrors the other models) — inert when `expanded` is empty + no getSubRows
      // (byte-identical-off, req-10). getSubRows is the TABLE-level child accessor (NOT a
      // ColumnDef field). getRowCanExpand makes EVERY row expandable for the #detail seam
      // (no subRows to gate on); when getSubRows IS supplied, leave it undefined so the
      // default `!!subRows.length` rule applies (only parents with children expand).
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (props.getSubRows || undefined) as any,
      getRowCanExpand: _expandableRef.current === true && props.getSubRows == null ? () => true : undefined,
      onExpandedChange: onExpandedChangeCb,
      // Grouping auto-expand (phase 50 req-4): table-core's autoResetExpanded defaults TRUE, so a
      // POST-MOUNT setGrouping (the consumer #groupBar / applyGrouping verb) auto-fires
      // onExpandedChange({}) to reset the expanded set. That spurious reset funnels through
      // writeExpanded and would LATCH expandedTouched=true — defeating the grouping auto-expand
      // default (currentState().expanded would fall back to {} → nested group subtrees collapsed).
      // Disabling it makes post-mount grouping behave like initial grouping (subtrees auto-expanded
      // until the FIRST real user toggle). Inert for the plain/expand-only table (no grouping/sort/
      // filter mutation triggers an auto-reset there); explicit expandAll/collapseAll/toggle verbs
      // are unaffected (they fire regardless of this flag).
      autoResetExpanded: false,
      // Grouping (phase 50 reqs 4-7, D-04/D-05): the grouped row model is supplied
      // UNCONDITIONALLY (mirrors the expand model) — inert when `grouping` is empty
      // (byte-identical-off, req-10). When `grouping` is a non-empty ordered key list,
      // table-core FLATTENS group-header rows (carrying getIsGrouped()/subRows) and their
      // members into getRowModel().rows, so they ride the SAME D-04 <template r-for> seam (no
      // nested r-for — Pitfall 1). Group rows are expandable via the EXISTING expanded model
      // (getRowCanExpand default `!!subRows.length`), so collapsing a group hides its subtree.
      getGroupedRowModel: getGroupedRowModel(),
      onGroupingChange: onGroupingChangeCb,
      // Faceted filtering (phase 50 reqs 8-9, D-03): the 3 faceted models are supplied
      // UNCONDITIONALLY (mirrors the expand/group models) — INERT until a consumer reads a
      // column facet (the getFaceted* verbs / #filter slot), so byte-identical-off holds (req-10).
      // The default getFacetedUniqueValues/getFacetedMinMaxValues impls are cross-filtered (D-03).
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: makeFacetedUniqueValues(),
      getFacetedMinMaxValues: makeFacetedMinMaxValues(),
      // Server-side hook (req-6): when `manual` is set, table-core trusts the consumer's
      // rows verbatim (no client-side filter/sort/paginate) and only emits the change
      // events so the consumer can fetch the next page/filtered slice.
      manualPagination: props.manual === true,
      manualFiltering: props.manual === true,
      manualSorting: props.manual === true,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: _selectionModeRef.current !== 'none',
      enableMultiRowSelection: _selectionModeRef.current === 'multiple',
      // PER-SLICE callbacks (Open-Q1: each maps 1:1 to a slice's r-model + change event,
      // no global onStateChange diff) — hoisted top-level consts, re-passed by the re-feed
      // $watch so React reads fresh currentState (the stale-closure fix, F6).
      onSortingChange: onSortingChangeCb,
      onGlobalFilterChange: onGlobalFilterChangeCb,
      onColumnFiltersChange: onColumnFiltersChangeCb,
      onPaginationChange: onPaginationChangeCb,
      onRowSelectionChange: onRowSelectionChangeCb,
      onColumnVisibilityChange: onColumnVisibilityChangeCb,
      onColumnSizingChange: onColumnSizingChangeCb,
      onColumnOrderChange: onColumnOrderChangeCb,
      onColumnPinningChange: onColumnPinningChangeCb,
      onColumnSizingInfoChange: onColumnSizingInfoChangeCb,
      // Resize mode: 'onChange' so the bound columnSizing model updates live during the
      // drag (the behavioral width-delta assertion observes the in-progress width). Column
      // resizing is enabled at the table level; per-column opt-out is via the ColumnDef.
      columnResizeMode: 'onChange',
      enableColumnResizing: true,
      renderFallbackValue: null,
      // table-core's RESOLVED options type (TableOptionsResolved) requires a global
      // onStateChange + renderFallbackValue; we drive state via the per-slice on<Slice>Change
      // callbacks above, so the global hook is a no-op. Present so the createTable() argument
      // satisfies the strict bundled-leaf tsc (deferred-items strict-tsc #2 close).
      onStateChange: () => {}
    });
    refreshRowModel.current = () => {
      if (!table.current) return;
      // Capture fresh locals; never write a $data key then re-read it in the same fn
      // (ROZ138 / React stale-read — setState is async on React, the closure binds the
      // PRE-write value).
      // windowSource(): the FULL pre-pagination model when virtual (windowing replaces client
      // pagination, req-9), else the normal paginated row model (non-virtual path byte-unchanged).
      const nextRows = windowSource().slice();
      const nextGroups = table.current.getHeaderGroups().slice();
      setRows(nextRows);
      setHeaderGroups(nextGroups);
      setRowModelVer(prev => prev + 1);
      // Vertical windowing re-feed (Pitfall 2 — stale count): push the fresh full-model count
      // into the virtualizer + reconcile IMPERATIVELY here (the table.setOptions re-feed path),
      // NEVER in a render helper (Pitfall 1). Pass the COMPLETE options set (virtual-core's
      // setOptions replaces, not merges). Guarded so the off path executes no virtual-core code.
      if (props.virtual && virtualizer.current) {
        virtualizer.current.setOptions(virtualizerOptions());
        virtualizer.current._willUpdate();
      }
      // D-05: on every data change (re-sort/filter/paginate/page-size — all re-pull here),
      // clamp the active cell to the new bounds (same indices, clamped if the grid shrank;
      // no row-id following, no top-bounce). isGrid()-gated so 'table' mode is untouched.
      // B8/B23: pass the FRESH bounds derived from `nextRows` (NOT $data.rows, which is the
      // async-stale useState snapshot on React) so a filter-to-fewer clamps the active cell AND
      // the range corners on React too — never re-reading the pre-change model.
      const nextRowCount = nextRows.length;
      const nextColCount = nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0;
      clampActiveCell(nextRowCount, nextColCount);
      // B23: a just-committed single-cell edit may have RELOCATED its row under an active sort/
      // filter. `nextRows` is the FRESH visible model (its index space == the rendered data-row
      // indices), so resolve the committed row's NEW index by identity HERE (never from the React-
      // stale state) and re-seat focus on that cell via the DOM-only poll (focusCellWhenReady reads
      // gridRoot only → React-safe). Consumed ONCE (cleared) so a multi-render re-feed focuses once;
      // a no-relocation commit resolves the same index → byte-behaviorally identical to before.
      if (pendingEditFollow.current && isGrid()) {
        const follow = pendingEditFollow.current;
        pendingEditFollow.current = null;
        const followIdx = indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
        if (followIdx >= 0) focusCellWhenReady(followIdx, follow.col);
      }
      // keep the select-all checkbox's `indeterminate` DOM property in lockstep with the
      // selection state (bound :indeterminate is inert on 5/6 targets). The box persists
      // across selection changes; a microtask defer covers React's post-render DOM patch.
      syncIndeterminate();
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(syncIndeterminate);else Promise.resolve().then(syncIndeterminate);
    };

    // initial pull
    refreshRowModel.current();

    // ── Grid mode: capture the table root ──────────────────────────────────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean.
    gridRoot.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-data-table') : null;
    // WR-04: NO on-mount auto-focus of the entry cell. Auto-focusing here stole focus on
    // page load AND was non-deterministic on React/Solid (the entry cell may not be
    // committed to the DOM yet at the $onMount microtask). The roving tabindex="0" entry
    // cell IS the first Tab-in target (matching the Wave-0 probe's "no auto-focus on
    // mount"); the consumer drives focus by Tabbing/clicking in, never the component.

    // ── Vertical windowing: construct the virtualizer (req-1/2 — ONLY when virtual) ───────
    // Built HERE (post-mount) so getScrollElement resolves the rendered .rdt-scroll div and
    // getPrePaginationRowModel reads the live table. ENTIRELY inside the $props.virtual guard:
    // when off, NO virtual-core runtime code executes (byte-identical-off). _didMount() registers
    // the scroll-element ResizeObserver and returns the teardown stored for $onUnmount.
    if (props.virtual) {
      gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rdt-scroll') : null;
      virtualizer.current = new Virtualizer(virtualizerOptions());
      virtualizerCleanup.current = virtualizer.current._didMount();
      // FINE-GRAINED FIRST-WINDOW KICK (Solid/Svelte): the windowed <For>/{#each} accessor was first
      // evaluated at initial render — while `virtualizer` was still null — and (because windowedRows()
      // reads $data.windowVer up top) subscribed to windowVer then returned []. `virtualizer` is a
      // non-reactive `let`, so its assignment above does NOT notify the accessor; we must bump the
      // SIGNAL it subscribed to. _didMount() computes the first window synchronously but its onChange
      // only fires on SUBSEQUENT scroll/resize, so without this explicit bump the first window would
      // never paint on the fine-grained targets. Idempotent + harmless on the coarse targets (they
      // re-render wholesale anyway). One bump = one re-run that now sees the non-null virtualizer and
      // pulls getVirtualItems().
      setWindowVer(prev => prev + 1);
      // After the first window commits (next frame), refine heights + fire the dev-mode warns
      // ONCE. Entirely inside the $props.virtual guard so the virtual=false emitted path adds NO
      // code and these warns can never fire there (req-1 byte-identical-off preserved).
      const afterFirstFrame = () => {
        // D-10: measure the rendered rows.
        remeasureWindow();
        // D-08/A1: a dev-mode runtime warn when the scroll container has no bounded height (the
        // bound may come from consumer CSS the compiler can't see — no compile diagnostic). No
        // process.env guard (not bundler-portable); always-warn-on-misconfig is acceptable.
        const h = gridScrollEl.current ? gridScrollEl.current.clientHeight : 0;
        if (!h) {
          console.warn('[rozie-data-table] virtual is on but the scroll container has no bounded height; set maxHeight or --rozie-data-table-max-height');
        }
        // D-07 (RESOLVED — runtime warn, not a compile diagnostic): warn ONCE when the consumer
        // CONFIGURED client pagination alongside virtual, in the non-manual case (the valid
        // virtual+manual combo per D-09 is silent). The pagination prop carries a non-null default
        // ({ pageIndex: 0, pageSize: 10 }) so it is never strictly null — "configured" is therefore
        // detected as a pagination that DIFFERS from that default (a consumer who set a real page
        // size / index). The uncontrolled default ({0,10}) does NOT trip the warn. Behavior + the
        // virtual=false path are untouched (this lives entirely inside the $props.virtual guard).
        const pg = _paginationRef.current;
        const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
        if (props.manual !== true && pgConfigured) {
          console.warn('[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.');
        }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));else setTimeout(afterFirstFrame, 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (virtualizerCleanup.current) virtualizerCleanup.current();
      // CR-04: remove any live fill-drag document listeners if we unmount mid-drag.
      teardownFillDrag();
    };
  }, []);
  useEffect(() => {
    if (!table.current) return;
    // Phase 51 req-4: track currentData() (the bound prop OR the uncontrolled
    // $data.dataDefault) so a committed edit re-feeds on Lit whether or not r-model:data is
    // bound. Compare by reference AND length so a same-length single-cell edit (fresh array,
    // identical length) still re-feeds.
    const d = currentData() || [];
    if (d === lastData.current && d.length === lastDataLen.current) return;
    lastData.current = d;
    lastDataLen.current = d.length;
    reFeed();
  }, [currentData, lastData, lastDataLen, reFeed, table]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    reFeed();
  }, [colReg, columnFilters, columnOrder, columnPinning, columnSizing, columnVisibility, data, dataDefault, expanded, globalFilter, grouping, pagination, props.expandable, props.groupable, props.selectionMode, rowSelection, sorting]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ sortColumn, clearSorting, toggleRowExpanded, expandAll, collapseAll, getExpandedRows, applyGrouping, clearGrouping, getFacetedUniqueValues, getFacetedMinMaxValues, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, getRowIndexRelativeToPage, editCell, commitEditing, editRow, getSelectedRange, cut });
  _rozieExposeRef.current = { sortColumn, clearSorting, toggleRowExpanded, expandAll, collapseAll, getExpandedRows, applyGrouping, clearGrouping, getFacetedUniqueValues, getFacetedMinMaxValues, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, getRowIndexRelativeToPage, editCell, commitEditing, editRow, getSelectedRange, cut };
  useImperativeHandle(ref, () => ({ sortColumn: (...args: Parameters<typeof sortColumn>): ReturnType<typeof sortColumn> => _rozieExposeRef.current.sortColumn(...args), clearSorting: (...args: Parameters<typeof clearSorting>): ReturnType<typeof clearSorting> => _rozieExposeRef.current.clearSorting(...args), toggleRowExpanded: (...args: Parameters<typeof toggleRowExpanded>): ReturnType<typeof toggleRowExpanded> => _rozieExposeRef.current.toggleRowExpanded(...args), expandAll: (...args: Parameters<typeof expandAll>): ReturnType<typeof expandAll> => _rozieExposeRef.current.expandAll(...args), collapseAll: (...args: Parameters<typeof collapseAll>): ReturnType<typeof collapseAll> => _rozieExposeRef.current.collapseAll(...args), getExpandedRows: (...args: Parameters<typeof getExpandedRows>): ReturnType<typeof getExpandedRows> => _rozieExposeRef.current.getExpandedRows(...args), applyGrouping: (...args: Parameters<typeof applyGrouping>): ReturnType<typeof applyGrouping> => _rozieExposeRef.current.applyGrouping(...args), clearGrouping: (...args: Parameters<typeof clearGrouping>): ReturnType<typeof clearGrouping> => _rozieExposeRef.current.clearGrouping(...args), getFacetedUniqueValues: (...args: Parameters<typeof getFacetedUniqueValues>): ReturnType<typeof getFacetedUniqueValues> => _rozieExposeRef.current.getFacetedUniqueValues(...args), getFacetedMinMaxValues: (...args: Parameters<typeof getFacetedMinMaxValues>): ReturnType<typeof getFacetedMinMaxValues> => _rozieExposeRef.current.getFacetedMinMaxValues(...args), getColumnDefs: (...args: Parameters<typeof getColumnDefs>): ReturnType<typeof getColumnDefs> => _rozieExposeRef.current.getColumnDefs(...args), toggleAllRows: (...args: Parameters<typeof toggleAllRows>): ReturnType<typeof toggleAllRows> => _rozieExposeRef.current.toggleAllRows(...args), clearSelection: (...args: Parameters<typeof clearSelection>): ReturnType<typeof clearSelection> => _rozieExposeRef.current.clearSelection(...args), getSelectedRows: (...args: Parameters<typeof getSelectedRows>): ReturnType<typeof getSelectedRows> => _rozieExposeRef.current.getSelectedRows(...args), setPage: (...args: Parameters<typeof setPage>): ReturnType<typeof setPage> => _rozieExposeRef.current.setPage(...args), setRowsPerPage: (...args: Parameters<typeof setRowsPerPage>): ReturnType<typeof setRowsPerPage> => _rozieExposeRef.current.setRowsPerPage(...args), toggleColumnVisibility: (...args: Parameters<typeof toggleColumnVisibility>): ReturnType<typeof toggleColumnVisibility> => _rozieExposeRef.current.toggleColumnVisibility(...args), applyColumnOrder: (...args: Parameters<typeof applyColumnOrder>): ReturnType<typeof applyColumnOrder> => _rozieExposeRef.current.applyColumnOrder(...args), resetColumnSizing: (...args: Parameters<typeof resetColumnSizing>): ReturnType<typeof resetColumnSizing> => _rozieExposeRef.current.resetColumnSizing(...args), pinColumn: (...args: Parameters<typeof pinColumn>): ReturnType<typeof pinColumn> => _rozieExposeRef.current.pinColumn(...args), focusCell: (...args: Parameters<typeof focusCell>): ReturnType<typeof focusCell> => _rozieExposeRef.current.focusCell(...args), getActiveCell: (...args: Parameters<typeof getActiveCell>): ReturnType<typeof getActiveCell> => _rozieExposeRef.current.getActiveCell(...args), clearActiveCell: (...args: Parameters<typeof clearActiveCell>): ReturnType<typeof clearActiveCell> => _rozieExposeRef.current.clearActiveCell(...args), getRowIndexRelativeToPage: (...args: Parameters<typeof getRowIndexRelativeToPage>): ReturnType<typeof getRowIndexRelativeToPage> => _rozieExposeRef.current.getRowIndexRelativeToPage(...args), editCell: (...args: Parameters<typeof editCell>): ReturnType<typeof editCell> => _rozieExposeRef.current.editCell(...args), commitEditing: (...args: Parameters<typeof commitEditing>): ReturnType<typeof commitEditing> => _rozieExposeRef.current.commitEditing(...args), editRow: (...args: Parameters<typeof editRow>): ReturnType<typeof editRow> => _rozieExposeRef.current.editRow(...args), getSelectedRange: (...args: Parameters<typeof getSelectedRange>): ReturnType<typeof getSelectedRange> => _rozieExposeRef.current.getSelectedRange(...args), cut: (...args: Parameters<typeof cut>): ReturnType<typeof cut> => _rozieExposeRef.current.cut(...args) }), []);

  return (
    <__ctx_data_table_columns.Provider value={{
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    setColReg(prev => ({
      ...prev,
      [key]: spec
    }));
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...colReg
    };
    delete r[String(id)];
    setColReg(r);
  }
}}>
    <>

    <div className={"rozie-data-table-wrap"} ref={__rozieRoot} data-rozie-s-d5dcab4c="">

    <div className={"rdt-column-defs"} style={{ display: "none" }} aria-hidden="true" data-rozie-s-d5dcab4c="">{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</div>

    {(!!invalidMsg) && <div className={"rdt-sr-live"} role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{invalidMsg}</div>}{(!!pasteAnnounce) && <div className={"rdt-sr-live rdt-sr-paste"} data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{pasteAnnounce}</div>}<div className={"rdt-toolbar"} data-rozie-s-d5dcab4c="">
      <input className={"rdt-global-filter"} type="text" role="searchbox" aria-label="Search table" value={globalFilterValue()} onInput={($event) => { onGlobalFilterInput($event); }} data-rozie-s-d5dcab4c="" />
      
      {(allLeafColumns().length) && <details className={"rdt-colvis"} data-rozie-s-d5dcab4c="">
        <summary className={"rdt-colvis-summary"} data-rozie-s-d5dcab4c="">Columns</summary>
        <div className={"rdt-colvis-menu"} role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c="">
          {allLeafColumns().map((lc) => <label key={lc.id} className={"rdt-colvis-item"} data-rozie-s-d5dcab4c="">
            <input type="checkbox" className={"rdt-colvis-checkbox"} checked={lc.visible} onChange={($event) => { onToggleVisibility(lc.id); }} data-rozie-s-d5dcab4c="" />
            <span className={"rdt-colvis-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(lc.label)}</span>
          </label>)}
        </div>
      </details>}</div>


    {(props.groupable) && <div className={"rdt-group-bar-host"} data-rozie-s-d5dcab4c="">
      {(props.renderGroupBar ?? props.slots?.['groupBar']) ? ((props.renderGroupBar ?? props.slots?.['groupBar']) as Function)({ grouping: groupingKeys(), groupableColumns: groupableColumns(), applyGrouping, clearGrouping }) : groupingKeys().map((gk) => <span key={gk} className={"rdt-group-token"} data-group-token="" data-rozie-s-d5dcab4c="">{rozieDisplay(gk)}</span>)}
    </div>}{(props.virtual) ? <div className={"rdt-scroll"} style={parseInlineStyle(props.maxHeight ? 'max-height:' + props.maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + props.maxHeight : 'overflow:auto')} data-rozie-s-d5dcab4c="">
    <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} aria-rowcount={rows.length} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg, hgLevel) => <tr key={hg.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel)} colSpan={(header.colSpan > 1 ? header.colSpan : undefined) ?? undefined} data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={cellTabindex('__header', headerColIndexOf(hg, header), hgLevel)} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectAll ?? props.slots?.['selectAll']) ? ((props.renderSelectAll ?? props.slots?.['selectAll']) as Function)({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) : (props.selectionMode === 'multiple') && <input className={"rdt-select-all"} type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" />}
            </span> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(header.column.getCanSort && header.column.getCanSort()) ? <button type="button" className={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
                <span className={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
              </span>}{(columnIsFilterable(header.column.id)) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" />}{(columnIsFilterable(header.column.id)) && <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderFilter ?? props.slots?.['filter'])?.({ columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter })}
              </span>}<span className={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
                <button type="button" className={"rdt-pin-btn rdt-pin-left"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} onClick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c="">⇤</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-none"} aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} onClick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c="">⇔</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-right"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} onClick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c="">⇥</button>
              </span>
              <button type="button" className={"rdt-resize-handle"} aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onPointerDown={($event) => { onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span className={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}</th>)}
        </tr>)}
      </thead>

      <tbody className={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        
        <tr className={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={visibleColCount()} style={parseInlineStyle('height:' + padTop() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
        
        {windowedRows().map((wr) => <Fragment key={wr.row.id}>
        <tr key={wr.row.id} className={clsx("rdt-tr", { "rdt-group-header": rowIsGrouped(wr.row), "rdt-row-pinned": wr.pinned })} role="row" data-row={rozieAttr(wr.vi.index)} aria-rowindex={wr.vi.index + 1} data-index={rozieAttr(wr.vi.index)} data-pinned={rozieAttr(wr.pinned ? 'true' : undefined)} data-depth={rozieAttr(wr.row.depth)} data-group-header={rozieAttr(rowIsGrouped(wr.row) ? wr.row.id : undefined)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(wr.row) ? wr.row.id : undefined)} aria-expanded={(rowIsGrouped(wr.row) ? !!rowIsExpanded(wr.row) : undefined) ?? undefined} aria-level={(groupingActive() ? wr.row.depth + 1 : undefined) ?? undefined} data-rozie-s-d5dcab4c="">
          {visibleCellsFor(wr.row).map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id), "rdt-in-range": inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(wr.vi.index)} data-col-index={rozieAttr(colIndexOf(wr.row, cellCtx))} tabIndex={cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx))} style={parseInlineStyle(bodyCellStyle(wr.row, cellCtx.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cellCtx)))} data-in-range={rozieAttr(inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) ? 'true' : undefined)} data-agg-cell={rozieAttr(cellIsAggregated(cellCtx) ? cellCtx.column.id : undefined)} data-rozie-s-d5dcab4c="">
            
            {(isExpanderColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(rowCanExpand(wr.row)) && <button type="button" className={"rdt-expander"} data-expander="" aria-expanded={!!rowIsExpanded(wr.row)} aria-label={rozieAttr(rowIsExpanded(wr.row) ? 'Collapse row' : 'Expand row')} onClick={($event) => { onToggleExpand(wr.row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(wr.row) ? '▾' : '▸')}</button>}</span> : (isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: wr.row.original, checked: rowIsSelected(wr.row), toggle: e => onToggleRow(wr.row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(wr.row)} onChange={($event) => { onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (cellIsGrouped(cellCtx)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" className={"rdt-expander rdt-group-toggle"} data-expander="" aria-expanded={!!rowIsExpanded(wr.row)} aria-label={rozieAttr(rowIsExpanded(wr.row) ? 'Collapse group' : 'Expand group')} onClick={($event) => { onToggleExpand(wr.row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(wr.row) ? '▾' : '▸')}</button>
              <span className={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
              </span>
              <span className={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay('(' + groupSubRowCount(wr.row) + ')')}</span>
            </span> : (isEditing(wr.vi.index, colIndexOf(wr.row, cellCtx))) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(hasEditorSlot(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderEditor ?? props.slots?.['editor'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() })}
              </span> : (editorTypeOf(cellCtx.column.id) === 'number') ? <input className={"rdt-cell-editor"} type="number" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : (editorTypeOf(cellCtx.column.id) === 'select') ? <select className={"rdt-cell-editor"} data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onChange={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                {editorOptionsOf(cellCtx.column.id).map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>)}
              </select> : (editorTypeOf(cellCtx.column.id) === 'checkbox') ? <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" checked={editorCheckedFor(cellCtx.column.id)} onChange={($event) => { onCellEditorCheckbox(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : <input className={"rdt-cell-editor"} type="text" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}</span> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
            </span>}{(isFillHandleCell(wr.vi.index, colIndexOf(wr.row, cellCtx))) && <span className={"rdt-fill-handle"} data-fill-handle="" data-testid="fill-handle" aria-hidden="true" onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" />}</td>)}
        </tr>
        
        {(rowShowsDetail(wr.row)) && <tr key={wr.row.id} className={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(wr.row.id)} data-rozie-s-d5dcab4c="">
          <td className={"rdt-detail-cell"} colSpan={visibleColCount()} data-rozie-s-d5dcab4c="">
            {(props.renderDetail ?? props.slots?.['detail'])?.({ row: wr.row.original })}
          </td>
        </tr>}</Fragment>)}
        
        <tr className={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={visibleColCount()} style={parseInlineStyle('height:' + padBottom() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
      </tbody>
    </table>
    </div> : <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} aria-rowcount={totalRowCount()} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg, hgLevel) => <tr key={hg.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel)} colSpan={(header.colSpan > 1 ? header.colSpan : undefined) ?? undefined} data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={cellTabindex('__header', headerColIndexOf(hg, header), hgLevel)} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectAll ?? props.slots?.['selectAll']) ? ((props.renderSelectAll ?? props.slots?.['selectAll']) as Function)({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) : (props.selectionMode === 'multiple') && <input className={"rdt-select-all"} type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" />}
            </span> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              
              {(header.column.getCanSort && header.column.getCanSort()) ? <button type="button" className={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
                <span className={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
              </span>}{(columnIsFilterable(header.column.id)) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" />}{(columnIsFilterable(header.column.id)) && <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderFilter ?? props.slots?.['filter'])?.({ columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter })}
              </span>}<span className={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
                <button type="button" className={"rdt-pin-btn rdt-pin-left"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} onClick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c="">⇤</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-none"} aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} onClick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c="">⇔</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-right"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} onClick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c="">⇥</button>
              </span>
              
              <button type="button" className={"rdt-resize-handle"} aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onPointerDown={($event) => { onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span className={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}</th>)}
        </tr>)}
      </thead>

      <tbody className={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        
        {rows.map((row) => <Fragment key={row.id}>
        <tr key={row.id} className={clsx("rdt-tr", { "rdt-group-header": rowIsGrouped(row) })} role="row" data-depth={rozieAttr(row.depth)} aria-rowindex={(isGrid() ? absRowIndexOf(row) + 1 : undefined) ?? undefined} data-group-header={rozieAttr(rowIsGrouped(row) ? row.id : undefined)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(row) ? row.id : undefined)} aria-expanded={(rowIsGrouped(row) ? !!rowIsExpanded(row) : undefined) ?? undefined} aria-level={(groupingActive() ? row.depth + 1 : undefined) ?? undefined} data-rozie-s-d5dcab4c="">
          {visibleCellsFor(row).map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id), "rdt-in-range": inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cellCtx))} tabIndex={cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx))} style={parseInlineStyle(bodyCellStyle(row, cellCtx.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cellCtx)))} data-in-range={rozieAttr(inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) ? 'true' : undefined)} data-agg-cell={rozieAttr(cellIsAggregated(cellCtx) ? cellCtx.column.id : undefined)} data-rozie-s-d5dcab4c="">
            
            {(isExpanderColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(rowCanExpand(row)) && <button type="button" className={"rdt-expander"} data-expander="" aria-expanded={!!rowIsExpanded(row)} aria-label={rozieAttr(rowIsExpanded(row) ? 'Collapse row' : 'Expand row')} onClick={($event) => { onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row) ? '▾' : '▸')}</button>}</span> : (isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (cellIsGrouped(cellCtx)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" className={"rdt-expander rdt-group-toggle"} data-expander="" aria-expanded={!!rowIsExpanded(row)} aria-label={rozieAttr(rowIsExpanded(row) ? 'Collapse group' : 'Expand group')} onClick={($event) => { onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row) ? '▾' : '▸')}</button>
              <span className={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
              </span>
              <span className={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay('(' + groupSubRowCount(row) + ')')}</span>
            </span> : (isEditing(rowIndexOf(row), colIndexOf(row, cellCtx))) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(hasEditorSlot(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderEditor ?? props.slots?.['editor'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() })}
              </span> : (editorTypeOf(cellCtx.column.id) === 'number') ? <input className={"rdt-cell-editor"} type="number" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : (editorTypeOf(cellCtx.column.id) === 'select') ? <select className={"rdt-cell-editor"} data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onChange={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                {editorOptionsOf(cellCtx.column.id).map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>)}
              </select> : (editorTypeOf(cellCtx.column.id) === 'checkbox') ? <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" checked={editorCheckedFor(cellCtx.column.id)} onChange={($event) => { onCellEditorCheckbox(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : <input className={"rdt-cell-editor"} type="text" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}</span> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
            </span>}{(isFillHandleCell(rowIndexOf(row), colIndexOf(row, cellCtx))) && <span className={"rdt-fill-handle"} data-fill-handle="" data-testid="fill-handle" aria-hidden="true" onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" />}</td>)}
        </tr>
        
        {(rowShowsDetail(row)) && <tr key={row.id} className={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(row.id)} data-rozie-s-d5dcab4c="">
          <td className={"rdt-detail-cell"} colSpan={visibleColCount()} data-rozie-s-d5dcab4c="">
            {(props.renderDetail ?? props.slots?.['detail'])?.({ row: row.original })}
          </td>
        </tr>}</Fragment>)}
      </tbody>
    </table>}{(!props.virtual) && <div className={"rdt-pagination"} role="group" aria-label="Pagination" data-rozie-s-d5dcab4c="">
      <button type="button" className={"rdt-page-btn rdt-page-prev"} disabled={!canPrevPage()} onClick={($event) => { onPrevPage(); }} data-rozie-s-d5dcab4c="">Prev</button>
      <span className={"rdt-page-status"} aria-live="polite" data-rozie-s-d5dcab4c="">
        {rozieDisplay('Page ' + (pageIndex() + 1) + ' of ' + pageCount())}
      </span>
      <button type="button" className={"rdt-page-btn rdt-page-next"} disabled={!canNextPage()} onClick={($event) => { onNextPage(); }} data-rozie-s-d5dcab4c="">Next</button>
      <select className={"rdt-page-size"} aria-label="Rows per page" value={pageSize()} onChange={($event) => { onPageSizeChange($event); }} data-rozie-s-d5dcab4c="">
        <option value={10} data-rozie-s-d5dcab4c="">10</option>
        <option value={25} data-rozie-s-d5dcab4c="">25</option>
        <option value={50} data-rozie-s-d5dcab4c="">50</option>
        <option value={100} data-rozie-s-d5dcab4c="">100</option>
      </select>
    </div>}</div>
    </>
    </__ctx_data_table_columns.Provider>
  );
});
export default DataTable;
