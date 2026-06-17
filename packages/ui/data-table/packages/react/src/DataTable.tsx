import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieContext, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './DataTable.css';
import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

interface SelectAllCtx { checked: any; indeterminate: any; toggle: any; }

interface SelectCellCtx { row: any; checked: any; toggle: any; }

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
  onSortChange?: (...args: any[]) => void;
  onFilterChange?: (...args: any[]) => void;
  onPageChange?: (...args: any[]) => void;
  onSelectionChange?: (...args: any[]) => void;
  onVisibilityChange?: (...args: any[]) => void;
  onResizeChange?: (...args: any[]) => void;
  onReorderChange?: (...args: any[]) => void;
  onPinChange?: (...args: any[]) => void;
  children?: ReactNode;
  renderSelectAll?: (ctx: SelectAllCtx) => ReactNode;
  renderSelectCell?: (ctx: SelectCellCtx) => ReactNode;
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
}

const DataTable = forwardRef<DataTableHandle, DataTableProps>(function DataTable(_props: DataTableProps, ref): JSX.Element {
  const __ctx_data_table_columns = rozieContext("data-table:columns");
  const __defaultColumns = useState(() => (() => [])())[0];
  const props: Omit<DataTableProps, 'columns' | 'selectionMode' | 'manual' | 'stickyHeader' | 'interactionMode'> & { columns: any[]; selectionMode: string; manual: boolean; stickyHeader: boolean; interactionMode: string } = {
    ..._props,
    columns: _props.columns ?? __defaultColumns,
    selectionMode: _props.selectionMode ?? 'none',
    manual: _props.manual ?? false,
    stickyHeader: _props.stickyHeader ?? false,
    interactionMode: _props.interactionMode ?? 'table',
  };
  const table = useRef<any>(null);
  const refreshRowModel = useRef<any>(null);
  const cellMounts = useRef<any>(null);
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
  const _columnSizingInfoRef = useRef(columnSizingInfo);
  _columnSizingInfoRef.current = columnSizingInfo;
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);

  const { onFilterChange: _rozieProp_onFilterChange } = props;
  // Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
  // the funnel. A counter (not a boolean) so nested writes are safe.
  let programmatic = 0;

  // Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
  // All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
  // this whole object as `state`.
  const currentState = useCallback(() => ({
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
        // config-array columns carry no template → plain-value fast path.
        hasCell: false,
        cellRenderer: null,
        hasHeader: false,
        headerRenderer: null,
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
        hasCell: spec.hasCell === true,
        cellRenderer: spec.cellRenderer != null ? spec.cellRenderer : null,
        hasHeader: spec.hasHeader === true,
        headerRenderer: spec.headerRenderer != null ? spec.headerRenderer : null,
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
        hasCell: false,
        cellRenderer: null,
        hasHeader: false,
        headerRenderer: null,
        pinned: '',
        width: ''
      };
      return [selectCol].concat(cols);
    }
    return cols;
  }, [columnDefs, selectionEnabled]);
  const { onSortChange: _rozieProp_onSortChange } = props;
    const writeSorting = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setSortingDefault(next); // fresh array only (never in-place)
    setSorting(next); // two-way emit if bound (no-op-diff if not)
    _rozieProp_onSortChange && _rozieProp_onSortChange(next);
    programmatic--;
  }, [_rozieProp_onSortChange, setSorting]);
  const applyUpdater = useCallback((updater: any, current: any) => typeof updater === 'function' ? updater(current) : updater, []);
  const writeGlobalFilter = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setGlobalFilterDefault(next);
    setGlobalFilter(next);
    _rozieProp_onFilterChange && _rozieProp_onFilterChange({
      globalFilter: next
    });
    programmatic--;
  }, [_rozieProp_onFilterChange, setGlobalFilter]);
  const writeColumnFilters = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setColumnFiltersDefault(next);
    setColumnFilters(next);
    _rozieProp_onFilterChange && _rozieProp_onFilterChange({
      columnFilters: next
    });
    programmatic--;
  }, [_rozieProp_onFilterChange, setColumnFilters]);
  const { onPageChange: _rozieProp_onPageChange } = props;
    const writePagination = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setPaginationDefault(next);
    setPagination(next);
    _rozieProp_onPageChange && _rozieProp_onPageChange(next);
    programmatic--;
  }, [_rozieProp_onPageChange, setPagination]);
  const { onSelectionChange: _rozieProp_onSelectionChange } = props;
    const writeRowSelection = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setRowSelectionDefault(next);
    setRowSelection(next);
    _rozieProp_onSelectionChange && _rozieProp_onSelectionChange(next);
    programmatic--;
  }, [_rozieProp_onSelectionChange, setRowSelection]);
  const { onVisibilityChange: _rozieProp_onVisibilityChange } = props;
    const writeColumnVisibility = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setColumnVisibilityDefault(next);
    setColumnVisibility(next);
    _rozieProp_onVisibilityChange && _rozieProp_onVisibilityChange(next);
    programmatic--;
  }, [_rozieProp_onVisibilityChange, setColumnVisibility]);
  const { onResizeChange: _rozieProp_onResizeChange } = props;
    const writeColumnSizing = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setColumnSizingDefault(next);
    setColumnSizing(next);
    _rozieProp_onResizeChange && _rozieProp_onResizeChange(next);
    programmatic--;
  }, [_rozieProp_onResizeChange, setColumnSizing]);
  const { onReorderChange: _rozieProp_onReorderChange } = props;
    const writeColumnOrder = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setColumnOrderDefault(next);
    setColumnOrder(next);
    _rozieProp_onReorderChange && _rozieProp_onReorderChange(next);
    programmatic--;
  }, [_rozieProp_onReorderChange, setColumnOrder]);
  const { onPinChange: _rozieProp_onPinChange } = props;
    const writeColumnPinning = useCallback((next: any) => {
    if (programmatic) return;
    programmatic++;
    setColumnPinningDefault(next);
    setColumnPinning(next);
    _rozieProp_onPinChange && _rozieProp_onPinChange(next);
    programmatic--;
  }, [_rozieProp_onPinChange, setColumnPinning]);
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
  cellMounts.current = new Map();
  function reconcileProjections() {
    if (!__rozieRoot.current || !cellMounts.current) return;
    const seen = new Set();
    const defs = columnDefs();
    const defById = Object.create(null);
    for (const d of defs as any) defById[d.id] = d;
    // cells
    const cellHosts = __rozieRoot.current!.querySelectorAll('[data-cell-host]');
    for (const host of cellHosts as any) {
      const key = host.getAttribute('data-cell-host');
      seen.add(key);
      if (cellMounts.current.has(key)) continue;
      const colId = host.getAttribute('data-col');
      const rowId = host.getAttribute('data-row');
      const def = defById[colId];
      if (!def || !def.hasCell || !def.cellRenderer) continue;
      const row = (rows || []).find((r: any) => String(r.id) === String(rowId));
      if (!row) continue;
      const handle = def.cellRenderer(host, {
        row: row.original,
        value: row.getValue(def.accessorKey),
        column: def
      });
      if (handle) cellMounts.current.set(key, handle);
    }
    // headers
    const headerHosts = __rozieRoot.current!.querySelectorAll('[data-header-host]');
    for (const host of headerHosts as any) {
      const key = host.getAttribute('data-header-host');
      seen.add(key);
      if (cellMounts.current.has(key)) continue;
      const colId = host.getAttribute('data-col');
      const def = defById[colId];
      if (!def || !def.hasHeader || !def.headerRenderer) continue;
      const handle = def.headerRenderer(host, {
        column: def
      });
      if (handle) cellMounts.current.set(key, handle);
    }
    // dispose handles whose host went away
    for (const key of Array.from(cellMounts.current.keys()) as any) {
      if (!seen.has(key)) {
        const h = cellMounts.current.get(key);
        cellMounts.current.delete(key);
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
    }
  }
  // Defer reconcileProjections to AFTER the framework flushes the keyed r-for DOM:
  // the [data-cell-host] / [data-header-host] spans for a freshly-pulled row model
  // do not exist yet when refreshRowModel() returns (the watch/lifecycle fires
  // before the DOM patch on Vue's default 'pre' flush, and synchronously in $onMount
  // before the first r-for render). A microtask + rAF double-defer lands the
  // projection after the hosts are in the DOM on all six targets (the reactive-portal
  // timing the listbox/rete ports rely on). Coalesced so a burst of state changes
  // projects once.
  let reconcilePending = false;
  const scheduleReconcile = useCallback(() => {
    if (reconcilePending) return;
    reconcilePending = true;
    const run = () => {
      reconcilePending = false;
      reconcileProjections();
    };
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        Promise.resolve().then(run);
      });
    } else {
      Promise.resolve().then(run);
    }
  }, [reconcileProjections]);
  const onHeaderSort = useCallback((colId: any, evt: any) => {
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (!col || !col.getCanSort()) return;
    const multi = !!(evt && evt.shiftKey);
    // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
    col.toggleSorting(undefined, multi);
  }, []);
  function ariaSortFor(colId: any) {
    if (!table.current) return 'none';
    const col = table.current.getColumn(colId);
    if (!col) return 'none';
    const dir = col.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }
  function sortIndicator(colId: any) {
    if (!table.current) return '';
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
  function columnHasCellTemplate(colId: any) {
    const d = defFor(colId);
    return !!(d && d.hasCell && d.cellRenderer);
  }
  function columnHasHeaderTemplate(colId: any) {
    const d = defFor(colId);
    return !!(d && d.hasHeader && d.headerRenderer);
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
    if (!table.current) return null;
    const col = table.current.getColumn(colId);
    if (!col) return null;
    const w = col.getSize();
    return w != null && w > 0 ? w + 'px' : null;
  }
  const onResizeStart = useCallback((colId: any, evt: any) => {
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
    if (!table.current) return false;
    const header = findHeader(colId);
    return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
  }
  function columnIsVisible(colId: any) {
    if (!table.current) return true;
    const col = table.current.getColumn(colId);
    return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
  }
  const onToggleVisibility = useCallback((colId: any) => {
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (col && col.toggleVisibility) col.toggleVisibility();
  }, []);
  function allLeafColumns() {
    if (!table.current) return [];
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
    if (!table.current) return false;
    const col = table.current.getColumn(colId);
    if (!col || !col.getIsPinned) return false;
    return col.getIsPinned();
  }
  const onPinColumn = useCallback((colId: any, side: any) => {
    if (!table.current) return;
    const col = table.current.getColumn(colId);
    if (col && col.pin) col.pin(side);
  }, []);
  function pinStyle(colId: any) {
    if (!table.current) return '';
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
    if (table.current) return table.current.getState().pagination.pageIndex;
    const p = currentState().pagination;
    return p && p.pageIndex != null ? p.pageIndex : 0;
  }
  function pageSize() {
    if (table.current) return table.current.getState().pagination.pageSize;
    const p = currentState().pagination;
    return p && p.pageSize != null ? p.pageSize : 10;
  }
  function pageCount() {
    if (!table.current) return 1;
    const c = table.current.getPageCount();
    return c != null && c > 0 ? c : 1;
  }
  function canPrevPage() {
    return !!(table.current && table.current.getCanPreviousPage());
  }
  function canNextPage() {
    return !!(table.current && table.current.getCanNextPage());
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
  function isAllRowsSelected() {
    return !!(table.current && table.current.getIsAllRowsSelected());
  }
  function isSomeRowsSelected() {
    return !!(table.current && table.current.getIsSomeRowsSelected());
  }
  const onToggleAllRows = useCallback((evt: any) => {
    if (!table.current) return;
    table.current.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
  }, []);
  function rowIsSelected(row: any) {
    return !!(row && row.getIsSelected && row.getIsSelected());
  }
  const onToggleRow = useCallback((row: any, evt: any) => {
    if (!row || !row.toggleSelected) return;
    row.toggleSelected(!!(evt && evt.target && evt.target.checked));
  }, []);
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

  useEffect(() => {
    // Build the table instance HERE so the closures below capture the live `table`.
    table.current = createTable({
      get data() {
        return _dataRef.current;
      },
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
      // PER-SLICE callback (Open-Q1: each maps 1:1 to a slice's r-model + change event,
      // no global onStateChange diff). Each applies the table-core Updater against the
      // CURRENT slice value, then funnels a FRESH value through the echo-guarded writer.
      onSortingChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().sorting);
        writeSorting(next);
      },
      onGlobalFilterChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().globalFilter);
        writeGlobalFilter(next);
      },
      onColumnFiltersChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().columnFilters);
        writeColumnFilters(next);
      },
      onPaginationChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().pagination);
        writePagination(next);
      },
      onRowSelectionChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().rowSelection);
        writeRowSelection(next);
      },
      // Column-management callbacks (req-8/9/10/11) — each applies the table-core Updater
      // against the CURRENT slice value, then funnels a FRESH value through its
      // echo-guarded writer (same A4 STATIC-key discipline as the slices above).
      onColumnVisibilityChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().columnVisibility);
        writeColumnVisibility(next);
      },
      onColumnSizingChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().columnSizing);
        writeColumnSizing(next);
      },
      onColumnOrderChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().columnOrder);
        writeColumnOrder(next);
      },
      onColumnPinningChange: (updater: any) => {
        const next = applyUpdater(updater, currentState().columnPinning);
        writeColumnPinning(next);
      },
      // Transient resize-gesture state — table-core drives this during a drag (NOT a
      // two-way model slice). Write a FRESH object to $data so getState() reflects
      // the live gesture; gate the row-model refresh on the resizing flag so a drag
      // re-pulls the sized columns. No change event (it is internal gesture state).
      onColumnSizingInfoChange: (updater: any) => {
        const next = applyUpdater(updater, _columnSizingInfoRef.current);
        setColumnSizingInfo(prev => next != null ? next : prev);
      },
      // Resize mode: 'onChange' so the bound columnSizing model updates live during the
      // drag (the behavioral width-delta assertion observes the in-progress width). Column
      // resizing is enabled at the table level; per-column opt-out is via the ColumnDef.
      columnResizeMode: 'onChange',
      enableColumnResizing: true,
      renderFallbackValue: null
    });
    refreshRowModel.current = () => {
      if (!table.current) return;
      // Capture fresh locals; never write a $data key then re-read it in the same fn
      // (ROZ138 / React stale-read — setState is async on React, the closure binds the
      // PRE-write value).
      const nextRows = table.current.getRowModel().rows.slice();
      const nextGroups = table.current.getHeaderGroups().slice();
      setRows(nextRows);
      setHeaderGroups(nextGroups);
      setRowModelVer(prev => prev + 1);
    };

    // initial pull
    refreshRowModel.current();
    // project the per-column #cell / #header templates into the freshly-rendered
    // framework-owned hosts — DEFERRED (scheduleReconcile) so the keyed r-for DOM
    // hosts exist before we query for them (a synchronous call here finds zero hosts
    // on first paint).
    scheduleReconcile();
    return () => {
      // dispose every live cell/header projection on unmount.
      if (cellMounts.current) {
        for (const h of cellMounts.current.values() as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        cellMounts.current.clear();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (!table.current) return;
    table.current.setOptions((prev: any) => ({
      ...prev,
      data: props.data,
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: props.selectionMode !== 'none',
      enableMultiRowSelection: props.selectionMode === 'multiple'
    }));
    if (refreshRowModel.current) refreshRowModel.current();
  }, [colReg, columnFilters, columnOrder, columnPinning, columnSizing, columnVisibility, globalFilter, pagination, props.data, props.selectionMode, rowSelection, sorting]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    scheduleReconcile();
  }, [rowModelVer]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn }), []); // eslint-disable-line react-hooks/exhaustive-deps

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

    <table className={clsx("rozie-data-table", { "rdt-sticky": props.stickyHeader })} role="table" data-rozie-s-d5dcab4c="">
      <thead className={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {headerGroups.map((hg) => <tr key={hg.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {hg.headers.map((header) => <th key={header.id} className={clsx("rdt-th", { "rdt-select-th": isSelectColumn(header.column.id), "rdt-th-resizing": columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
            {(isSelectColumn(header.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectAll ?? props.slots?.['selectAll']) ? ((props.renderSelectAll ?? props.slots?.['selectAll']) as Function)({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) : (props.selectionMode === 'multiple') && <input className={"rdt-select-all"} type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} indeterminate={rozieAttr(isSomeRowsSelected())} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" />}
            </span> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              
              {(header.column.getCanSort && header.column.getCanSort()) ? <button type="button" className={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                
                {(columnHasHeaderTemplate(header.column.id)) ? <span className={"rdt-header-host"} data-header-host={rozieAttr('h:' + header.column.id)} data-col={rozieAttr(header.column.id)} data-rozie-s-d5dcab4c="" /> : <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(headerLabel(header.column.id))}</span>}<span className={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button> : <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(columnHasHeaderTemplate(header.column.id)) ? <span className={"rdt-header-host"} data-header-host={rozieAttr('h:' + header.column.id)} data-col={rozieAttr(header.column.id)} data-rozie-s-d5dcab4c="" /> : <span className={"rdt-header-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(headerLabel(header.column.id))}</span>}</span>}{(columnIsFilterable(header.column.id)) && <input className={"rdt-col-filter"} type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { $event.stopPropagation(); ((undefined) as ((...args: any[]) => any))($event); }} data-rozie-s-d5dcab4c="" />}<span className={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
                <button type="button" className={"rdt-pin-btn rdt-pin-left"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} onClick={($event) => { $event.stopPropagation(); onPinColumn(header.column.id, 'left'); }} data-rozie-s-d5dcab4c="">⇤</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-none"} aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} onClick={($event) => { $event.stopPropagation(); onPinColumn(header.column.id, false); }} data-rozie-s-d5dcab4c="">⇔</button>
                <button type="button" className={"rdt-pin-btn rdt-pin-right"} aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} onClick={($event) => { $event.stopPropagation(); onPinColumn(header.column.id, 'right'); }} data-rozie-s-d5dcab4c="">⇥</button>
              </span>
              
              <button type="button" className={"rdt-resize-handle"} aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onPointerDown={($event) => { $event.stopPropagation(); onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { $event.stopPropagation(); onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span className={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}</th>)}
        </tr>)}
      </thead>

      <tbody className={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        {rows.map((row) => <tr key={row.id} className={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          {row.getVisibleCells().map((cellCtx) => <td key={cellCtx.id} className={clsx("rdt-td", { "rdt-select-td": isSelectColumn(cellCtx.column.id) })} role="cell" data-col={rozieAttr(cellCtx.column.id)} style={parseInlineStyle(pinStyle(cellCtx.column.id))} data-rozie-s-d5dcab4c="">
            
            {(isSelectColumn(cellCtx.column.id)) ? <span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(props.renderSelectCell ?? props.slots?.['selectCell']) ? ((props.renderSelectCell ?? props.slots?.['selectCell']) as Function)({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) : <input className={"rdt-select-row"} type="checkbox" aria-label="Select row" checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span> : (columnHasCellTemplate(cellCtx.column.id)) ? <span className={"rdt-cell-host"} data-cell-host={rozieAttr('c:' + row.id + ':' + cellCtx.column.id)} data-col={rozieAttr(cellCtx.column.id)} data-row={rozieAttr(row.id)} data-rozie-s-d5dcab4c="" /> : <span className={"rdt-cell-value"} data-rozie-s-d5dcab4c="">{rozieDisplay(cellCtx.getValue())}</span>}</td>)}
        </tr>)}
      </tbody>
    </table>


    <div className={"rdt-pagination"} role="group" aria-label="Pagination" data-rozie-s-d5dcab4c="">
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
    </div>
    </div>
    </>
    </__ctx_data_table_columns.Provider>
  );
});
export default DataTable;
