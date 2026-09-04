import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieContext, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './DataTable.css';
import Popover from '@rozie-ui/popover-react';
import { isSafeKey, wrapAggregationFn } from './helpers/columnDefUtils';
import { applyUpdater, clamp, focusables } from './helpers/indexMath';
import { escapeTsvField, parseTsv, tileGridToBox, tileIndex } from './helpers/tsvGrid';
import { replaceRowValue, indexOfRowIn, replaceRowValues } from './helpers/rowValueUtils';
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
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

interface GroupBarCtx { grouping: any; groupableColumns: any; applyGrouping: any; clearGrouping: any; }

interface SelectAllCtx { checked: any; indeterminate: any; toggle: any; }

interface ColHeaderCtx { columnId: any; column: any; label: any; }

interface FilterCtx { columnId: any; value: any; uniqueValues: any; minMax: any; setFilter: any; }

interface SelectCellCtx { row: any; checked: any; toggle: any; }

interface CellCtx { columnId: any; column: any; row: any; value: any; }

interface EditorCtx { columnId: any; column: any; row: any; value: any; commit: any; cancel: any; autofocus: any; }

interface DetailCtx { row: any; }

interface DataTableProps {
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable data={rows} onDataChange={setRows} columns={cols} />
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
   * Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset.
   */
  rowCount?: (number) | null;
  /**
   * Explicit total page count for `manual` pagination; overrides rowCount-derived count.
   */
  pageCount?: (number) | null;
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
   * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` (GA since Phase 63) — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
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
  onHistoryChange?: (...args: any[]) => void;
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
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  canUndo: (...args: any[]) => any;
  canRedo: (...args: any[]) => any;
  clearHistory: (...args: any[]) => any;
}

const DataTable = forwardRef<DataTableHandle, DataTableProps>(function DataTable(_props: DataTableProps, ref): JSX.Element {
  const __ctx_data_table_columns = rozieContext("data-table:columns");
  const __defaultColumns = useState(() => (() => [])())[0];
  const props: Omit<DataTableProps, 'columns' | 'selectionMode' | 'manual' | 'rowCount' | 'pageCount' | 'expandable' | 'getSubRows' | 'groupable' | 'stickyHeader' | 'interactionMode' | 'singleClickEdit' | 'undoable' | 'undoLimit' | 'virtual' | 'estimateRowHeight' | 'autoMeasure' | 'maxHeight'> & { columns: any[]; selectionMode: string; manual: boolean; rowCount: (number) | null; pageCount: (number) | null; expandable: boolean; getSubRows: ((...args: any[]) => any) | null; groupable: boolean; stickyHeader: boolean; interactionMode: string; singleClickEdit: boolean; undoable: boolean; undoLimit: number; virtual: boolean | string; estimateRowHeight: number; autoMeasure: boolean; maxHeight: string } = {
    ..._props,
    columns: _props.columns ?? __defaultColumns,
    selectionMode: _props.selectionMode ?? 'none',
    manual: _props.manual ?? false,
    rowCount: _props.rowCount ?? null,
    pageCount: _props.pageCount ?? null,
    expandable: _props.expandable ?? false,
    getSubRows: _props.getSubRows ?? null,
    groupable: _props.groupable ?? false,
    stickyHeader: _props.stickyHeader ?? false,
    interactionMode: _props.interactionMode ?? 'table',
    singleClickEdit: _props.singleClickEdit ?? false,
    undoable: _props.undoable ?? false,
    undoLimit: _props.undoLimit ?? 100,
    virtual: _props.virtual ?? false,
    estimateRowHeight: _props.estimateRowHeight ?? 40,
    autoMeasure: _props.autoMeasure ?? false,
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
  const rangeDragMove = useRef<any>(null);
  const rangeDragUp = useRef<any>(null);
  const rangeDragging = useRef(false);
  const lastData = useRef<any>(null);
  const lastDataLen = useRef(-1);
  const lastPropsData = useRef<unknown>(null);
  const undoStack = useRef<unknown[]>([]);
  const redoStack = useRef<unknown[]>([]);
  const focusIntentEpoch = useRef(0);
  const committedThisSession = useRef(false);
  const editTransition = useRef(false);
  const restoringHistory = useRef<boolean>(false);
  const rangeTransition = useRef(false);
  const rangeClickPending = useRef(false);
  const rangeDragMoved = useRef(false);
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
  const _getSubRowsRef = useRef(props.getSubRows);
  _getSubRowsRef.current = props.getSubRows;
  const _manualRef = useRef(props.manual);
  _manualRef.current = props.manual;
  const _pageCountRef = useRef(props.pageCount);
  _pageCountRef.current = props.pageCount;
  const _rowCountRef = useRef(props.rowCount);
  _rowCountRef.current = props.rowCount;
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
  const [editFocusColId, setEditFocusColId] = useState<any>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<any>(null);
  const [rowDraft, setRowDraft] = useState<Record<string, any>>({});
  const [rangeAnchor, setRangeAnchor] = useState<any>(null);
  const [rangeFocus, setRangeFocus] = useState<any>(null);
  const [pasteAnnounce, setPasteAnnounce] = useState('');
  const [liveAnnounce, setLiveAnnounce] = useState('');
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);

  // CR-01 remeasure scheduling state. remeasurePending dedupes the deferred sweep — at most ONE
  // rAF is in flight, so a burst of onChange ticks (a fast scroll) collapses to a single measure
  // pass per frame instead of piling up rAF callbacks that fire mid-gesture. The piled-up
  // callbacks were what broke the Solid scroll-then-focus seam (D-12 focusActiveCell →
  // scrollToIndex → double-rAF focus): a stray remeasure firing inside that focus deferral
  // disrupted the focus landing. The sweep ALSO bails while virtual-core is mid-scroll
  // (virtualizer.isScrolling), so a measure can't run during scrollToIndex; the next settled
  // onChange re-measures the now-stable window. Scroll-driven recycling (the CR-01 case, measured
  // once motion settles between scroll steps) is unaffected.
  // ── Vertical row windowing instance state (phase 53) ──────────────────────────────────
  // Mutable top-level instances (the `let table` precedent — React hoists to useRef; do NOT
  // const). NULL until $onMount, and ONLY constructed when $props.virtual. virtualizerCleanup
  // holds the _didMount() teardown for $onUnmount; gridScrollEl is the captured .rdt-scroll div
  // the virtualizer observes.
  // table-core instance — top-level `let` referenced from hooks → React hoists to
  // useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
  // getRowModel-reading closures capture the LIVE instance, NOT an empty initial
  // snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
  // freezes the table at the empty-initial state on React).
  // ── Grid interaction-mode constants + DOM root (phase 49, REQ-2/6) ────────────────────
  // Fixed PageUp/PageDown row step (D-06). Phase 53 swaps this for the visible-window size
  // via the same focusActiveCell() scroll-into-view seam — kept a top-level const so that
  // later change is a one-line edit.
  const GRID_PAGE_STEP = useMemo(() => 10, []);
  // The stable table-root element, captured in $onMount (the ONLY ROZ123-safe place to read
  // $el / query DOM across all six). focusActiveCell() resolves cells off this root; it is
  // shadow-safe because the query runs from INSIDE the component's own scope (the listbox
  // querySelector-off-root precedent, proven ×6 by plan 01's probe). NEVER read in a
  // computed/template binding (ROZ123).
  // Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
  // the funnel. A counter (not a boolean) so nested writes are safe.
  // Focus-intent epoch (#9) — a monotonic counter bumped at every focus-INTENT entry point
  // (focusActiveCell / focusCell+focusAbsCellWhenReady arm / a genuine active-cell-moving
  // focusin in syncActiveFromEvent). The two async focus-recovery polls (focusWhenReady for the
  // virtual off-window scroll, focusAbsCellWhenReady for the paginated page-switch) CAPTURE this
  // value at arm time (AFTER their own bump) and abort at the top of each iteration if it has since
  // changed — so a LATER user nav (ArrowKey / click) supersedes a stale poll instead of the poll
  // yanking focus back frames later. A naive guardMoved "abort if focus moved" check is WRONG here:
  // both polls arm while focus still sits on the OLD/being-left cell BY DESIGN (scroll-to /
  // page-switch), so an epoch — bumped only by a NEWER intent — is the correct abort signal.
  // ── Grid-wide undo/redo (260709-8ct) — history STATE lives in top-level `let` (mirroring
  // `programmatic` above), NOT $data: recording a snapshot on every keystroke must not trigger
  // a reactive re-render. React hoists each to useRef. undoStack/redoStack hold `data` array
  // REFERENCES (never deep copies — see undoHistory.rzts's header comment on the shared-row
  // invariant). restoringHistory suppresses re-recording while an undo()/redo() replay is
  // in flight.
  //
  // The external-swap history reset keys on data ORIGIN, not a timing window. Every internal
  // writeback stamps its fresh `data` array with a durable, non-enumerable marker under
  // DATA_WRITE_TOKEN_KEY (see writeData in writeFunnels.rzts); the reset (maybeClearHistoryOnExternal
  // Swap, below) clears history ONLY when a newly-supplied `$props.data` carries no marker — it did
  // not come from us, so it is a genuine external dataset swap. Presence of the marker ⟺ "descends
  // from one of our writes", and it survives EVERYTHING that defeated the four flag/timer variants:
  //   1. A raw-reference latch (`lastWrittenData === currentData()`) — Vue `reactive()` / Svelte 5
  //      `$state` / Solid store re-wrap a written array in a NEW Proxy on its way back through props,
  //      so `===` never holds. (A non-enumerable own PROPERTY, by contrast, is forwarded through
  //      every target's reactive Proxy via `Reflect.get` — readable through the wrap.)
  //   2. A single-consume boolean — the re-feed watch fires MULTIPLE times per write; the first pass
  //      consumed the flag, a later pass wrongly cleared.
  //   3. A content signature (`JSON.stringify`) — the watch can fire with a TRANSIENTLY STALE
  //      `currentData()` mid-settle (Solid/Lit), a real-but-older value → false mismatch.
  //   4. A deferred settle-window flag (rAF, then a 96ms macrotask) — a slow re-feed on a LARGE
  //      controlled table OUTRAN the window (#8); no fixed timeout can be correct (re-feed latency
  //      scales with dataset size).
  // A STRING key (not a JS Symbol) is deliberate: it is stable BY VALUE on all six targets with ZERO
  // caching, whereas a `Symbol()` needs a per-instance memo to hold one identity — and Lit lowers
  // `$computed(() => Symbol())` to a plain getter that RE-MINTS the Symbol on every read, so writeData
  // and the reset would stamp/read DIFFERENT symbols and the marker would never match. Non-enumerable
  // → invisible to JSON.stringify / spread / Object.keys (the consumer's data stays clean); namespaced
  // so a consumer array never collides.
  const DATA_WRITE_TOKEN_KEY = useMemo(() => '__rozieDataWriteToken', []);
  // Grouping auto-expand latch (phase 50 req-4): when grouping is ACTIVE and the consumer
  // has not bound `expanded` and has not yet toggled any group, group-header rows default to
  // EXPANDED (so the grouped subtree is visible — the standard grouped-grid affordance + the
  // roundout-VR leaf-visible baseline). The FIRST group/row toggle sets this true (in
  // writeExpanded), after which the user's expanded state wins. Stays false (untouched) on the
  // non-grouping path → byte-identical-off (the `expanded` slice resolves to $data.expandedDefault
  // exactly as before, both for the plain table AND the expandable-rows feature).
  // groupingActiveDefault(): is grouping currently engaged (a non-empty ordered key list)? Reads
  // the same source order as currentState().grouping ($props.grouping ?? $data.groupingDefault) so
  // the expanded auto-default below tracks the live grouping state on every target.
  function groupingActiveDefault() {
    return ((grouping != null ? grouping : groupingDefault) || []).length > 0;
  }

  // effectiveColumnPinning(): the auto-injected select/expander chrome columns are a STRUCTURAL
  // left-pinned rail — they ALWAYS lead the pinned-left group so the checkbox/chevron stay the
  // leftmost body cells in EVERY case (fresh, pinned, AND grouped). Two forces would otherwise
  // push a data column ahead of the checkbox:
  //   1. Pinning — a consumer pinning `name` left makes it left-pinned; getVisibleCells() returns
  //      [left-pinned, center, right-pinned], so an unpinned (center) checkbox renders AFTER it.
  //   2. Grouping — table-core's groupedColumnMode defaults to 'reorder', which moves a grouped
  //      column to the FRONT of the order, ahead of an unpinned center checkbox.
  // Pinning the rail left beats BOTH: the left group always precedes the (grouped-reordered)
  // center group. We prepend SELECT_COL_ID then EXPANDER_COL_ID (matching the tableColumns
  // injection order [select, expander, ...userCols]) ahead of any consumer left-pins.
  // REQUIRES: the chrome column defs carry an explicit `size` (columnBuilders.rzts) — pinStyle's
  // sticky offset is col.getStart('left') = Σ preceding pinned SIZES, so a size-less chrome column
  // (table-core's 150px default) would inflate every real pinned column's `left` and overlap.
  // The consumer's columnPinning model never sees these ids: writeColumnPinning() strips them
  // on the way back out (writeFunnels.rzts). Note: this ALWAYS-pin makes the default (no-pin)
  // checkbox a sticky-left rail — an intentional baseline change (VR/snapshot baselines drift).
  function effectiveColumnPinning(): any {
    const base = columnPinning != null ? columnPinning : columnPinningDefault;
    const rail: string[] = [];
    if (selectionEnabled()) rail.push(SELECT_COL_ID);
    if (props.expandable === true) rail.push(EXPANDER_COL_ID);
    if (rail.length === 0) return base;
    const left = base && base.left ? base.left : [];
    const deduped = left.filter((id: string) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID);
    return {
      ...base,
      left: rail.concat(deduped)
    };
  }

  // Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
  // All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
  // this whole object as `state`. Return type annotated `any`: the inferred object-literal
  // type does not structurally match table-core's `Partial<TableState>` under the strict
  // bundled-leaf tsc (the columnSizingInfo/pagination shapes widen to Record) — the
  // runtime shape is correct; `any` sidesteps the over-strict structural check (the
  // deferred-items strict-tsc #2 / leaf-output-strict-typecheck close).
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
    columnPinning: effectiveColumnPinning(),
    // columnSizingInfo: table-core's transient resize-gesture state. We pass an
    // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
    // `column.getIsResizing()` / `getResizeHandler()` read
    // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
    // absent. Seed the default shape (matches table-core's
    // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
    // every render. Not a two-way model slice (transient gesture state, not consumer
    // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
    columnSizingInfo: columnSizingInfo
  }), [columnFilters, columnFiltersDefault, columnOrder, columnOrderDefault, columnSizing, columnSizingDefault, columnSizingInfo, columnVisibility, columnVisibilityDefault, effectiveColumnPinning, expanded, expandedDefault, globalFilter, globalFilterDefault, grouping, groupingActiveDefault, groupingDefault, pagination, paginationDefault, rowSelection, rowSelectionDefault, sorting, sortingDefault]);
  // The live row data (Phase 51 req-4): the bound `data` prop when controlled, else the
  // uncontrolled $data.dataDefault fallback (mirrors currentState's per-slice ?? pattern).
  // A committed edit funnels a FRESH array through writeData, which writes BOTH sinks; the
  // re-feed sources here so editing works whether or not the consumer binds r-model:data.
  const currentData = useCallback((): any => data != null ? data : dataDefault, [data, dataDefault]);
  // Build the table-core ColumnDef for ONE config-array entry. A LEAF entry
  // ({ id?, field, header?, … }) maps to an accessor ColumnDef; a GROUP entry
  // ({ id?, header, columns: [...] }) maps to a multi-level header GROUP column
  // whose children are built recursively (B12 — grouped/multi-level column headers).
  // Returns null for an unusable entry (no id/field, unsafe key, empty group).
  function buildConfigDef(c: any) {
    if (!c) return null;
    // Grouped (multi-level) header column: an entry carrying a `columns` array. table-core's
    // getHeaderGroups() yields ONE extra header-row level per group depth — the parent group
    // header spans its leaf children (B12). The group id falls back to its header text so it
    // stays addressable (no accessor; group columns carry no data).
    if (Array.isArray(c.columns)) {
      const kids = [];
      for (const child of c.columns as any) {
        const cd = buildConfigDef(child);
        if (cd) kids.push(cd);
      }
      if (!kids.length) return null;
      // Group id: an explicit c.id wins. Otherwise synthesize a STABLE UNIQUE id from the child
      // column ids (which are unique per leaf accessor / recursively-synthesized per nested group)
      // — NOT the header text. Falling back to c.header collided two same-titled groups (e.g. both
      // "Details") into one by-id map key, so the columnDefs LWW merge silently dropped one whole
      // group column + its children. The child-id derivation is deterministic (stable across
      // renders — no Math.random/Date). A group with neither id nor header (nor derivable children)
      // stays dropped as before.
      let gid = c.id;
      if (gid == null) gid = c.header != null ? '__grp_' + kids.map((k: any) => k.id).join('_') : null;
      if (gid == null) return null;
      const id = String(gid);
      if (!isSafeKey(id)) return null;
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
  const SELECT_COL_ID = useMemo(() => '__rdt_select', []);
  // The constant id of the auto-injected leading chevron expander column (phase 50, D-04).
  // Distinct from any consumer column id (the registry/config guard never produces a leading
  // "__"). Injected AFTER the select column (so order is [select, expander, ...userCols]).
  const EXPANDER_COL_ID = useMemo(() => '__rdt_expander', []);
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
        width: '',
        // Explicit narrow size so table-core's getSize()/getStart('left') match the RENDERED
        // width. Without it table-core assumes its 150px default, which is fine for an UNPINNED
        // chrome column (a CSS `width:1%` trick shrinks it visually) but breaks the moment the
        // column joins the left-pinned rail: pinStyle's sticky offset is Σ preceding pinned
        // SIZES, so a phantom 150px would push every real pinned column ~150px too far right and
        // overlap. Keep this in sync with the `--rdt-expander-col-width` CSS default (40px).
        size: 40
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
        width: '',
        // Explicit narrow size so table-core's sticky-offset math (getStart('left')) matches the
        // rendered checkbox width once this column joins the left-pinned rail — see the expander
        // note above. Keep in sync with the `--rdt-select-col-width` CSS default (44px).
        size: 44
      };
      return [selectCol].concat(withExpander);
    }
    return withExpander;
  }, [columnDefs, props.expandable, selectionEnabled]);
  // ── sorting slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────────
  // table-core hands an Updater<SortingState> = value | (old)=>new; the onSortingChange
  // callback applies it against the CURRENT sorting, then this funnel writes a FRESH
  // array to the uncontrolled default + the two-way model + fires the change event
  // REGARDLESS of binding. STATIC key (`$data.sortingDefault` / `$model.sorting`) — a
  // dynamic-key funnel is ROZ106 on all six. The remaining 8 slices each get their own
  // such funnel in Plans 04/05.
  function writeSorting(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setSortingDefault(next); // fresh array only (never in-place)
    setSorting(next); // two-way emit if bound (no-op-diff if not)
    props.onSortChange && props.onSortChange(next);
    programmatic.current--;
  }

  // ── expanded slice: STATIC-KEY fresh-value echo-guarded write funnel (A4) ──────────
  // table-core hands an Updater<ExpandedState> = value | (old)=>new; onExpandedChange
  // applies it against the CURRENT expanded, then this funnel writes a FRESH value to the
  // uncontrolled default + the two-way model + fires `expanded-change` REGARDLESS of binding.
  // `next` may be the `true` expand-all literal OR a { [rowId]: true } object — written
  // verbatim (Pitfall 2). One emit per change (the shared `programmatic` guard dedups the
  // React multi-render re-entry, D-07). STATIC key ($data.expandedDefault / $model.expanded).
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

  // ── grouping slice: STATIC-KEY fresh-array echo-guarded write funnel (phase 50 reqs 4-7) ──
  // table-core hands an Updater<GroupingState> = value | (old)=>new; onGroupingChange applies it
  // against the CURRENT grouping, then this funnel writes a FRESH ordered array to the
  // uncontrolled default + the two-way model + fires `group-change` REGARDLESS of binding. One
  // emit per change (the shared `programmatic` guard dedups the React multi-render re-entry, D-07).
  // STATIC key ($data.groupingDefault / $model.grouping). Event stem is `group-change`, NOT
  // `grouping-change`: the model:true `grouping` prop auto-generates an `onGroupingChange` callback
  // on the React/Solid flat Props interface, and a `grouping-change` event would camelCase to the
  // SAME identifier → duplicate-identifier TS2300 (the model-prop==emit-name collision class 50-02
  // hit with expanded/expanded-change → expand-change). Every sibling slice stems off a DISTINCT
  // name (sorting→sort-change, rowSelection→selection-change); grouping→group-change follows suit.
  function writeGrouping(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setGroupingDefault(next); // fresh ordered array only (never in-place push)
    setGrouping(next); // two-way emit if bound (no-op-diff if not)
    props.onGroupChange && props.onGroupChange(next);
    programmatic.current--;
  }

  // ── globalFilter slice: STATIC-KEY fresh-value echo-guarded write funnel (A4) ──────
  // A fresh string (primitive) to the uncontrolled default + the two-way model + fires
  // `filter-change` REGARDLESS of binding.
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

  // ── columnFilters slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ─────
  // table-core hands ColumnFiltersState = [{ id, value }]; write a FRESH array (never
  // in-place push) + fire `filter-change`. globalFilter + columnFilters both surface
  // through `filter-change` (per the plan: filter-change fires regardless of binding).
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

  // ── pagination slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ───────
  // table-core hands { pageIndex, pageSize }; write a FRESH object + fire `page-change`.
  const { onPageChange: _rozieProp_onPageChange } = props;
    const writePagination = useCallback((next: any) => {
    if (programmatic.current) return;
    programmatic.current++;
    setPaginationDefault(next);
    setPagination(next);
    _rozieProp_onPageChange && _rozieProp_onPageChange(next);
    programmatic.current--;
  }, [_rozieProp_onPageChange, setPagination]);
  // ── rowSelection slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
  // table-core hands RowSelectionState = { [rowId]: true }; write a FRESH object (never
  // in-place key-set) + fire `selection-change` REGARDLESS of binding.
  function writeRowSelection(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setRowSelectionDefault(next);
    setRowSelection(next);
    props.onSelectionChange && props.onSelectionChange(next);
    programmatic.current--;
  }

  // ── columnVisibility slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──
  // table-core hands VisibilityState = { [colId]: boolean }; write a FRESH object (never
  // in-place key-set) + fire `visibility-change` REGARDLESS of binding.
  function writeColumnVisibility(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnVisibilityDefault(next);
    setColumnVisibility(next);
    props.onVisibilityChange && props.onVisibilityChange(next);
    programmatic.current--;
  }

  // ── columnSizing slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────
  // table-core hands ColumnSizingState = { [colId]: number }; the pointer-drag resize
  // handle funnels a FRESH sizing object + fires `resize-change` REGARDLESS of binding.
  function writeColumnSizing(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnSizingDefault(next);
    setColumnSizing(next);
    props.onResizeChange && props.onResizeChange(next);
    programmatic.current--;
  }

  // ── columnOrder slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ────────
  // table-core hands ColumnOrderState = string[]; write a FRESH order array (never an
  // in-place splice) + fire `reorder-change` REGARDLESS of binding.
  function writeColumnOrder(next: any) {
    if (programmatic.current) return;
    programmatic.current++;
    setColumnOrderDefault(next);
    setColumnOrder(next);
    props.onReorderChange && props.onReorderChange(next);
    programmatic.current--;
  }

  // ── columnPinning slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
  // table-core hands ColumnPinningState = { left: string[], right: string[] }; write a
  // FRESH object (never in-place push into left/right) + fire `pin-change` REGARDLESS of
  // binding.
  function writeColumnPinning(next: any) {
    if (programmatic.current) return;
    // effectiveColumnPinning() forces the auto-injected chrome ids (select/expander) into the
    // table-core `left` rail, so table-core hands them back here on every pin change. Strip them
    // before persisting: the CONSUMER's columnPinning model + the pin-change event must reflect
    // only their own columns, never our internal rail ids (which re-inject each render anyway).
    const strip = (ids: any) => (ids || []).filter((id: any) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID);
    const clean = {
      ...next,
      left: strip(next && next.left),
      right: strip(next && next.right)
    };
    programmatic.current++;
    setColumnPinningDefault(clean);
    setColumnPinning(clean);
    props.onPinChange && props.onPinChange(clean);
    programmatic.current--;
  }

  // ── data slice: STATIC-KEY fresh-array echo-guarded write funnel (Phase 51 req-4) ──
  // A committed cell/row edit (or paste/fill in a later wave) replaces ONE row object in
  // a FRESH array and funnels it here. Writes the uncontrolled default + the two-way
  // model so editing works controlled OR uncontrolled. CRITICAL: writeData does NOT emit —
  // unlike the 9 state slices (each has one change event fired inside its funnel), the
  // `data` slice's commit event (`cell-edit-commit`) carries a PER-CELL payload and fires
  // from the SINGLE commitEdit call site so the count stays exactly one per commit (React
  // multi-emit dedup, D-07). Echo-guarded by the shared `programmatic` counter so the
  // re-feed watch never re-enters mid-write.
  //
  // 260709-8ct (grid-wide undo/redo): record the PRE-mutation snapshot BEFORE writing, but
  // ONLY when `$props.undoable` is on AND we are not mid-replay (`!restoringHistory` — an
  // undo()/redo() call routes back through THIS SAME writeData to reuse the two-way model +
  // re-feed watch; without the guard the replay would re-record itself and corrupt the
  // stack). `emitHistoryChangeIfEdged` fires `history-change` only when canUndo/canRedo
  // availability actually flipped (a long streak of edits that doesn't change availability
  // must not spam consumers).
  //
  // External-swap origin marker: stamp EVERY array we write (undoable or not, incl. an undo/
  // redo replay) with the durable, non-enumerable marker under DATA_WRITE_TOKEN_KEY. The reset
  // (maybeClearHistoryOnExternalSwap in DataTable.rozie) clears history only when a new $props.data
  // lacks the marker → it did not come from us → a genuine external swap. This replaces the
  // `dataWriteSettling` settle-window flag that a slow re-feed on a large controlled table outran
  // (#8) — see DATA_WRITE_TOKEN_KEY's declaration in DataTable.rozie for the four flag/timer
  // variants it supersedes and why the marker is timing-independent. Stamped on the fresh `next`
  // array (never the consumer's original), non-enumerable so JSON.stringify / spread / Object.keys
  // never see it. We write a FRESH RAW shallow copy (`fresh`) so the marker lands on an UNWRAPPED
  // array: an undo/redo replay reuses a snapshot that, in controlled mode, is a framework reactive
  // PROXY (svelte `$state`, vue `reactive`) — and `Object.defineProperty` does NOT reliably stick
  // through a proxy's trap, so stamping the raw copy (never the possibly-proxied `next`) keeps the
  // marker readable. Normal edits already pass a fresh array; the copy shares row references (cheap).
  // `try` guards the (never-expected) frozen/sealed-array case.
  function writeData(next: any) {
    if (programmatic.current) return;
    if (props.undoable && !restoringHistory.current) {
      const prevU = canUndo();
      const prevR = canRedo();
      recordSnapshot(currentData());
      emitHistoryChangeIfEdged(prevU, prevR);
    }
    const fresh = Array.isArray(next) ? next.slice() : next;
    try {
      Object.defineProperty(fresh, DATA_WRITE_TOKEN_KEY, {
        value: true,
        enumerable: false,
        configurable: true,
        writable: true
      });
    } catch (_e: any) {/* a frozen/sealed array can't be stamped — our fresh arrays never are */}
    programmatic.current++;
    setDataDefault(fresh); // fresh raw array only (never in-place, never a proxy)
    setData(fresh); // two-way emit if bound (no-op-diff if not)
    programmatic.current--;
  }

  // Read the live columnFilters value for a given column id (string-safe; drives the
  // per-column filter input's bound value). Reads currentState() (NOT a $data re-read
  // of a just-written key → React stale-read safe).
  function columnFilterValue(colId: any) {
    const cf = currentState().columnFilters || [];
    for (const f of cf as any) if (f && f.id === colId) return f.value != null ? f.value : '';
    return '';
  }

  // Apply a per-column filter value: build a FRESH ColumnFiltersState array (drop the
  // column's prior entry, append the new one unless empty) and funnel it. Never mutate
  // the existing array in place (silent on React/Solid/Angular/Lit).
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
  // ── grid-wide undo/redo (260709-8ct) — snapshot-stack history engine ──────────────────────
  // Per the approved design (docs/superpowers/specs/2026-07-09-data-table-undo-history-design.md,
  // decisions 1-6, LOCKED). A pure, unit-testable buffer over the FOUR history lets declared
  // top-level in DataTable.rozie beside `let programmatic = 0` (undoStack/redoStack/
  // restoringHistory/lastPropsData — NOT $data, so recording an edit causes no reactive
  // re-render churn on every keystroke). This module holds the FUNCTIONS only; it references
  // those component-scope lets + `$props`, `$emit`, `writeData`, `currentData` BARE (by name,
  // zero ES imports) — the SAME inlined-partial pattern writeFunnels.rzts uses for
  // `programmatic`/`$data`/`$model` (DataTable.rozie is the ONLY place that ES-imports across
  // .rzts partials; a cross-import between writeFunnels and undoHistory would create an ES
  // cycle and/or a TDZ on the inlined lets).
  //
  // Collision-safe (ROZ121/124/137): none of undo/redo/canUndo/canRedo/clearHistory are
  // HTMLElement methods, model props, or React auto-generated setters.

  // Push the PRE-mutation snapshot (a `data` array reference — never a deep copy; unchanged
  // rows are shared across every retained snapshot because every write funnel already builds a
  // fresh array reusing unchanged row references, per the design's Memory analysis). Evict the
  // oldest snapshot once the stack exceeds `undoLimit` (default 100 — DataTable.rozie prop).
  // Any NEW recording invalidates the redo stack (standard undo semantics).
  function recordSnapshot(current: any) {
    undoStack.current.push(current);
    const limit = props.undoLimit != null ? props.undoLimit : 100;
    while (undoStack.current.length > limit) undoStack.current.shift();
    redoStack.current = [];
  }
  function canUndo() {
    return undoStack.current.length > 0;
  }
  function canRedo() {
    return redoStack.current.length > 0;
  }

  // Both stacks empty — the external-swap latch (DataTable.rozie reFeed) and the
  // clearHistory() $expose verb share this single implementation.
  function clearHistory() {
    undoStack.current = [];
    redoStack.current = [];
  }

  // `$emit('history-change', { canUndo, canRedo })` — the imperative/keyboard $expose verb
  // contract. Unconditional (used by undo()/redo() themselves, which always fire exactly once
  // per call per the design — NOT edge-gated there; only the writeData-triggered recording path
  // below is edge-gated, since a routine sequence of edits would otherwise spam the event).
  function emitHistoryChange() {
    props.onHistoryChange && props.onHistoryChange({
      canUndo: canUndo(),
      canRedo: canRedo()
    });
  }

  // Fire `history-change` ONLY when canUndo/canRedo availability flipped since `prevU`/`prevR`
  // were captured (BEFORE recordSnapshot ran). Called from writeData's recording hook so a
  // long streak of edits that doesn't change availability (canUndo already true, redo already
  // empty) does not spam consumers with a no-op event per keystroke.
  function emitHistoryChangeIfEdged(prevU: any, prevR: any) {
    const nextU = canUndo();
    const nextR = canRedo();
    if (nextU !== prevU || nextR !== prevR) emitHistoryChange();
  }

  // undo(): pop the most recent pre-mutation snapshot, push the CURRENT data onto the redo
  // stack (so redo can restore it), then replay the popped snapshot through the SAME writeData
  // seam — under `restoringHistory = true` so writeData's own recording hook does not
  // re-capture this replay (which would corrupt the stack). Replaying through writeData
  // (rather than writing $data/$model directly) is deliberate: the two-way $model.data
  // writeback, the re-feed $watch, and the echo guard all keep working with zero new code.
  function undo() {
    if (!canUndo()) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(currentData());
    restoringHistory.current = true;
    writeData(prev);
    restoringHistory.current = false;
    emitHistoryChange();
  }

  // redo(): symmetric — pop the redo stack, push the CURRENT data back onto the undo stack,
  // replay through the same guarded writeData seam.
  function redo() {
    if (!canRedo()) return;
    const next = redoStack.current.pop();
    undoStack.current.push(currentData());
    restoringHistory.current = true;
    writeData(next);
    restoringHistory.current = false;
    emitHistoryChange();
  }

  // Re-read the row model + header groups into $data (fresh arrays → the template
  // re-renders). A plain fn (NOT a $computed — getRowModel() must be pulled AFTER a
  // setOptions re-feed, imperatively). Defined inside $onMount so it captures the live
  // `table`.
  // PER-SLICE callbacks hoisted to top-level consts (NOT inlined in createTable) so the
  // re-feed $watch can re-pass them on every setOptions. On React the createTable
  // callbacks would otherwise capture the MOUNT-render's currentState() closure (table
  // instance is built once in $onMount); table-core's setOptions keeps the prior
  // callbacks unless new ones are supplied, so a stale callback applied each updater
  // against the mount-time empty slice → the sort cycle never advances + multi-row
  // selection collapses to the last row (React stale-closure, F6). Re-passing these
  // fresh (recreated each render on React, reading fresh currentState) in the re-feed
  // keeps the Updater base value current. No-op cost on the other five.
  const onSortingChangeCb = useCallback((updater: any) => {
    writeSorting(applyUpdater(updater, currentState().sorting));
  }, [currentState, writeSorting]);
  const onExpandedChangeCb = useCallback((updater: any) => {
    writeExpanded(applyUpdater(updater, currentState().expanded));
  }, [currentState, writeExpanded]);
  const onGroupingChangeCb = useCallback((updater: any) => {
    writeGrouping(applyUpdater(updater, currentState().grouping));
  }, [currentState, writeGrouping]);
  const onGlobalFilterChangeCb = useCallback((updater: any) => {
    writeGlobalFilter(applyUpdater(updater, currentState().globalFilter));
  }, [currentState, writeGlobalFilter]);
  const onColumnFiltersChangeCb = useCallback((updater: any) => {
    writeColumnFilters(applyUpdater(updater, currentState().columnFilters));
  }, [currentState, writeColumnFilters]);
  const onPaginationChangeCb = useCallback((updater: any) => {
    writePagination(applyUpdater(updater, currentState().pagination));
  }, [currentState, writePagination]);
  const onRowSelectionChangeCb = useCallback((updater: any) => {
    writeRowSelection(applyUpdater(updater, currentState().rowSelection));
  }, [currentState, writeRowSelection]);
  const onColumnVisibilityChangeCb = useCallback((updater: any) => {
    writeColumnVisibility(applyUpdater(updater, currentState().columnVisibility));
  }, [currentState, writeColumnVisibility]);
  const onColumnSizingChangeCb = useCallback((updater: any) => {
    writeColumnSizing(applyUpdater(updater, currentState().columnSizing));
  }, [currentState, writeColumnSizing]);
  const onColumnOrderChangeCb = useCallback((updater: any) => {
    writeColumnOrder(applyUpdater(updater, currentState().columnOrder));
  }, [currentState, writeColumnOrder]);
  const onColumnPinningChangeCb = useCallback((updater: any) => {
    writeColumnPinning(applyUpdater(updater, currentState().columnPinning));
  }, [currentState, writeColumnPinning]);
  const onColumnSizingInfoChangeCb = useCallback((updater: any) => {
    const next = applyUpdater(updater, columnSizingInfo);
    setColumnSizingInfo(prev => next != null ? next : prev);
  }, [columnSizingInfo]);
  // ══ Vertical row windowing (phase 53, req-1/2/3/6/9/10) — the virtual-core bridge ════════
  // virtual-core is a pure state machine EXACTLY like table-core: constructed once in $onMount
  // (ONLY when $props.virtual), its imperative onChange push converted to per-target reactivity
  // via the SEPARATE $data.windowVer tick, re-fed via setOptions()+_willUpdate() in the
  // refreshRowModel path (NEVER a render helper — Pitfall 1). Every runtime reference is guarded
  // so the virtual=false emitted path is dead (req-1).
  //
  // Phase 64 (D-04): the PURE windowing math (windowedRows / padTop / padBottom / pmIndexInWindow /
  // rowIsOutsideWindow / virtualizerOptions / virtualItemKey) now lives in the shared, target-agnostic
  // `@rozie-ui/headless-core/windowing.rzts` partial and is re-exported below — this file is now the
  // thin DATA-TABLE HOST SHELL holding only the impure, per-consumer pieces (the table-bound row
  // source + the DOM/refs/virtualizer-instance machinery + the D-05 edit-pinning hook). The math
  // dissolves in via inlineScriptPartials() byte-identically; behavior is unchanged (the B13 specs +
  // dist-parity are the net). The host satisfies the windowing.rzts contract by convention:
  // windowSource() (the row source), pinnedEditIndex()/pinnedMeasurement() (the D-05 pin hook),
  // scheduleRemeasure(), and the gridScrollEl/virtualizer/virtual-core-fn references.

  // ══ D-05 predicate layer (Phase 87 87-02) — resolves the windowing prop into an axis state,
  // replacing every bare truthiness read of $props.virtual (which is unsafe once the prop widens
  // to a string grammar in 87-03: 'columns' is truthy but does NOT mean "windows rows"). Modeled on
  // resolveAppendTo() in CommandPalette.rozie (the D-01 value-grammar precedent): branch on
  // typeof === 'string', switch on the known string values, fall back to the boolean cases. THIS
  // plan still declares `virtual: Boolean` (87-03 widens the declaration to [Boolean, String]), so
  // resolveVirtual() can currently only return 'off' or 'rows' and colsWindowed() is constantly
  // false — inert until 87-03/87-04 land the column axis.
  //
  // Declared BEFORE windowSource() (below): windowSource() calls rowsWindowed(), and the React
  // emitter lowers each of these to a useCallback whose dependency array is evaluated eagerly at
  // the declaration site — a forward reference here is a genuine TDZ (TS2448), not just a style
  // preference (found running the strict react typecheck gate this task, Rule 1).
  function resolveVirtual() {
    const v = props.virtual;
    if (typeof v === 'string') {
      if (v === 'rows') return 'rows';
      if (v === 'columns') return 'columns';
      if (v === 'both') return 'both';
      return 'off';
    }
    return v === true ? 'rows' : 'off';
  }
  // rowsWindowed(): the windowing.rzts host-contract symbol (D-05). Byte-behaviorally identical to
  // today's `$props.virtual` truthiness — this plan changes NO user-visible behavior.
  const rowsWindowed = useCallback(() => {
    const s = resolveVirtual();
    return s === 'rows' || s === 'both';
  }, [resolveVirtual]);
  const colsWindowed = useCallback(() => {
    const s = resolveVirtual();
    return s === 'columns' || s === 'both';
  }, [resolveVirtual]);
  const isWindowed = useCallback(() => rowsWindowed() || colsWindowed(), [colsWindowed, rowsWindowed]);
  // D-10 column-axis host-contract stubs (Phase 87 87-02) — INERT until 87-04 constructs the
  // second, horizontal Virtualizer instance (see windowing.rzts's AXIS MECHANISM note). Explicit
  // return-type annotations (columnSize / forcedColumns) copy the pinMeasurement() trick
  // (windowing.rzts:65-74) so the strict bundled-leaf tsc does not flow-narrow a no-op host's
  // return to `never`.
  function columnCount(): number {
    return 0;
  }
  function columnSize(i: number): number {
    return 0;
  }
  function forcedColumns(): number[] {
    return [];
  }

  // windowSource(): the rows fed to the virtualizer AND held in $data.rows — the windowing.rzts
  // host-contract source. When virtual, the FULL filtered+sorted PRE-PAGINATION model
  // (A2-verified table.getPrePaginationRowModel()) so windowing REPLACES client pagination (req-9);
  // else the normal (paginated) row model — the non-virtual path is byte-unchanged.
  const windowSource = useCallback(() => {
    if (!table.current) return [];
    if (rowsWindowed()) return table.current.getPrePaginationRowModel().rows;
    return table.current.getRowModel().rows;
  }, [rowsWindowed]);
  // Defer remeasureWindow() until AFTER the framework commits the recycled window (onChange fires
  // BEFORE React/Solid commit), falling back to a microtask/timeout where rAF is unavailable (SSR /
  // test envs). DEDUPED via remeasurePending so a scroll burst queues at most one in-flight sweep
  // (piled-up rAF sweeps broke the Solid scroll-then-focus seam — and the focus seam itself now
  // polls for its target cell, so it no longer depends on remeasure timing).
  //
  // TWO deferred passes (microtask THEN rAF), both behind the single in-flight flag:
  //   - Solid's <For> / Svelte's {#each} commit the recycled <tr> set SYNCHRONOUSLY in the reactive
  //     tick that the windowVer bump triggers, so the recycled nodes already exist by the next
  //     microtask — measuring there observes them while they are still connected, BEFORE the next
  //     fast-scroll step recycles them away. A single rAF (a full frame later) was too late on the
  //     fine-grained targets under a 40ms-per-step scroll: many rows mounted-and-recycled within one
  //     frame, so the once-per-frame rAF sweep observed only a fraction of them and the measured
  //     total under-converged (the Solid ~23.5k-vs-≥24k residual). The microtask catches them.
  //   - React's setState→reconcile→commit is async (a microtask is too early — the new window is not
  //     committed yet), so the rAF pass is what observes React's recycled rows.
  // Each pass only OBSERVES + measures the live window; measureElement is idempotent on an
  // already-observed node, so running both is cheap and loop-free.
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

  // pinnedEditIndex(): the FULL-MODEL row index of the row currently in edit (D-02 pin-row),
  // or -1 when no editor is open. Under virtualization `$data.rows` is the FULL pre-pagination
  // model, so editingRow (single-cell) / editingRowIndex (full-row) — both in that index space —
  // ARE the full-model index. The pinned row must never recycle while editing (req-9): it is
  // unioned into the windowed slice when it scrolls off-window and its height is subtracted from
  // the appropriate spacer so the total stays exactly getTotalSize() (the 51-01-proven mechanism).
  // This is the data-table half of the D-05 windowing.rzts pin-extension hook (listbox provides none).
  function pinnedEditIndex() {
    if (editingRow >= 0) return editingRow;
    if (editingRowIndex != null) return editingRowIndex;
    return -1;
  }
  // pinnedMeasurement(pin): the virtual-core measurement { index, start, size, end, key } for the
  // pinned full-model index — its measured (or estimated) height + offset, used to (a) decide
  // whether it sits above/below the rendered window and (b) subtract its height from the right
  // spacer. Null when out of range / not virtual.
  function pinnedMeasurement(pin: any) {
    if (!virtualizer.current || pin < 0) return null;
    const ms = virtualizer.current.getMeasurements();
    return ms && ms[pin] ? ms[pin] : null;
  }

  // measureElement sweep (D-10 / CR-01): refine estimated heights to MEASURED ones. The off-root
  // querySelector idiom (chartjs/cropper/embla precedent — no per-row callback ref). Each rendered
  // <tr> MUST be handed to virtualizer.measureElement on every window commit for it to be observed:
  // virtual-core does NOT auto-register rendered rows — measureElement is the SOLE caller of its
  // internal ResizeObserver's observe() (virtual-core@3.17.1 dist/esm/index.js:794-817), keyed by
  // getItemKey. So this sweep must run not just once at mount but on every onChange tick (via
  // scheduleRemeasure), or recycled rows keep the estimateRowHeight seed forever. measureElement is
  // idempotent on an already-observed node (the `prevNode !== node` guard), so re-sweeping the
  // visible window each commit is cheap and loop-free.
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
  // D-04: this shell exports ONLY the impure, data-table-specific host pieces. The pure windowing
  // math (windowedRows / padTop / padBottom / pmIndexInWindow / rowIsOutsideWindow / virtualizerOptions
  // / virtualItemKey) is imported DIRECTLY by the host (DataTable.rozie) from
  // `@rozie-ui/headless-core/windowing.rzts` via bare specifier — the P0-proven cross-package inline
  // path that DISSOLVES the partial into the leaf (a re-export-from THROUGH this shell would survive as
  // a runtime import, not inline — verified). The math closes over these host symbols by convention.
  // ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
  // Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
  // holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
  // in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
  // compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
  //
  // HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
  // by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
  //   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
  //                             returns its pre-pagination row model, listbox/combobox return the
  //                             filtered options). This partial MUST NOT reach into the host data engine
  //                             directly — rows arrive ONLY through windowSource().
  //   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
  //   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
  //   - gridScrollEl              — the scroll-container element handle.
  //   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
  //   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
  //   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
  //   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
  //                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
  //                             listbox passes nothing. Routing pinning through this host hook (NOT
  //                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.
  //   - rowsWindowed(): boolean  — is the ROW axis windowed. REQUIRED, no default — replaces every bare
  //                             truthiness read of the host's windowing prop (D-05); `windowedRows()` /
  //                             `padTop()` / `padBottom()` / `rowIsOutsideWindow()` below call it by
  //                             convention exactly as they already call `pinnedEditIndex()`.
  //   - colsWindowed(): boolean  — is the COLUMN axis windowed. REQUIRED, no default. `false` for every
  //                             host until it defines the real column-axis mechanism (87-04+).
  //   - columnCount(): number    — the leaf-column count the column virtualizer windows over. REQUIRED,
  //                             no default.
  //   - columnSize(i: number): number — the authoritative width of absolute leaf column `i`, sourced
  //                             from table-core's `getSize()` under D-06. REQUIRED, no default.
  //   - forcedColumns(): number[] — the D-10 OPTIONAL column-axis mirror of `pinnedEditIndex()`: the
  //                             DataTable host unions pinned + active-cell + editing column indices into
  //                             the column-window slice; listbox/combobox pass an empty array (host-
  //                             provided, defaulting to `[]`).
  //   - colVirtualizer           — the host's SECOND virtual-core instance, windowing the COLUMN axis
  //                             (see the AXIS MECHANISM note below). Host-provided, defaulting to `null`.
  //
  // AXIS MECHANISM (OQ1 / Assumption A1 — resolved from the installed source this session, NOT
  // implemented yet; this plan documents the contract only, the second instance lands starting 87-04):
  // `horizontal` is a PER-INSTANCE field of `VirtualizerOptions`
  // (`node_modules/@tanstack/virtual-core/dist/esm/index.d.ts:67`, installed version 3.17.1 per
  // `package.json`), and every axis-sensitive internal read consults `instance.options.horizontal` —
  // `measureElement`'s inlineSize/blockSize + offsetWidth/offsetHeight branch
  // (`dist/esm/index.js:137,150`), `observeElementOffset`'s scrollLeft/scrollTop branch
  // (`dist/esm/index.js:118-121`), `getMaxScrollOffset`'s scrollWidth/scrollHeight branch
  // (`dist/esm/index.js:907-915`), and `scrollWithAdjustments`'s left/top branch
  // (`dist/esm/index.js:152-161`). So ONE `Virtualizer` instance windows exactly ONE axis: the column
  // axis needs its own SECOND, independent `Virtualizer` instance constructed with `horizontal: true`,
  // sharing the SAME `getScrollElement()` (the `rdt-scroll` wrapper) the row instance already uses.
  // Two options the row axis does not set that the column instance will need: `isRtl?: boolean`
  // (data-table ships an RTL grid path) and `overscan?: number` (D-07 gives the column axis its own
  // hardcoded constant, separate from the row axis's `overscan: 8` below).

  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  function virtualItemKey(i: any) {
    const src = windowSource();
    return src && src[i] ? src[i].id : undefined;
  }

  // COL_OVERSCAN (D-07): the column axis's own hardcoded overscan constant, separate from the
  // row axis's `overscan: 8` below. Columns are far wider than rows are tall, so one number
  // cannot serve both axes; no prop is exposed because no consumer has asked to tune the row
  // overscan across the four phases it has shipped. Unused until 87-04 constructs the second,
  // horizontal Virtualizer instance (see the AXIS MECHANISM note above).
  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
  // increment the React emitter lowers to functional setState — correct even from a mount closure.
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
  // pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
  // shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
  // two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
  // no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
  // `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
  // guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
  // thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
  // gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
  // Typing-only: the runtime value (a measurement or null) is unchanged.
  function pinMeasurement(pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null {
    return pinnedMeasurement(pin);
  }

  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
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
      // Rows OFF (Phase 87 D-04: this now includes the colsWindowed()-only path, since the
      // wrapper template is entered whenever isWindowed(), not just rowsWindowed() — the row
      // virtualizer is never constructed when only the column axis is windowed, D-04) → the FULL
      // set, with a SYNTHETIC `vi.index` set to each row's array position (matching rowIndexOf's
      // own `$data.rows.indexOf(row)` semantics exactly, since $data.rows IS windowSource()'s
      // output here). Every windowed body binding reads wr.vi.index (data-row, aria-rowindex,
      // colIndexOf, isEditing, the fill handle) — a bare `null` there is a hard crash the moment
      // this branch is reached with the wrapper mounted, which colsWindowed()-only now does.
      // Row-virtual ON but the virtualizer is not yet constructed (pre-$onMount first paint) →
      // render NOTHING so the template never dereferences a not-yet-real `vi`; the rows appear on
      // the first onChange after _didMount.
      if (!rowsWindowed()) {
        const rowList = rows || [];
        return rowList.map((r: any, i: any) => ({
          vi: {
            index: i
          },
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

  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void windowVer;
    void editVer;
    if (!rowsWindowed() || !virtualizer.current) return 0;
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
    if (!rowsWindowed() || !virtualizer.current) return 0;
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
  // pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
  function pmIndexInWindow(items: any, idx: any) {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  }
  // rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
  // window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
  function rowIsOutsideWindow(r: any) {
    if (!rowsWindowed() || !virtualizer.current) return false;
    const items = virtualizer.current.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  }
  // ── Sort/filter live-announcement (#14) ─────────────────────────────────────────────
  // A polite aria-live announcement whenever the consumer changes sorting or filtering, so a
  // screen-reader user hears that the rows were reordered / narrowed (which is otherwise silent).
  // announceState holds the last-seen references so the lazy watch below can tell WHICH slice
  // changed (sort vs filter) and pick the message. It is a top-level mutable const → stabilized
  // once per instance on all six targets (React useMemo-wraps a mutable instance; the others run
  // setup once), so it PERSISTS across renders — unlike a top-level `let`, which React resets per
  // render. Seeded from the initial state in $onMount so the first (post-mount) change compares
  // against the true starting values, not a null sentinel.
  // Typed as `unknown` members: these hold opaque last-seen references compared only by
  // identity (!==) below, never read in a typed context — the annotation keeps the null seed
  // from narrowing the members to `null` (which would reject the real reassignments under
  // strictNullChecks in the emitted leaves).
  const announceState: {
    sorting: unknown;
    columnFilters: unknown;
    globalFilter: unknown;
  } = useMemo(() => ({
    sorting: null,
    columnFilters: null,
    globalFilter: null
  }), []);
  // Effective (controlled-or-uncontrolled) reads of the sort/filter slices: the bound prop when
  // the consumer bound the matching r-model, else the uncontrolled $data default (mirrors currentState()).
  const effectiveSorting = useCallback(() => sorting != null ? sorting : sortingDefault, [sorting, sortingDefault]);
  const effectiveColumnFilters = useCallback(() => columnFilters != null ? columnFilters : columnFiltersDefault, [columnFilters, columnFiltersDefault]);
  const effectiveGlobalFilter = useCallback(() => globalFilter != null ? globalFilter : globalFilterDefault, [globalFilter, globalFilterDefault]);
  // Build the polite message for a sort/filter change and advance announceState. Sort takes
  // precedence when the sorting reference changed; otherwise a filter changed → the post-filter
  // result count (the FILTERED total via totalRowCount(), NOT the page slice). Returns '' when
  // neither actually changed (a no-op watch tick — do not re-announce).
  function buildSortFilterAnnounce() {
    const nextSorting = effectiveSorting();
    const nextColumnFilters = effectiveColumnFilters();
    const nextGlobalFilter = effectiveGlobalFilter();
    const sortChanged = nextSorting !== announceState.sorting;
    const filterChanged = nextColumnFilters !== announceState.columnFilters || nextGlobalFilter !== announceState.globalFilter;
    announceState.sorting = nextSorting;
    announceState.columnFilters = nextColumnFilters;
    announceState.globalFilter = nextGlobalFilter;
    if (sortChanged) {
      const active = nextSorting && nextSorting.length ? nextSorting[0] : null;
      if (!active) return 'Sorting cleared';
      const rawLabel = headerLabel(active.id);
      const label = typeof rawLabel === 'string' && rawLabel ? rawLabel : active.id;
      return 'Sorted by ' + label + ', ' + (active.desc ? 'descending' : 'ascending');
    }
    if (filterChanged) {
      return totalRowCount() + ' results';
    }
    return '';
  }
  // Push fresh options into table-core + re-pull the row model. Extracted so BOTH the
  // re-feed $watch (above) and the Lit data-change $onUpdate (below) call it.
  const reFeed = useCallback(() => {
    if (!table.current) return;
    // NOTE: the external-swap history reset does NOT live here. reFeed() fires on EVERY watched
    // change — including our OWN synchronous internal `$data.dataDefault` write — so a clear keyed
    // on a `currentData()` read here would (on fine-grained targets) fire mid-round-trip against a
    // TRANSIENTLY-STALE `$props.data` and wrongly wipe a just-recorded edit's history. The reset is
    // keyed on the `$props.data` REFERENCE actually changing instead — see the $onUpdate backstop
    // below (`maybeClearHistoryOnExternalSwap`), which runs on all six targets.
    table.current.setOptions((prev: any) => ({
      ...prev,
      data: currentData(),
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: props.selectionMode !== 'none',
      enableMultiRowSelection: props.selectionMode === 'multiple',
      // Re-pass the server-side page-count sources (#2) so a RUNTIME rowCount/pageCount change
      // takes effect: setOptions REPLACES via `...prev`, which holds the value captured at
      // createTable time, so an omitted key would freeze the mount-time count. The re-feed
      // $watch keys on both props below.
      rowCount: props.rowCount ?? undefined,
      pageCount: props.pageCount ?? undefined,
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
  }, [currentData, currentState, onColumnFiltersChangeCb, onColumnOrderChangeCb, onColumnPinningChangeCb, onColumnSizingChangeCb, onColumnSizingInfoChangeCb, onColumnVisibilityChangeCb, onExpandedChangeCb, onGlobalFilterChangeCb, onGroupingChangeCb, onPaginationChangeCb, onRowSelectionChangeCb, onSortingChangeCb, props.expandable, props.getSubRows, props.pageCount, props.rowCount, props.selectionMode, tableColumns]);
  // LIT (+ any fine-grained target whose effect-tracked watch does NOT observe the plain
  // `data` PROPERTY): the re-feed $watch reads `(this.data||[]).length` inside a
  // preact-signals effect, but `data` is a Lit @property (not a signal) so the effect
  // never re-runs when the consumer pushes new rows post-mount (the sticky demo seeds 20
  // rows in its own $onMount AFTER the child mounted empty → the body stayed at 0). The
  // slice models DO re-pull (their $data.<slice>Default signals are effect-tracked), so
  // only a raw `data` reference/length change slips through. $onUpdate (Lit updated())
  // fires on ANY property change incl `data`; guard with a stored last-seen data ref +
  // length so it re-feeds ONLY on a real data change (no churn). On the coarse-render
  // targets the watch already covers it; this is a cheap idempotent backstop.
  // External-swap history reset (grid-wide undo/redo, 260709-8ct; #8 fix). Keyed on the CONTROLLED
  // `$props.data` REFERENCE changing — deliberately NOT on `currentData()` inside reFeed. An internal
  // writeback changes `$data.dataDefault` SYNCHRONOUSLY and only LATER round-trips into `$props.data`;
  // keying on `$props.data`'s OWN change means we never observe the transient window where a fine-
  // grained target's reFeed reads a stale, unstamped `$props.data` mid-write and wrongly wipes a
  // just-recorded edit's history (the stale-read false-clear — the SAME failure that broke the
  // content-signature variant — that regressed Solid/Lit when this clear lived in reFeed). When
  // `$props.data` genuinely changes: a new array carrying DATA_WRITE_TOKEN round-tripped from one of
  // OUR writes → keep; one without it is a dataset the consumer handed us → external swap → clear. A
  // non-data tick (sort/filter/pagination) never touches `$props.data` → never clears. Called from
  // BOTH the coarse re-feed watch AND the $onUpdate backstop (Lit's @property `data` the effect-
  // tracked watch can't observe); both are ref-gated so the redundant call is an idempotent no-op.
  const maybeClearHistoryOnExternalSwap = useCallback(() => {
    const pd = data;
    if (pd === lastPropsData.current) return; // $props.data did not change → not an external swap
    lastPropsData.current = pd;
    if (!props.undoable) return;
    if (pd != null && (pd as any)[DATA_WRITE_TOKEN_KEY] != null) return; // descends from our write → keep
    clearHistory();
  }, [clearHistory, data, props.undoable]);
  // Header click → toggle sort. Shift-click → ADD a secondary sort (multi-sort). Driven
  // through table-core's column API so the onSortingChange funnel emits the fresh state.
  const onHeaderSort = useCallback((colId: any, evt: any) => {
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (!col || !col.getCanSort()) return;
    const multi = !!(evt && evt.shiftKey);
    // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
    col.toggleSorting(undefined, multi);
  }, []);
  // aria-sort string for a column header: 'ascending' | 'descending' | 'none'. Reads
  // Reactive tick: read $data.rowModelVer (bumped by every refreshRowModel) so a
  // template binding that calls a table-READING chrome helper (pagination/sort/pin/
  // visibility predicates below) re-evaluates when the row model changes. On the
  // coarse-render targets (Vue/React/Angular) the whole template re-runs anyway so this
  // is a no-op; on the FINE-GRAINED targets (Solid/Lit) a helper that only reads the
  // non-reactive `table` let would be computed ONCE (when table is still null → the
  // default branch) and never update — pagination would read "Page 1 of 1" forever,
  // aria-sort never flips, the pin position never sticks. Touching rowModelVer puts each
  // helper in the reactive scope. The chrome helpers prefix `tick()` in their guard.
  function tick() {
    return rowModelVer;
  }
  // the live sort direction off the table-core column (string-safe — never a bound
  // boolean, the listbox aria lesson).
  function ariaSortFor(colId: any) {
    if (tick() < 0 || !table.current) return 'none';
    const col = table.current.getColumn(colId);
    if (!col) return 'none';
    const dir = col.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }

  // A small sort-direction glyph for the header (▲/▼/empty). Decorative — aria-hidden.
  function sortIndicator(colId: any) {
    if (tick() < 0 || !table.current) return '';
    const col = table.current.getColumn(colId);
    if (!col) return '';
    const dir = col.getIsSorted();
    if (dir === 'asc') return '▲';
    if (dir === 'desc') return '▼';
    return '';
  }

  // Template helpers reading the resolved column-def metadata by id (plain fns — used
  // in template predicates + interpolation; uniform on all 6, no $computed alias trap).
  function defFor(colId: any) {
    const defs = columnDefs();
    for (const d of defs as any) if (d.id === colId) return d;
    return null;
  }
  // Per-row visible cells for the body loop. table-core memoizes row objects by id,
  // so a re-pull after a column change (visibility/reorder/pin, or the late <Column>
  // registry on first mount) returns the SAME row references with a different cell
  // set. On Solid the row loop keeps the existing <tr> across that pull (`:key="row.id"`
  // is stable, so the emitter's `<Key>` reconciler holds the node), and Solid will NOT
  // re-run a child loop whose `each` reads no signal — so a bare `row.getVisibleCells()`
  // goes stale (header reorders, cells don't). Reading `$data.rowModelVer` (bumped by every
  // refreshRowModel) inside the `each` puts the inner loop in the reactive scope, so it
  // re-derives the cells on every row-model change. No-op on the coarse-render targets.
  function visibleCellsFor(row: any) {
    return rowModelVer >= 0 ? row.getVisibleCells() : [];
  }

  // ── Editable-cell column-meta accessors (phase 51 req-1/2/5) ───────────────────────
  // editMetaOf: the resolved ColumnDef.meta for a column id (the editable config carried
  // from <Column>/`:columns` via columnDefs). Null-safe — an unknown/non-editable column
  // returns null and every predicate below short-circuits to the read-only path.
  function editMetaOf(colId: any) {
    const d = defFor(colId);
    return d && d.meta ? d.meta : null;
  }
  // columnEditable: whether this column opted into editing (req-1). Drives every editor
  // gate; false → the cell stays the read-only #cell display (byte-identical-off).
  function columnEditable(colId: any) {
    const m = editMetaOf(colId);
    return !!(m && m.editable === true);
  }
  // editorTypeOf: the built-in editor kind ('text'|'number'|'select'|'checkbox') OR
  // 'custom' (the #editor scoped-slot escape hatch, req-2). Defaults to 'text'.
  function editorTypeOf(colId: any) {
    const m = editMetaOf(colId);
    return m && m.editor != null ? m.editor : 'text';
  }
  // editorOptionsOf: the select-editor options ([{ value, label }]) for editor='select'.
  function editorOptionsOf(colId: any) {
    const m = editMetaOf(colId);
    return m && m.editorOptions != null ? m.editorOptions : [];
  }
  // hasEditorSlot: this column routes through the consumer's #editor scoped slot (req-2)
  // — true only when the column declared editor='custom' AND the consumer actually
  // provided an #editor slot. Falls through to the built-in editor otherwise (e.g. a
  // column marked 'custom' with no slot supplied degrades to the text editor, never blank).
  function hasEditorSlot(colId: any) {
    return editorTypeOf(colId) === 'custom' && !!(props.renderEditor ?? props.slots?.["editor"]);
  }

  // hasFilterSlot: the consumer supplied a #filter scoped slot, so it OWNS the per-column
  // filter UI (re-added in 72-05 alongside the dedicated filter row's `<slot name="filter">`
  // host — see the 72-03 removal note in that plan's SUMMARY for why this was briefly gone).
  function hasFilterSlot() {
    return !!(props.renderFilter ?? props.slots?.["filter"]);
  }
  function columnIsFilterable(colId: any) {
    const d = defFor(colId);
    return !!(d && d.filterable);
  }
  function headerLabel(colId: any) {
    const d = defFor(colId);
    return d ? d.header : colId;
  }

  // ── Column-management chrome (req-8/9/10/11) ────────────────────────────────────────
  // Live header width (px) for a column — drives the <th> :style width binding. Reads the
  // table-core column size (post-mount) with a fallback to undefined (auto width).
  function headerWidth(colId: any) {
    if (tick() < 0 || !table.current) return null;
    const col = table.current.getColumn(colId);
    if (!col) return null;
    const w = col.getSize();
    return w != null && w > 0 ? w + 'px' : null;
  }

  // Pointer-drag resize handler for a resizable header — table-core's getResizeHandler()
  // returns a function bound to a pointerdown/touchstart event that drives the column
  // size through onColumnSizingChange (our writeColumnSizing funnel) under
  // columnResizeMode:'onChange'. Pure delegation; no scratch gesture state held in a
  // top-level const (the React fragile-binding rule — table-core owns the gesture state).
  const onResizeStart = useCallback((colId: any, evt: any) => {
    // stop here (NOT a `.stop` modifier) — the Angular `.stop`-in-@for hoist is broken (F5).
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table.current) return;
    const header = findHeader(colId);
    if (!header || !header.getResizeHandler) return;
    const handler = header.getResizeHandler();
    if (handler) handler(evt);
  }, [findHeader]);
  // Find the live header object for a column id across the rendered header groups.
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

  // Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
  // onColumnVisibilityChange funnel emits the fresh state.
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
  // The full set of leaf columns (for the visibility-toggle menu) — id + header label +
  // current visibility. Excludes the auto-injected CHROME columns (select + expander) —
  // neither is a data column: they carry no header label (so they'd surface their raw
  // internal id, e.g. '__rdt_expander') and their presence is governed by the
  // selectionMode/expandable props, not user-toggleable visibility.
  function allLeafColumns() {
    if (tick() < 0 || !table.current) return [];
    const cols = table.current.getAllLeafColumns ? table.current.getAllLeafColumns() : [];
    const out = [];
    for (const c of cols as any) {
      if (!c || c.id === SELECT_COL_ID || c.id === EXPANDER_COL_ID) continue;
      out.push({
        id: c.id,
        label: headerLabel(c.id),
        visible: !!(c.getIsVisible && c.getIsVisible())
      });
    }
    return out;
  }

  // Pinning (req-11) — drive table-core's column.pin('left'|'right'|false) so the
  // onColumnPinningChange funnel emits a fresh state. Sticky offsets read the live column
  // start/after positions (table-core computes them from the pinned column sizes).
  function columnPinSide(colId: any) {
    if (tick() < 0 || !table.current) return false;
    const col = table.current.getColumn(colId);
    if (!col || !col.getIsPinned) return false;
    return col.getIsPinned();
  }
  // NOTE: the event is stopped HERE (evt.stopPropagation()) rather than via a `.stop`
  // template modifier. The Angular emitter, hoisting a `.stop`-modified handler that
  // lives INSIDE an `@for` loop into a class-field wrapper, drops the component `this.`
  // qualifier (→ `onPinColumn(...)` bare ReferenceError) and fails to capture the loop
  // var — so a `@click.stop="onPinColumn(...)"` inside the header `@for` breaks on
  // Angular (F5). Stopping inside the handler sidesteps the broken hoist on all six.
  const onPinColumn = useCallback((colId: any, side: any, evt: any) => {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (col && col.pin) col.pin(side);
  }, []);
  // Sticky inline style for a pinned header/cell — position:sticky + the computed left or
  // right offset. Returns '' (no sticky) for unpinned columns. Returned as a STRING (the
  // :style binding is value-driven — never an eval'd attr).
  //
  // `zIndex` (phase 72 fix, default 1 — body <td> / filter-row <th> layer): an INLINE style
  // ALWAYS wins over the stylesheet's `.rozie-data-table.rdt-sticky .rdt-thead .rdt-th
  // { z-index: var(--rdt-sticky-z, 2) }` rule, so a pinned header cell that unconditionally
  // got `z-index:1` here (same as the pinned body/filter-row cells) silently DOWNGRADED the
  // intended sticky-header stacking level from 2 to 1 — tying it with the dedicated filter
  // row's own pinned <th> (72-05), which sits LATER in DOM order (a sibling <tr> beneath the
  // header row) and therefore visually/interactively covers the header's ⋯ menu (phase 72,
  // z-index:1000 relative to Popover's OWN local stacking context — capped by the pinned
  // header <th>'s z-index, since a `position:fixed` descendant does not escape an ancestor's
  // stacking context, only its layout containing block) whenever that SAME column is both
  // pinned and filterable. thStyle() (the header caller) passes zIndex=2 so the header layer
  // always wins ties against the filter-row/body layers, which keep the default of 1.
  function pinStyle(colId: any, zIndex = 1) {
    if (tick() < 0 || !table.current) return '';
    const col = table.current.getColumn(colId);
    if (!col || !col.getIsPinned) return '';
    const side = col.getIsPinned();
    if (side === 'left') {
      const left = col.getStart ? col.getStart('left') : 0;
      return 'position:sticky;left:' + left + 'px;z-index:' + zIndex + ';';
    }
    if (side === 'right') {
      const right = col.getAfter ? col.getAfter('right') : 0;
      return 'position:sticky;right:' + right + 'px;z-index:' + zIndex + ';';
    }
    return '';
  }
  // Combined inline style for a <th> (width + pin) and a <td> (pin). Plain string concat —
  // uniform on all 6, no bound-object trap. zIndex=2 (see pinStyle) so a pinned header cell
  // — which hosts the ⋯ menu's floating content — always stacks above the pinned filter-row
  // cell for the same column (zIndex=1, its own default).
  function thStyle(colId: any) {
    let s = '';
    const w = headerWidth(colId);
    if (w) s += 'width:' + w + ';';
    s += pinStyle(colId, 2);
    return s;
  }
  // ── Filter chrome handlers ─────────────────────────────────────────────────────────
  // Global search input → funnel through table-core's setGlobalFilter so the
  // onGlobalFilterChange callback fires the echo-guarded writer. Capture the fresh local
  // value (never re-read a just-written $data key — React stale-read).
  const onGlobalFilterInput = useCallback((evt: any) => {
    const value = evt && evt.target ? evt.target.value : '';
    if (table.current) {
      table.current.setGlobalFilter(value);
      return;
    }
    writeGlobalFilter(value);
  }, [writeGlobalFilter]);
  // Per-column filter input → setColumnFilter (fresh-array funnel).
  const onColumnFilterInput = useCallback((colId: any, evt: any) => {
    const value = evt && evt.target ? evt.target.value : '';
    setColumnFilter(colId, value);
  }, [setColumnFilter]);
  // The live global filter value (bound to the search <input>, value-driven NOT eval'd).
  function globalFilterValue() {
    const v = currentState().globalFilter;
    return v != null ? v : '';
  }

  // ── Pagination chrome ────────────────────────────────────────────────────────────
  // Read the live pagination state off table-core (post-mount) with a currentState()
  // fallback (pre-mount / SSR). All string-safe (no bound booleans).
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
  // Renamed from `pageCount` → `displayPageCount`: `pageCount` is now a public prop
  // (server-side manual pagination), and a same-named top-level helper collides with the
  // destructured prop on Svelte and the @Input/@property class field on Angular/Lit. This
  // reader is internal (drives the "Page X of Y" chrome) and reads table-core's live
  // getPageCount(), which now reflects rowCount/pageCount when manual.
  function displayPageCount() {
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
  // ── Row-selection chrome (req-7) ───────────────────────────────────────────────────
  // Detect the auto-injected leading checkbox column by its constant id (template uses
  // this to render checkbox chrome instead of an accessor value).
  function isSelectColumn(colId: any) {
    return colId === SELECT_COL_ID;
  }
  // ── Expandable-rows template helpers (phase 50, D-04) ──────────────────────────────
  // isExpanderColumn: the auto-injected leading chevron column predicate (mirrors
  // isSelectColumn). rowIsExpanded / rowCanExpand read table-core row handles THROUGH the
  // reactive tick (rowModelVer) so the chevron glyph + aria-expanded + the #detail r-if
  // re-derive on a re-pull on the fine-grained targets (Solid/Lit) — same discipline as
  // visibleCellsFor. `!!`-coerced so a bound aria-expanded emits an UNWRAPPED boolean (the
  // listbox aria lesson — never a rozieAttr string → TS2322 on React/Solid).
  function isExpanderColumn(colId: any) {
    return colId === EXPANDER_COL_ID;
  }
  // rowCanExpand gates ONLY the leading expander-column detail chevron. Group-header rows
  // are excluded (`!getIsGrouped`): with `expandable` + grouping, getRowCanExpand returns
  // `() => true` for EVERY flattened row, so without this a group header rendered TWO
  // chevrons — the group-toggle in its grouped cell AND a redundant detail chevron in the
  // leading column (both fire onToggleExpand on the shared expanded state). A group row's
  // expand affordance is the group-toggle; the leading-column chevron is detail-only.
  function rowCanExpand(row: any) {
    return !!(tick() >= 0 && row && row.getCanExpand && row.getCanExpand() && !(row.getIsGrouped && row.getIsGrouped()));
  }
  function rowIsExpanded(row: any) {
    return !!(tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());
  }
  // rowShowsDetail: the #detail <tr> renders ONLY in #detail mode (no getSubRows) when the
  // row is expanded AND is NOT a group-header row. With getSubRows the children arrive as
  // ordinary depth-indented rows in $data.rows (table-core flattens) — NO additive detail
  // row, NO nested r-for (Pitfall 1). The `!rowIsGrouped` guard is load-bearing: grouping
  // and detail-expand share table-core's SINGLE `expanded` state, so a group-header row is
  // `getIsExpanded()===true` the moment its group opens; without this guard that expanded
  // group row also satisfied `getSubRows==null && rowIsExpanded`, painting a spurious
  // #detail panel under every opened group (the group-toggle looked "linked" to detail).
  function rowShowsDetail(row: any) {
    return props.getSubRows == null && !rowIsGrouped(row) && rowIsExpanded(row);
  }
  // Toggle a row's expanded state through table-core so onExpandedChange → writeExpanded
  // fires exactly one expanded-change. Used by the chevron @click (native <button> handles
  // Enter/Space → click, so NO explicit @keydown.enter/.space — that would DOUBLE-toggle on
  // a real button; the grid @keydown is inert in 'table' mode, isGrid()-gated).
  const onToggleExpand = useCallback((row: any, evt: any) => {
    if (!row || !row.toggleExpanded) return;
    // Capture the owning row element BEFORE the toggle so DOM focus can be restored after the
    // expanded-state re-render. This guards a focus-drop that USED to happen on Solid: when the
    // cell loop reconciled by reference (bare <For>), table-core's fresh cell instances each
    // pull rebuilt the expander <td>/<button> (the <tr> persisted but its cells were rebuilt),
    // dropping DOM focus to <body> and breaking keyboard activation (Enter/Space on the focused
    // expander left nothing focused). Since the emitter now emits `<Key>` for the
    // `:key="cellCtx.id"` cell loop, Solid keeps the cell node on a stable key too — so the
    // expander is no longer recreated and this re-focus is now a defensive no-op on ALL six
    // targets (re-focusing the SAME kept element — the focusActiveCell imperative-refocus
    // precedent). Kept for safety; it costs nothing when the node is unchanged. The rAF defers
    // past the synchronous reactive flush so any (re)created node exists first.
    const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest('tr') : null;
    row.toggleExpanded();
    if (ownerRow && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const btn = ownerRow.querySelector('[data-expander]');
        if (btn) btn.focus();
      });
    }
  }, []);
  // bodyCellStyle: the non-virtual <td> inline style — pinStyle PLUS a depth-proportional
  // left pad on the EXPANDER cell so nested getSubRows children visibly indent (row.depth).
  // Only the expander column indents (the tree affordance lives in its dedicated column);
  // data columns stay grid-aligned. depth 0 → unchanged (byte-identical-off).
  function bodyCellStyle(row: any, colId: any) {
    const base = pinStyle(colId);
    if (isExpanderColumn(colId) && row && row.depth) {
      // Only the expander column indents (the tree affordance lives here).
      const pad = 'padding-left:' + (0.5 + row.depth * 1.25) + 'rem';
      return base ? base + pad : pad;
    }
    return base;
  }
  // ── Grouping template helpers (phase 50 reqs 4-7, D-04/D-05) ───────────────────────────
  // Group-header rows ARE expandable rows: table-core's getGroupedRowModel FLATTENS them into
  // $data.rows carrying getIsGrouped()/subRows, so they ride the SAME D-04 <template r-for> seam
  // (no parallel render path, no nested r-for). These predicates read through the reactive tick
  // (rowModelVer) so the group chrome + collapse state re-derive on a re-pull on the fine-grained
  // targets (Solid/Lit) — same discipline as rowIsExpanded/visibleCellsFor. `!!`-coerced (the
  // listbox aria lesson — a bound boolean must be UNWRAPPED, never a rozieAttr string → TS2322).
  // rowIsGrouped: this flattened row is a group-header row.
  function rowIsGrouped(row: any) {
    return !!(tick() >= 0 && row && row.getIsGrouped && row.getIsGrouped());
  }
  // groupingActive: grouping is currently engaged (a non-empty ordered key list). Drives the
  // data-group-leaf marker so it is ABSENT when ungrouped (byte-identical-off, req-10).
  function groupingActive() {
    return tick() >= 0 && (currentState().grouping || []).length > 0;
  }
  // cellIsGrouped / cellIsAggregated: per-CELL roles on a group-header row. The grouped cell shows
  // the group key + toggle + count; an aggregated cell shows the rolled-up value through the
  // EXISTING #cell slot (cell.getValue()) — NO new aggregatedCell template (RESEARCH State of the
  // Art). A placeholder cell (neither) falls through to the #cell r-else and renders its empty value.
  function cellIsGrouped(cellCtx: any) {
    return !!(tick() >= 0 && cellCtx && cellCtx.getIsGrouped && cellCtx.getIsGrouped());
  }
  function cellIsAggregated(cellCtx: any) {
    return !!(tick() >= 0 && cellCtx && cellCtx.getIsAggregated && cellCtx.getIsAggregated());
  }
  // cellIsPlaceholder: a PLACEHOLDER cell on a group-header row — a non-grouped, non-aggregated
  // cell that table-core fills with the FIRST leaf row's value (cell.getValue() leaks e.g.
  // "Services"/"Edsger Dijkstra" onto the group line). Renders BLANK via a dedicated empty
  // template branch so the leaked leaf value never paints. Tick-gated exactly like cellIsGrouped
  // so the group chrome re-derives on a re-pull on the fine-grained targets (Solid/Lit).
  function cellIsPlaceholder(cellCtx: any) {
    return !!(tick() >= 0 && cellCtx && cellCtx.getIsPlaceholder && cellCtx.getIsPlaceholder());
  }
  // groupSubRowCount: the number of underlying LEAF RECORDS under a group-header row (the count
  // shown in the header, e.g. "North (40)"). row.subRows is the IMMEDIATE members — for MULTI-LEVEL
  // grouping those are sub-GROUPS, not records, so "North" with 2 categories / 40 records would show
  // "North (2)". getLeafRows() returns all leaf descendants (the actual record count); keep the
  // subRows fallback for safety. Single-level grouping is unchanged (getLeafRows == subRows when the
  // children are already leaves).
  function groupSubRowCount(row: any) {
    return row && row.getLeafRows ? row.getLeafRows().length : row && row.subRows ? row.subRows.length : 0;
  }
  // groupingKeys: the live ordered grouping array — slot prop for the headless #groupBar + the
  // default styled-token reflection. Reads currentState() ($props.grouping ?? $data.groupingDefault),
  // both reactive sources, so the bar re-renders on a grouping change across all six targets.
  function groupingKeys() {
    return currentState().grouping || [];
  }
  // groupableColumns: the data columns OFFERED to the headless #groupBar (those whose Column/config
  // `groupable` is not false) — `[{ id, label }]`. Excludes the chrome columns (select/expander are
  // not in columnDefs()). The consumer builds any bar/drag UI from this; the component ships none.
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
  // Plain stop-propagation handler (used in place of the `@click.stop` bare modifier —
  // a bare `.stop` with no handler hoists to `_guardedUndefined` → `this.undefined($event)`
  // on Angular inside an `@for`, F5). Calling an explicit handler is uniform on all six.
  const stopEvent = useCallback((evt: any) => {
    if (evt && evt.stopPropagation) evt.stopPropagation();
  }, []);
  // select-all header state (D-06: scopes to all filtered rows = TanStack default).
  // `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
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
  // per-row checkbox state + toggle (checkbox-only, D-05 — row body does NOT select).
  // Read selection from the LIVE controlled state (currentState().rowSelection keyed by
  // row.id) — NOT row.getIsSelected(). The latter reads table-core's row model, which
  // only reflects a selection AFTER the re-feed watch pushes the new `state` + re-pulls
  // (two reactive cycles on React). The controlled-state read updates in the SAME cycle
  // as the write funnel, so the controlled <input :checked> reflects the toggle without
  // the row-model-re-pull latency — the React controlled-checkbox revert that left
  // `.check()` seeing no state change (F6). row.getIsSelected() is the fallback.
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
  // ── Header ⋯ menu chrome (phase 72, D-06) ──────────────────────────────────────────
  // onHideColumn: the ⋯ menu's "Hide column" item. Reuses the SAME columnVisibility write
  // funnel as the existing colvis toggle (onToggleVisibility in columnChrome.rzts) — just
  // forced to `false` rather than toggled, since hide is a one-directional action from the
  // menu (the colvis panel is the re-show path). Event stopped HERE (not a `.stop`
  // modifier) — same Angular @for-hoist hazard as onPinColumn/onResizeStart (F5).
  const onHideColumn = useCallback((colId: any, evt: any) => {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (col && col.toggleVisibility) col.toggleVisibility(false);
  }, []);
  // hasAnyFilterableColumn: gates the dedicated filter row (72-05) — true when at least one
  // leaf column (excluding the select/expander chrome columns, already excluded by
  // allLeafColumns) is filterable. Reactive via allLeafColumns()'s own tick() gate.
  function hasAnyFilterableColumn() {
    const cols = allLeafColumns();
    for (const c of cols as any) {
      if (c && columnIsFilterable(c.id)) return true;
    }
    return false;
  } // `indeterminate` is a DOM PROPERTY, not an HTML attribute — a `:indeterminate="…"`
  // binding only takes effect on Vue (which binds known DOM props); on
  // React/Solid/Angular/Lit/Svelte it lands as an inert attribute and `el.indeterminate`
  // stays false. So set it IMPERATIVELY: query the select-all checkbox off the component
  // root ($el — post-mount safe) and assign the property. Called from refreshRowModel
  // (every selection change re-pulls the row model) so it stays in lockstep with the
  // table-core selection state. The select-all box is NOT re-created by a selection
  // change (only its checked attr flips), so the live element persists.
  // `box` is aliased through a module-scope null-let (typeNeutralize → `any`) so the
  // strict bundled-leaf tsc accepts `.indeterminate` (querySelector returns `Element`,
  // which has no `indeterminate` — it is an HTMLInputElement DOM property). Same idiom
  // as Column's `let reg = null; reg = $inject(...)`.
  const syncIndeterminate = useCallback(() => {
    if (!__rozieRoot.current || !__rozieRoot.current!.querySelector) return;
    selectAllBox.current = __rozieRoot.current!.querySelector('.rdt-select-all');
    if (selectAllBox.current) selectAllBox.current.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
  }, [isAllRowsSelected, isSomeRowsSelected]);
  // The registry API handed to <Column> children (whole-object-replace — T-48-PP guard).
  // Imperative handle (consumer-callable). Each verb is a PRE-DECLARED top-level
  // `const` (the canonical $expose contract — `$expose({ name })` references a
  // binding ALREADY in scope; an INLINE-defined verb `$expose({ name: () => {} })`
  // is dropped on ALL SIX targets, only the by-reference key survives → a
  // runtime ReferenceError at `defineExpose`/`useImperativeHandle`). Sorting verbs +
  // a fresh column-def readout, selection, pagination, and column-management verbs.
  function sortColumn(colId: any, desc: any) {
    if (table.current) table.current.getColumn(colId) && table.current.getColumn(colId).toggleSorting(desc, false);
  }
  function clearSorting() {
    if (table.current) table.current.resetSorting(true);
  }
  function getColumnDefs() {
    return columnDefs();
  }
  // selection verbs (req-7) — drive table-core so the onRowSelectionChange funnel
  // emits the fresh state + selection-change.
  function toggleAllRows(value: any) {
    if (table.current) table.current.toggleAllRowsSelected(value);
  }
  function clearSelection() {
    if (table.current) table.current.resetRowSelection(true);
  }
  function getSelectedRows() {
    return table.current ? table.current.getSelectedRowModel().rows.map((r: any) => r.original) : [];
  }
  // pagination verbs.
  function setPage(idx: any) {
    if (table.current) table.current.setPageIndex(idx);
  }
  function setRowsPerPage(size: any) {
    if (table.current) table.current.setPageSize(size);
  }
  // column-management verbs (req-8/9/10/11) — drive table-core so the funnels fire.
  function toggleColumnVisibility(colId: any) {
    if (table.current) {
      const c = table.current.getColumn(colId);
      if (c && c.toggleVisibility) c.toggleVisibility();
    }
  }
  // NOT `setColumnOrder`: a verb named `set<ModelProp>` collides with React's
  // auto-generated `setColumnOrder` useState setter for the `columnOrder` model
  // prop, and an $expose verb is PUBLIC-CONTRACT-PROTECTED from the React
  // deconfliction rename (ROZ524 — the rename target is the verb, which is
  // off-limits). So the public verb is `applyColumnOrder` (semantically: apply a
  // new column order). The other set* verbs (setPage/setRowsPerPage) do NOT match
  // any model prop's setter, so they are collision-free.
  function applyColumnOrder(order: any) {
    if (table.current) table.current.setColumnOrder(order);
  }
  function resetColumnSizing() {
    if (table.current) table.current.resetColumnSizing(true);
  }
  // pinColumn: the verb that drives column.pin; distinct from the template handler
  // onPinColumn (no shadow — the deferred-items finding #4 collision check).
  function pinColumn(colId: any, side: any) {
    if (table.current) {
      const c = table.current.getColumn(colId);
      if (c && c.pin) c.pin(side);
    }
  }
  // getRowIndexRelativeToPage(absRow?) — C1 (phase 63 wave-6) converter: an ABSOLUTE display-order
  // index (the focusCell/getActiveCell/activecell-change space) → the PAGE-RELATIVE index. Mirrors
  // MUI getRowIndexRelativeToVisibleRows. With NO argument it converts the CURRENT active cell
  // (toAbsRow($data.activeRow) - pageRowOffset() collapses to $data.activeRow). In virtual mode
  // there is no page (windowing replaces pagination) → the windowed model IS the full model, so it
  // returns the absolute index unchanged. Collision-safe: no *-change event, prop, React auto-setter,
  // or inherited Lit DOM method named getRowIndexRelativeToPage (ROZ121/124/137 clear).
  function getRowIndexRelativeToPage(absRow: any) {
    const abs = absRow == null ? toAbsRow(activeRow) : Math.trunc(Number(absRow)) || 0;
    if (rowsWindowed()) return abs;
    return abs - pageRowOffset();
  }

  // C3 (phase 63 wave-9) — the PUBLIC Cut verb: copy the current cell range to the clipboard then
  // clear the source cells through the write-funnel (one writeData), delegating to cutRange (the
  // clipboardFill funnel that also backs the Ctrl+X shortcut). Reads the persisted $data range /
  // active cell, so it cuts the current selection even when the call arrives off a control that
  // moved DOM focus off the grid. Collision-safe: no `cut` event / model prop / React auto-setter /
  // inherited Lit DOM method named `cut` (ROZ121/124/137 clear) — `cut` is not on HTMLElement.
  function cut() {
    return cutRange();
  }

  // 260709-8ct (grid-wide undo/redo): NO pass-through wrapper lands here for
  // undo/redo/canUndo/canRedo/clearHistory. Unlike `cut` above (which delegates to a
  // differently-named clipboardFill export, `cutRange`), the undoHistory.rzts exports already
  // use the exact public verb names and are already component-scope (imported directly into
  // DataTable.rozie) — so DataTable.rozie's $expose references them BY NAME with zero
  // indirection. This file stays the seam for verbs that need a rename/adapter, not a mandatory
  // stop for every $expose entry.
  // interactionMode gate. 'grid' lights up roving nav; 'table' (default) is byte-behaviorally
  // identical to phase 48 (roles fall back to the literals, tabindex drops).
  const isGrid = useCallback(() => props.interactionMode === 'grid', [props.interactionMode]);
  // Role computeds (RESEARCH Pattern 4). The 'table' branch returns the EXACT phase-48
  // literal so 'table'-mode DOM is unchanged. Header cells keep 'columnheader' and rows keep
  // 'row'/'rowgroup' in BOTH modes (APG grid) — those stay static literals in the template.
  function tableRole() {
    return isGrid() ? 'grid' : 'table';
  }
  function cellRole() {
    return isGrid() ? 'gridcell' : 'cell';
  }

  // ── Cell addressing helpers (plain fns — no $computed alias trap; safe in template) ────
  // rowIndexOf: a body row's index over the visible model ($data.rows). tick() puts the read
  // in the fine-grained reactive scope (Solid/Lit) so the data-row marker re-derives on a
  // re-pull (reorder/filter) — matching visibleCellsFor's discipline.
  function rowIndexOf(row: any) {
    return tick() >= 0 ? (rows || []).indexOf(row) : -1;
  }
  // colIndexOf: a body cell's position in its row's visible cell list.
  function colIndexOf(row: any, cellCtx: any) {
    return tick() >= 0 ? visibleCellsFor(row).indexOf(cellCtx) : -1;
  }
  // headerColIndexOf: a header cell's position in its header group's leaf headers.
  function headerColIndexOf(hg: any, header: any) {
    return (hg && hg.headers ? hg.headers : []).indexOf(header);
  }

  // ── C1 (phase 63 wave-6) absolute-index bridge ─────────────────────────────────────────
  // The PUBLIC active-cell rowIndex (focusCell/getActiveCell/activecell-change) is the ABSOLUTE
  // display-order position in getPrePaginationRowModel().rows (filter+sort+expand applied, BEFORE
  // pagination/windowing), in BOTH paginated and virtual modes — reversing the old page-relative
  // paginated meaning. INTERNALLY $data.activeRow stays PAGE-RELATIVE in the non-virtual paginated
  // body (the data-row markers + the nav math index the page slice) and FULL-MODEL in virtual mode
  // (the wr.vi.index space). pageRowOffset() bridges the two so the API speaks one absolute language.
  //   - virtual mode: activeRow is already the full pre-pagination index → offset 0.
  //   - non-virtual:  activeRow is page-relative → offset = pageIndex * pageSize.
  // isGrid()-gated (the active-cell API is grid-only); pageIndex()/pageSize() read live table-core
  // state through the reactive tick (filterPaginationRowChrome), so this re-derives on a page change.
  function pageRowOffset() {
    if (!isGrid() || rowsWindowed()) return 0;
    return pageIndex() * pageSize();
  }
  // page-relative active row → absolute (display-order) index.
  function toAbsRow(localRow: any) {
    return localRow + pageRowOffset();
  }
  // A body row's ABSOLUTE display-order index = its page-relative index + the page offset. Drives
  // aria-rowindex on the non-virtual paginated body (B27); the virtual path uses wr.vi.index
  // directly (already absolute). Reactive via rowIndexOf's tick().
  // Total filtered+sorted PRE-pagination row count — the clamp bound for an absolute focusCell.
  // In virtual mode $data.rows IS the full pre-pagination model (bodyRowCount suffices); in the
  // non-virtual paginated body $data.rows is only the page slice, so read the live model.
  function prePaginationRowCount() {
    if (!table.current || rowsWindowed()) return bodyRowCount();
    const pm = table.current.getPrePaginationRowModel();
    return pm && pm.rows ? pm.rows.length : bodyRowCount();
  }

  // Roving tabindex (RESEARCH Code Examples). Reads ONLY reactive $data (ROZ123-safe,
  // fine-grained-reactive). Returns null in 'table' mode → the bound numeric attribute
  // DROPS entirely (IN-01: on React via the `cellTabindex(...) ?? undefined` numeric-attr
  // emitter path landed in 4bec3b8e — NOT rozieAttr, which would string-widen tabIndex and
  // TS2322; the other five targets drop it via their own nullish-attr handling), keeping
  // 'table'-mode DOM clean. rowKey is the literal
  // '__header' for header cells or the String(bodyRowIndex) for body cells, so the active
  // header state (activeIsHeader) is addressable through the same computed.
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

  // ── Active-cell ring predicate (grid pointer §1, 260708-ni6) ───────────────────────────
  // isActiveCell mirrors cellTabindex's ACTIVE branch (the same (rowKey, colIndex, level)
  // address tuples the roving tabindex uses) but returns a BOOLEAN for the `.rdt-cell-active`
  // :class binding, and is STATE-DRIVEN — so the ring shows identically on click AND keyboard
  // (independent of :focus-visible, which browsers gate off for a mouse-focused non-text <td>).
  // It DELIBERATELY omits cellTabindex's B6 empty-grid / header-fallback branch: the ring must
  // NOT light on an empty grid's synthetic tab-stop (there is no real active cell there). Reads
  // ONLY reactive $data (ROZ123-safe, fine-grained). Returns false in 'table' mode so table-mode
  // markup is byte-behaviorally unchanged. Header cells are active only while activeIsHeader is
  // true (addressed by BOTH colIndex and level — a grouped multi-level header carries exactly one
  // ring); body cells only while activeIsHeader is false.
  function isActiveCell(rowKey: any, colIndex: any, level = null) {
    if (!isGrid()) return false;
    if (activeIsHeader) {
      if (rowKey !== '__header') return false;
      return colIndex === activeColIndex && level === activeHeaderLevel;
    }
    if (rowKey === '__header') return false;
    return rowKey === String(activeRow) && colIndex === activeColIndex;
  }

  // ── The focus SEAM (RESEARCH Pattern 1 + 3, req-6) ─────────────────────────────────────
  // resolveCellEl: index pair → DOM element, via a data-* attribute query off the stable
  // post-mount root. Uniform on all six, shadow-safe (the query runs from inside the
  // component's own scope). rowKey is the literal '__header' or a String(integer index) and
  // colIndex is an integer — NO consumer string is interpolated into the selector (T-49-01).
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

  // focusActiveCell: THE single DOM-focus-resolution path (req-6). Every focus change —
  // the D-04 entry cell here, and (plan 03) arrow nav / focusCell() / the data-change clamp —
  // routes through this one function, so a verifier can point to it and phase 53 windowing
  // hooks it without a rewrite. Accepts OPTIONAL explicit (nextRow,nextCol) so callers can
  // pass FRESH post-write locals (React ROZ138 / Angular signal async — pinned by plan 01);
  // falls back to $data when none passed. NEVER stores a DOM node (index-only state).
  // 260618-ao9 — params carry explicit `= null` defaults so the cross-target
  // emitters type them OPTIONAL (untyped params lower to REQUIRED `any`, making the
  // 2-arg `focusActiveCell(r, c)` call sites a TS2554 on React/Solid/Lit — a
  // pre-existing regression from the d7166c5e header-crossing `nextIsHeader` add).
  // The `= null` default reproduces the documented "falls back to $data when
  // omitted" contract: an omitted arg arrives as `null`, and the body's `== null`
  // checks already route those to the live `$data` value — behavior-identical.
  function focusActiveCell(nextRow = null, nextCol = null, nextIsHeader = null, nextLevel = null) {
    if (!isGrid() || !gridRoot.current) return;
    // #9 focus-intent epoch: focusActiveCell is THE single seam every keyboard nav re-asserts
    // focus through, so it establishes a fresh "where focus should be" on every call — bump the
    // epoch here (BEFORE arming the virtual-scroll focusWhenReady poll below). A SUBSEQUENT
    // focusActiveCell (the next user nav) bumps again → any pending focusWhenReady captured the
    // OLD value → aborts instead of yanking focus back. The poll captures the POST-bump value so
    // a lone scroll-to-focus with no later nav still lands (epoch stable across its own frames).
    focusIntentEpoch.current = focusIntentEpoch.current + 1;
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
    if (rowsWindowed() && virtualizer.current && !header && rowIsOutsideWindow(r)) {
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
      // cannot re-introduce the remeasure-vs-scroll fight. Inside the rowsWindowed() guard only.
      let focusAttempts = 0;
      // #9: capture the epoch AFTER this call's own bump (above) so the poll never aborts itself
      // (its captured value equals the current epoch). A LATER focusActiveCell / focusCell /
      // active-cell-moving focusin bumps the epoch → the check below aborts this stale poll.
      const myEpoch = focusIntentEpoch.current;
      const focusWhenReady = () => {
        // A newer focus intent superseded this poll — abort WITHOUT focusing (the user has since
        // navigated / clicked elsewhere; re-focusing this off-window target would yank focus back).
        if (focusIntentEpoch.current !== myEpoch) return;
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

  // ══ Grid keyboard navigation (phase 49 plan 03 — RESEARCH Pattern 5 + the delegated handler) ═══
  // The nav model is plain ARRAY-INDEX MATH over the VISIBLE model. table-core has already
  // done the hard part: $data.rows (body) and $data.headerGroups (header) hold the visible,
  // reordered, pinned cell set (row.getVisibleCells() / getHeaderGroups()) — hidden columns
  // are ALREADY ABSENT, reorder/pinning is ALREADY REFLECTED (REQ-7). There is NO separate
  // "compute visible order" step. Every index is clamped to [0,max] so an out-of-range key
  // never throws or builds an injection-shaped selector (Security V5 / T-49-03).

  // IN-01: aria-rowcount for the NON-VIRTUAL table. The virtual table binds $data.rows.length
  // (the full pre-pagination model). For the non-virtual path $data.rows is the PAGINATED slice,
  // so report the FILTERED (pre-pagination) total instead — the count AT users need to know "row N
  // of TOTAL". Falls back to $data.rows.length pre-mount (table is null until $onMount).
  // NB the helper is named `totalRowCount`, NOT `ariaRowCount`: `ariaRowCount` is an inherited
  // HTMLElement ARIA-reflected property (`Element.ariaRowCount: string`), so a same-named method
  // becomes a class field that shadows it on Lit → TS2416 cascades to EVERY @property decorator
  // (the `valueOf`/`nodeType` inherited-DOM-member collision class, authoring playbook §6).
  function totalRowCount() {
    if (!table.current) return (rows || []).length;
    const fm = table.current.getFilteredRowModel();
    return fm && fm.rows ? fm.rows.length : (rows || []).length;
  }

  // ── A11y row bookkeeping (#13): consistent aria-rowindex / aria-rowcount ──────────────
  // WAI-ARIA: when aria-rowcount is set on the grid/table, EVERY row (header rows + body rows)
  // must carry an aria-rowindex, and aria-rowcount must equal the total number of rows INCLUDING
  // the header rows. Before this fix aria-rowcount was set unconditionally to totalRowCount() but
  // aria-rowindex was grid-only — so a paginated 'table'-mode grid advertised e.g. rowcount=100
  // while its 10 visible rows carried NO index (SR announced "row 1..10 of 100" on the LAST page).
  //   headerRowCount = the columnheader rows ($data.headerGroups — a grouped/multi-level header is
  //     >1; the role="presentation" filter row is NOT a row and is excluded).
  //   gridAriaRowCount = header rows + the FILTERED pre-pagination data total → equals the largest
  //     aria-rowindex any body row carries, so count and indices are always mutually consistent.
  // NB the helpers are gridAriaRowCount / bodyAriaRowIndex, NOT ariaRowCount / ariaRowIndex: the
  // latter collide with the inherited HTMLElement.ariaRowCount / .ariaRowIndex reflected properties
  // on Lit (TS2416 — the same inherited-DOM-member collision class as totalRowCount's rename note).
  function headerRowCount() {
    return (headerGroups || []).length;
  }
  function gridAriaRowCount() {
    return headerRowCount() + totalRowCount();
  }
  // Page offset that is MODE-INDEPENDENT (works in BOTH 'table' and 'grid' mode), unlike
  // pageRowOffset() which is isGrid()-gated for the active-cell API. In the non-virtual body
  // $data.rows is only the page slice, so a data row's ABSOLUTE index = its page-relative
  // rowIndexOf + this offset. Virtual mode never reaches here (that body uses wr.vi.index).
  function ariaPageOffset() {
    return table.current ? pageIndex() * pageSize() : 0;
  }
  // A non-virtual body row's 1-based aria-rowindex: the header rows come first (headerRowCount),
  // then the absolute (page-aware) 0-based data index, +1 to 1-base it. Present in BOTH modes so
  // it is always consistent with gridAriaRowCount. The virtual body binds
  // `headerRowCount() + wr.vi.index + 1` inline (wr.vi.index is already the absolute full-model index).
  function bodyAriaRowIndex(row: any) {
    return headerRowCount() + rowIndexOf(row) + ariaPageOffset() + 1;
  }

  // Column count = the visible cell list length (uniform header+body in a flat grid). Reads
  // $data.rows (reactive) so it is fine-grained-correct on Solid/Lit; falls back to the
  // header leaf count when there are no body rows.
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

  // ── Multi-level (grouped) header addressing (B12) ──────────────────────────────────────
  // $data.headerGroups is ordered top→bottom; the LEAF header row (the one adjacent to the
  // body) is the LAST group. The roving active-header state carries activeHeaderLevel (the
  // group index) alongside activeColIndex (the index within THAT level's headers) so the
  // single-tab-stop invariant + ArrowUp parent-resolution span every header level — a flat
  // grid has one level (leafLevel 0), so the table-mode/flat path is unchanged.
  function headerLeafLevel() {
    const hg = headerGroups || [];
    return hg.length ? hg.length - 1 : 0;
  }
  // #10: the number of header cells AT a given level. A grouped PARENT level may have FEWER
  // headers than there are leaf columns (one parent spans several leaves), so horizontal nav on a
  // non-leaf header must clamp against THIS count — not visibleColCount() (the leaf-column count),
  // which would let ArrowRight/End overrun into a phantom (null) cell → focus dropped to <body>.
  // Degenerate cases (no headerGroups, level out of range) fall back to visibleColCount() so the
  // clamp is never negative or NaN. The LEAF level's count equals visibleColCount() (one header per
  // visible leaf column), so leaf-header + body horizontal nav is byte-behaviorally unchanged.
  function headerCountAtLevel(level: any) {
    const hg = headerGroups || [];
    if (!hg.length) return visibleColCount();
    const grp = level >= 0 && level < hg.length ? hg[level] : null;
    if (!grp || !grp.headers) return visibleColCount();
    return grp.headers.length;
  }
  function headerAt(level: any, colIndex: any) {
    const hg = headerGroups || [];
    const grp = hg[level];
    if (!grp || !grp.headers) return null;
    return grp.headers[colIndex] || null;
  }
  // ArrowUp from a (level, colIndex) leaf/child header → the index of its PARENT header in the
  // level above (the parent column that spans it, via table-core header.column.parent). -1 when
  // there is no real parent (already at the top, or a placeholder with no group) → the caller
  // keeps the active header where it is.
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
  // ArrowDown from a (level, colIndex) GROUP header → the index of its FIRST child header in the
  // level below (via table-core column.columns). -1 when the header has no child columns (a leaf)
  // → the caller drops into the body instead.
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

  // ── Nav helpers: compute the NEXT indices into LOCAL consts, write $data from them, and
  // RETURN the fresh locals so the caller threads the SAME values into BOTH focusActiveCell
  // AND the activecell-change emit. NEVER re-read $data.activeRow/activeColIndex after the
  // write (React setState is async — ROZ138 — the re-read binds the PRE-write value; Angular
  // signal writes are async too — both proven live by plan 01's probe). ──────────────────────

  // ArrowRight/Left — clamp colIndex over [0, visibleColCount()-1] (no wrap; hidden cols
  // already excluded from the visible list per REQ-7).
  function moveCol(delta: any) {
    // #10: when a grouped PARENT header is active, clamp against the header count AT THE ACTIVE
    // LEVEL (which may be fewer than the leaf-column count) so ArrowRight never overruns onto a
    // phantom cell past that level's headers. Body cells + the leaf header level keep visibleColCount().
    const count = activeIsHeader ? headerCountAtLevel(activeHeaderLevel) : visibleColCount();
    const max = count - 1;
    const nextCol = clamp(activeColIndex + delta, 0, max < 0 ? 0 : max);
    setActiveColIndex(nextCol);
    return nextCol;
  }

  // ArrowUp/Down + PageUp/Down — cross the header boundary and clamp at body edges (no
  // page-cross per D-06/REQ-7). Returns { row, isHeader } fresh locals.
  //  - From the header, ArrowDown (delta>0) drops into body row 0 (activeIsHeader=false).
  //  - From body row 0, ArrowUp (delta<0) crosses into the header (activeIsHeader=true).
  //  - PageUp/Down jump by ±GRID_PAGE_STEP, clamped to the current page bounds (no cross).
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

  // Home/End within the current row → col 0 / max. Returns the fresh colIndex.
  function gotoColEdge(toEnd: any) {
    // #10: End on a grouped PARENT header lands on that level's LAST header (headerCountAtLevel-1),
    // not the leaf-column max — otherwise the ring strands on a phantom cell past the level's
    // headers. Home is index 0 either way. Body cells + the leaf header level keep visibleColCount().
    const count = activeIsHeader ? headerCountAtLevel(activeHeaderLevel) : visibleColCount();
    const max = count - 1;
    const nextCol = toEnd ? max < 0 ? 0 : max : 0;
    setActiveColIndex(nextCol);
    return nextCol;
  }

  // gotoRowEdge(toEnd): the §8 (260709-3qt) Ctrl+ArrowUp/Down vertical region-edge jump — move the
  // active cell to the data-region row edge (row 0 / last body row) in the CURRENT column, mirroring
  // gotoColEdge's horizontal edge jump. Body cells only (the caller gates on !activeIsHeader); always
  // lands in the body (activeIsHeader=false). Returns the fresh row index for the shared focus seam.
  function gotoRowEdge(toEnd: any) {
    const lastRow = bodyRowCount() - 1;
    const nextRow = toEnd ? lastRow < 0 ? 0 : lastRow : 0;
    setActiveRow(nextRow);
    setActiveIsHeader(false);
    return nextRow;
  }

  // Ctrl+Home → first body cell (0,0); Ctrl+End → last body cell (lastRow,max). Returns the
  // fresh { row, col } locals. Both land in the body (activeIsHeader=false).
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

  // Resolve the active cell element (for the in-cell trap) — uses the same data-* query as
  // the focus seam. rowKey is the literal '__header' or String(integer) — no consumer string.
  function currentCellEl() {
    const rowKey = activeIsHeader ? '__header' : String(activeRow);
    return resolveCellEl(rowKey, activeColIndex, activeIsHeader ? activeHeaderLevel : null);
  }

  // Enter/F2 → enter interaction mode: focus the active cell's FIRST interactive control
  // (D-07 — uniform for header sort buttons and body controls; Enter does NOT sort directly).
  // No-op (stay in navigation mode) if the cell has no focusable control.
  function enterControl() {
    const cellEl = currentCellEl();
    const list = focusables(cellEl);
    if (!list.length) return;
    setActiveInControl(true);
    list[0].focus();
  }

  // Cycle focus among the controls WITHIN the active cell (D-08 focus containment) — Tab
  // forward / Shift+Tab backward, wrapping at the ends. Uses the plan-01-PROVEN per-target
  // activeElement read: gridRoot.getRootNode().activeElement is the UNIFORM correct read on
  // ALL SIX (document in light DOM; the shadow root on Lit). Reuse verbatim — do NOT re-derive.
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
  // THE single delegated keydown handler (RESEARCH "Single delegated keydown handler"). Wired
  // as ONE keydown listener on the <table> root — NOT per-cell, NOT with .stop/.prevent modifiers (the
  // Angular .stop-in-@for hoist bug, F5/ROZ723). e.preventDefault() is called IMPERATIVELY for
  // handled keys. Each nav helper writes $data and RETURNS the fresh post-write locals; those
  // SAME locals feed BOTH focusActiveCell AND the activecell-change emit (no $data re-read).
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
    // ── §8 (260709-3qt) Ctrl/Cmd+Arrow — jump the active cell to the data-region edge (plain
    // Ctrl) or EXTEND the range to that edge (Ctrl+Shift). Body cells only (a header-active
    // Ctrl+Arrow falls through to the plain-arrow branches unchanged). Tested BEFORE the
    // Shift+Arrow / plain-arrow cascade so the modifier combo is matched first. preventDefault
    // suppresses the browser's native Ctrl+Arrow scroll/word-jump. The Ctrl+Shift branch owns
    // extendRange's focus + range-change emit (returns); the plain-Ctrl branch sets the fresh
    // nextRow/nextCol locals and FALLS THROUGH to the shared focus seam (like Ctrl+Home/End). ──
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !activeIsHeader && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault();
      if (key === 'ArrowUp') extendRange(-activeRow, 0);else if (key === 'ArrowDown') extendRange(bodyRowCount() - 1 - activeRow, 0);else if (key === 'ArrowLeft') extendRange(0, -activeColIndex);else extendRange(0, visibleColCount() - 1 - activeColIndex);
      return;
    } else if ((e.ctrlKey || e.metaKey) && !activeIsHeader && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault();
      clearRange();
      if (key === 'ArrowUp') {
        nextRow = gotoRowEdge(false);
        nextIsHeader = false;
      } else if (key === 'ArrowDown') {
        nextRow = gotoRowEdge(true);
        nextIsHeader = false;
      } else if (key === 'ArrowLeft') {
        nextCol = gotoColEdge(false);
      } else {
        nextCol = gotoColEdge(true);
      }
    } else if (key === 'ArrowRight' && e.shiftKey && !activeIsHeader) {
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
    // ── 260709-8ct (grid-wide undo/redo) — Ctrl/Cmd+Z undoes; Ctrl/Cmd+Y OR Ctrl/Cmd+Shift+Z
    // redoes. Undoable-gated (`$props.undoable`) — when off, neither preventDefault nor
    // undo()/redo() runs, so a shipped grid with undoable unset is byte-behaviorally unchanged
    // (the browser's own native undo/redo, if any, still fires). NOT clipboardActiveAllowed-
    // gated (unlike Ctrl+C/V/X/Delete above): undo/redo is GRID-WIDE and must work regardless of
    // whether a header or body cell is active. Tested the Ctrl+Shift+Z (redo) combo BEFORE the
    // plain Ctrl+Z (undo) branch so a Shift+Z never falls into undo.
    else if ((key === 'z' || key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (props.undoable) {
        e.preventDefault();
        redo();
        return;
      }
    } else if ((key === 'y' || key === 'Y') && (e.ctrlKey || e.metaKey)) {
      if (props.undoable) {
        e.preventDefault();
        redo();
        return;
      }
    } else if ((key === 'z' || key === 'Z') && (e.ctrlKey || e.metaKey)) {
      if (props.undoable) {
        e.preventDefault();
        undo();
        return;
      }
    }
    // ── §7 (260709-3qt) — Delete/Backspace CLEARS the active cell / range through the SAME
    // write-funnel as Cut (applyGridToRange of an empty grid), MINUS the clipboard copy. B11-gated
    // by clipboardActiveAllowed so a header-active Delete/Backspace falls through to NATIVE behavior
    // (never a silent body mutation). The top-of-handler editing early-returns + the line-39
    // data-grid-cell guard keep this to navigation mode; applyGridToRange skips read-only/non-editable
    // cells. Reversible via Ctrl+Z when `undoable` is on (260709-8ct) — clearActiveRange funnels
    // through the SAME writeData seam undo/redo replay through, so no separate inverse machinery
    // is needed here.
    else if ((key === 'Delete' || key === 'Backspace') && clipboardActiveAllowed()) {
      e.preventDefault();
      clearActiveRange();
      return;
    }
    // ── §8 (260709-3qt) — Ctrl/Cmd+A selects the WHOLE BODY range (drives the same range corners
    // shift+arrow uses). preventDefault ALWAYS so the page is never selected in grid mode; only a
    // body-active Ctrl+A builds the range (a header-active Ctrl+A is a no-op — selects nothing). ──
    else if ((key === 'a' || key === 'A') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!activeIsHeader) selectAllBody();
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
    // ── Boolean in-place toggle (design doc 2026-07-05, Change 1) — a built-in
    // editor:'checkbox' cell toggles + commits INSTANTLY on Space/Enter/F2, no editor opens
    // (the spreadsheet-standard shape for a two-state value). Tested BEFORE the generic
    // Enter/F2 edit-entry branch below (a checkbox cell must never fall into the open-an-
    // editor ceremony) and gated the SAME way (isActiveCellEditable) plus editorTypeOf ===
    // 'checkbox'. Full-row edit mode is unaffected — the editingRowIndex early return at the
    // top of onGridKeyDown already excludes it.
    else if ((key === 'Enter' || key === 'F2' || key === ' ') && isActiveCellEditable() && editorTypeOf(activeCellColumnId()) === 'checkbox') {
      e.preventDefault();
      toggleActiveBooleanCell();
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
    } else if (isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && editorTypeOf(activeCellColumnId()) !== 'checkbox') {
      // B24: a printable key only SEEDS a draft on a free-text editor (text/number). A
      // checkbox/select/date editor must NOT take the typed char as its value (it would
      // force-check the checkbox, seed a garbage select option, or corrupt the date) — open
      // those with the EXISTING value (seed=null), identical to the F2/Enter in-place entry.
      // Checkbox is excluded entirely (type-to-edit disabled — the branch above already
      // handles Space/Enter/F2; any OTHER printable key on a checkbox cell is a no-op).
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
      // guardMoved=true: the group header row is UNCHANGED by its own collapse, so a stale late
      // rAF poll must not steal focus back after the user has already ArrowDown'd to another row.
      recoverGridFocus(String(grpRow), grpCol, null, true);
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
      // Mirror getActiveCell's shape (this payload + getActiveCell are documented to speak the
      // SAME language): a header cell has no body-row index, so emit rowIndex:null + isHeader:true
      // rather than a bogus toAbsRow(nextRow) — which would compute a real body-row absolute index
      // for a HEADER move, misleading a consumer into thinking that body row is the active cell.
      _rozieProp_onActivecellChange && _rozieProp_onActivecellChange(nextIsHeader ? {
        rowIndex: null,
        colIndex: nextCol,
        isHeader: true
      } : {
        rowIndex: toAbsRow(nextRow),
        colIndex: nextCol,
        isHeader: false
      });
    }
  }, [_rozieProp_onActivecellChange, activeCellColumnId, activeColIndex, activeHeaderLevel, activeInControl, activeIsHeader, activeRow, beginEdit, beginRowEdit, bodyRowCount, clearActiveRange, clearRange, clipboardActiveAllowed, copyRange, currentCellEl, cutRange, cycleWithinCell, editingRow, editingRowIndex, editorTypeOf, enterControl, extendRange, focusActiveCell, gotoColEdge, gotoEnd, gotoRowEdge, gotoStart, isActiveCellEditable, isGrid, moveCol, moveRow, onToggleExpand, pasteRange, props.undoable, recoverGridFocus, redo, rowIsGrouped, rows, selectAllBody, toAbsRow, toggleActiveBooleanCell, undo, visibleColCount]);
  // WR-03: integrate mouse-click + programmatic focus with the roving model. A click on a
  // tabindex="-1" cell (or focus arriving any way other than the keyboard nav path) moves
  // DOM focus there but does NOT run onGridKeyDown — so activeRow/activeColIndex would stay
  // on the OLD cell and the NEXT arrow key would jump from the stale active cell. Wired as
  // ONE @focusin on the <table> root (focusin bubbles): resolve the focused element's owning
  // [data-grid-cell], parse its data-row/data-col-index, and write them into the active-cell
  // state (mirroring the keyboard path). Clears activeInControl ONLY when the cell ITSELF
  // (not an inner control) received focus — focusing a control via Enter keeps the in-control
  // flag. NEVER emits activecell-change (a focus sync is not a keyboard navigation event).
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
    // #9: snapshot the PRE-write active position so we can bump the focus-intent epoch ONLY when
    // this focusin genuinely MOVES the active cell (a click landing on a NEW cell). A no-op focusin
    // — focus arriving on the ALREADY-active cell, e.g. a scroll/page-switch poll's own el.focus()
    // or focusActiveCell's synchronous re-seat — must NOT bump, or it would abort a legitimate
    // in-flight recovery on its own settling frames (the poll would see a changed epoch and quit).
    const prevIsHeader = activeIsHeader;
    const prevRow = activeRow;
    const prevCol = activeColIndex;
    const prevLevel = activeHeaderLevel;
    const isHeader = rowAttr === '__header';
    setActiveIsHeader(isHeader);
    let movedRow = prevRow;
    let movedLevel = prevLevel;
    if (isHeader) {
      // B12: a click/focus onto a grouped header cell must capture its header LEVEL too, so the
      // roving model + a subsequent ArrowUp/ArrowDown resolve from the correct level (not a stale
      // one). data-header-level is an integer marker on the <th>; fall back to the leaf level.
      const lvlAttr = cellEl.getAttribute('data-header-level');
      const lvl = lvlAttr != null ? parseInt(lvlAttr, 10) : headerLeafLevel();
      movedLevel = Number.isFinite(lvl) ? lvl : headerLeafLevel();
      setActiveHeaderLevel(movedLevel);
    } else {
      const row = parseInt(rowAttr, 10);
      if (Number.isFinite(row)) {
        movedRow = row;
        setActiveRow(row);
      }
    }
    setActiveColIndex(col);
    // #9: a genuine active-cell MOVE is a fresh focus intent — supersede any pending async focus
    // poll (scroll-to / page-switch). Compare against the PRE-write snapshot: bump only when the
    // header-flag, column, or (per mode) the header LEVEL / body ROW actually changed.
    if (isHeader !== prevIsHeader || col !== prevCol || (isHeader ? movedLevel !== prevLevel : movedRow !== prevRow)) {
      focusIntentEpoch.current = focusIntentEpoch.current + 1;
    }
    // A plain focus collapses any range back to the single active cell — EXCEPT (a) the
    // programmatic settle of an in-flight extendRange (rangeTransition): that focus move lands
    // ON the new range-focus corner and must NOT wipe the range we just set; and (b) the
    // focusin that follows a Shift+Click (rangeClickPending): @mousedown already set the range
    // BEFORE this focusin fires, and a focusin carries no reliable shiftKey, so the @mousedown
    // path owns the shift case and flags it here so the collapse is skipped.
    if (rangeTransition.current) {
      rangeTransition.current = false;
    } else if (rangeClickPending.current) {
      rangeClickPending.current = false;
    } else {
      clearRange();
    }
    // The cell box (not an inner control) receiving focus = navigation mode.
    if (tgt === cellEl) setActiveInControl(false);
  }, [activeColIndex, activeHeaderLevel, activeIsHeader, activeRow, clearRange, headerLeafLevel, isGrid]);
  // onGridMouseDown: the pointer range seam (phase 51 req-7 / D-07 Shift+Click; §6 260709-3qt
  // plain drag-to-select). A focusin event carries no reliable `shiftKey`, so the modifier MUST
  // be read off the pointer event — @mousedown fires BEFORE the cell's focusin and DOES carry
  // shiftKey. A shift-held mousedown on a BODY cell sets the range's moving corner to that cell
  // (keeping the anchor), then flags rangeClickPending so the follow-up focusin does not collapse
  // the range. A PLAIN (non-shift) mousedown BEGINS a drag-select anchored at that cell (§6): the
  // document pointermove/up listeners paint the range as the pointer moves. The fill handle owns
  // its own @pointerdown drag (it stops propagation), so a plain mousedown originating inside it is
  // skipped. Do NOT preventDefault — native focus must still land (focusin sync + roving tabindex).
  const onGridMouseDown = useCallback((e: any) => {
    if (!isGrid() || !e) return;
    const tgt = e.target;
    if (!tgt || !tgt.closest) return;
    // §6: a plain mousedown inside the fill handle is owned by the handle's own pointerdown drag —
    // never begin a range paint from it (the shift path never lands on the 8px handle).
    if (!e.shiftKey && tgt.closest('[data-fill-handle]')) return;
    const cellEl = tgt.closest('[data-grid-cell]');
    if (!cellEl) return;
    const rowAttr = cellEl.getAttribute('data-row');
    const colAttr = cellEl.getAttribute('data-col-index');
    if (rowAttr == null || colAttr == null || rowAttr === '__header') return;
    const row = parseInt(rowAttr, 10);
    const col = parseInt(colAttr, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    if (e.shiftKey) {
      // Shift+Click: set the moving corner (keeping the anchor) and flag rangeClickPending so the
      // follow-up focusin does not collapse the range (a focusin carries no reliable shiftKey).
      setRangeFocus$local(row, col);
      setActiveIsHeader(false);
      setActiveRow(row);
      setActiveColIndex(col);
      rangeClickPending.current = true;
      return;
    }
    // §6 plain mousedown → begin a document-level drag-select anchored at this cell. The mousedown's
    // native focusin commits the ACTIVE cell to (row,col); beginRangeDrag's first cross-cell
    // pointermove paints the range via setRangeFocus (anchored at the active cell). A mousedown with
    // no move collapses to a single active cell (no range).
    beginRangeDrag(row, col);
  }, [beginRangeDrag, isGrid, setRangeFocus$local]);
  // onGridDblClick: the double-click-into-edit seam (grid pointer §3+§5, 260708-ni6). Wired as
  // ONE @dblclick on the <table> root (mirroring the already-delegated @mousedown/@focusin). A
  // double-click on a BODY cell either toggles a group (group-header cell) or opens the editor
  // (editable cell); a non-editable body cell is a no-op (the cell stays active — its focusin
  // already set the active state + the §1 ring). Header cells return early so they keep their
  // native sort/menu/resize semantics. Reuses the SAME closest/parse/finite guards as
  // syncActiveFromEvent and the SAME beginEdit / onToggleExpand funnels the keyboard path uses —
  // no new edit or expand machinery. isGrid()-gated so 'table' mode never runs it.
  const onGridDblClick = useCallback((e: any) => {
    if (!isGrid() || !e) return;
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
    // NB the local is `rowObj` (NOT `activeRow`): $data.activeRow lowers to the bare React state
    // binding `activeRow`, so a `const activeRow = …` local self-shadows it (TS2448 TDZ — the
    // visibleColCount `rowList` self-shadow class). ($data.rows || [])[row] is the active flattened
    // row (page-relative non-virtual / full-model virtual — both index $data.rows, matching the C2
    // Enter-on-group path + syncActiveFromEvent's row parse).
    const rowObj = (rows || [])[row];
    if (rowIsGrouped(rowObj)) {
      // Group-header cell → toggle its collapse/expand through the SAME onToggleExpand funnel the
      // chevron uses (mirrors the C2 Enter-on-group path verbatim), then re-seat focus after the
      // re-render (guardMoved=true — the group-header row is unchanged by its own collapse, so a
      // stale late rAF must not steal focus back after a subsequent nav).
      e.preventDefault();
      onToggleExpand(rowObj, e);
      recoverGridFocus(String(row), col, null, true);
      return;
    }
    // Editable body cell → open its editor (seed=null → seed the EXISTING value, the in-place F2/
    // Enter entry). A non-editable body cell is a no-op: the cell stays active (focusin already set
    // it + the §1 ring), matching the spreadsheet display-vs-edit convention.
    const colId = columnIdAt(row, col);
    if (colId != null && columnEditable(colId)) {
      e.preventDefault();
      beginEdit(row, col, null);
    }
  }, [beginEdit, columnEditable, columnIdAt, isGrid, onToggleExpand, recoverGridFocus, rowIsGrouped, rows]);
  // onGridClick: the opt-in single-click-to-edit seam (grid pointer §4, 260708-ni6). Only active
  // when the `singleClickEdit` prop is true (default false, negative-opt-out). Wired as ONE @click
  // on the <table> root — @click fires on a genuine mouseup-no-drag click (NOT @mousedown), which
  // honors the deferred §6 drag guard (a mousedown that begins a drag-select must not open an
  // editor). A plain click on an EDITABLE body cell opens its editor via the SAME beginEdit funnel;
  // shift+click (range extend) and non-editable cells are unaffected. Same closest/parse/header-skip
  // /finite guards as onGridDblClick. isGrid()-gated so 'table' mode never runs it.
  const onGridClick = useCallback((e: any) => {
    if (!isGrid() || !e) return;
    if (!props.singleClickEdit) return;
    if (e.shiftKey) return;
    // §6 (260709-3qt): a drag-select that MOVED must never open the editor — the editor opens only
    // on a genuine mouseup-no-drag click. beginRangeDrag resets rangeDragMoved=false per gesture, so
    // the flag is always fresh; consume it here so a subsequent plain click still edits.
    if (rangeDragMoved.current) {
      rangeDragMoved.current = false;
      return;
    }
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
    // Already editing THIS exact cell → no-op (a click inside an open editor must not re-open it).
    if (editingRow === row && editingCol === col) return;
    const colId = columnIdAt(row, col);
    if (colId != null && columnEditable(colId)) beginEdit(row, col, null);
  }, [beginEdit, columnEditable, columnIdAt, editingCol, editingRow, isGrid, props.singleClickEdit]);
  // WR-02: reset the interaction-mode flag when focus leaves the active cell's subtree.
  // Without this, activeInControl could stick `true` — a mouse click OUTSIDE the cell, or
  // the focused inner control being removed from the DOM — leaving onGridKeyDown wedged in
  // the in-cell-trap branch so arrow nav is dead until Escape. Wired as ONE @focusout on
  // the <table> root (focusout bubbles, unlike blur). relatedTarget is the element RECEIVING
  // focus (null when focus leaves the document / is retargeted across a shadow boundary). If
  // focus is NOT moving to a descendant of the active cell, drop the flag. A Tab-cycle WITHIN
  // the cell (interaction mode) keeps relatedTarget inside cellEl → no reset.
  const onGridFocusOut = useCallback((e: any) => {
    if (!isGrid() || !activeInControl) return;
    const next = e ? e.relatedTarget : null;
    const cellEl = currentCellEl();
    if (!cellEl || !next || !cellEl.contains(next)) setActiveInControl(false);
  }, [activeInControl, currentCellEl, isGrid]);
  // B25: re-focus a resolved valid cell AFTER a programmatic shrink re-renders. The clamp
  // runs synchronously BEFORE the framework commits the new tbody, so a deferred rAF-poll
  // resolves the [data-row][data-col-index] cell off gridRoot once it has rendered (the fast
  // targets land on attempt 1; React/Solid retry across the async commit). Mirrors
  // focusCellWhenReady (B23) — DOM-only (reads gridRoot), so it is React-stale-safe.
  // guardMoved (default false): when true, the poll does NOT stomp focus that a later nav has
  // already moved to a DIFFERENT, STILL-VALID row — used only by the group-collapse re-seat (the
  // target group-header row is unchanged, so a stale late rAF must not steal focus back after the
  // user ArrowDown'd away → the non-deterministic treegrid collapsed-nav focus-theft). It is left
  // OFF for the B25 shrink-recovery site, whose target is a CLAMPED index of a now-REMOVED cell:
  // there focus legitimately sits on the doomed old cell (a different row) mid-async-render on
  // React and MUST be recovered onto the clamped survivor, not preserved. Compare data-row (NOT
  // node identity) so a stale SAME-row cell on Solid's node-replacing re-render still resolves as
  // the target — a genuinely dropped focus is always recovered on both sites.
  function recoverGridFocus(rowKey: any, col: any, level: any, guardMoved = false) {
    if (!gridRoot.current) return;
    let attempts = 0;
    const tryFocus = () => {
      if (guardMoved) {
        const ae = gridRoot.current && gridRoot.current.getRootNode ? gridRoot.current.getRootNode().activeElement : null;
        const aeCell = ae && ae.closest ? ae.closest('[data-grid-cell]') : null;
        if (aeCell && gridRoot.current.contains(aeCell)) {
          const aeRow = aeCell.getAttribute('data-row');
          if (aeRow != null && aeRow !== rowKey) return;
        }
      }
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

  // D-05: clamp the active cell to bounds on every underlying-data change (re-sort, filter,
  // pagination, page-size). KEEP the same indices; clamp ONLY when the grid shrank — NO
  // row-id following, NO bounce-to-top on a filter keystroke. Gated by isGrid() so 'table'
  // mode is entirely untouched. Invoked at the rowModelVer bump path (refreshRowModel).
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
  }, [activeColIndex, activeIsHeader, activeRow, bodyRowCount, clampRange, headerLeafLevel, isGrid, recoverGridFocus, visibleColCount]);
  // B6 (phase 63 wave-11) — "the active cell is parked on the empty-grid header fallback" control
  // flag, written + read ONLY inside clampActiveCell (never bound in the template). It MUST be a
  // plain component-scope `let` (React hoists to useRef), NOT a $data reactive field: clampActiveCell
  // is reached through the mount-time refreshRowModel closure, so a `$data.gridEmptyFallback` READ
  // there binds the async-stale mount-time value on React (setState is async — the rangeActive /
  // pendingEditFollow / B23-nextRows stale-read class). With the body re-populated after a filter
  // CLEAR, that stale read skipped the recovery branch on React → the roving tab-stop stayed on the
  // header fallback (columnheader) instead of re-seating a body cell (the B6 recovery gap). A
  // synchronously-written plain `let` is read fresh on all six → the empty→non-empty recovery
  // re-seats activeRow 0 on React too. The other 5 targets are byte-behaviorally identical (they
  // already read reactive $data synchronously). A top-level reassigned `let` referenced from the
  // refreshRowModel/clampActiveCell chain → React hoists to useRef → persists per-instance.
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
  // rangeClickPending: set by onGridMouseDown on a Shift+Click (the range is set off the
  // pointer event's shiftKey BEFORE the cell's focusin fires); the follow-up focusin reads it
  // to SKIP the range-collapse (a focusin carries no reliable shiftKey). Reset on consumption.
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

  // getSelectedRange(): the current range as plain integers — { anchor, focus } each a
  // { rowIndex, colIndex } pair (or null when no range). T-49-02: positions only, no row
  // data, no DOM node. Used by the getSelectedRange $expose verb AND every range-change emit
  // (the single payload source) AND copyRange/fillRange (the rectangle they operate over).
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

  // isFillHandleCell(rIdx, cIdx): is this cell the BOTTOM-RIGHT corner of the current range?
  // That corner hosts the fill-handle affordance (req-8 / D-04). False without a range — the
  // byte-identical-off guard for the handle markup (no range → no handle).
  function isFillHandleCell(rIdx: any, cIdx: any) {
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a || !f) return false;
    const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
    const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
    return rIdx === r1 && cIdx === c1;
  }

  // emitRangeChange(anchor, focus): fire range-change with the FRESH range corners passed by
  // the caller — NOT a re-read of $data.rangeAnchor/rangeFocus. The range corners are <data>
  // (useState on React), so re-reading right after the same-tick setState returns the STALE
  // pre-write value (ROZ138). extendRange/setRangeFocus thread the just-computed locals through
  // here so the emitted payload matches the write. The single call site keeps the count
  // predictable (React multi-emit dedup, D-07). One-way notification.
  function emitRangeChange(anchor: any, focus: any) {
    props.onRangeChange && props.onRangeChange({
      anchor,
      focus
    });
  }

  // extendRange(dRow, dCol): move rangeFocus by the (row,col) delta, clamped to the grid
  // bounds, seeding rangeAnchor from the active cell when no range exists yet (Shift+Arrow
  // from a bare active cell starts a 1×N / N×1 rectangle anchored at that cell). Body cells
  // only (header rows are not range-selectable). Emits range-change from this single site.
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
    rangeTransition.current = true;
    focusActiveCell(nextRow, nextCol, false);
    // B18: emit range-change ONLY on an actual change. A clamped no-op (a range already exists
    // and the focus corner did not move — Shift+Arrow into the grid boundary) is not a selection
    // change → no emit. Seeding a brand-new range (no prior range) is always a change (the
    // rectangle came into existence) even if its first corner is a degenerate 1×1.
    if (!hadRange || nextRow !== focus.rowIndex || nextCol !== focus.colIndex) {
      emitRangeChange(anchor, nextFocus);
    }
  }

  // setRangeFocus(rIdx, cIdx): set the moving corner to an explicit cell (Shift+Click),
  // seeding the anchor from the active cell when no range exists yet. Clamped to bounds.
  // Emits range-change from this single site.
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

  // selectAllBody(): the §8 (260709-3qt) Ctrl+A whole-body select — set the range to span EVERY
  // body cell (anchor at the first body cell (0,0), moving corner at the last (maxRow, maxCol)),
  // driving the SAME range corners shift+arrow / setRangeFocus use. Emits range-change from a single
  // site (the emitRangeChange contract — pass the FRESH corners, never a $data re-read). No-op on an
  // empty grid. Body cells only — a header-active Ctrl+A is gated OUT by the caller (never builds a
  // range from a header). rangeActive is set synchronously so a follow-up clearRange collapses it.
  function selectAllBody() {
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return;
    const anchor = {
      rowIndex: 0,
      colIndex: 0
    };
    const focus = {
      rowIndex: maxRow,
      colIndex: maxCol
    };
    setRangeAnchor(anchor);
    setRangeFocus(focus);
    rangeActive.current = true;
    emitRangeChange(anchor, focus);
  }

  // clearRange(): drop the rectangle (a non-shift navigation / edit-entry collapses any
  // range back to a single active cell). Cheap no-op when no range is set (the guard keeps a
  // plain navigation with no active range from emitting). B19: when a range DID exist, emit
  // range-change with null corners so a consumer mirroring the selection through the event sees
  // the drop — without this they hold a STALE rectangle after every non-shift navigation /
  // edit-entry collapse (getSelectedRange already reports null, but the event never fired).
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

  // B8: clamp the range corners to the current grid bounds after an underlying-data change
  // (sort/filter/paginate/page-size all re-derive the row model). A range whose rows now exceed
  // the shrunken model would otherwise leave STALE/phantom corners → a copy serializes empty
  // rows past the model's end (and getSelectedRange reports out-of-bounds corners). We CLAMP each
  // corner into [0,maxRow]×[0,maxCol] (preserving a valid rectangle — a corner that clamps onto
  // another keeps the range non-empty); when no selectable body cell remains the rectangle is
  // dropped. Does NOT emit range-change here — the clamp is a reconcile, not a user selection
  // move (the emit-on-change work, B18/B19, lands in plan 63-05). Called from clampActiveCell.
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
  // announce(msg): write the polite aria-live PASTE-announce region (D-03 — "N of M cells
  // pasted"). SEPARATE from the validation invalidMsg region (different semantics). '' clears it.
  function announce(msg: any) {
    setPasteAnnounce(msg != null ? msg : '');
  }

  // B11: copy / paste (and the Cut verb plan 63-09 adds) are NO-OPS while a HEADER cell is
  // active. A header has no body value to copy, and a paste anchored at a header would silently
  // write body row 0 at the header's column (a silent body mutation, borderline P0). This is the
  // SINGLE reusable guard every clipboard entry path checks — copyRange/pasteRange self-guard
  // with it AND the onGridKeyDown Ctrl+C/Ctrl+V branches gate on it (so the native shortcut is
  // left untouched on a header). Plan 63-09's Cut reuses this exact predicate.
  function clipboardActiveAllowed() {
    return !activeIsHeader;
  }

  // fieldOfColId: the row-object key (accessorKey) to write for a column id — the same
  // accessorKey-or-id rule the edit funnels use. Used by paste/fill to apply values by field.
  function fieldOfColId(colId: any) {
    const d = defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  }

  // normalizedRange(): the current rectangle as { r0, r1, c0, c1 } (min/max of anchor+focus),
  // or null when no range. The shared rectangle source for copy/paste/fill. B8: the corners are
  // CLAMPED to the CURRENT grid bounds ON READ (read at call time → React-stale-safe), so a copy
  // after a filter-to-fewer can never serialize phantom rows past the shrunken model even when
  // the stored corners were not eagerly re-clamped (refreshRowModel's clamp is async-defeated on
  // React; this read-time clamp is the cross-target guarantee). Returns null when no body cell
  // remains.
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

  // rangeToTsv(): serialize the current range to TSV — rows joined by '\n', cells by '\t',
  // reading each cell's value off the visible model by index (cellValueAt). A single active
  // cell (no range) serializes that one cell. Each field is B10-escaped. Pure read — never writes.
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

  // copyRange(): write the current range as TSV to the clipboard (async). No-op when the
  // async Clipboard API is unavailable (older/insecure contexts) — a copy is best-effort.
  function copyRange() {
    // B11: never copy from a header-active state (the reusable clipboard guard).
    if (!clipboardActiveAllowed()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) return;
    try {
      const p = navigator.clipboard.writeText(rangeToTsv());
      if (p && p.catch) p.catch(() => {});
    } catch (err: any) {/* best-effort copy */}
  }

  // applyGridToRange(grid, originRow, originCol): the SHARED write path for paste + fill. Walks
  // the grid (string[][]) anchored at (originRow, originCol), CLAMPED to the grid bounds (no
  // unbounded loop — T-51-02). For each target cell: count it (total); SKIP if the column is
  // non-editable (D-03) or the per-column validator rejects the value (D-03, T-51-01 — the
  // value passes runValidator as plain string DATA before any write); else stage it into ONE
  // running fresh array (replaceRowValue) and record the committed cell. After the walk: ONE
  // writeData (the single r-model:data write), ONE cell-edit-commit per COMMITTED cell, and the
  // N-of-M aria-live announce. Returns { wrote, total }.
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

  // rowOriginalAt / rowIdAt: the underlying row object / id at a visible-model body index.
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

  // pasteRange(): read TSV from the clipboard (async), parse it, TILE it over the destination
  // (C3), and apply it anchored at the destination top-left under the D-03 skip rule. The grid is
  // clamped to the grid bounds (T-51-02). A failed/empty read is a silent no-op.
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

  // cutRange(): C3 Cut — copy the current range to the clipboard (rangeToTsv — the SAME escaped
  // serialization copyRange uses) THEN CLEAR the source cells through the SAME write-funnel as
  // paste/fill: applyGridToRange of an empty-string grid sized to the range → coerceCellValue('')
  // per column (null on a numeric column, '' on text) + the D-03 editable/validator skip rule +
  // ONE writeData + one cell-edit-commit per cleared cell + the N-of-M announce. A read-only /
  // required cell is left intact (the funnel skips it). B11: a no-op while a header cell is active
  // (reuses clipboardActiveAllowed — Cut can never silently clear a body cell from a header anchor).
  // The clear is SYNCHRONOUS and runs AFTER rangeToTsv has already serialized, so the copy reads the
  // pre-clear values; the clipboard write is best-effort/async and never blocks the clear.
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

  // clearActiveRange(): the §7 (260709-3qt) Delete/Backspace clear — cutRange() MINUS the clipboard
  // copy. Clears the active cell / selected range through the SAME write-funnel as Cut/paste/fill:
  // applyGridToRange of an empty-string grid sized to the range → coerceCellValue('') per column
  // (null on a numeric column, '' on text) + the D-03 editable/validator/read-only skip rule + ONE
  // writeData + one cell-edit-commit per cleared cell + the N-of-M announce. B11: a no-op while a
  // header cell is active (reuses clipboardActiveAllowed — Delete can never silently clear a body
  // cell from a header anchor). NO undo — the grid is controlled (writeData → $model.data; every
  // clear fires cell-edit-commit), so undo is the consumer's responsibility, the SAME contract
  // Cut/Paste/Fill already carry (design §7, approved 2026-07-09).
  function clearActiveRange() {
    if (!clipboardActiveAllowed()) return;
    // Snapshot the source rectangle synchronously (the ROZ138 concern cutRange/pasteRange share).
    const box = normalizedRange();
    const r0 = box ? box.r0 : activeRow;
    const r1 = box ? box.r1 : activeRow;
    const c0 = box ? box.c0 : activeColIndex;
    const c1 = box ? box.c1 : activeColIndex;
    const grid = [];
    for (let r = r0; r <= r1; r++) {
      const cols = [];
      for (let c = c0; c <= c1; c++) cols.push('');
      grid.push(cols);
    }
    applyGridToRange(grid, r0, c0);
  }

  // fillRange(sourceBox): drag-fill (D-04 — VALUE-COPY ONLY, no series detection). B7: the fill
  // SOURCE is the PRE-DRAG rectangle (`sourceBox`, captured at pointerdown before the drag grew
  // the range); each target cell copies the source cell in its OWN column (and row, when the
  // source spans rows), TILED across the source dimensions. This fixes two data-loss bugs: (1) a
  // single-scalar broadcast clobbered the other columns' data, and (2) reading box.r0/box.c0
  // flipped to the WRONG corner on an up/left drag (the box top-left is a TARGET cell there, not
  // the source). `sourceBox` falls back to the box's top-left 1×1 for a no-source fill. Honors the
  // SAME editable + validation + type-coercion skip rule as paste (via applyGridToRange): one
  // writeData + one cell-edit-commit per committed cell + the N-of-M announce. No-op without a range.
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

  // onFillHandlePointerDown: begin a fill-handle drag (req-8 / D-04). The handle sits on the
  // range's bottom-right cell; a pointer drag extends the range (reusing setRangeFocus off the
  // cell under the pointer) and, on release, value-fills the dragged rectangle. Kept minimal:
  // pointermove extends the range to the cell under the pointer; pointerup commits the fill.

  // CR-04: track the live fill-drag document listeners in module-lets so $onUnmount can remove
  // them if the component unmounts MID-DRAG (the `up` handler clears them on a normal release,
  // but a mid-drag unmount would otherwise leak a pointermove/pointerup listener on document).
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
    // #leak: tear down any orphaned PRIOR gesture BEFORE reassigning the module-let handlers. If a
    // pointerup was missed (pointer released off-window, context menu, alt-tab), the prior fillDrag's
    // document pointermove/pointerup stay attached; overwriting fillDragMove/fillDragUp below would
    // strand them (removeEventListener could never reach the old refs) → a permanent global
    // pointermove leak. teardownFillDrag is idempotent (no-op when nothing is attached).
    teardownFillDrag();
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
      // A plain click on the fill handle (pointerdown+up with NO intervening drag) leaves lastCell
      // at the source box's own origin corner (r1,c1), so fillRange(sourceBox, corner) would
      // recommit the source range onto ITSELF — a no-op write that pollutes undo history and fires
      // spurious per-cell cell-edit-commit events (oldValue === newValue). Only fill when the drag
      // actually reached a cell past the source origin.
      if (lastCell && sourceBox && (lastCell.r !== sourceBox.r1 || lastCell.c !== sourceBox.c1)) {
        fillRange(sourceBox, lastCell);
      }
    };
    // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
    fillDragMove.current = move;
    fillDragUp.current = up;
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
  }, [cellIndexFromPoint, fillRange, normalizedRange, setRangeFocus$local, teardownFillDrag]);
  // §6 (260709-3qt) drag-to-select — mirror the fill-drag listener discipline. rangeDragging gates
  // the live gesture; rangeDragMove/rangeDragUp track the document pointermove/pointerup handlers so
  // a mid-drag unmount ($onUnmount → teardownRangeDrag) can remove them (CR-04). rangeDragMoved flips
  // true once the drag enters a DIFFERENT cell than its mousedown anchor; onGridClick reads it to
  // suppress a singleClickEdit editor-open after a drag (reset per-gesture in beginRangeDrag). Each
  // top-level let → React hoists to useRef.
  // ══ Mouse drag-to-select (grid cell-interaction §6, 260709-3qt) ═════════════════════════
  // A plain (non-shift) mousedown on a body cell begins a document-level drag: the FIRST
  // pointermove that reaches a DIFFERENT body cell paints the range moving corner via the
  // SHARED-scope setRangeFocus (the SAME range model shift+click / shift+arrow drive), pointerup
  // ends it. Mirrors fillDrag.rzts's listener discipline VERBATIM (document pointermove/pointerup
  // tracked in module-lets so a mid-drag unmount can remove them — CR-04), and REUSES fillDrag's
  // shadow-piercing cellIndexFromPoint (shared scope) so the Lit shadow target is covered uniformly.
  // teardownRangeDrag(): remove the live drag listeners, null them, clear the dragging flag. The
  // `up` handler calls it on a normal release; $onUnmount calls it if we unmount MID-DRAG (mirrors
  // teardownFillDrag). rangeDragMoved is NOT reset here — it is read by onGridClick AFTER pointerup
  // (to suppress a singleClickEdit editor-open) and reset per-gesture in beginRangeDrag.
  const teardownRangeDrag = useCallback(() => {
    if (typeof document !== 'undefined') {
      if (rangeDragMove.current) document.removeEventListener('pointermove', rangeDragMove.current);
      if (rangeDragUp.current) document.removeEventListener('pointerup', rangeDragUp.current);
    }
    rangeDragMove.current = null;
    rangeDragUp.current = null;
    rangeDragging.current = false;
  }, []);
  // beginRangeDrag(anchorR, anchorC): start a drag-select anchored at the mousedown cell. The
  // mousedown's native focus/focusin already committed the ACTIVE cell to (anchorR, anchorC), so
  // setRangeFocus (which seeds the anchor from the ACTIVE cell) spans mousedown-cell→pointer-cell —
  // we NEVER write $data.rangeAnchor directly (it is React-stale, ROZ138). rangeDragMoved starts
  // false and flips true only once the pointer reaches a DIFFERENT cell, so a mousedown-with-no-move
  // leaves a single active cell + no range (a normal click). lastCell dedups the many pointermove
  // events per cell (setRangeFocus emits range-change — only extend on a NEW cell, mirroring fillDrag's
  // B20 dedup). Captured per-gesture in the closure (no module-let needed for lastCell).
  function beginRangeDrag(anchorR: any, anchorC: any) {
    // #leak: tear down any orphaned PRIOR range gesture BEFORE reassigning the module-let handlers.
    // A missed pointerup (off-window release, context menu, alt-tab) leaves the prior drag's document
    // pointermove/pointerup attached; overwriting rangeDragMove/rangeDragUp below would strand them
    // (removeEventListener could never reach the old refs) → a permanent global pointermove leak.
    // teardownRangeDrag is idempotent (no-op when nothing is attached) and does NOT touch
    // rangeDragMoved, which is reset per-gesture immediately below.
    teardownRangeDrag();
    rangeDragging.current = true;
    rangeDragMoved.current = false;
    let lastCell = {
      r: anchorR,
      c: anchorC
    };
    const move = (ev: any) => {
      if (!rangeDragging.current) return;
      const cell = cellIndexFromPoint(ev.clientX, ev.clientY);
      if (cell && (cell.r !== lastCell.r || cell.c !== lastCell.c)) {
        lastCell = cell;
        rangeDragMoved.current = true;
        setRangeFocus$local(cell.r, cell.c);
      }
    };
    const up = () => {
      // teardownRangeDrag clears rangeDragging + removes both listeners (the fill-drag CR-04 path).
      teardownRangeDrag();
    };
    // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
    rangeDragMove.current = move;
    rangeDragUp.current = up;
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
  }
  // The column id at the active cell (the active row's visible cell list @ activeColIndex).
  // Null when out of range (no body rows, or active cell is a header / select column).
  function activeCellColumnId() {
    if (activeIsHeader) return null;
    const rowList = rows || [];
    const row = rowList[activeRow];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[activeColIndex];
    return cell && cell.column ? cell.column.id : null;
  }

  // isActiveCellEditable: the active cell sits in an editable column AND is a body cell
  // (req-1). Gates the F2/Enter/printable edit-entry branches in onGridKeyDown; a
  // non-editable active cell falls through to the reserved enterControl path.
  function isActiveCellEditable() {
    const colId = activeCellColumnId();
    return colId != null && columnEditable(colId);
  }

  // isEditing: is the cell at (rowIndex, colIndex) over the visible model in edit? ONE
  // predicate covers BOTH modes (RESEARCH Pattern 6):
  //  - row mode (req-6): editingRowIndex === rowIndex AND the column at colIndex is editable —
  //    so EVERY editable cell in the row enters edit simultaneously (the editor template branch
  //    re-uses this gate verbatim, no template fork);
  //  - single-cell mode (req-1/3): the editingRow/editingCol pair matches exactly.
  // Pure index compare (editingRowIndex null + editingRow -1 = none) → the byte-identical-off
  // guard for the editor template branch. $data.editVer is read first so the per-cell branch
  // re-derives on Svelte/Solid when editing state mutates from a foreign slot-callback scope.
  // Called per-cell in both <td> bodies with the body-specific row index (rowIndexOf(row)
  // non-virtual, wr.vi.index virtual).
  function isEditing(rowIndex: any, colIndex: any) {
    if (editVer < 0) return false;
    if (editingRowIndex != null && editingRowIndex === rowIndex) {
      const colId = columnIdAt(rowIndex, colIndex);
      return colId != null && columnEditable(colId);
    }
    return editingRow === rowIndex && editingCol === colIndex;
  }

  // cellAriaInvalid (req-5/D-01): the STRING 'true' ONLY for the editing cell while it holds
  // an invalid value — drives :aria-invalid on the <td>. Returns null otherwise so the bound
  // attribute DROPS (the rozieAttr nullish-attr path), keeping non-editing cells byte-clean.
  // Returns the literal 'true' (NOT boolean true) so rozieAttr's string-literal-union preserve
  // keeps React's aria-invalid (Booleanish incl. 'true') happy instead of widening to string.
  function cellAriaInvalid(rowIndex: any, colIndex: any): 'true' | null {
    return isEditing(rowIndex, colIndex) && !!invalidMsg ? 'true' : null;
  }

  // runValidator: the sync per-column validator (req-5). Reads col.meta.validate; not a
  // function → valid (true). Calls it (defensively wrapped — a thrown/non-true/non-string
  // return coerces to a generic message so a misbehaving validator can never wedge the
  // keymap, Security V5 DoS). A string return is the error message (commit rejected, D-01).
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

  // setInvalid: record the current validation error (drives the aria-live region +
  // :aria-invalid wired in Task 3). Empty string clears it.
  function setInvalid(msg: any) {
    setInvalidMsg(msg != null ? msg : '');
  }

  // Map a visible-model body-row index ($data.rows index) to its underlying currentData()
  // index via the row's original object identity (sorting/filtering/pagination may reorder
  // the visible model away from the source array order). Falls back to the same index.
  function sourceIndexOfRow(visibleRowIndex: any) {
    const rowList = rows || [];
    const row = rowList[visibleRowIndex];
    if (!row) return visibleRowIndex;
    const orig = row.original;
    const data = currentData() || [];
    const idx = data.indexOf(orig);
    return idx >= 0 ? idx : visibleRowIndex;
  }

  // The column id / field (accessorKey) / current value / row object / row id for the cell
  // in EDIT — keyed off the authoritative editing pair ($data.editingRow/editingCol), NOT
  // the active-cell indices (which can drift from the editing cell on a Tab-advance, and are
  // async-stale right after a setState on React — ROZ138). Called only from commitEdit.
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

  // Focus the freshly-mounted editor (Pitfall 1, ROZ123): after beginEdit flips the editing
  // state, the editor <input> does not exist until the framework commits the r-if branch
  // (React setState async; Solid/Lit/Svelte next reactive tick). Poll for the
  // [data-editing-cell] element off gridRoot for ~30 frames — the five fast targets resolve
  // on attempt 1, React retries across its async commit. NEVER read $refs eagerly.
  // B2: selectAll gates the post-focus el.select(). Select-all is right when entering
  // edit IN PLACE (F2/Enter/click/row-edit/validation-reject — no seeded char, the user
  // retypes), but WRONG on a type-to-edit entry where a printable key already seeded the
  // draft (selecting the seeded char makes the next keystroke replace it: Zeta → eta).
  // beginEdit threads `seed == null` so a seeded entry skips the select and the caret sits
  // AFTER the seeded char; every other caller keeps the default select-all.
  // Editor-owns-focus contract (quick 260711-i5m): REVERTS the g52 shadow-piercing helper
  // (commit 5fa30045) that recursed into descendant shadow roots. Built-in editors are
  // host-DOM — the plain direct query resolves them on all 6 targets (no shadow to cross). A
  // #editor DROP-IN now owns its OWN focus via the reactive `autofocus` prop (EditorText's
  // $onMount + lazy $watch), so the host never needs to reach across a Lit drop-in's nested
  // shadow root at all — see the !hasEditorSlot gate below, which skips the host focus call
  // entirely for a drop-in target.
  function focusEditorWhenReady(selectAll = true) {
    if (!gridRoot.current) return;
    // Editor-owns-focus contract: when the CURRENT focus target is a #editor drop-in, the host
    // does NOT reach into its DOM — the drop-in self-focuses via its own autofocus prop.
    if (editFocusColId != null && hasEditorSlot(editFocusColId)) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = gridRoot.current ? gridRoot.current.querySelector('[data-editing-cell]') : null;
      // Do NOT stomp focus a later interaction already placed in a DIFFERENT column's editor of
      // this row: focusEditorWhenReady only needs to get focus INTO the (first) freshly-mounted
      // editor; if focus already sits in another editable cell, a late rAF re-focus would steal it
      // back to the first editor and break row-mode Tab containment (the non-deterministic B21
      // focus-theft). Compare the OWNING cell's data-col-index (NOT node identity) so a stale
      // SAME-column editor node on Solid's node-replacing re-render still resolves as the target —
      // a genuinely dropped focus is still recovered.
      const ae = gridRoot.current && gridRoot.current.getRootNode ? gridRoot.current.getRootNode().activeElement : null;
      if (ae && el && ae !== el && ae.closest && gridRoot.current.contains(ae) && ae.hasAttribute && ae.hasAttribute('data-editing-cell')) {
        const aeCell = ae.closest('[data-grid-cell]');
        const elCell = el.closest ? el.closest('[data-grid-cell]') : null;
        const aeCol = aeCell ? aeCell.getAttribute('data-col-index') : null;
        const elCol = elCell ? elCell.getAttribute('data-col-index') : null;
        if (aeCol != null && aeCol !== elCol) return;
      }
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

  // Column id + current value at an EXPLICIT (rowIndex, colIndex) over the visible model —
  // used by beginEdit so it never re-reads $data.activeRow/activeColIndex (which are async-
  // stale right after a Tab-advance sets them on React — ROZ138).
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

  // beginEdit: open the editor on the (rowIndex, colIndex) cell (req-1/3, D-05). seed===null
  // → seed the EXISTING value (F2/Enter in-place edit); a printable char → REPLACE (the
  // editor opens holding just that char). Resolves the column from the PASSED indices (not
  // $data) so a Tab-advance that just setState'd activeRow/Col works on React. Clears any
  // prior invalid state. Focus moves into the editor.
  function beginEdit(rowIndex: any, colIndex: any, seed: any) {
    const colId = columnIdAt(rowIndex, colIndex);
    if (colId == null || !columnEditable(colId)) return;
    // A new edit session starts — reset the sync idempotency latch so THIS session's eventual
    // commit is not silently no-op'd by a PRIOR session's already-set latch.
    committedThisSession.current = false;
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
    // Editor-owns-focus contract (quick 260711-i5m): THIS cell's column is the current
    // focus target — editorAutofocusFor derives the reactive `autofocus` #editor scope prop
    // from it. Cleared on endEdit.
    setEditFocusColId(colId);
    // B2: a seeded (type-to-edit) entry must NOT select-all — keep the caret after the
    // seeded char so subsequent typing appends instead of replacing it.
    focusEditorWhenReady(seed == null);
  }

  // Return focus to a body cell AFTER the editor unmounts (commit/cancel). The display↔
  // editor re-render must commit before the <td> is focusable with its roving tabindex —
  // on React/Solid/Lit that commit is async, so a synchronous focusActiveCell can run while
  // the cell is still the editor (or mid-swap) and focus is lost. Bounded rAF-poll resolves
  // the [data-row][data-col-index] cell off gridRoot for ~30 frames (the fast targets land
  // on attempt 1; React/Solid retry across the async commit). Mirrors focusEditorWhenReady.
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
  // endEdit: tear down the editor (shared by commit/cancel). Clears the editing pair +
  // draft + invalid state and returns to navigation mode. Does NOT move focus (callers
  // decide where focus lands — commit/cancel return it to the owning cell).
  function endEdit() {
    setEditingRow(-1);
    setEditingCol(-1);
    setDraftValue(null);
    setInvalidMsg('');
    setActiveInControl(false);
    setEditVer(prev => prev + 1);
    setEditFocusColId(null);
  }

  // endRowEdit: tear down full-row edit (shared by commitRow/cancelRow). Clears the row
  // index + the per-cell drafts + invalid state and returns to navigation mode. Does NOT
  // move focus (callers return it to the active cell). Mirrors endEdit for the row mode.
  function endRowEdit() {
    setEditingRowIndex(null);
    setRowDraft({});
    setInvalidMsg('');
    setActiveInControl(false);
    setEditVer(prev => prev + 1);
    setEditFocusColId(null);
  }

  // editorAutofocusFor (quick 260711-i5m, editor-owns-focus contract): the reactive `autofocus`
  // #editor scope prop for a given (colId, rowIndex) — true for EXACTLY the current focus-
  // target cell, re-deriving on every editVer bump (mirrors isEditing's reactive gate so
  // Svelte/Solid re-run this per-cell on a foreign-slot-callback state mutation). Works for
  // BOTH single-cell ($data.editingRow) and row mode ($data.editingRowIndex) since
  // $data.editFocusColId is set by both beginEdit and beginRowEdit/commitRow/rowEditTab.
  function editorAutofocusFor(colId: any, rowIndex: any) {
    if (editVer < 0) return false;
    if (editingRowIndex != null) {
      if (editingRowIndex !== rowIndex) return false;
    } else {
      if (editingRow !== rowIndex) return false;
    }
    return editFocusColId != null && editFocusColId === colId;
  }

  // B3: coerce the committed value by the column's built-in editor type at the single
  // commit funnel. A 'number' editor commits a real Number; an empty/whitespace/non-numeric
  // draft commits null (never '' / never NaN — Number('') === 0 is a silent footgun). Every
  // other editor type commits the value verbatim. Idempotent for the #editor drop-in path
  // (an already-numeric override passes through; an explicit null stays null).
  function coerceCellValue(colId: any, raw: any) {
    if (editorTypeOf(colId) !== 'number') return raw;
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }

  // commitEdit: validate the draft (req-5); on success replace one row in a fresh array,
  // funnel it through writeData (the controlled r-model:data write, req-4), emit EXACTLY
  // ONE cell-edit-commit from THIS single call site (React multi-emit dedup, D-07), then
  // return focus to the cell. On a validation FAILURE keep the editor OPEN (D-01) — set
  // invalid, re-trap focus, never write the model. Captures the optional override value
  // (the #editor slot's commit(v) call) else the live draft.
  // Returns true when the commit succeeded (model written, editor closed); false when a
  // validation failure kept the editor OPEN (D-01). Callers MUST use this return value, not
  // a synchronous re-read of $data.editingRow — React's endEdit setState is async, so an
  // immediate re-read of editingRow still shows the OLD value (the ROZ138 stale-read class).
  function commitEdit(overrideValue = undefined, skipFocusReturn = false) {
    if (editingRow < 0) return false;
    // Sync idempotency latch (drop-in double cell-edit-commit fix): a second commitEdit call
    // within the SAME edit session — the deferred drop-in's unmount-blur re-entry, which on
    // React fires while $data.editingRow is still async-stale ≥ 0 — no-ops here instead of
    // re-validating/re-writing/re-emitting. Reset by beginEdit/beginRowEdit/editCell.
    if (committedThisSession.current) return false;
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
    // #5: a no-op commit (the coerced value is UNCHANGED — a bare Enter/Tab/blur that edited
    // nothing) must do NO model write, NO history record, and NO commit event: writeData →
    // recordSnapshot UNCONDITIONALLY clears the redo stack and mints a fresh row identity, so an
    // unconditional write on a no-op would destroy redo + spuriously re-render + emit a no-op
    // cell-edit-commit. Compute `changed` and gate the write/emit on it; ALWAYS close the editor.
    const changed = !Object.is(newValue, oldValue);
    // Snapshot the EDITING cell to return focus to BEFORE endEdit clears editing state.
    const focusRow = editingRow;
    const focusCol = editingCol;
    // Guard the teardown blur: writeData/endEdit re-render unmounts the editor → its blur
    // must NOT re-enter commitEdit (double cell-edit-commit). Cleared after the focus return.
    editTransition.current = true;
    // Sync idempotency latch: flip BEFORE writeData/endEdit so the async unmount-blur re-entry
    // (which fires AFTER this call returns, once editTransition is already back to false) finds
    // it set at the top-of-function guard above and no-ops. Set on BOTH paths so a no-op commit
    // is just as re-entry-safe as a real one.
    committedThisSession.current = true;
    if (changed) {
      const srcIndex = sourceIndexOfRow(editingRow);
      const next = replaceRowValue(currentData(), srcIndex, field, newValue);
      writeData(next);
      // Exactly one emit per commit, from this single call site (writeData does NOT emit).
      props.onCellEditCommit && props.onCellEditCommit({
        rowId,
        columnId: colId,
        oldValue,
        newValue
      });
    }
    endEdit();
    editTransition.current = false;
    if (changed) {
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
    } else if (skipFocusReturn !== true) {
      // #5 no-op path: nothing was written, so refreshRowModel never runs and would never consume
      // a pendingEditFollow — focus would drop to <body>. Return focus DIRECTLY. The row does NOT
      // relocate (no write), so the B23 relocation hazard that forces the pendingEditFollow path on
      // a real commit does not apply here: the fixed (focusRow, focusCol) is correct and safe.
      focusCellWhenReady(focusRow, focusCol);
    }
    return true;
  }

  // toggleActiveBooleanCell (design doc 2026-07-05, Change 1): the spreadsheet-standard
  // single-keystroke boolean toggle. Flips the ACTIVE cell's value and commits it through the
  // EXACT SAME write funnel commitEdit uses (replaceRowValue → writeData → single $emit) but
  // WITHOUT opening an editor — there is no editingRow/editingCol involvement at all, so this
  // operates entirely off $data.activeRow/activeColIndex. Gated in onGridKeyDown to
  // editor:'checkbox' columns only (Space/Enter/F2), full-row edit mode is unaffected (the
  // editingRowIndex early return in onGridKeyDown already excludes it).
  function toggleActiveBooleanCell() {
    const colId = columnIdAt(activeRow, activeColIndex);
    if (colId == null || !columnEditable(colId)) return;
    const rowList = rows || [];
    const row = rowList[activeRow];
    if (!row) return;
    const rowOriginal = row.original;
    const rowId = row.id;
    const oldValue = cellValueAt(activeRow, activeColIndex);
    const newValue = !oldValue;
    // D-01: same discipline as commitEdit — a rejecting validator blocks the toggle. There is
    // no editor to keep open here, so the toggle simply does not apply (no model write).
    const err = runValidator(colId, newValue, rowOriginal);
    if (err !== true) {
      setInvalid(err);
      return;
    }
    setInvalid('');
    const def = defFor(colId);
    const field = def && def.accessorKey != null ? def.accessorKey : colId;
    const srcIndex = sourceIndexOfRow(activeRow);
    // Sync idempotency latch: this toggle is a commit-equivalent (mirrors commitEdit's D-07
    // single-emit discipline) — flip it too so a stray re-entry after this toggle no-ops.
    committedThisSession.current = true;
    writeData(replaceRowValue(currentData(), srcIndex, field, newValue));
    // Exactly one emit per toggle, from this single call site (writeData does NOT emit) —
    // mirrors commitEdit's D-07 single-emit discipline.
    props.onCellEditCommit && props.onCellEditCommit({
      rowId,
      columnId: colId,
      oldValue,
      newValue
    });
    // Follow the toggled row's focus through a boolean sort/filter relocation AND a
    // fine-grained keyed-row replace (Solid) — the SAME recovery commitEdit relies on; even
    // with no editor to unmount, writeData's re-render can still drop focus.
    pendingEditFollow.current = {
      rowOriginal,
      rowId,
      col: activeColIndex
    };
  }

  // cancelEdit: discard the draft (D-05 — revert to the pre-edit value, no model write) and
  // return focus to the owning cell.
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
  // The editable [columnId, field] pairs for a body row at the given visible-model index,
  // in visible-cell order. field is the column's accessorKey (the row-object key to write).
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

  // B21/B22: focus the row-mode editor at a given VISIBLE col index. In full-row edit every
  // editable cell is already mounted as an editor, so this resolves the cell off gridRoot and
  // focuses its [data-editing-cell] control. Bounded rAF-poll (mirrors focusEditorWhenReady)
  // so a React re-render that recreates the input across the focus call still lands it. select-
  // all on text/number editors (a no-op try/catch on select/checkbox).
  // Editor-owns-focus contract (quick 260711-i5m): when the TARGET column is a #editor
  // drop-in, the host does NOT reach into its DOM (early return, before starting the rAF poll
  // at all) — the drop-in self-focuses via its own reactive `autofocus` prop, which the caller
  // (commitRow's B22 reject path / rowEditTab) already flips via $data.editFocusColId. Built-in
  // columns are unaffected (hasEditorSlot is false for them) — unchanged host direct-focus.
  function focusRowEditorAt(rowIndex: any, colIndex: any) {
    if (!gridRoot.current) return;
    const colId = columnIdAt(rowIndex, colIndex);
    if (colId != null && hasEditorSlot(colId)) return;
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

  // beginRowEdit(row): enter full-row edit on a body row (req-6). Seeds rowDraft from each
  // editable column's CURRENT value (so an immediate save is a no-op), clears any single-cell
  // edit (mutual exclusivity), and focuses the first editable cell's editor (the bounded
  // rAF-poll resolves the first [data-editing-cell] off gridRoot — same mechanism as
  // focusEditorWhenReady). Accepts the row OBJECT (the template/Shift+F2 path) — index-resolved
  // internally via rowIndexOf so it stays in the editingRow/activeRow index space.
  function beginRowEdit(row: any) {
    const rowIndex = rowIndexOf(row);
    if (rowIndex < 0) return;
    const editable = editableColumnsForRow(rowIndex);
    if (editable.length === 0) return;
    // A new edit session starts — reset the sync idempotency latch (see editCellLifecycle.rzts).
    committedThisSession.current = false;
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
    // Editor-owns-focus contract (quick 260711-i5m): the row's FIRST editable column is the
    // initial focus target — editorAutofocusFor derives the reactive `autofocus` #editor scope
    // prop from it (a built-in column is also host-focused below via focusEditorWhenReady; a
    // drop-in column self-focuses via its own $onMount, gated off the host reach-in in Task 3).
    setEditFocusColId(editable[0].colId);
    focusEditorWhenReady();
  }

  // commitRow(): validate EVERY edited column (D-01 — keep the row open if ANY fails: set
  // invalid + announce, NEVER write the model); on all-valid build ONE fresh array replacing
  // the single row object with all rowDraft values applied at once, call writeData ONCE, then
  // emit ONE row-edit-commit from THIS single call site, clear the row state, return focus.
  // Returns true on a written commit, false when a validation failure kept the row open.
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
        // Editor-owns-focus contract (quick 260711-i5m): the OFFENDING column becomes the new
        // reactive focus target BEFORE the host-focus call below — a #editor drop-in already
        // mounted (full-row edit opens every editable cell at once) picks this up via its own
        // lazy $watch on the `autofocus` scope prop flipping false→true. Bump editVer so the
        // coarse-render targets (React/Vue/Angular/Svelte) re-derive the slot binding (Solid's
        // fine-grained accessor re-runs without the bump, but the bump keeps all 6 in lockstep).
        setEditFocusColId(ec.colId);
        setEditVer(prev => prev + 1);
        // B22: focus the OFFENDING column's editor (the one whose validator rejected), NOT
        // unconditionally the first editor (focusEditorWhenReady resolves the first
        // [data-editing-cell] in DOM order). ec.colIndex is the offending cell's visible col.
        // Gated (Task 3) so a #editor drop-in self-focuses instead of a host DOM reach-in.
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
    // Snapshot the active cell to return focus to (the whole row is in edit, so the active-cell
    // row/column is the roving focus target), BEFORE endRowEdit clears editing state.
    const focusRow = activeRow;
    const focusCol = activeColIndex;
    // #5: a no-op row commit (NO column's value actually changed — a bare Enter/save/outside-click
    // that edited nothing) must do NO model write, NO history record, NO row-edit-commit event:
    // writeData → recordSnapshot UNCONDITIONALLY clears the redo stack and mints a fresh row
    // identity, so an unconditional write on a no-op destroys redo + spuriously re-renders + emits
    // a no-op row-edit-commit. Gate the write/emit on `changes.length`; ALWAYS close the editor.
    const changed = changes.length > 0;
    editTransition.current = true;
    if (changed) {
      // ONE fresh-array replace of the SINGLE row object with all field values applied at once.
      const srcIndex = sourceIndexOfRow(rowIndex);
      const next = replaceRowValues(currentData(), srcIndex, fieldValues);
      writeData(next);
      // EXACTLY ONE emit per row commit, from THIS single call site (React multi-emit dedup, D-07).
      props.onRowEditCommit && props.onRowEditCommit({
        rowId,
        changes
      });
    }
    endRowEdit();
    editTransition.current = false;
    if (changed) {
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
    } else {
      // #5 no-op path: nothing was written, so refreshRowModel never runs and would never consume a
      // pendingEditFollow — focus would drop to <body>. Return focus DIRECTLY. The row does NOT
      // relocate (no write), so the B23 relocation hazard does not apply: (focusRow, focusCol) is safe.
      focusCellWhenReady(focusRow, focusCol);
    }
    return true;
  }

  // cancelRow(): revert the whole row as a unit (D-06 — drop every draft, NO model write) and
  // return focus to the active cell.
  function cancelRow() {
    if (editingRowIndex == null) return;
    const focusRow = activeRow;
    const focusCol = activeColIndex;
    editTransition.current = true;
    endRowEdit();
    editTransition.current = false;
    focusCellWhenReady(focusRow, focusCol);
  }

  // Compute the next editable cell for Tab-advance (req-3, RESEARCH Open-Q3 deterministic
  // rule): skip non-editable columns within the row; wrap to the NEXT row's first editable
  // cell at the row's end; stop (return null) at grid end. Pure index math over the visible
  // model. Returns { row, col } or null.
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

  // B4: the mirror of nextEditableCell — the PREVIOUS editable cell for a Shift+Tab
  // backward move. Skips non-editable columns leftward within the row; wraps to the END
  // of the prior row; stops (returns null) at grid start. Pure index math over the visible
  // model. Returns { row, col } or null.
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

  // Transient guard: true while an editor commit/cancel/Tab-advance is tearing the current
  // editor down. The unmounting editor fires a `blur` as it leaves the DOM — without this
  // guard onEditorBlur would re-enter commitEdit on the (already-resolved or newly-opened)
  // cell, double-counting cell-edit-commit. A top-level `let` (React hoists to useRef).

  // B23: a pending "follow the committed row's focus" request, set by commitEdit (a single-cell
  // commit that may relocate the row under an active sort/filter) and consumed ONCE by the next
  // refreshRowModel pass — which runs with the FRESH re-derived row model, so it can resolve the
  // committed row's NEW display index (React-stale-safe) and re-seat focus there. Shape:
  // { rowOriginal, rowId, col } or null. A top-level `let` (React hoists to useRef → persists).

  // Sync idempotency latch for a cell commit (drop-in double cell-edit-commit fix, 260705):
  // commitEdit's `$data.editingRow < 0` re-entry guard is ASYNC-STALE on React — a deferred
  // drop-in editor's unmount-blur (onBlur → $props.commit → commitEdit) fires AFTER commitEdit
  // has already returned (editTransition is a SYNC latch, cleared before the async blur), while
  // `$data.editingRow` in that stale closure still reads the OLD (pre-endEdit) value, so the
  // second commit slips through and re-emits `cell-edit-commit`. A top-level `let` is written/read
  // synchronously by plain assignment (unaffected by React's setState batching — that's the point)
  // so it stays correct across the async window editTransition/editingRow cannot cover. Set true on
  // a SUCCESSFUL commitEdit/toggleActiveBooleanCell; reset to false wherever a NEW edit session
  // begins (beginEdit/beginRowEdit/editCell) so the next legitimate commit fires exactly once.
  // A top-level `let` (React hoists to useRef → persists).
  // ── Per-cell editor draft source (req-6) ──────────────────────────────────────────────
  // In single-cell mode every editor binds the shared $data.draftValue. In full-row mode
  // (editingRowIndex != null) each editable cell owns its OWN draft keyed by columnId in
  // rowDraft — so the four editors open simultaneously never clobber one shared value. These
  // helpers let the ONE editor template branch serve BOTH modes (no per-mode template fork):
  // the template binds editorValueFor(colId)/editorCheckedFor(colId) and writes via
  // onCellEditorInput(colId, evt)/onCellEditorCheckbox(colId, evt).
  function inRowEdit() {
    return editingRowIndex != null;
  }
  function editorValueFor(colId: any) {
    return inRowEdit() ? rowDraft ? rowDraft[colId] : null : draftValue;
  }
  function editorCheckedFor(colId: any) {
    return !!(inRowEdit() ? rowDraft ? rowDraft[colId] : null : draftValue);
  }

  // #editor custom-slot callbacks (req-2/6): the consumer's slot calls commit(value)/cancel().
  // In SINGLE-CELL mode commit(v) commits that cell (commitEdit override); in ROW mode commit(v)
  // only WRITES this column's draft (the row commits as a unit later — never per cell). cancel()
  // reverts the cell (single) or the whole row (row mode). Factory-bound per columnId so the
  // row-mode commit targets the right draft key.
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

  // Editor input handlers (the global-filter `evt.target.value` idiom — an untyped param
  // neutralizes to `any`, so reading .value/.checked typechecks ×6; an inline
  // `$data.x = $event.target.value` binding does NOT neutralize and breaks Lit/React JSX).
  // Column-aware: in row mode they write rowDraft[colId] (a FRESH object so Solid/Svelte/React
  // re-derive); single-cell they write the shared draftValue.
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
  // setRowDraft: write ONE key into a FRESH rowDraft object (whole-object replace — an
  // in-place mutation is silently dropped on React/Solid; the family immutable rule).
  function setRowDraft$local(colId: any, value: any) {
    const src = rowDraft || {};
    const next = {};
    for (const k in src) next[k] = src[k];
    next[colId] = value;
    setRowDraft(next);
  }

  // B21: contain a Tab WITHIN the editing row (editMode='row'). Resolve the editable cells'
  // visible col indices for the editing row, find the current editor's col (off the blurring
  // editor's owning [data-grid-cell]), then move to the next/prev editable col WITH WRAP so
  // focus never leaves the row. A no-op when no row is editing / the row has no editable cells.
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
    // Editor-owns-focus contract (quick 260711-i5m): the Tab target becomes the new reactive
    // focus target BEFORE the host-focus call below, so Tab onto an already-mounted #editor
    // drop-in (row mode) also refocuses it via its own lazy $watch.
    setEditFocusColId(editable[nextPos].colId);
    setEditVer(prev => prev + 1);
    focusRowEditorAt(rowIndex, cols[nextPos]);
  }

  // onEditorKeyDown: the editor-LOCAL keymap (req-3). Enter → commit + stay (focus returns
  // to the cell); Tab → commit + advance to the next editable cell; Escape → cancel +
  // revert. preventDefault on handled keys so the grid keymap / native Tab don't double-act.
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
  // onEditorBlur: commit on a genuine click/focus-away (D-01 — an invalid value keeps the
  // editor open via commitEdit's reject path). SKIP when:
  //  - editTransition is set (a synchronous commit/cancel teardown is unmounting the editor), or
  //  - the blur is part of a controlled keyboard transition: focus is moving to a grid cell
  //    or another editor inside our gridRoot (Tab-advance, Enter/Escape focus-return). On the
  //    async-render targets the unmount-blur can fire AFTER the synchronous flag cleared, so
  //    the relatedTarget/containment check is the load-bearing guard, not the flag alone.
  const onEditorBlur = useCallback((e: any) => {
    // Full-row mode (req-6): a blur that stays WITHIN the row editor — Tab/click between the
    // row's OWN fields — is a normal focus move and must NOT commit (a per-cell blur-commit
    // would split the row into N writes + N events, violating the one-write/one-event contract).
    // But an OUTSIDE-click blur (#7) MUST commit the row: otherwise the model is never written
    // AND editingRowIndex stays set, freezing onGridKeyDown's editingRowIndex early-return so
    // arrow-nav is dead the moment the user clicks back into the grid. Mirror the single-cell
    // branch's relatedTarget shape to tell an in-row focus move from a genuine click-away.
    if (inRowEdit()) {
      // Guard the teardown blur: commitRow's writeData/endRowEdit re-render unmounts the row's
      // editors → a same-tick re-render blur must NOT re-enter commitRow (double row-edit-commit).
      // commitRow sets editTransition synchronously BEFORE writeData, so it is set here during the
      // teardown window (the async unmount-blur that fires after endRowEdit finds editingRowIndex
      // already null → inRowEdit() false → the single-cell tail's editingRow<0 guard returns).
      if (editTransition.current) return;
      const rowNext = e ? e.relatedTarget : null;
      const rowNextCell = rowNext && rowNext.closest ? rowNext.closest('[data-grid-cell]') : null;
      const rowNextRow = rowNextCell ? rowNextCell.getAttribute('data-row') : null;
      // Focus landing on a cell of the SAME editing row (Tab/click between the row's own fields) →
      // controlled in-row move, do NOT commit. Anything else — a null relatedTarget, another row,
      // a toolbar/widget, or outside the grid entirely — is an outside-click → commit the row as a
      // unit. commitRow clears editingRowIndex, releasing onGridKeyDown's early-return so nav
      // resumes; a no-op row (nothing changed) takes commitRow's clean #5 no-write/no-emit path.
      if (rowNextRow != null && rowNextRow === String(editingRowIndex)) return;
      commitRow();
      return;
    }
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
  }, [commitEdit, commitRow, editingCol, editingRow, editingRowIndex, inRowEdit, resolveCellEl]);
  // editCell(rowIndex, colIndex) — programmatic edit-entry ($expose, req-3). Coerces +
  // clamps indices, moves the active cell, and opens the editor (no-op on a non-editable
  // cell). Collision-clean (RESEARCH name-check): not a verb/event/prop/ROZ137 member.
  function editCell(rowIndex: any, colIndex: any) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const maxCol = visibleColCount() - 1;
    const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    // A new edit session starts — reset the sync idempotency latch (see editCellLifecycle.rzts).
    committedThisSession.current = false;
    setActiveIsHeader(false);
    setActiveRow(r);
    setActiveColIndex(c);
    beginEdit(r, c, null);
  }

  // commitEditing() — programmatic commit of the open editor ($expose, req-3). No-op when
  // nothing is editing. Collision-clean (not `commit`). Handles BOTH edit modes: a full-row
  // edit (editRow()/Shift+F2) drives editingRowIndex and leaves editingRow at -1, so the
  // single-cell commitEdit guard (editingRow >= 0) is false during a row edit — route to
  // commitRow() first so a programmatic commit of a row editor is not a silent no-op.
  function commitEditing() {
    if (inRowEdit()) {
      commitRow();
      return;
    }
    if (editingRow >= 0) commitEdit(undefined);
  }

  // editRow(rowIndex) — programmatically enter full-row edit on a body row ($expose, req-6 /
  // D-06), the API twin of the Shift+F2 shortcut. Addressed BY INDEX over the visible model
  // (coerced + clamped); no-op on a row with no editable columns. Collision-clean (RESEARCH
  // name-check): `editRow` is not in the 15 existing verbs, not a prop, not a *-change/commit
  // event, not a Lit ROZ137-reserved host member. Moves the active cell to the row first so the
  // commit/cancel focus-return lands in the right row.
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
  // ── Grid active-cell $expose verbs (phase 49 plan 03, D-01) — exactly THREE, joining the
  // existing 12 (→ 15). Collision-safe names (Pitfall 1): focusCell NOT `focus` (would shadow
  // HTMLElement.focus on Lit — ROZ137); clearActiveCell NOT `clear` (listbox already exposes
  // `clear`); getActiveCell is a read-style getter. None collide with the 9 *-change events,
  // any prop, or a React auto-setter (ROZ121/137/524 clear). ──────────────────────────────────

  // focusAbsCellWhenReady — paginated page-switch focus poll (C1). After a programmatic page
  // switch the in-page (localRow, col) cell is ambiguous: EVERY page renders a row at the same
  // page-relative index, so a plain resolveCellEl(localRow, col) poll would grab the OLD page's
  // cell on frame 1 (before the switch commits) and focus it — only for the page switch to then
  // REMOVE it, dropping focus to <body>. Disambiguate by the ABSOLUTE aria-rowindex: poll until
  // the cell at (localRow, col) carries the TARGET page's body aria-rowindex (i.e. the TARGET
  // page has actually rendered), THEN focus. DOM-only (reads gridRoot), so React-stale-safe; works
  // for both controlled (round-trips through page-change) and uncontrolled pagination. ~60 frames
  // (~1s) to cover the controlled-state parent round-trip on React/Solid/Lit.
  //   #13: the body aria-rowindex is now header-offset (bodyAriaRowIndex = headerRowCount + absRow
  //   + 1) so header rows + body rows form one consistent aria-rowindex/aria-rowcount space — so
  //   the poll target must add headerRowCount() too, else it never matches and focus drops.
  function focusAbsCellWhenReady(absRow: any, localRow: any, col: any) {
    if (!gridRoot.current) return;
    let attempts = 0;
    const want = String(headerRowCount() + absRow + 1);
    // #9: capture the focus-intent epoch at arm time (AFTER focusCell's own bump at its top, so
    // this poll never aborts itself). A LATER focus intent — a click landing on a new cell
    // (syncActiveFromEvent) or another focusCell / keyboard nav — bumps the epoch, so this
    // paginated page-switch poll aborts instead of grabbing focus frames after the user moved on.
    const myEpoch = focusIntentEpoch.current;
    const tryFocus = () => {
      if (focusIntentEpoch.current !== myEpoch) return;
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

  // focusCell(rowIndex, colIndex) — move + focus the active cell. C1 (phase 63 wave-6): rowIndex
  // is the ABSOLUTE display-order position in getPrePaginationRowModel().rows (filter+sort+expand
  // applied, BEFORE pagination/windowing), in BOTH paginated and virtual modes — REVERSING the old
  // page-relative-when-paginated meaning. Args are COERCED to integers and CLAMPED before the
  // data-* selector is built (T-49-01/T-63-06-01: never interpolate a raw consumer string; clamp
  // the abs index into getPrePaginationRowModel bounds). The activecell-change payload + getActiveCell
  // speak the SAME absolute language (toAbsRow).
  function focusCell(rowIndex: any, colIndex: any) {
    // B16: isGrid()-gate the verb. In 'table' mode there is no roving active cell, so focusCell
    // is a NO-OP (never an activecell-change emit) — the keyboard path (onGridKeyDown) is already
    // isGrid-gated; the exposed verb must mirror that so a consumer's focusCell on a table-mode
    // instance does not leak a spurious activecell-change.
    if (!isGrid()) return;
    // #9: focusCell is a focus-INTENT entry point — bump the epoch BEFORE arming any poll (the
    // switched-page focusAbsCellWhenReady captures the post-bump value; the same-page / virtual
    // branches route through focusActiveCell, which bumps again — harmless). A subsequent focusCell
    // or user nav bumps again → a pending focusAbsCellWhenReady from THIS call aborts.
    focusIntentEpoch.current = focusIntentEpoch.current + 1;
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
    if (rowsWindowed()) {
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
        // TARGET page's body aria-rowindex (headerRowCount + absRow + 1, #13) before focusing, so
        // the OLD page's same-indexed cell is never grabbed-then-removed (drop-to-<body>). DOM-only.
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

  // getActiveCell() — return the current active-cell position. Integers only — no row data,
  // no DOM node (T-49-02 Information-Disclosure: return the screen position, nothing else).
  // B15: reflect the HEADER-active state. When a header cell is active the roving position is
  // NOT a body row — return the header sentinel (rowIndex null + isHeader true, colIndex the
  // header column) so a consumer never mistakes a header focus for body 'row 0'. A body cell
  // returns the integer rowIndex + isHeader false (back-compatible: the rowIndex/colIndex pair
  // is unchanged for the body case).
  // C1: a body cell returns the ABSOLUTE display-order rowIndex (toAbsRow) — matching focusCell's
  // addressing + the activecell-change payload — in BOTH paginated and virtual modes.
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

  // clearActiveCell() — reset the roving position to the D-04 entry cell (row 0, col 0) and
  // exit interaction mode; the next Tab-in re-enters at the entry cell (D-01). Does NOT emit
  // (no move to a new addressable cell — a reset, not a navigation). B16: isGrid()-gated — a
  // table-mode instance has no roving active cell, so the verb is a no-op there.
  function clearActiveCell() {
    if (!isGrid()) return;
    setActiveIsHeader(false);
    setActiveInControl(false);
    setActiveRow(0);
    setActiveColIndex(0);
  }
  // ── Expand $expose verbs (phase 50 req-3, D-06) — joining the existing 19 (→ 23).
  // Collision-safe names (ROZ121/137/524): toggleRowExpanded / expandAll / collapseAll are
  // not inherited HTMLElement members, Lit lifecycle names, React auto-setters, prop names,
  // or *-change events; getExpandedRows is a read-style getter (twin of getSelectedRows).
  // Each drives @tanstack/table-core so the onExpandedChange → writeExpanded funnel fires
  // one expanded-change. ──────────────────────────────────────────────────────────────────

  // toggleRowExpanded(rowId) — toggle ONE row's expanded state, addressed by the consumer's
  // row id (the data `id` field) OR the table-core row id. Scans the core flat-row set (all
  // rows regardless of current expansion) so a collapsed parent is still resolvable.
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

  // expandAll() — open every expandable row (table-core sets ExpandedState to the `true`
  // literal under the hood → Pitfall 2: writeExpanded passes it through verbatim).
  function expandAll() {
    if (!table.current) return;
    table.current.toggleAllRowsExpanded(true);
  }

  // collapseAll() — reset to a blank expanded state ({}). resetExpanded(true) forces the
  // blank reset (NOT the initialState) and fires onExpandedChange → one expanded-change.
  function collapseAll() {
    if (!table.current) return;
    table.current.resetExpanded(true);
  }

  // getExpandedRows() — return the original row data for every currently-expanded row
  // (read-verb twin of expanded-change). Integers/data only — scans the core flat rows and
  // filters by getIsExpanded(). Empty when nothing is expanded.
  function getExpandedRows() {
    if (!table.current) return [];
    const out = [];
    const flat = table.current.getCoreRowModel().flatRows;
    for (const r of flat as any) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
    return out;
  }
  // ── Grouping $expose verbs (phase 50 reqs 4-7, D-06 name-check) ────────────────────────────
  // applyGrouping (RENAMED from setGrouping — ROZ524: a bare `set<ModelProp>` verb shadows
  // React's auto-generated `setGrouping` useState setter for the `grouping` model slice, and an
  // $expose verb is PUBLIC-CONTRACT-PROTECTED from the deconfliction rename; same precedent as
  // setColumnOrder→applyColumnOrder) + clearGrouping. Both drive @tanstack/table-core's
  // table.setGrouping so the onGroupingChange → writeGrouping funnel fires one group-change with
  // the fresh ordered key list. Also handed to the headless #groupBar slot as apply/clear helpers.
  function applyGrouping(cols: any) {
    if (table.current) table.current.setGrouping(cols);
  }
  function clearGrouping() {
    if (table.current) table.current.setGrouping([]);
  }
  // ── Faceted filtering read helpers (phase 50 reqs 8-9, D-03) ────────────────────────────────
  // Shared by BOTH the getFaceted* $expose verbs AND the #filter slot props. They resolve a
  // column via table.getColumn(colId) (a table-core lookup — NEVER a string-built querySelector,
  // T-50-06 / the T-49-01 index-only discipline) and read table-core's CROSS-FILTERED faceted
  // values (default impl — reflects rows passing all OTHER active column filters, D-03). They
  // touch the reactive tick (`tick() < 0` guard) so the #filter slot props re-derive when an
  // upstream filter changes on the fine-grained targets (Solid/Lit) — the visibleCellsFor idiom.
  //
  // getFacetedUniqueValues: the column's distinct values, KEYS ONLY — occurrence counts are
  // deliberately NOT exposed (D-03; the column's getFacetedUniqueValues() returns Map<any,number>,
  // we return Array.from(map.keys()) — no .entries()/count surface). Empty array on missing
  // column/table. NAMED to match the $expose verb exactly (the ExposedMethod.name shorthand
  // contract: an exposed verb lowers to `{ getFacetedUniqueValues }`, which must resolve to THIS
  // helper — the table-core factory was aliased to makeFacetedUniqueValues to free this name).
  function getFacetedUniqueValues(colId: any) {
    if (tick() < 0 || !table.current) return [];
    const col = table.current.getColumn(colId);
    if (!col || !col.getFacetedUniqueValues) return [];
    const map = col.getFacetedUniqueValues(); // Map<any, number>
    return map ? Array.from(map.keys()) : []; // KEYS only — counts deferred (D-03)
  }
  // getFacetedMinMaxValues: the column's [min, max] numeric range, or null when unavailable.
  // Named to match the $expose verb (same shorthand contract as getFacetedUniqueValues above).
  function getFacetedMinMaxValues(colId: any) {
    if (tick() < 0 || !table.current) return null;
    const col = table.current.getColumn(colId);
    if (!col || !col.getFacetedMinMaxValues) return null;
    return col.getFacetedMinMaxValues() || null; // [number, number] | null
  }

  const _clampActiveCellRef = useRef(clampActiveCell);
  _clampActiveCellRef.current = clampActiveCell;
  const _colsWindowedRef = useRef(colsWindowed);
  _colsWindowedRef.current = colsWindowed;
  const _currentDataRef = useRef(currentData);
  _currentDataRef.current = currentData;
  const _currentStateRef = useRef(currentState);
  _currentStateRef.current = currentState;
  const _effectiveColumnFiltersRef = useRef(effectiveColumnFilters);
  _effectiveColumnFiltersRef.current = effectiveColumnFilters;
  const _effectiveGlobalFilterRef = useRef(effectiveGlobalFilter);
  _effectiveGlobalFilterRef.current = effectiveGlobalFilter;
  const _effectiveSortingRef = useRef(effectiveSorting);
  _effectiveSortingRef.current = effectiveSorting;
  const _focusCellWhenReadyRef = useRef(focusCellWhenReady);
  _focusCellWhenReadyRef.current = focusCellWhenReady;
  const _isGridRef = useRef(isGrid);
  _isGridRef.current = isGrid;
  const _isWindowedRef = useRef(isWindowed);
  _isWindowedRef.current = isWindowed;
  const _onColumnFiltersChangeCbRef = useRef(onColumnFiltersChangeCb);
  _onColumnFiltersChangeCbRef.current = onColumnFiltersChangeCb;
  const _onColumnOrderChangeCbRef = useRef(onColumnOrderChangeCb);
  _onColumnOrderChangeCbRef.current = onColumnOrderChangeCb;
  const _onColumnPinningChangeCbRef = useRef(onColumnPinningChangeCb);
  _onColumnPinningChangeCbRef.current = onColumnPinningChangeCb;
  const _onColumnSizingChangeCbRef = useRef(onColumnSizingChangeCb);
  _onColumnSizingChangeCbRef.current = onColumnSizingChangeCb;
  const _onColumnSizingInfoChangeCbRef = useRef(onColumnSizingInfoChangeCb);
  _onColumnSizingInfoChangeCbRef.current = onColumnSizingInfoChangeCb;
  const _onColumnVisibilityChangeCbRef = useRef(onColumnVisibilityChangeCb);
  _onColumnVisibilityChangeCbRef.current = onColumnVisibilityChangeCb;
  const _onExpandedChangeCbRef = useRef(onExpandedChangeCb);
  _onExpandedChangeCbRef.current = onExpandedChangeCb;
  const _onGlobalFilterChangeCbRef = useRef(onGlobalFilterChangeCb);
  _onGlobalFilterChangeCbRef.current = onGlobalFilterChangeCb;
  const _onGroupingChangeCbRef = useRef(onGroupingChangeCb);
  _onGroupingChangeCbRef.current = onGroupingChangeCb;
  const _onPaginationChangeCbRef = useRef(onPaginationChangeCb);
  _onPaginationChangeCbRef.current = onPaginationChangeCb;
  const _onRowSelectionChangeCbRef = useRef(onRowSelectionChangeCb);
  _onRowSelectionChangeCbRef.current = onRowSelectionChangeCb;
  const _onSortingChangeCbRef = useRef(onSortingChangeCb);
  _onSortingChangeCbRef.current = onSortingChangeCb;
  const _rowsWindowedRef = useRef(rowsWindowed);
  _rowsWindowedRef.current = rowsWindowed;
  const _syncIndeterminateRef = useRef(syncIndeterminate);
  _syncIndeterminateRef.current = syncIndeterminate;
  const _tableColumnsRef = useRef(tableColumns);
  _tableColumnsRef.current = tableColumns;
  const _virtualizerOptionsRef = useRef(virtualizerOptions);
  _virtualizerOptionsRef.current = virtualizerOptions;
  const _windowSourceRef = useRef(windowSource);
  _windowSourceRef.current = windowSource;
  const _writePaginationRef = useRef(writePagination);
  _writePaginationRef.current = writePagination;
  useEffect(() => {
    const _onColumnFiltersChangeCbStable: typeof _onColumnFiltersChangeCbRef.current = (...args) => _onColumnFiltersChangeCbRef.current(...args);
    const _onColumnOrderChangeCbStable: typeof _onColumnOrderChangeCbRef.current = (...args) => _onColumnOrderChangeCbRef.current(...args);
    const _onColumnPinningChangeCbStable: typeof _onColumnPinningChangeCbRef.current = (...args) => _onColumnPinningChangeCbRef.current(...args);
    const _onColumnSizingChangeCbStable: typeof _onColumnSizingChangeCbRef.current = (...args) => _onColumnSizingChangeCbRef.current(...args);
    const _onColumnSizingInfoChangeCbStable: typeof _onColumnSizingInfoChangeCbRef.current = (...args) => _onColumnSizingInfoChangeCbRef.current(...args);
    const _onColumnVisibilityChangeCbStable: typeof _onColumnVisibilityChangeCbRef.current = (...args) => _onColumnVisibilityChangeCbRef.current(...args);
    const _onExpandedChangeCbStable: typeof _onExpandedChangeCbRef.current = (...args) => _onExpandedChangeCbRef.current(...args);
    const _onGlobalFilterChangeCbStable: typeof _onGlobalFilterChangeCbRef.current = (...args) => _onGlobalFilterChangeCbRef.current(...args);
    const _onGroupingChangeCbStable: typeof _onGroupingChangeCbRef.current = (...args) => _onGroupingChangeCbRef.current(...args);
    const _onPaginationChangeCbStable: typeof _onPaginationChangeCbRef.current = (...args) => _onPaginationChangeCbRef.current(...args);
    const _onRowSelectionChangeCbStable: typeof _onRowSelectionChangeCbRef.current = (...args) => _onRowSelectionChangeCbRef.current(...args);
    const _onSortingChangeCbStable: typeof _onSortingChangeCbRef.current = (...args) => _onSortingChangeCbRef.current(...args);
    const _syncIndeterminateStable: typeof _syncIndeterminateRef.current = (...args) => _syncIndeterminateRef.current(...args);
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
      data: _currentDataRef.current(),
      columns: _tableColumnsRef.current(),
      state: _currentStateRef.current(),
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
      getSubRows: (_getSubRowsRef.current || undefined) as any,
      getRowCanExpand: _expandableRef.current === true && _getSubRowsRef.current == null ? () => true : undefined,
      onExpandedChange: _onExpandedChangeCbStable,
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
      onGroupingChange: _onGroupingChangeCbStable,
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
      manualPagination: _manualRef.current === true,
      manualFiltering: _manualRef.current === true,
      manualSorting: _manualRef.current === true,
      // Server-side page-count sources (#2): pass the consumer-supplied total row count and/or
      // explicit page count so table-core can compute getPageCount() under `manual` (where it
      // does not hold the full dataset). undefined when unset → table-core auto-derives from the
      // loaded data (client-pagination path byte-unchanged). Precedence is table-core's: explicit
      // pageCount wins, else ⌈rowCount / pageSize⌉, else auto. With a real count getCanNextPage()
      // becomes true, so a server-pagination consumer can leave page 0.
      rowCount: _rowCountRef.current ?? undefined,
      pageCount: _pageCountRef.current ?? undefined,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: _selectionModeRef.current !== 'none',
      enableMultiRowSelection: _selectionModeRef.current === 'multiple',
      // PER-SLICE callbacks (Open-Q1: each maps 1:1 to a slice's r-model + change event,
      // no global onStateChange diff) — hoisted top-level consts, re-passed by the re-feed
      // $watch so React reads fresh currentState (the stale-closure fix, F6).
      onSortingChange: _onSortingChangeCbStable,
      onGlobalFilterChange: _onGlobalFilterChangeCbStable,
      onColumnFiltersChange: _onColumnFiltersChangeCbStable,
      onPaginationChange: _onPaginationChangeCbStable,
      onRowSelectionChange: _onRowSelectionChangeCbStable,
      onColumnVisibilityChange: _onColumnVisibilityChangeCbStable,
      onColumnSizingChange: _onColumnSizingChangeCbStable,
      onColumnOrderChange: _onColumnOrderChangeCbStable,
      onColumnPinningChange: _onColumnPinningChangeCbStable,
      onColumnSizingInfoChange: _onColumnSizingInfoChangeCbStable,
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
      const nextRows = _windowSourceRef.current().slice();
      const nextGroups = table.current.getHeaderGroups().slice();
      setRows(nextRows);
      setHeaderGroups(nextGroups);
      setRowModelVer(prev => prev + 1);
      // Vertical windowing re-feed (Pitfall 2 — stale count): push the fresh full-model count
      // into the virtualizer + reconcile IMPERATIVELY here (the table.setOptions re-feed path),
      // NEVER in a render helper (Pitfall 1). Pass the COMPLETE options set (virtual-core's
      // setOptions replaces, not merges). Guarded so the off path executes no virtual-core code.
      if (_rowsWindowedRef.current() && virtualizer.current) {
        virtualizer.current.setOptions(_virtualizerOptionsRef.current());
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
      _clampActiveCellRef.current(nextRowCount, nextColCount);
      // #4: clamp a pageIndex that now points PAST the last page. When the consumer holds
      // pagination.pageIndex (controlled) and shrinks the data (filter / replace) so there are
      // fewer pages, the body renders blank ("Page 6 of 3" with Next disabled). Read table-core's
      // LIVE post-re-derive state: getPageCount() is the fresh count (now correct under `manual`
      // too, #2) and getState().pagination is the just-fed state. Funnel the correction through
      // writePagination (the single-emit + two-way-model funnel) so the consumer's controlled
      // pagination prop converges to the last valid page (page-change carries { pageIndex, pageSize }).
      //   • pc > 0 skips the manual-WITHOUT-count case (getPageCount() === -1) — never clamp toward
      //     an unknown total.
      //   • LOOP-GUARD: emit ONLY when the clamped index actually differs. After the consumer echoes
      //     the clamp back through the pagination prop, the re-feed re-enters here with
      //     pageIndex === pc - 1, so `pageIndex > pc - 1` is false → no re-emit; a consumer that
      //     ignores the event triggers no further re-feed, so it stays a single emit either way.
      //   • No fight with table-core's autoResetPageIndex: that reset only fires on table-core's OWN
      //     setX mutations, which this fully-controlled-state architecture never calls (filters/data
      //     flow through setOptions), so reading the live state here can only fire on a genuine
      //     overflow — if the index is already valid we stay silent (uncontrolled self-heals too,
      //     writing paginationDefault, with no regression since table-core does not auto-clamp here).
      const pgState = table.current.getState().pagination;
      const pc = table.current.getPageCount();
      if (pc > 0 && pgState.pageIndex > pc - 1) {
        _writePaginationRef.current({
          pageIndex: pc - 1,
          pageSize: pgState.pageSize
        });
      }
      // B23: a just-committed single-cell edit may have RELOCATED its row under an active sort/
      // filter. `nextRows` is the FRESH visible model (its index space == the rendered data-row
      // indices), so resolve the committed row's NEW index by identity HERE (never from the React-
      // stale state) and re-seat focus on that cell via the DOM-only poll (focusCellWhenReady reads
      // gridRoot only → React-safe). Consumed ONCE (cleared) so a multi-render re-feed focuses once;
      // a no-relocation commit resolves the same index → byte-behaviorally identical to before.
      if (pendingEditFollow.current && _isGridRef.current()) {
        const follow = pendingEditFollow.current;
        pendingEditFollow.current = null;
        const followIdx = indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
        if (followIdx >= 0) _focusCellWhenReadyRef.current(followIdx, follow.col);
      }
      // keep the select-all checkbox's `indeterminate` DOM property in lockstep with the
      // selection state (bound :indeterminate is inert on 5/6 targets). The box persists
      // across selection changes; a microtask defer covers React's post-render DOM patch.
      _syncIndeterminateRef.current();
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(_syncIndeterminateStable);else Promise.resolve().then(_syncIndeterminateStable);
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

    // ── Windowing: capture the scroll element + construct the row virtualizer (req-1/2 — the
    // row virtual-core instance ONLY when rows are windowed; the scroll-element capture whenever
    // EITHER axis is windowed, since both axes observe the SAME .rdt-scroll element — D-03). Built
    // HERE (post-mount) so getScrollElement resolves the rendered .rdt-scroll div and
    // getPrePaginationRowModel reads the live table. ENTIRELY inside the isWindowed()/rowsWindowed()
    // guards: when both axes are off, NO virtual-core runtime code executes (byte-identical-off).
    // _didMount() registers the scroll-element ResizeObserver and returns the teardown stored for
    // $onUnmount.
    if (_isWindowedRef.current()) {
      gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rdt-scroll') : null;
    }
    if (_rowsWindowedRef.current()) {
      virtualizer.current = new Virtualizer(_virtualizerOptionsRef.current());
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
    }
    // After the first window commits (next frame), refine heights + fire the dev-mode warns ONCE.
    // Entirely inside the isWindowed() guard so the off (neither axis windowed) emitted path adds
    // NO code and these warns can never fire there (req-1 byte-identical-off preserved). The
    // row-specific measurement + warns stay further guarded by rowsWindowed() (byte-identical to
    // before this restructure); the column-axis warn (Phase 87 D-07(a)) is guarded by
    // colsWindowed() so it can fire ONLY on the 'columns'/'both' path, never on 'rows'/true/false.
    if (_isWindowedRef.current()) {
      const afterFirstFrame = () => {
        if (_rowsWindowedRef.current()) {
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
          // virtual=false path are untouched (rowsWindowed()-guarded, as before this restructure).
          const pg = _paginationRef.current;
          const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
          if (_manualRef.current !== true && pgConfigured) {
            console.warn('[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.');
          }
        }
        // Phase 87 Task 1(a) (D-07/D-08 precedent, APPROVED): a dev-mode runtime warn when the
        // column axis is windowed but the scroll container has no bounded width — the horizontal
        // failure mode is worse than the vertical one (an unbounded width renders every column
        // with no scrollbar, so the feature silently does nothing and there is no compile
        // diagnostic possible, since the bound may come from consumer CSS). Guarded by
        // colsWindowed() so it can NEVER fire on the 'rows'/true/false path.
        if (_colsWindowedRef.current()) {
          const w = gridScrollEl.current ? gridScrollEl.current.clientWidth : 0;
          if (!w) {
            console.warn('[rozie-data-table] virtual is on for columns but the scroll container has no bounded width; set a CSS width on an ancestor so the column window can be measured');
          }
        }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));else setTimeout(afterFirstFrame, 0);
    }

    // #14: seed the sort/filter announce baseline from the initial (post-mount) state so the LAZY
    // watch's first fire — a real user sort/filter — compares against the true starting values and
    // is classified correctly (a null sentinel would misread the first filter change as a sort change).
    announceState.sorting = _effectiveSortingRef.current();
    announceState.columnFilters = _effectiveColumnFiltersRef.current();
    announceState.globalFilter = _effectiveGlobalFilterRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (virtualizerCleanup.current) virtualizerCleanup.current();
      // CR-04: remove any live fill-drag document listeners if we unmount mid-drag.
      teardownFillDrag();
      // §6 (260709-3qt): remove any live drag-select document listeners on a mid-drag unmount.
      teardownRangeDrag();
    };
  }, []);
  useEffect(() => {
    maybeClearHistoryOnExternalSwap();
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
  }, [currentData, lastData, lastDataLen, maybeClearHistoryOnExternalSwap, reFeed, table]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    reFeed();
    maybeClearHistoryOnExternalSwap();
  }, [colReg, columnFilters, columnOrder, columnPinning, columnSizing, columnVisibility, data, dataDefault, expanded, globalFilter, grouping, pagination, props.columns, props.expandable, props.groupable, props.pageCount, props.rowCount, props.selectionMode, rowSelection, sorting]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const msg = buildSortFilterAnnounce();
    if (msg) setLiveAnnounce(msg);
  }, [columnFilters, columnFiltersDefault, globalFilter, globalFilterDefault, sorting, sortingDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ sortColumn, clearSorting, toggleRowExpanded, expandAll, collapseAll, getExpandedRows, applyGrouping, clearGrouping, getFacetedUniqueValues, getFacetedMinMaxValues, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, getRowIndexRelativeToPage, editCell, commitEditing, editRow, getSelectedRange, cut, undo, redo, canUndo, canRedo, clearHistory });
  _rozieExposeRef.current = { sortColumn, clearSorting, toggleRowExpanded, expandAll, collapseAll, getExpandedRows, applyGrouping, clearGrouping, getFacetedUniqueValues, getFacetedMinMaxValues, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, getRowIndexRelativeToPage, editCell, commitEditing, editRow, getSelectedRange, cut, undo, redo, canUndo, canRedo, clearHistory };
  useImperativeHandle(ref, () => ({ sortColumn: (...args: Parameters<typeof sortColumn>): ReturnType<typeof sortColumn> => _rozieExposeRef.current.sortColumn(...args), clearSorting: (...args: Parameters<typeof clearSorting>): ReturnType<typeof clearSorting> => _rozieExposeRef.current.clearSorting(...args), toggleRowExpanded: (...args: Parameters<typeof toggleRowExpanded>): ReturnType<typeof toggleRowExpanded> => _rozieExposeRef.current.toggleRowExpanded(...args), expandAll: (...args: Parameters<typeof expandAll>): ReturnType<typeof expandAll> => _rozieExposeRef.current.expandAll(...args), collapseAll: (...args: Parameters<typeof collapseAll>): ReturnType<typeof collapseAll> => _rozieExposeRef.current.collapseAll(...args), getExpandedRows: (...args: Parameters<typeof getExpandedRows>): ReturnType<typeof getExpandedRows> => _rozieExposeRef.current.getExpandedRows(...args), applyGrouping: (...args: Parameters<typeof applyGrouping>): ReturnType<typeof applyGrouping> => _rozieExposeRef.current.applyGrouping(...args), clearGrouping: (...args: Parameters<typeof clearGrouping>): ReturnType<typeof clearGrouping> => _rozieExposeRef.current.clearGrouping(...args), getFacetedUniqueValues: (...args: Parameters<typeof getFacetedUniqueValues>): ReturnType<typeof getFacetedUniqueValues> => _rozieExposeRef.current.getFacetedUniqueValues(...args), getFacetedMinMaxValues: (...args: Parameters<typeof getFacetedMinMaxValues>): ReturnType<typeof getFacetedMinMaxValues> => _rozieExposeRef.current.getFacetedMinMaxValues(...args), getColumnDefs: (...args: Parameters<typeof getColumnDefs>): ReturnType<typeof getColumnDefs> => _rozieExposeRef.current.getColumnDefs(...args), toggleAllRows: (...args: Parameters<typeof toggleAllRows>): ReturnType<typeof toggleAllRows> => _rozieExposeRef.current.toggleAllRows(...args), clearSelection: (...args: Parameters<typeof clearSelection>): ReturnType<typeof clearSelection> => _rozieExposeRef.current.clearSelection(...args), getSelectedRows: (...args: Parameters<typeof getSelectedRows>): ReturnType<typeof getSelectedRows> => _rozieExposeRef.current.getSelectedRows(...args), setPage: (...args: Parameters<typeof setPage>): ReturnType<typeof setPage> => _rozieExposeRef.current.setPage(...args), setRowsPerPage: (...args: Parameters<typeof setRowsPerPage>): ReturnType<typeof setRowsPerPage> => _rozieExposeRef.current.setRowsPerPage(...args), toggleColumnVisibility: (...args: Parameters<typeof toggleColumnVisibility>): ReturnType<typeof toggleColumnVisibility> => _rozieExposeRef.current.toggleColumnVisibility(...args), applyColumnOrder: (...args: Parameters<typeof applyColumnOrder>): ReturnType<typeof applyColumnOrder> => _rozieExposeRef.current.applyColumnOrder(...args), resetColumnSizing: (...args: Parameters<typeof resetColumnSizing>): ReturnType<typeof resetColumnSizing> => _rozieExposeRef.current.resetColumnSizing(...args), pinColumn: (...args: Parameters<typeof pinColumn>): ReturnType<typeof pinColumn> => _rozieExposeRef.current.pinColumn(...args), focusCell: (...args: Parameters<typeof focusCell>): ReturnType<typeof focusCell> => _rozieExposeRef.current.focusCell(...args), getActiveCell: (...args: Parameters<typeof getActiveCell>): ReturnType<typeof getActiveCell> => _rozieExposeRef.current.getActiveCell(...args), clearActiveCell: (...args: Parameters<typeof clearActiveCell>): ReturnType<typeof clearActiveCell> => _rozieExposeRef.current.clearActiveCell(...args), getRowIndexRelativeToPage: (...args: Parameters<typeof getRowIndexRelativeToPage>): ReturnType<typeof getRowIndexRelativeToPage> => _rozieExposeRef.current.getRowIndexRelativeToPage(...args), editCell: (...args: Parameters<typeof editCell>): ReturnType<typeof editCell> => _rozieExposeRef.current.editCell(...args), commitEditing: (...args: Parameters<typeof commitEditing>): ReturnType<typeof commitEditing> => _rozieExposeRef.current.commitEditing(...args), editRow: (...args: Parameters<typeof editRow>): ReturnType<typeof editRow> => _rozieExposeRef.current.editRow(...args), getSelectedRange: (...args: Parameters<typeof getSelectedRange>): ReturnType<typeof getSelectedRange> => _rozieExposeRef.current.getSelectedRange(...args), cut: (...args: Parameters<typeof cut>): ReturnType<typeof cut> => _rozieExposeRef.current.cut(...args), undo: (...args: Parameters<typeof undo>): ReturnType<typeof undo> => _rozieExposeRef.current.undo(...args), redo: (...args: Parameters<typeof redo>): ReturnType<typeof redo> => _rozieExposeRef.current.redo(...args), canUndo: (...args: Parameters<typeof canUndo>): ReturnType<typeof canUndo> => _rozieExposeRef.current.canUndo(...args), canRedo: (...args: Parameters<typeof canRedo>): ReturnType<typeof canRedo> => _rozieExposeRef.current.canRedo(...args), clearHistory: (...args: Parameters<typeof clearHistory>): ReturnType<typeof clearHistory> => _rozieExposeRef.current.clearHistory(...args) }), []);

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

    {!!(!!invalidMsg) && <div className={"rdt-sr-live"} role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{invalidMsg}</div>}{!!(!!pasteAnnounce) && <div className={"rdt-sr-live rdt-sr-paste"} data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{pasteAnnounce}</div>}{!!(!!liveAnnounce) && <div className={"rdt-sr-live rdt-sr-sortfilter"} data-testid="sortfilter-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{liveAnnounce}</div>}<div className={"rdt-toolbar"} data-rozie-s-d5dcab4c="">
      <input className={"rdt-global-filter"} type="text" role="searchbox" aria-label="Search table" value={globalFilterValue()} onInput={($event) => { onGlobalFilterInput($event); }} data-rozie-s-d5dcab4c="" />
      
      {!!(allLeafColumns().length) && <details className={"rdt-colvis"} data-rozie-s-d5dcab4c="">
        <summary className={"rdt-colvis-summary"} data-rozie-s-d5dcab4c="">Columns</summary>
        <div className={"rdt-colvis-menu"} role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c="">
          {allLeafColumns().map((lc) => <label key={lc.id} className={"rdt-colvis-item"} data-rozie-s-d5dcab4c="">
            <input type="checkbox" className={"rdt-colvis-checkbox"} checked={lc.visible} onChange={($event) => { onToggleVisibility(lc.id); }} data-rozie-s-d5dcab4c="" />
            <span className={"rdt-colvis-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(lc.label)}</span>
          </label>)}
        </div>
      </details>}</div>


    {!!(props.groupable) && <div className={"rdt-group-bar-host"} data-rozie-s-d5dcab4c="">
      {(props.renderGroupBar ?? props.slots?.['groupBar']) ? ((props.renderGroupBar ?? props.slots?.['groupBar']) as Function)({ grouping: groupingKeys(), groupableColumns: groupableColumns(), applyGrouping, clearGrouping }) : groupingKeys().map((gk) => <span key={gk} className={"rdt-group-token"} data-group-token="" data-rozie-s-d5dcab4c="">{rozieDisplay(gk)}</span>)}
    </div>}{(isWindowed()) ? <div className={"rdt-scroll"} style={parseInlineStyle(rowsWindowed() && props.maxHeight ? 'max-height:' + props.maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + props.maxHeight : 'overflow:auto')} data-rozie-s-d5dcab4c="">
    <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} aria-rowcount={gridAriaRowCount()} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} onDoubleClick={($event) => { onGridDblClick($event); }} onClick={($event) => { onGridClick($event); }} data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg, hgLevel) => <tr key={hg.id} className={"rdt-tr"} role="row" aria-rowindex={hgLevel + 1} data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-expander-th": isExpanderColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id), "rdt-cell-active": isActiveCell('__header', headerColIndexOf(hg, header), hgLevel) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel)} colSpan={(header.colSpan > 1 ? header.colSpan : undefined) ?? undefined} data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={cellTabindex('__header', headerColIndexOf(hg, header), hgLevel)} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectAll ?? props.slots?.['selectAll']) ? ((props.renderSelectAll ?? props.slots?.['selectAll']) as Function)({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) : !!(props.selectionMode === 'multiple') && <input className={"rdt-select-all"} type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (isExpanderColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(header.column.getCanSort && header.column.getCanSort()) ? <button type="button" className={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
                <span className={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
              </span>}<Popover trigger="click" placement="bottom-end" strategy="fixed" offset={4} data-rozie-s-d5dcab4c="" renderAnchor={() => (<>
                  <button type="button" className={"rdt-col-menu-trigger"} aria-label={rozieAttr('Column options for ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">⋯</button>
                </>)} children={<><div className={"rdt-col-menu"} role="menu" data-rozie-s-d5dcab4c="">
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} aria-pressed={columnPinSide(header.column.id) === 'left'} onClick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c="">Pin left</button>
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} aria-pressed={columnPinSide(header.column.id) === 'right'} onClick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c="">Pin right</button>
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} aria-pressed={!columnPinSide(header.column.id)} onClick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c="">Unpin</button>
                  <hr className={"rdt-col-menu-sep"} data-rozie-s-d5dcab4c="" />
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} onClick={($event) => { onHideColumn(header.column.id, $event); }} data-rozie-s-d5dcab4c="">Hide column</button>
                </div></>} />
              <button type="button" className={"rdt-resize-handle"} aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onPointerDown={($event) => { onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span className={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}</th>)}
        </tr>)}
        
        {!!(hasAnyFilterableColumn()) && <tr className={"rdt-filter-row"} data-rozie-s-d5dcab4c="">
          {headerGroups[headerGroups.length - 1].headers.map((header) => <th key={header.id} className={"rdt-filter-cell"} role="presentation" style={parseInlineStyle(pinStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : (isExpanderColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {!!(columnIsFilterable(header.column.id) && !hasFilterSlot()) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" />}{!!(columnIsFilterable(header.column.id)) && <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderFilter ?? props.slots?.['filter'])?.({ columnId: header.column.id, value: columnFilterValue(header.column.id), uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter })}
              </span>}</span>}</th>)}
        </tr>}</thead>

      <tbody className={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        
        <tr className={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={visibleColCount()} style={parseInlineStyle('height:' + padTop() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
        
        {windowedRows().map((wr) => <Fragment key={wr.row.id}>
        <tr key={wr.row.id} className={clsx("rdt-tr", { "rdt-group-header": rowIsGrouped(wr.row), "rdt-row-pinned": wr.pinned })} role="row" data-row={rozieAttr(wr.vi.index)} aria-rowindex={headerRowCount() + wr.vi.index + 1} data-index={rozieAttr(wr.vi.index)} data-pinned={rozieAttr(wr.pinned ? 'true' : undefined)} data-depth={rozieAttr(wr.row.depth)} data-group-header={rozieAttr(rowIsGrouped(wr.row) ? wr.row.id : undefined)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(wr.row) ? wr.row.id : undefined)} aria-expanded={(rowIsGrouped(wr.row) ? !!rowIsExpanded(wr.row) : undefined) ?? undefined} aria-selected={(props.selectionMode !== 'none' ? !!rowIsSelected(wr.row) : undefined) ?? undefined} aria-level={(groupingActive() ? wr.row.depth + 1 : undefined) ?? undefined} data-rozie-s-d5dcab4c="">
          {visibleCellsFor(wr.row).map((cell) => <td key={cell.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cell.column.id), "rdt-expander-td": isExpanderColumn(cell.column.id), "rdt-in-range": inRange(wr.vi.index, colIndexOf(wr.row, cell)), "rdt-cell-active": isActiveCell(String(wr.vi.index), colIndexOf(wr.row, cell)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cell.column.id)} data-grid-cell="" data-row={rozieAttr(wr.vi.index)} data-col-index={rozieAttr(colIndexOf(wr.row, cell))} tabIndex={cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cell))} style={parseInlineStyle(bodyCellStyle(wr.row, cell.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cell)))} data-in-range={rozieAttr(inRange(wr.vi.index, colIndexOf(wr.row, cell)) ? 'true' : undefined)} data-agg-cell={rozieAttr(cellIsAggregated(cell) ? cell.column.id : undefined)} data-rozie-s-d5dcab4c="">
            
            {(isExpanderColumn(cell.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {!!(rowCanExpand(wr.row)) && <button type="button" className={"rdt-expander"} data-expander="" aria-expanded={!!rowIsExpanded(wr.row)} aria-label={rozieAttr(rowIsExpanded(wr.row) ? 'Collapse row' : 'Expand row')} onClick={($event) => { onToggleExpand(wr.row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(wr.row) ? '▾' : '▸')}</button>}</span> : (isSelectColumn(cell.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: wr.row.original, checked: rowIsSelected(wr.row), toggle: e => onToggleRow(wr.row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(wr.row)} onChange={($event) => { onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (cellIsGrouped(cell)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" className={"rdt-expander rdt-group-toggle"} data-expander="" aria-expanded={!!rowIsExpanded(wr.row)} aria-label={rozieAttr(rowIsExpanded(wr.row) ? 'Collapse group' : 'Expand group')} onClick={($event) => { onToggleExpand(wr.row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(wr.row) ? '▾' : '▸')}</button>
              <span className={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cell.column.id, column: cell.column, row: wr.row.original, value: cell.getValue() }) : rozieDisplay(cell.getValue())}
              </span>
              <span className={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay('(' + groupSubRowCount(wr.row) + ')')}</span>
            </span> : (isEditing(wr.vi.index, colIndexOf(wr.row, cell))) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(hasEditorSlot(cell.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderEditor ?? props.slots?.['editor'])?.({ columnId: cell.column.id, column: cell.column, row: wr.row.original, value: editorValueFor(cell.column.id), commit: editorCommitFor(cell.column.id), cancel: editorCancelFor(), autofocus: editorAutofocusFor(cell.column.id, wr.vi.index) })}
              </span> : (editorTypeOf(cell.column.id) === 'number') ? <input className={"rdt-cell-editor"} type="number" data-editing-cell="" value={editorValueFor(cell.column.id)} onInput={($event) => { onCellEditorInput(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : (editorTypeOf(cell.column.id) === 'select') ? <select className={"rdt-cell-editor"} data-editing-cell="" value={editorValueFor(cell.column.id)} onChange={($event) => { onCellEditorInput(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                {editorOptionsOf(cell.column.id).map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>)}
              </select> : (editorTypeOf(cell.column.id) === 'checkbox') ? <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" checked={editorCheckedFor(cell.column.id)} onChange={($event) => { onCellEditorCheckbox(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : <input className={"rdt-cell-editor"} type="text" data-editing-cell="" value={editorValueFor(cell.column.id)} onInput={($event) => { onCellEditorInput(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}</span> : (cellIsPlaceholder(cell)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cell.column.id, column: cell.column, row: wr.row.original, value: cell.getValue() }) : rozieDisplay(cell.getValue())}
            </span>}{!!(isFillHandleCell(wr.vi.index, colIndexOf(wr.row, cell))) && <span className={"rdt-fill-handle"} data-fill-handle="" data-testid="fill-handle" aria-hidden="true" onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" />}</td>)}
        </tr>
        
        {!!(rowShowsDetail(wr.row)) && <tr key={wr.row.id} className={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(wr.row.id)} data-rozie-s-d5dcab4c="">
          <td className={"rdt-detail-cell"} colSpan={visibleColCount()} data-rozie-s-d5dcab4c="">
            {(props.renderDetail ?? props.slots?.['detail'])?.({ row: wr.row.original })}
          </td>
        </tr>}</Fragment>)}
        
        <tr className={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={visibleColCount()} style={parseInlineStyle('height:' + padBottom() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
      </tbody>
    </table>
    </div> : <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} aria-rowcount={gridAriaRowCount()} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} onDoubleClick={($event) => { onGridDblClick($event); }} onClick={($event) => { onGridClick($event); }} data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg, hgLevel) => <tr key={hg.id} className={"rdt-tr"} role="row" aria-rowindex={hgLevel + 1} data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-expander-th": isExpanderColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id), "rdt-cell-active": isActiveCell('__header', headerColIndexOf(hg, header), hgLevel) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel)} colSpan={(header.colSpan > 1 ? header.colSpan : undefined) ?? undefined} data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={cellTabindex('__header', headerColIndexOf(hg, header), hgLevel)} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectAll ?? props.slots?.['selectAll']) ? ((props.renderSelectAll ?? props.slots?.['selectAll']) as Function)({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) : !!(props.selectionMode === 'multiple') && <input className={"rdt-select-all"} type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (isExpanderColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              
              {(header.column.getCanSort && header.column.getCanSort()) ? <button type="button" className={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
                <span className={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(props.renderColHeader ?? props.slots?.['colHeader']) ? ((props.renderColHeader ?? props.slots?.['colHeader']) as Function)({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) : rozieDisplay(headerLabel(header.column.id))}
                </span>
              </span>}<Popover trigger="click" placement="bottom-end" strategy="fixed" offset={4} data-rozie-s-d5dcab4c="" renderAnchor={() => (<>
                  <button type="button" className={"rdt-col-menu-trigger"} aria-label={rozieAttr('Column options for ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">⋯</button>
                </>)} children={<><div className={"rdt-col-menu"} role="menu" data-rozie-s-d5dcab4c="">
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} aria-pressed={columnPinSide(header.column.id) === 'left'} onClick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c="">Pin left</button>
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} aria-pressed={columnPinSide(header.column.id) === 'right'} onClick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c="">Pin right</button>
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} aria-pressed={!columnPinSide(header.column.id)} onClick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c="">Unpin</button>
                  <hr className={"rdt-col-menu-sep"} data-rozie-s-d5dcab4c="" />
                  <button type="button" role="menuitem" className={"rdt-col-menu-item"} onClick={($event) => { onHideColumn(header.column.id, $event); }} data-rozie-s-d5dcab4c="">Hide column</button>
                </div></>} />
              
              <button type="button" className={"rdt-resize-handle"} aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onPointerDown={($event) => { onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span className={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}</th>)}
        </tr>)}
        
        {!!(hasAnyFilterableColumn()) && <tr className={"rdt-filter-row"} data-rozie-s-d5dcab4c="">
          {headerGroups[headerGroups.length - 1].headers.map((header) => <th key={header.id} className={"rdt-filter-cell"} role="presentation" style={parseInlineStyle(pinStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : (isExpanderColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {!!(columnIsFilterable(header.column.id) && !hasFilterSlot()) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" />}{!!(columnIsFilterable(header.column.id)) && <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderFilter ?? props.slots?.['filter'])?.({ columnId: header.column.id, value: columnFilterValue(header.column.id), uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter })}
              </span>}</span>}</th>)}
        </tr>}</thead>

      <tbody className={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        
        {rows.map((row) => <Fragment key={row.id}>
        <tr key={row.id} className={clsx("rdt-tr", { "rdt-group-header": rowIsGrouped(row) })} role="row" data-depth={rozieAttr(row.depth)} aria-rowindex={bodyAriaRowIndex(row)} data-group-header={rozieAttr(rowIsGrouped(row) ? row.id : undefined)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(row) ? row.id : undefined)} aria-expanded={(rowIsGrouped(row) ? !!rowIsExpanded(row) : undefined) ?? undefined} aria-selected={(props.selectionMode !== 'none' ? !!rowIsSelected(row) : undefined) ?? undefined} aria-level={(groupingActive() ? row.depth + 1 : undefined) ?? undefined} data-rozie-s-d5dcab4c="">
          {visibleCellsFor(row).map((cell) => <td key={cell.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cell.column.id), "rdt-expander-td": isExpanderColumn(cell.column.id), "rdt-in-range": inRange(rowIndexOf(row), colIndexOf(row, cell)), "rdt-cell-active": isActiveCell(String(rowIndexOf(row)), colIndexOf(row, cell)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cell.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cell))} tabIndex={cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cell))} style={parseInlineStyle(bodyCellStyle(row, cell.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cell)))} data-in-range={rozieAttr(inRange(rowIndexOf(row), colIndexOf(row, cell)) ? 'true' : undefined)} data-agg-cell={rozieAttr(cellIsAggregated(cell) ? cell.column.id : undefined)} data-rozie-s-d5dcab4c="">
            
            {(isExpanderColumn(cell.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {!!(rowCanExpand(row)) && <button type="button" className={"rdt-expander"} data-expander="" aria-expanded={!!rowIsExpanded(row)} aria-label={rozieAttr(rowIsExpanded(row) ? 'Collapse row' : 'Expand row')} onClick={($event) => { onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row) ? '▾' : '▸')}</button>}</span> : (isSelectColumn(cell.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (cellIsGrouped(cell)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" className={"rdt-expander rdt-group-toggle"} data-expander="" aria-expanded={!!rowIsExpanded(row)} aria-label={rozieAttr(rowIsExpanded(row) ? 'Collapse group' : 'Expand group')} onClick={($event) => { onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row) ? '▾' : '▸')}</button>
              <span className={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cell.column.id, column: cell.column, row: row.original, value: cell.getValue() }) : rozieDisplay(cell.getValue())}
              </span>
              <span className={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay('(' + groupSubRowCount(row) + ')')}</span>
            </span> : (isEditing(rowIndexOf(row), colIndexOf(row, cell))) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(hasEditorSlot(cell.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderEditor ?? props.slots?.['editor'])?.({ columnId: cell.column.id, column: cell.column, row: row.original, value: editorValueFor(cell.column.id), commit: editorCommitFor(cell.column.id), cancel: editorCancelFor(), autofocus: editorAutofocusFor(cell.column.id, rowIndexOf(row)) })}
              </span> : (editorTypeOf(cell.column.id) === 'number') ? <input className={"rdt-cell-editor"} type="number" data-editing-cell="" value={editorValueFor(cell.column.id)} onInput={($event) => { onCellEditorInput(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : (editorTypeOf(cell.column.id) === 'select') ? <select className={"rdt-cell-editor"} data-editing-cell="" value={editorValueFor(cell.column.id)} onChange={($event) => { onCellEditorInput(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                {editorOptionsOf(cell.column.id).map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>)}
              </select> : (editorTypeOf(cell.column.id) === 'checkbox') ? <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" checked={editorCheckedFor(cell.column.id)} onChange={($event) => { onCellEditorCheckbox(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : <input className={"rdt-cell-editor"} type="text" data-editing-cell="" value={editorValueFor(cell.column.id)} onInput={($event) => { onCellEditorInput(cell.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}</span> : (cellIsPlaceholder(cell)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cell.column.id, column: cell.column, row: row.original, value: cell.getValue() }) : rozieDisplay(cell.getValue())}
            </span>}{!!(isFillHandleCell(rowIndexOf(row), colIndexOf(row, cell))) && <span className={"rdt-fill-handle"} data-fill-handle="" data-testid="fill-handle" aria-hidden="true" onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" />}</td>)}
        </tr>
        
        {!!(rowShowsDetail(row)) && <tr key={row.id} className={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(row.id)} data-rozie-s-d5dcab4c="">
          <td className={"rdt-detail-cell"} colSpan={visibleColCount()} data-rozie-s-d5dcab4c="">
            {(props.renderDetail ?? props.slots?.['detail'])?.({ row: row.original })}
          </td>
        </tr>}</Fragment>)}
      </tbody>
    </table>}{!!(!rowsWindowed()) && <div className={"rdt-pagination"} role="group" aria-label="Pagination" data-rozie-s-d5dcab4c="">
      <button type="button" className={"rdt-page-btn rdt-page-prev"} disabled={!canPrevPage()} onClick={($event) => { onPrevPage(); }} data-rozie-s-d5dcab4c="">Prev</button>
      <span className={"rdt-page-status"} aria-live="polite" data-rozie-s-d5dcab4c="">
        {rozieDisplay('Page ' + (pageIndex() + 1) + ' of ' + displayPageCount())}
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
