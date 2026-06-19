import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieContext, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './DataTable.css';
import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';
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

interface SelectAllCtx { checked: any; indeterminate: any; toggle: any; }

interface ColHeaderCtx { columnId: any; column: any; label: any; }

interface SelectCellCtx { row: any; checked: any; toggle: any; }

interface CellCtx { columnId: any; column: any; row: any; value: any; }

interface DataTableProps {
  data: any[];
  columns?: any[];
  selectionMode?: string;
  sorting?: any[];
  defaultSorting?: any[];
  onSortingChange?: (sorting: any[]) => void;
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (globalFilter: string) => void;
  columnFilters?: any[];
  defaultColumnFilters?: any[];
  onColumnFiltersChange?: (columnFilters: any[]) => void;
  pagination?: Record<string, any>;
  defaultPagination?: Record<string, any>;
  onPaginationChange?: (pagination: Record<string, any>) => void;
  manual?: boolean;
  rowSelection?: Record<string, any>;
  defaultRowSelection?: Record<string, any>;
  onRowSelectionChange?: (rowSelection: Record<string, any>) => void;
  columnVisibility?: Record<string, any>;
  defaultColumnVisibility?: Record<string, any>;
  onColumnVisibilityChange?: (columnVisibility: Record<string, any>) => void;
  columnSizing?: Record<string, any>;
  defaultColumnSizing?: Record<string, any>;
  onColumnSizingChange?: (columnSizing: Record<string, any>) => void;
  columnOrder?: any[];
  defaultColumnOrder?: any[];
  onColumnOrderChange?: (columnOrder: any[]) => void;
  columnPinning?: Record<string, any>;
  defaultColumnPinning?: Record<string, any>;
  onColumnPinningChange?: (columnPinning: Record<string, any>) => void;
  stickyHeader?: boolean;
  interactionMode?: string;
  virtual?: boolean;
  estimateRowHeight?: number;
  maxHeight?: string;
  onSortChange?: (...args: any[]) => void;
  onFilterChange?: (...args: any[]) => void;
  onPageChange?: (...args: any[]) => void;
  onSelectionChange?: (...args: any[]) => void;
  onVisibilityChange?: (...args: any[]) => void;
  onResizeChange?: (...args: any[]) => void;
  onReorderChange?: (...args: any[]) => void;
  onPinChange?: (...args: any[]) => void;
  onActivecellChange?: (...args: any[]) => void;
  children?: ReactNode;
  renderSelectAll?: (ctx: SelectAllCtx) => ReactNode;
  renderColHeader?: (ctx: ColHeaderCtx) => ReactNode;
  renderSelectCell?: (ctx: SelectCellCtx) => ReactNode;
  renderCell?: (ctx: CellCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface DataTableHandle {
  sortColumn: (...args: any[]) => any;
  clearSorting: (...args: any[]) => any;
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
}

const DataTable = forwardRef<DataTableHandle, DataTableProps>(function DataTable(_props: DataTableProps, ref): JSX.Element {
  const __ctx_data_table_columns = rozieContext("data-table:columns");
  const __defaultColumns = useState(() => (() => [])())[0];
  const props: Omit<DataTableProps, 'columns' | 'selectionMode' | 'manual' | 'stickyHeader' | 'interactionMode' | 'virtual' | 'estimateRowHeight' | 'maxHeight'> & { columns: any[]; selectionMode: string; manual: boolean; stickyHeader: boolean; interactionMode: string; virtual: boolean; estimateRowHeight: number; maxHeight: string } = {
    ..._props,
    columns: _props.columns ?? __defaultColumns,
    selectionMode: _props.selectionMode ?? 'none',
    manual: _props.manual ?? false,
    stickyHeader: _props.stickyHeader ?? false,
    interactionMode: _props.interactionMode ?? 'table',
    virtual: _props.virtual ?? false,
    estimateRowHeight: _props.estimateRowHeight ?? 40,
    maxHeight: _props.maxHeight ?? '',
  };
  const table = useRef<any>(null);
  const refreshRowModel = useRef<any>(null);
  const virtualizer = useRef<any>(null);
  const gridRoot = useRef<any>(null);
  const gridScrollEl = useRef<any>(null);
  const virtualizerCleanup = useRef<any>(null);
  const programmatic = useRef(0);
  const remeasurePending = useRef(false);
  const selectAllBox = useRef<any>(null);
  const lastData = useRef<any>(null);
  const lastDataLen = useRef(-1);
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
  const _dataRef = useRef(props.data);
  _dataRef.current = props.data;
  const _selectionModeRef = useRef(props.selectionMode);
  _selectionModeRef.current = props.selectionMode;
  const _paginationRef = useRef(pagination);
  _paginationRef.current = pagination;
  const [sortingDefault, setSortingDefault] = useState<any[]>([]);
  const [globalFilterDefault, setGlobalFilterDefault] = useState('');
  const [columnFiltersDefault, setColumnFiltersDefault] = useState<any[]>([]);
  const [paginationDefault, setPaginationDefault] = useState({
    pageIndex: 0,
    pageSize: 10
  });
  const [rowSelectionDefault, setRowSelectionDefault] = useState({});
  const [columnVisibilityDefault, setColumnVisibilityDefault] = useState({});
  const [columnSizingDefault, setColumnSizingDefault] = useState({});
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
  const [colReg, setColReg] = useState({});
  const [rows, setRows] = useState<any[]>([]);
  const [headerGroups, setHeaderGroups] = useState<any[]>([]);
  const [rowModelVer, setRowModelVer] = useState(0);
  const [windowVer, setWindowVer] = useState(0);
  const [activeRow, setActiveRow] = useState(0);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const [activeIsHeader, setActiveIsHeader] = useState(false);
  const [activeInControl, setActiveInControl] = useState(false);
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
  const currentState = useCallback((): any => ({
    sorting: sorting != null ? sorting : sortingDefault,
    globalFilter: globalFilter != null ? globalFilter : globalFilterDefault,
    columnFilters: columnFilters != null ? columnFilters : columnFiltersDefault,
    pagination: pagination != null ? pagination : paginationDefault,
    rowSelection: rowSelection != null ? rowSelection : rowSelectionDefault,
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
  }), [columnFilters, columnFiltersDefault, columnOrder, columnOrderDefault, columnPinning, columnPinningDefault, columnSizing, columnSizingDefault, columnSizingInfo, columnVisibility, columnVisibilityDefault, globalFilter, globalFilterDefault, pagination, paginationDefault, rowSelection, rowSelectionDefault, sorting, sortingDefault]);
  function isSafeKey(k: any) {
    return k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  }
  function columnDefs() {
    const byId = Object.create(null);
    const order = [];
    const cfg = props.columns || [];
    for (const c of cfg as any) {
      if (!c) continue;
      const rawId = c.id != null ? c.id : c.field;
      if (rawId == null) continue;
      const id = String(rawId);
      if (!isSafeKey(id)) continue;
      if (!(id in byId)) order.push(id);
      byId[id] = {
        id,
        accessorKey: c.field != null ? c.field : id,
        header: c.header != null ? c.header : id,
        enableSorting: c.sortable === true,
        // per-column filter opt-in (req-5). table-core gates the filter input + value
        // funnel on enableColumnFilter; a column with filterable !== true cannot be
        // filtered (and renders no per-column filter input in the chrome below).
        enableColumnFilter: c.filterable === true,
        filterable: c.filterable === true,
        pinned: c.pinned != null ? c.pinned : '',
        width: c.width != null ? c.width : ''
      };
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
        pinned: spec.pinned != null ? spec.pinned : '',
        width: spec.width != null ? spec.width : ''
      };
    }
    const out = [];
    for (const id of order as any) if (byId[id]) out.push(byId[id]);
    return out;
  }
  // The constant id of the auto-injected leading checkbox column (D-04). Distinct from
  // any consumer column id (the registry/config guard never produces a leading "__").
  const SELECT_COL_ID = '__rdt_select';

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
      return [selectCol].concat(cols);
    }
    return cols;
  }, [columnDefs, selectionEnabled]);
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
  const windowingSource = useCallback(() => {
    if (!table.current) return [];
    if (props.virtual) return table.current.getPrePaginationRowModel().rows;
    return table.current.getRowModel().rows;
  }, [props.virtual]);
  function virtualItemKey(i: any) {
    const src = windowingSource();
    return src && src[i] ? src[i].id : undefined;
  }
  const virtualizerOptions = useCallback((): any => ({
    count: windowingSource().length,
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
  }), [props.estimateRowHeight, scheduleRemeasure, virtualItemKey, windowingSource]);
  function scheduleRemeasure() {
    if (remeasurePending.current) return;
    remeasurePending.current = true;
    const run = () => {
      remeasurePending.current = false;
      remeasureWindow();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);else if (typeof queueMicrotask !== 'undefined') queueMicrotask(run);else setTimeout(run, 0);
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
    void windowVer;
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
    return items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
  }
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer at the TOP so the spacer-<td>
    // :style binding subscribes on the fine-grained targets before the `!virtualizer` early return.
    void windowVer;
    if (!props.virtual || !virtualizer.current) return 0;
    const items = virtualizer.current.getVirtualItems();
    return items.length ? items[0].start : 0;
  }
  function padBottom() {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer before the early return so the
    // fine-grained spacer :style binding subscribes on its first eval while virtualizer is null.
    void windowVer;
    if (!props.virtual || !virtualizer.current) return 0;
    const items = virtualizer.current.getVirtualItems();
    if (!items.length) return 0;
    return virtualizer.current.getTotalSize() - items[items.length - 1].end;
  }
  function rowIsOutsideWindow(r: any) {
    if (!props.virtual || !virtualizer.current) return false;
    const items = virtualizer.current.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
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
  const reFeed = useCallback(() => {
    if (!table.current) return;
    table.current.setOptions((prev: any) => ({
      ...prev,
      data: props.data,
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: props.selectionMode !== 'none',
      enableMultiRowSelection: props.selectionMode === 'multiple',
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
  }, [currentState, onColumnFiltersChangeCb, onColumnOrderChangeCb, onColumnPinningChangeCb, onColumnSizingChangeCb, onColumnSizingInfoChangeCb, onColumnVisibilityChangeCb, onGlobalFilterChangeCb, onPaginationChangeCb, onRowSelectionChangeCb, onSortingChangeCb, props.data, props.selectionMode, tableColumns]);
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
  function isGrid() {
    return props.interactionMode === 'grid';
  }
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
  function cellTabindex(rowKey: any, colIndex: any) {
    if (!isGrid()) return null;
    const activeKey = activeIsHeader ? '__header' : String(activeRow);
    const isActive = rowKey === activeKey && colIndex === activeColIndex;
    return isActive ? 0 : -1;
  }
  function resolveCellEl(rowKey: any, colIndex: any) {
    if (!gridRoot.current) return null;
    return gridRoot.current.querySelector('[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]');
  }
  function focusActiveCell(nextRow = null, nextCol = null, nextIsHeader = null) {
    if (!isGrid() || !gridRoot.current) return;
    const r = nextRow == null ? activeRow : nextRow;
    const c = nextCol == null ? activeColIndex : nextCol;
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
      const focusNow = () => {
        const el = resolveCellEl(String(r), c);
        if (el) el.focus();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(focusNow));else setTimeout(focusNow, 0);
      return;
    }
    const rowKey = header ? '__header' : String(r);
    const el = resolveCellEl(rowKey, c);
    if (el) el.focus();
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
  function moveCol(delta: any) {
    const max = visibleColCount() - 1;
    const nextCol = clamp(activeColIndex + delta, 0, max < 0 ? 0 : max);
    setActiveColIndex(nextCol);
    return nextCol;
  }
  function moveRow(delta: any) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    if (activeIsHeader) {
      // In the header: any downward move lands on body row 0; upward stays in the header.
      if (delta > 0) {
        setActiveIsHeader(false);
        setActiveRow(0);
        return {
          row: 0,
          isHeader: false
        };
      }
      return {
        row: activeRow,
        isHeader: true
      };
    }
    // In the body: an upward move from row 0 crosses into the header.
    if (delta < 0 && activeRow === 0) {
      setActiveIsHeader(true);
      return {
        row: activeRow,
        isHeader: true
      };
    }
    const nextRow = clamp(activeRow + delta, 0, maxRow);
    setActiveRow(nextRow);
    setActiveIsHeader(false);
    return {
      row: nextRow,
      isHeader: false
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
    return resolveCellEl(rowKey, activeColIndex);
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
    let nextRow = prevRow;
    let nextCol = prevCol;
    let nextIsHeader = prevIsHeader;
    if (key === 'ArrowRight') {
      e.preventDefault();
      nextCol = moveCol(1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      nextCol = moveCol(-1);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      const m = moveRow(1);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      const m = moveRow(-1);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
    } else if (key === 'PageDown') {
      e.preventDefault();
      const m = moveRow(GRID_PAGE_STEP);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
    } else if (key === 'PageUp') {
      e.preventDefault();
      const m = moveRow(-GRID_PAGE_STEP);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
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
    } else if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      enterControl();
      return;
    } else return;
    // THE seam — built from the SAME fresh post-write locals (Pitfall 2). Always re-assert
    // focus on the resolved cell (harmless on a no-op clamp; corrects any drift otherwise).
    focusActiveCell(nextRow, nextCol, nextIsHeader);
    // WR-06: the D-02 activecell-change event fires ONLY when the resolved cell actually
    // changed. A clamped no-op edge move (ArrowLeft at col 0, ArrowDown at the page-last
    // row, …) leaves the indices identical → no spurious emit (a no-op is not a navigation).
    if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader) {
      _rozieProp_onActivecellChange && _rozieProp_onActivecellChange({
        rowIndex: nextRow,
        colIndex: nextCol
      });
    }
  }, [_rozieProp_onActivecellChange, activeColIndex, activeInControl, activeIsHeader, activeRow, currentCellEl, cycleWithinCell, enterControl, focusActiveCell, gotoColEdge, gotoEnd, gotoStart, isGrid, moveCol, moveRow]);
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
    if (!isHeader) {
      const row = parseInt(rowAttr, 10);
      if (Number.isFinite(row)) setActiveRow(row);
    }
    setActiveColIndex(col);
    // The cell box (not an inner control) receiving focus = navigation mode.
    if (tgt === cellEl) setActiveInControl(false);
  }, [isGrid]);
  const onGridFocusOut = useCallback((e: any) => {
    if (!isGrid() || !activeInControl) return;
    const next = e ? e.relatedTarget : null;
    const cellEl = currentCellEl();
    if (!cellEl || !next || !cellEl.contains(next)) setActiveInControl(false);
  }, [activeInControl, currentCellEl, isGrid]);
  const clampActiveCell = useCallback(() => {
    if (!isGrid()) return;
    const maxCol = visibleColCount() - 1;
    const col = clamp(activeColIndex, 0, maxCol < 0 ? 0 : maxCol);
    if (col !== activeColIndex) setActiveColIndex(col);
    if (!activeIsHeader) {
      const lastRow = bodyRowCount() - 1;
      const maxRow = lastRow < 0 ? 0 : lastRow;
      const row = clamp(activeRow, 0, maxRow);
      if (row !== activeRow) setActiveRow(row);
    }
  }, [activeColIndex, activeIsHeader, activeRow, bodyRowCount, clamp, isGrid, visibleColCount]);
  function focusCell(rowIndex: any, colIndex: any) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const maxCol = visibleColCount() - 1;
    const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    setActiveIsHeader(false);
    setActiveInControl(false);
    setActiveRow(r);
    setActiveColIndex(c);
    // Thread isHeader=false EXPLICITLY (focusCell always lands in the body). Without it
    // focusActiveCell re-reads $data.activeIsHeader, which on React (setState async, ROZ138)
    // / Angular (async signal) returns the PRE-write value — and WR-03's @focusin sync sets
    // activeIsHeader=true whenever an inner control inside a HEADER cell (a sort button) was
    // last clicked, so a stale read would resolve focus to the header instead of body row r.
    focusActiveCell(r, c, false);
    props.onActivecellChange && props.onActivecellChange({
      rowIndex: r,
      colIndex: c
    });
  }
  function getActiveCell() {
    return {
      rowIndex: activeRow,
      colIndex: activeColIndex
    };
  }
  function clearActiveCell() {
    setActiveIsHeader(false);
    setActiveInControl(false);
    setActiveRow(0);
    setActiveColIndex(0);
  }

  useEffect(() => {
    // Build the table instance HERE so the closures below capture the live `table`.
    table.current = createTable({
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      data: _dataRef.current,
      columns: tableColumns(),
      state: currentState(),
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
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
      // windowingSource(): the FULL pre-pagination model when virtual (windowing replaces client
      // pagination, req-9), else the normal paginated row model (non-virtual path byte-unchanged).
      const nextRows = windowingSource().slice();
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
      clampActiveCell();
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
    };
  }, []);
  useEffect(() => {
    if (!table.current) return;
    const d = _dataRef.current || [];
    if (d === lastData.current && d.length === lastDataLen.current) return;
    lastData.current = d;
    lastDataLen.current = d.length;
    reFeed();
  }, [lastData, lastDataLen, reFeed, table]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    reFeed();
  }, [colReg, columnFilters, columnOrder, columnPinning, columnSizing, columnVisibility, globalFilter, pagination, props.data, props.selectionMode, rowSelection, sorting]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell });
  _rozieExposeRef.current = { sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell };
  useImperativeHandle(ref, () => ({ sortColumn: (...args: Parameters<typeof sortColumn>): ReturnType<typeof sortColumn> => _rozieExposeRef.current.sortColumn(...args), clearSorting: (...args: Parameters<typeof clearSorting>): ReturnType<typeof clearSorting> => _rozieExposeRef.current.clearSorting(...args), getColumnDefs: (...args: Parameters<typeof getColumnDefs>): ReturnType<typeof getColumnDefs> => _rozieExposeRef.current.getColumnDefs(...args), toggleAllRows: (...args: Parameters<typeof toggleAllRows>): ReturnType<typeof toggleAllRows> => _rozieExposeRef.current.toggleAllRows(...args), clearSelection: (...args: Parameters<typeof clearSelection>): ReturnType<typeof clearSelection> => _rozieExposeRef.current.clearSelection(...args), getSelectedRows: (...args: Parameters<typeof getSelectedRows>): ReturnType<typeof getSelectedRows> => _rozieExposeRef.current.getSelectedRows(...args), setPage: (...args: Parameters<typeof setPage>): ReturnType<typeof setPage> => _rozieExposeRef.current.setPage(...args), setRowsPerPage: (...args: Parameters<typeof setRowsPerPage>): ReturnType<typeof setRowsPerPage> => _rozieExposeRef.current.setRowsPerPage(...args), toggleColumnVisibility: (...args: Parameters<typeof toggleColumnVisibility>): ReturnType<typeof toggleColumnVisibility> => _rozieExposeRef.current.toggleColumnVisibility(...args), applyColumnOrder: (...args: Parameters<typeof applyColumnOrder>): ReturnType<typeof applyColumnOrder> => _rozieExposeRef.current.applyColumnOrder(...args), resetColumnSizing: (...args: Parameters<typeof resetColumnSizing>): ReturnType<typeof resetColumnSizing> => _rozieExposeRef.current.resetColumnSizing(...args), pinColumn: (...args: Parameters<typeof pinColumn>): ReturnType<typeof pinColumn> => _rozieExposeRef.current.pinColumn(...args), focusCell: (...args: Parameters<typeof focusCell>): ReturnType<typeof focusCell> => _rozieExposeRef.current.focusCell(...args), getActiveCell: (...args: Parameters<typeof getActiveCell>): ReturnType<typeof getActiveCell> => _rozieExposeRef.current.getActiveCell(...args), clearActiveCell: (...args: Parameters<typeof clearActiveCell>): ReturnType<typeof clearActiveCell> => _rozieExposeRef.current.clearActiveCell(...args) }), []);

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

    <div className={"rdt-toolbar"} data-rozie-s-d5dcab4c="">
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


    {(props.virtual) ? <div className={"rdt-scroll"} style={parseInlineStyle(props.maxHeight ? 'max-height:' + props.maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + props.maxHeight : 'overflow:auto')} data-rozie-s-d5dcab4c="">
    <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} aria-rowcount={rows.length} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg) => <tr key={hg.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={(cellTabindex('__header', headerColIndexOf(hg, header))) ?? undefined} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
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
              </span>}{(columnIsFilterable(header.column.id)) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" />}<span className={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
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
          <td colSpan={(visibleColCount()) ?? undefined} style={parseInlineStyle('height:' + padTop() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
        
        {windowedRows().map((wr) => <tr key={wr.row.id} className={"rdt-tr"} role="row" data-row={rozieAttr(wr.vi.index)} aria-rowindex={rozieAttr(wr.vi.index + 1)} data-index={rozieAttr(wr.vi.index)} data-rozie-s-d5dcab4c="">
          {visibleCellsFor(wr.row).map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(wr.vi.index)} data-col-index={rozieAttr(colIndexOf(wr.row, cellCtx))} tabIndex={(cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx))) ?? undefined} style={parseInlineStyle(pinStyle(cellCtx.column.id))} data-rozie-s-d5dcab4c="">
            {(isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: wr.row.original, checked: rowIsSelected(wr.row), toggle: e => onToggleRow(wr.row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(wr.row)} onChange={($event) => { onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
            </span>}</td>)}
        </tr>)}
        
        <tr className={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={(visibleColCount()) ?? undefined} style={parseInlineStyle('height:' + padBottom() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
      </tbody>
    </table>
    </div> : <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg) => <tr key={hg.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={(cellTabindex('__header', headerColIndexOf(hg, header))) ?? undefined} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
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
              </span>}{(columnIsFilterable(header.column.id)) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" />}<span className={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
                <button type="button" className={"rdt-pin-btn rdt-pin-left"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} onClick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c="">⇤</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-none"} aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} onClick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c="">⇔</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-right"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} onClick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c="">⇥</button>
              </span>
              
              <button type="button" className={"rdt-resize-handle"} aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onPointerDown={($event) => { onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span className={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}</th>)}
        </tr>)}
      </thead>

      <tbody className={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {rows.map((row) => <tr key={row.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {visibleCellsFor(row).map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cellCtx))} tabIndex={(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx))) ?? undefined} style={parseInlineStyle(pinStyle(cellCtx.column.id))} data-rozie-s-d5dcab4c="">
            
            {(isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
            </span>}</td>)}
        </tr>)}
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
