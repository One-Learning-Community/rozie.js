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

interface EditorCtx { columnId: any; column: any; row: any; value: any; commit: any; cancel: any; }

interface CellCtx { columnId: any; column: any; row: any; value: any; }

interface DataTableProps {
  data: any[];
  defaultData?: any[];
  onDataChange?: (data: any[]) => void;
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
  onRangeChange?: (...args: any[]) => void;
  onCellEditCommit?: (...args: any[]) => void;
  onRowEditCommit?: (...args: any[]) => void;
  children?: ReactNode;
  renderSelectAll?: (ctx: SelectAllCtx) => ReactNode;
  renderColHeader?: (ctx: ColHeaderCtx) => ReactNode;
  renderSelectCell?: (ctx: SelectCellCtx) => ReactNode;
  renderEditor?: (ctx: EditorCtx) => ReactNode;
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
  editCell: (...args: any[]) => any;
  commitEditing: (...args: any[]) => any;
  editRow: (...args: any[]) => any;
  getSelectedRange: (...args: any[]) => any;
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
  const [editingRow, setEditingRow] = useState(-1);
  const [editingCol, setEditingCol] = useState(-1);
  const [draftValue, setDraftValue] = useState<any>(null);
  const [invalidMsg, setInvalidMsg] = useState('');
  const [editVer, setEditVer] = useState(0);
  const [editingRowIndex, setEditingRowIndex] = useState<any>(null);
  const [rowDraft, setRowDraft] = useState({});
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
  const currentData = useCallback((): any => data != null ? data : dataDefault, [data, dataDefault]);
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
        const pm = pinnedMeasurement(pin);
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
      const pm = pinnedMeasurement(pin);
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
      const pm = pinnedMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start >= items[0].start) {
        // below the window (start at-or-past the first rendered start AND not in window) →
        // it trailed the slice; subtract its height from the trailing spacer.
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
      data: currentData(),
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
  }, [currentData, currentState, onColumnFiltersChangeCb, onColumnOrderChangeCb, onColumnPinningChangeCb, onColumnSizingChangeCb, onColumnSizingInfoChangeCb, onColumnVisibilityChangeCb, onGlobalFilterChangeCb, onPaginationChangeCb, onRowSelectionChangeCb, onSortingChangeCb, props.selectionMode, tableColumns]);
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
    let nextRow = prevRow;
    let nextCol = prevCol;
    let nextIsHeader = prevIsHeader;
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
      nextIsHeader = m.isHeader;
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      clearRange();
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
    }
    // ── Clipboard (phase 51 req-8 / D-03) — Ctrl/Cmd+C copies the range as TSV; Ctrl/Cmd+V
    // pastes TSV into the range under the D-03 skip rule. Placed BEFORE the printable-key
    // edit-entry branch (which excludes ctrl/meta) so the shortcuts are never swallowed as a
    // type-to-edit char. Copy/paste act on the whole range (or the single active cell). ──────
    else if ((key === 'c' || key === 'C') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      copyRange();
      return;
    } else if ((key === 'v' || key === 'V') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      pasteRange();
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
      e.preventDefault();
      beginEdit(activeRow, activeColIndex, key);
      return;
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
  }, [_rozieProp_onActivecellChange, activeColIndex, activeInControl, activeIsHeader, activeRow, beginEdit, beginRowEdit, clearRange, copyRange, currentCellEl, cycleWithinCell, editingRow, editingRowIndex, enterControl, extendRange, focusActiveCell, gotoColEdge, gotoEnd, gotoStart, isActiveCellEditable, isGrid, moveCol, moveRow, pasteRange, rows]);
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
  }, [clearRange, isGrid]);
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
    return {
      anchor: rangeAnchor,
      focus: rangeFocus
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
    // Keep the active cell tracking the moving focus corner (so a follow-up F2 / arrow acts
    // from the range's leading edge, the spreadsheet convention).
    setActiveRow(nextRow);
    setActiveColIndex(nextCol);
    // Suppress the focus-move's @focusin clearRange (no shiftKey on a programmatic focus): the
    // settle on the new focus corner is part of THIS range extension, not a fresh navigation.
    rangeTransition = true;
    focusActiveCell(nextRow, nextCol, false);
    emitRangeChange(anchor, nextFocus);
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
    emitRangeChange(anchor, nextFocus);
  }
  function clearRange() {
    if (rangeAnchor == null && rangeFocus == null) return;
    setRangeAnchor(null);
    setRangeFocus(null);
  }
  function announce(msg: any) {
    setPasteAnnounce(msg != null ? msg : '');
  }
  function fieldOfColId(colId: any) {
    const d = defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  }
  function normalizedRange() {
    const a = rangeAnchor;
    const f = rangeFocus;
    if (!a || !f) return null;
    return {
      r0: a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex,
      r1: a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex,
      c0: a.colIndex < f.colIndex ? a.colIndex : f.colIndex,
      c1: a.colIndex > f.colIndex ? a.colIndex : f.colIndex
    };
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
        cells.push(v == null ? '' : String(v));
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
  function parseTsv(text: any) {
    const str = text != null ? String(text) : '';
    if (str === '') return [];
    const norm = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = norm.split('\n');
    // Drop a single trailing empty line (a TSV that ends with a newline).
    if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') rawLines.pop();
    return rawLines.map((line: any) => line.split('\t'));
  }
  function copyRange() {
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
        const value = cols[gc];
        // T-51-01: validate the pasted value as plain string DATA before any write.
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
      editTransition = true;
      writeData(next);
      editTransition = false;
      // One cell-edit-commit per COMMITTED cell (the per-cell event contract, D-03).
      for (let i = 0; i < committed.length; i++) props.onCellEditCommit && props.onCellEditCommit(committed[i]);
    }
    announce(wrote + ' of ' + total + ' cells pasted');
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
  function pasteRange() {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) return;
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
      applyGridToRange(grid, activeRow, activeColIndex);
    }).catch(() => {});
  }
  function fillRange() {
    const box = normalizedRange();
    if (!box) return;
    const anchorVal = cellValueAt(box.r0, box.c0);
    const fillStr = anchorVal == null ? '' : String(anchorVal);
    // Build a grid of the anchor value spanning the rectangle (value-copy only — NEVER a
    // numeric/date series, D-04), anchored at (r0,c0).
    const grid = [];
    for (let r = box.r0; r <= box.r1; r++) {
      const cols = [];
      for (let c = box.c0; c <= box.c1; c++) cols.push(fillStr);
      grid.push(cols);
    }
    applyGridToRange(grid, box.r0, box.c0);
  }
  // onFillHandlePointerDown: begin a fill-handle drag (req-8 / D-04). The handle sits on the
  // range's bottom-right cell; a pointer drag extends the range (reusing setRangeFocus off the
  // cell under the pointer) and, on release, value-fills the dragged rectangle. Kept minimal:
  // pointermove extends the range to the cell under the pointer; pointerup commits the fill.
  let fillDragging = false;
  function cellIndexFromPoint(clientX: any, clientY: any) {
    if (typeof document === 'undefined' || !document.elementFromPoint) return null;
    const el = document.elementFromPoint(clientX, clientY);
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
    fillDragging = true;
    const move = (ev: any) => {
      if (!fillDragging) return;
      const cell = cellIndexFromPoint(ev.clientX, ev.clientY);
      if (cell) setRangeFocus$local(cell.r, cell.c);
    };
    const up = () => {
      fillDragging = false;
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      }
      fillRange();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
  }, [cellIndexFromPoint, fillRange, setRangeFocus$local]);
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
        const merged = {};
        const orig = src[i] || {};
        for (const k in orig) merged[k] = orig[k];
        merged[field] = value;
        out.push(merged);
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
  function focusEditorWhenReady() {
    if (!gridRoot.current) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = gridRoot.current ? gridRoot.current.querySelector('[data-editing-cell]') : null;
      if (el) {
        el.focus();
        if (el.select) {
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
    focusEditorWhenReady();
  }
  function focusCellWhenReady(row: any, col: any) {
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
  }
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
    const newValue = overrideValue !== undefined ? overrideValue : draftValue;
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
    editTransition = true;
    writeData(next);
    // Exactly one emit per commit, from this single call site (writeData does NOT emit).
    props.onCellEditCommit && props.onCellEditCommit({
      rowId,
      columnId: colId,
      oldValue,
      newValue
    });
    endEdit();
    editTransition = false;
    // Defer the focus return so the display↔editor re-render commits first (async on
    // React/Solid/Lit) — the cell is focusable with its roving tabindex only after the
    // editor unmounts and the display branch (+ tabindex) re-renders. Skipped on a
    // Tab-advance (the caller immediately opens the next editor and focuses THAT).
    if (skipFocusReturn !== true) focusCellWhenReady(focusRow, focusCol);
    return true;
  }
  function cancelEdit() {
    if (editingRow < 0) return;
    const focusRow = activeRow;
    const focusCol = activeColIndex;
    editTransition = true;
    endEdit();
    editTransition = false;
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
      out.push({
        colId,
        field
      });
    }
    return out;
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
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      const err = runValidator(ec.colId, draft[ec.colId], rowOriginal);
      if (err !== true) {
        setInvalid(err);
        focusEditorWhenReady();
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
      const newValue = draft[ec.colId];
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
    const focusRow = rowIndex;
    const focusCol = activeColIndex;
    editTransition = true;
    writeData(next);
    // EXACTLY ONE emit per row commit, from THIS single call site (React multi-emit dedup, D-07).
    props.onRowEditCommit && props.onRowEditCommit({
      rowId,
      changes
    });
    endRowEdit();
    editTransition = false;
    focusCellWhenReady(focusRow, focusCol);
    return true;
  }
  function cancelRow() {
    if (editingRowIndex == null) return;
    const focusRow = activeRow;
    const focusCol = activeColIndex;
    editTransition = true;
    endRowEdit();
    editTransition = false;
    focusCellWhenReady(focusRow, focusCol);
  }
  function replaceRowValues(rows: any, rowIndex: any, fieldValues: any) {
    const src = rows || [];
    const fv = fieldValues || {};
    const out = [];
    for (let i = 0; i < src.length; i++) {
      if (i === rowIndex) {
        const merged = {};
        const orig = src[i] || {};
        for (const k in orig) merged[k] = orig[k];
        for (const k in fv) merged[k] = fv[k];
        out.push(merged);
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
  // Transient guard: true while an editor commit/cancel/Tab-advance is tearing the current
  // editor down. The unmounting editor fires a `blur` as it leaves the DOM — without this
  // guard onEditorBlur would re-enter commitEdit on the (already-resolved or newly-opened)
  // cell, double-counting cell-edit-commit. A top-level `let` (React hoists to useRef).
  let editTransition = false;

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
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      commitEdit(undefined);
    } else if (key === 'Tab') {
      e.preventDefault();
      // Resolve the advance target from the EDITING pair (the cell that is open), not the
      // active cell (they match here, but the editing pair is authoritative).
      const target = nextEditableCell(editingRow, editingCol);
      // skipFocusReturn=true: don't bounce focus back to the committed cell — we advance
      // straight into the next editable cell's editor below. Use the RETURN value (not a
      // re-read of $data.editingRow — async-stale on React) to gate the advance: a validation
      // failure returns false and keeps the editor open (the user must fix the value first).
      const committed = commitEdit(undefined, true);
      if (committed && target) {
        setActiveRow(target.row);
        setActiveColIndex(target.col);
        beginEdit(target.row, target.col, null);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [beginEdit, cancelEdit, cancelRow, commitEdit, commitRow, editingCol, editingRow, inRowEdit, nextEditableCell]);
  const onEditorBlur = useCallback((e: any) => {
    // Full-row mode (req-6): blur NEVER commits — the row commits as a UNIT only on an
    // explicit Enter / save / editRow-driven flow (a per-cell blur-commit would split the row
    // into N writes + N events, violating the one-write/one-event contract). Tabbing between
    // the row's own editors is a normal focus move, not a commit.
    if (inRowEdit()) return;
    if (editingRow < 0 || editTransition) return;
    const next = e ? e.relatedTarget : null;
    // Commit ONLY on a genuine focus-away to a real element OUTSIDE the grid (click into
    // another widget). Skip when:
    //  - relatedTarget is inside gridRoot — a controlled move (Tab-advance to the next editor,
    //    Enter/Escape focus-return to the cell); the keyboard handler already acted, AND
    //  - relatedTarget is null — an unmount-blur (the editor left the DOM) or a focus drop the
    //    keyboard path owns; committing here would double-count. The explicit Enter/Tab/Escape
    //    keymap covers every keyboard commit, so a null-relatedTarget blur is never a commit.
    if (next == null) return;
    if (gridRoot.current && gridRoot.current.contains && gridRoot.current.contains(next)) return;
    commitEdit(undefined);
  }, [commitEdit, editingRow, inRowEdit]);
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
  }, [colReg, columnFilters, columnOrder, columnPinning, columnSizing, columnVisibility, data, dataDefault, globalFilter, pagination, props.selectionMode, rowSelection, sorting]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, editCell, commitEditing, editRow, getSelectedRange });
  _rozieExposeRef.current = { sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, editCell, commitEditing, editRow, getSelectedRange };
  useImperativeHandle(ref, () => ({ sortColumn: (...args: Parameters<typeof sortColumn>): ReturnType<typeof sortColumn> => _rozieExposeRef.current.sortColumn(...args), clearSorting: (...args: Parameters<typeof clearSorting>): ReturnType<typeof clearSorting> => _rozieExposeRef.current.clearSorting(...args), getColumnDefs: (...args: Parameters<typeof getColumnDefs>): ReturnType<typeof getColumnDefs> => _rozieExposeRef.current.getColumnDefs(...args), toggleAllRows: (...args: Parameters<typeof toggleAllRows>): ReturnType<typeof toggleAllRows> => _rozieExposeRef.current.toggleAllRows(...args), clearSelection: (...args: Parameters<typeof clearSelection>): ReturnType<typeof clearSelection> => _rozieExposeRef.current.clearSelection(...args), getSelectedRows: (...args: Parameters<typeof getSelectedRows>): ReturnType<typeof getSelectedRows> => _rozieExposeRef.current.getSelectedRows(...args), setPage: (...args: Parameters<typeof setPage>): ReturnType<typeof setPage> => _rozieExposeRef.current.setPage(...args), setRowsPerPage: (...args: Parameters<typeof setRowsPerPage>): ReturnType<typeof setRowsPerPage> => _rozieExposeRef.current.setRowsPerPage(...args), toggleColumnVisibility: (...args: Parameters<typeof toggleColumnVisibility>): ReturnType<typeof toggleColumnVisibility> => _rozieExposeRef.current.toggleColumnVisibility(...args), applyColumnOrder: (...args: Parameters<typeof applyColumnOrder>): ReturnType<typeof applyColumnOrder> => _rozieExposeRef.current.applyColumnOrder(...args), resetColumnSizing: (...args: Parameters<typeof resetColumnSizing>): ReturnType<typeof resetColumnSizing> => _rozieExposeRef.current.resetColumnSizing(...args), pinColumn: (...args: Parameters<typeof pinColumn>): ReturnType<typeof pinColumn> => _rozieExposeRef.current.pinColumn(...args), focusCell: (...args: Parameters<typeof focusCell>): ReturnType<typeof focusCell> => _rozieExposeRef.current.focusCell(...args), getActiveCell: (...args: Parameters<typeof getActiveCell>): ReturnType<typeof getActiveCell> => _rozieExposeRef.current.getActiveCell(...args), clearActiveCell: (...args: Parameters<typeof clearActiveCell>): ReturnType<typeof clearActiveCell> => _rozieExposeRef.current.clearActiveCell(...args), editCell: (...args: Parameters<typeof editCell>): ReturnType<typeof editCell> => _rozieExposeRef.current.editCell(...args), commitEditing: (...args: Parameters<typeof commitEditing>): ReturnType<typeof commitEditing> => _rozieExposeRef.current.commitEditing(...args), editRow: (...args: Parameters<typeof editRow>): ReturnType<typeof editRow> => _rozieExposeRef.current.editRow(...args), getSelectedRange: (...args: Parameters<typeof getSelectedRange>): ReturnType<typeof getSelectedRange> => _rozieExposeRef.current.getSelectedRange(...args) }), []);

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


    {(props.virtual) ? <div className={"rdt-scroll"} style={parseInlineStyle(props.maxHeight ? 'max-height:' + props.maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + props.maxHeight : 'overflow:auto')} data-rozie-s-d5dcab4c="">
    <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} aria-rowcount={rows.length} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} data-rozie-s-d5dcab4c="">
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
        
        {windowedRows().map((wr) => <tr key={wr.row.id} className={clsx("rdt-tr", { "rdt-row-pinned": wr.pinned })} role="row" data-row={rozieAttr(wr.vi.index)} aria-rowindex={rozieAttr(wr.vi.index + 1)} data-index={rozieAttr(wr.vi.index)} data-pinned={rozieAttr(wr.pinned ? 'true' : undefined)} data-rozie-s-d5dcab4c="">
          {visibleCellsFor(wr.row).map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id), "rdt-in-range": inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(wr.vi.index)} data-col-index={rozieAttr(colIndexOf(wr.row, cellCtx))} tabIndex={(cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx))) ?? undefined} style={parseInlineStyle(pinStyle(cellCtx.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cellCtx)))} data-in-range={rozieAttr(inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) ? 'true' : undefined)} data-rozie-s-d5dcab4c="">
            {(isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: wr.row.original, checked: rowIsSelected(wr.row), toggle: e => onToggleRow(wr.row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(wr.row)} onChange={($event) => { onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (isEditing(wr.vi.index, colIndexOf(wr.row, cellCtx))) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(hasEditorSlot(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderEditor ?? props.slots?.['editor'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() })}
              </span> : (editorTypeOf(cellCtx.column.id) === 'number') ? <input className={"rdt-cell-editor"} type="number" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : (editorTypeOf(cellCtx.column.id) === 'select') ? <select className={"rdt-cell-editor"} data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onChange={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                {editorOptionsOf(cellCtx.column.id).map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>)}
              </select> : (editorTypeOf(cellCtx.column.id) === 'checkbox') ? <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" checked={editorCheckedFor(cellCtx.column.id)} onChange={($event) => { onCellEditorCheckbox(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : <input className={"rdt-cell-editor"} type="text" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}</span> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
            </span>}{(isFillHandleCell(wr.vi.index, colIndexOf(wr.row, cellCtx))) && <span className={"rdt-fill-handle"} data-fill-handle="" data-testid="fill-handle" aria-hidden="true" onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" />}</td>)}
        </tr>)}
        
        <tr className={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={(visibleColCount()) ?? undefined} style={parseInlineStyle('height:' + padBottom() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
      </tbody>
    </table>
    </div> : <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role={rozieAttr(tableRole())} onKeyDown={($event) => { onGridKeyDown($event); }} onFocus={($event) => { syncActiveFromEvent($event); }} onBlur={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} data-rozie-s-d5dcab4c="">
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
          {visibleCellsFor(row).map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id), "rdt-in-range": inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cellCtx))} tabIndex={(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx))) ?? undefined} style={parseInlineStyle(pinStyle(cellCtx.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cellCtx)))} data-in-range={rozieAttr(inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) ? 'true' : undefined)} data-rozie-s-d5dcab4c="">
            
            {(isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (isEditing(rowIndexOf(row), colIndexOf(row, cellCtx))) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(hasEditorSlot(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(props.renderEditor ?? props.slots?.['editor'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() })}
              </span> : (editorTypeOf(cellCtx.column.id) === 'number') ? <input className={"rdt-cell-editor"} type="number" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : (editorTypeOf(cellCtx.column.id) === 'select') ? <select className={"rdt-cell-editor"} data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onChange={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                {editorOptionsOf(cellCtx.column.id).map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>)}
              </select> : (editorTypeOf(cellCtx.column.id) === 'checkbox') ? <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" checked={editorCheckedFor(cellCtx.column.id)} onChange={($event) => { onCellEditorCheckbox(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /> : <input className={"rdt-cell-editor"} type="text" data-editing-cell="" value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}</span> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) : rozieDisplay(cellCtx.getValue())}
            </span>}{(isFillHandleCell(rowIndexOf(row), colIndexOf(row, cellCtx))) && <span className={"rdt-fill-handle"} data-fill-handle="" data-testid="fill-handle" aria-hidden="true" onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" />}</td>)}
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
