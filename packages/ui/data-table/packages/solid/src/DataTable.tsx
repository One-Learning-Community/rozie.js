import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieContext, rozieDisplay } from '@rozie/runtime-solid';
import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

__rozieInjectStyle('DataTable-d5dcab4c', `.rozie-data-table[data-rozie-s-d5dcab4c] {
  border-collapse: collapse;
  width: 100%;
  font: var(--rdt-font, 14px system-ui, sans-serif);
  color: var(--rdt-color, inherit);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td[data-rozie-s-d5dcab4c] {
  padding: var(--rdt-cell-padding, 0.5rem 0.75rem);
  text-align: left;
  border-bottom: var(--rdt-border, 1px solid rgba(0, 0, 0, 0.08));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-thead[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  font-weight: var(--rdt-header-weight, 600);
  background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-sort-btn[data-rozie-s-d5dcab4c] {
  display: inline-flex;
  align-items: center;
  gap: var(--rdt-sort-gap, 0.35em);
  background: none;
  border: none;
  font: inherit;
  font-weight: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-sort-ind[data-rozie-s-d5dcab4c] {
  font-size: 0.8em;
  opacity: var(--rdt-sort-ind-opacity, 0.7);
}
.rozie-data-table.rdt-sticky[data-rozie-s-d5dcab4c] .rdt-thead[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  position: sticky;
  top: var(--rdt-sticky-top, 0);
  z-index: var(--rdt-sticky-z, 2);
  background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] {
  display: flex;
  flex-direction: column;
  gap: var(--rdt-chrome-gap, 0.5rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-toolbar[data-rozie-s-d5dcab4c] {
  display: flex;
  gap: var(--rdt-toolbar-gap, 0.5rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-global-filter[data-rozie-s-d5dcab4c],
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-col-filter[data-rozie-s-d5dcab4c] {
  font: inherit;
  padding: var(--rdt-filter-padding, 0.25rem 0.5rem);
  border: var(--rdt-filter-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-filter-radius, 4px);
  background: var(--rdt-filter-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-col-filter[data-rozie-s-d5dcab4c] {
  display: block;
  margin-top: var(--rdt-col-filter-gap, 0.25rem);
  width: 100%;
  font-weight: normal;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-pagination[data-rozie-s-d5dcab4c] {
  display: flex;
  align-items: center;
  gap: var(--rdt-pagination-gap, 0.5rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-btn[data-rozie-s-d5dcab4c] {
  font: inherit;
  cursor: pointer;
  padding: var(--rdt-page-btn-padding, 0.25rem 0.6rem);
  border: var(--rdt-page-btn-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-page-btn-radius, 4px);
  background: var(--rdt-page-btn-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-btn[data-rozie-s-d5dcab4c]:disabled {
  opacity: var(--rdt-page-btn-disabled-opacity, 0.4);
  cursor: default;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-status[data-rozie-s-d5dcab4c] {
  font-size: var(--rdt-page-status-size, 0.9em);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-size[data-rozie-s-d5dcab4c] {
  font: inherit;
  padding: var(--rdt-page-size-padding, 0.2rem 0.4rem);
  border: var(--rdt-page-size-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-page-size-radius, 4px);
  background: var(--rdt-page-size-bg, transparent);
  color: inherit;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  position: relative;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-resize-handle[data-rozie-s-d5dcab4c] {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: var(--rdt-resize-handle-width, 6px);
  padding: 0;
  border: none;
  background: none;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-resize-grip[data-rozie-s-d5dcab4c] {
  display: block;
  width: var(--rdt-resize-grip-width, 2px);
  height: 100%;
  margin: 0 auto;
  background: var(--rdt-resize-grip-color, rgba(0, 0, 0, 0.12));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-resize-handle[data-rozie-s-d5dcab4c]:hover .rdt-resize-grip[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th-resizing[data-rozie-s-d5dcab4c] .rdt-resize-grip[data-rozie-s-d5dcab4c] {
  background: var(--rdt-resize-grip-active, rgba(0, 0, 0, 0.4));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-pin-controls[data-rozie-s-d5dcab4c] {
  display: inline-flex;
  gap: var(--rdt-pin-gap, 0.1em);
  margin-left: var(--rdt-pin-margin, 0.35em);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-pin-btn[data-rozie-s-d5dcab4c] {
  font: inherit;
  font-size: var(--rdt-pin-btn-size, 0.8em);
  line-height: 1;
  cursor: pointer;
  padding: var(--rdt-pin-btn-padding, 0.1em 0.25em);
  border: var(--rdt-pin-btn-border, 1px solid rgba(0, 0, 0, 0.15));
  border-radius: var(--rdt-pin-btn-radius, 3px);
  background: var(--rdt-pin-btn-bg, transparent);
  color: inherit;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-pin-btn[aria-pressed='true'][data-rozie-s-d5dcab4c] {
  background: var(--rdt-pin-btn-active-bg, rgba(0, 0, 0, 0.1));
  font-weight: 700;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis[data-rozie-s-d5dcab4c] {
  position: relative;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis-summary[data-rozie-s-d5dcab4c] {
  cursor: pointer;
  font: inherit;
  padding: var(--rdt-colvis-summary-padding, 0.25rem 0.6rem);
  border: var(--rdt-colvis-summary-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-colvis-summary-radius, 4px);
  list-style: none;
  user-select: none;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis-menu[data-rozie-s-d5dcab4c] {
  position: absolute;
  z-index: var(--rdt-colvis-menu-z, 5);
  margin-top: var(--rdt-colvis-menu-gap, 0.25rem);
  padding: var(--rdt-colvis-menu-padding, 0.4rem 0.6rem);
  display: flex;
  flex-direction: column;
  gap: var(--rdt-colvis-item-gap, 0.25rem);
  border: var(--rdt-colvis-menu-border, 1px solid rgba(0, 0, 0, 0.15));
  border-radius: var(--rdt-colvis-menu-radius, 4px);
  background: var(--rdt-colvis-menu-bg, #fff);
  box-shadow: var(--rdt-colvis-menu-shadow, 0 2px 8px rgba(0, 0, 0, 0.12));
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis-item[data-rozie-s-d5dcab4c] {
  display: flex;
  align-items: center;
  gap: var(--rdt-colvis-label-gap, 0.4em);
  cursor: pointer;
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-th[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-td[data-rozie-s-d5dcab4c] {
  width: var(--rdt-select-col-width, 1%);
  text-align: var(--rdt-select-col-align, center);
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-all[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-row[data-rozie-s-d5dcab4c] {
  cursor: pointer;
  accent-color: var(--rdt-select-accent, currentColor);
}`);

interface SelectAllSlotCtx { checked: any; indeterminate: any; toggle: any; }

interface ColHeaderSlotCtx { columnId: any; column: any; label: any; }

interface SelectCellSlotCtx { row: any; checked: any; toggle: any; }

interface CellSlotCtx { columnId: any; column: any; row: any; value: any; }

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
  onSortChange?: (...args: unknown[]) => void;
  onFilterChange?: (...args: unknown[]) => void;
  onPageChange?: (...args: unknown[]) => void;
  onSelectionChange?: (...args: unknown[]) => void;
  onVisibilityChange?: (...args: unknown[]) => void;
  onResizeChange?: (...args: unknown[]) => void;
  onReorderChange?: (...args: unknown[]) => void;
  onPinChange?: (...args: unknown[]) => void;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  selectAllSlot?: (ctx: SelectAllSlotCtx) => JSX.Element;
  colHeaderSlot?: (ctx: ColHeaderSlotCtx) => JSX.Element;
  selectCellSlot?: (ctx: SelectCellSlotCtx) => JSX.Element;
  cellSlot?: (ctx: CellSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: DataTableHandle) => void;
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

export default function DataTable(_props: DataTableProps): JSX.Element {
  const _merged = mergeProps({ columns: (() => [])(), selectionMode: 'none', manual: false, stickyHeader: false, interactionMode: 'table' }, _props);
  const [local, attrs] = splitProps(_merged, ['data', 'columns', 'selectionMode', 'sorting', 'globalFilter', 'columnFilters', 'pagination', 'manual', 'rowSelection', 'columnVisibility', 'columnSizing', 'columnOrder', 'columnPinning', 'stickyHeader', 'interactionMode', 'children', 'ref']);
  const resolved = () => local.children;
  onMount(() => { local.ref?.({ sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn }); });

  const __ctx_data_table_columns = rozieContext("data-table:columns");
  const [sorting, setSorting] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'sorting', (() => [])());
  const [globalFilter, setGlobalFilter] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'globalFilter', '');
  const [columnFilters, setColumnFilters] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'columnFilters', (() => [])());
  const [pagination, setPagination] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'pagination', (() => ({
    pageIndex: 0,
    pageSize: 10
  }))());
  const [rowSelection, setRowSelection] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'rowSelection', (() => ({}))());
  const [columnVisibility, setColumnVisibility] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'columnVisibility', (() => ({}))());
  const [columnSizing, setColumnSizing] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'columnSizing', (() => ({}))());
  const [columnOrder, setColumnOrder] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'columnOrder', (() => [])());
  const [columnPinning, setColumnPinning] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'columnPinning', (() => ({
    left: [],
    right: []
  }))());
  const [sortingDefault, setSortingDefault] = createSignal([]);
  const [globalFilterDefault, setGlobalFilterDefault] = createSignal('');
  const [columnFiltersDefault, setColumnFiltersDefault] = createSignal([]);
  const [paginationDefault, setPaginationDefault] = createSignal({
    pageIndex: 0,
    pageSize: 10
  });
  const [rowSelectionDefault, setRowSelectionDefault] = createSignal({});
  const [columnVisibilityDefault, setColumnVisibilityDefault] = createSignal({});
  const [columnSizingDefault, setColumnSizingDefault] = createSignal({});
  const [columnOrderDefault, setColumnOrderDefault] = createSignal([]);
  const [columnPinningDefault, setColumnPinningDefault] = createSignal({
    left: [],
    right: []
  });
  const [columnSizingInfo, setColumnSizingInfo] = createSignal({
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: []
  });
  const [colReg, setColReg] = createSignal({});
  const [rows, setRows] = createSignal([]);
  const [headerGroups, setHeaderGroups] = createSignal([]);
  const [rowModelVer, setRowModelVer] = createSignal(0);
  const [activeRow, setActiveRow] = createSignal(0);
  const [activeColIndex, setActiveColIndex] = createSignal(0);
  const [activeIsHeader, setActiveIsHeader] = createSignal(false);
  const [activeInControl, setActiveInControl] = createSignal(false);
  onMount(() => {
    // Build the table instance HERE so the closures below capture the live `table`.
    table = createTable({
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      data: local.data,
      columns: tableColumns(),
      state: currentState(),
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      // Server-side hook (req-6): when `manual` is set, table-core trusts the consumer's
      // rows verbatim (no client-side filter/sort/paginate) and only emits the change
      // events so the consumer can fetch the next page/filtered slice.
      manualPagination: local.manual === true,
      manualFiltering: local.manual === true,
      manualSorting: local.manual === true,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: local.selectionMode !== 'none',
      enableMultiRowSelection: local.selectionMode === 'multiple',
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
    refreshRowModel = () => {
      if (!table) return;
      // Capture fresh locals; never write a $data key then re-read it in the same fn
      // (ROZ138 / React stale-read — setState is async on React, the closure binds the
      // PRE-write value).
      const nextRows = table.getRowModel().rows.slice();
      const nextGroups = table.getHeaderGroups().slice();
      setRows(nextRows);
      setHeaderGroups(nextGroups);
      setRowModelVer(rowModelVer() + 1);
      // keep the select-all checkbox's `indeterminate` DOM property in lockstep with the
      // selection state (bound :indeterminate is inert on 5/6 targets). The box persists
      // across selection changes; a microtask defer covers React's post-render DOM patch.
      syncIndeterminate();
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(syncIndeterminate);else Promise.resolve().then(syncIndeterminate);
    };

    // initial pull
    refreshRowModel();

    // ── Grid mode: capture the table root + focus the D-04 entry cell ──────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean. The entry-cell focus is gated by
    // isGrid() so 'table' mode is entirely untouched.
    gridRoot = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-data-table') : null;
    if (isGrid()) {
      // D-04: first body data cell (row 0, first navigable column). Re-resolved fresh —
      // no DOM node is ever stored in $data. Deferred a microtask so the body cells have
      // mounted before the query (React/Solid commit their first render asynchronously).
      const focusEntry = () => focusActiveCell(activeRow(), activeColIndex());
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(focusEntry);else Promise.resolve().then(focusEntry);
    }
  });
  createEffect(() => {
    if (!table) return;
    const d = local.data || [];
    if (d === lastData && d.length === lastDataLen) return;
    lastData = d;
    lastDataLen = d.length;
    reFeed();
  });
  createEffect(on(() => (() => [sorting(), globalFilter(), columnFilters(), pagination(), rowSelection(), columnVisibility(), columnSizing(), columnOrder(), columnPinning(), local.selectionMode, (local.data || []).length, colReg()])(), (v) => untrack(() => (() => {
    reFeed();
  })()), { defer: true }));
  let __rozieRootRef: HTMLElement | null = null;

  // table-core instance — top-level `let` referenced from hooks → React hoists to
  // useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
  // getRowModel-reading closures capture the LIVE instance, NOT an empty initial
  // snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
  // freezes the table at the empty-initial state on React).
  let table: any = null;

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
  let gridRoot: any = null;

  // Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
  // the funnel. A counter (not a boolean) so nested writes are safe.
  let programmatic = 0;

  // Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
  // All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
  // this whole object as `state`. Return type annotated `any`: the inferred object-literal
  // type does not structurally match table-core's `Partial<TableState>` under the strict
  // bundled-leaf tsc (the columnSizingInfo/pagination shapes widen to Record) — the
  // runtime shape is correct; `any` sidesteps the over-strict structural check (the
  // deferred-items strict-tsc #2 / leaf-output-strict-typecheck close).
  function currentState(): any {
    return {
      sorting: sorting() != null ? sorting() : sortingDefault(),
      globalFilter: globalFilter() != null ? globalFilter() : globalFilterDefault(),
      columnFilters: columnFilters() != null ? columnFilters() : columnFiltersDefault(),
      pagination: pagination() != null ? pagination() : paginationDefault(),
      rowSelection: rowSelection() != null ? rowSelection() : rowSelectionDefault(),
      columnVisibility: columnVisibility() != null ? columnVisibility() : columnVisibilityDefault(),
      columnSizing: columnSizing() != null ? columnSizing() : columnSizingDefault(),
      columnOrder: columnOrder() != null ? columnOrder() : columnOrderDefault(),
      columnPinning: columnPinning() != null ? columnPinning() : columnPinningDefault(),
      // columnSizingInfo: table-core's transient resize-gesture state. We pass an
      // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
      // `column.getIsResizing()` / `getResizeHandler()` read
      // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
      // absent. Seed the default shape (matches table-core's
      // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
      // every render. Not a two-way model slice (transient gesture state, not consumer
      // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
      columnSizingInfo: columnSizingInfo()
    };
  }

  // Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
  // applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
  // byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
  // cannot pollute Object.prototype. Returns the table-core ColumnDef[]. (No per-column
  // render callbacks — cells render via the single #cell/#header scoped slot on this
  // component, dispatched by columnId; <Column> carries metadata only.)
  function isSafeKey(k: any) {
    return k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  }
  function columnDefs() {
    const byId = Object.create(null);
    const order = [];
    const cfg = local.columns || [];
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
    const reg = colReg() || {};
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
    return local.selectionMode === 'single' || local.selectionMode === 'multiple';
  }
  function tableColumns() {
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
  }

  // ── sorting slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────────
  // table-core hands an Updater<SortingState> = value | (old)=>new; the onSortingChange
  // callback applies it against the CURRENT sorting, then this funnel writes a FRESH
  // array to the uncontrolled default + the two-way model + fires the change event
  // REGARDLESS of binding. STATIC key (`$data.sortingDefault` / `$model.sorting`) — a
  // dynamic-key funnel is ROZ106 on all six. The remaining 8 slices each get their own
  // such funnel in Plans 04/05.
  function writeSorting(next: any) {
    if (programmatic) return;
    programmatic++;
    setSortingDefault(next); // fresh array only (never in-place)
    setSorting(next); // two-way emit if bound (no-op-diff if not)
    _props.onSortChange?.(next);
    programmatic--;
  }
  function applyUpdater(updater: any, current: any) {
    return typeof updater === 'function' ? updater(current) : updater;
  }

  // ── globalFilter slice: STATIC-KEY fresh-value echo-guarded write funnel (A4) ──────
  // A fresh string (primitive) to the uncontrolled default + the two-way model + fires
  // `filter-change` REGARDLESS of binding.
  function writeGlobalFilter(next: any) {
    if (programmatic) return;
    programmatic++;
    setGlobalFilterDefault(next);
    setGlobalFilter(next);
    _props.onFilterChange?.({
      globalFilter: next
    });
    programmatic--;
  }

  // ── columnFilters slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ─────
  // table-core hands ColumnFiltersState = [{ id, value }]; write a FRESH array (never
  // in-place push) + fire `filter-change`. globalFilter + columnFilters both surface
  // through `filter-change` (per the plan: filter-change fires regardless of binding).
  function writeColumnFilters(next: any) {
    if (programmatic) return;
    programmatic++;
    setColumnFiltersDefault(next);
    setColumnFilters(next);
    _props.onFilterChange?.({
      columnFilters: next
    });
    programmatic--;
  }

  // ── pagination slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ───────
  // table-core hands { pageIndex, pageSize }; write a FRESH object + fire `page-change`.
  function writePagination(next: any) {
    if (programmatic) return;
    programmatic++;
    setPaginationDefault(next);
    setPagination(next);
    _props.onPageChange?.(next);
    programmatic--;
  }

  // ── rowSelection slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
  // table-core hands RowSelectionState = { [rowId]: true }; write a FRESH object (never
  // in-place key-set) + fire `selection-change` REGARDLESS of binding.
  function writeRowSelection(next: any) {
    if (programmatic) return;
    programmatic++;
    setRowSelectionDefault(next);
    setRowSelection(next);
    _props.onSelectionChange?.(next);
    programmatic--;
  }

  // ── columnVisibility slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──
  // table-core hands VisibilityState = { [colId]: boolean }; write a FRESH object (never
  // in-place key-set) + fire `visibility-change` REGARDLESS of binding.
  function writeColumnVisibility(next: any) {
    if (programmatic) return;
    programmatic++;
    setColumnVisibilityDefault(next);
    setColumnVisibility(next);
    _props.onVisibilityChange?.(next);
    programmatic--;
  }

  // ── columnSizing slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────
  // table-core hands ColumnSizingState = { [colId]: number }; the pointer-drag resize
  // handle funnels a FRESH sizing object + fires `resize-change` REGARDLESS of binding.
  function writeColumnSizing(next: any) {
    if (programmatic) return;
    programmatic++;
    setColumnSizingDefault(next);
    setColumnSizing(next);
    _props.onResizeChange?.(next);
    programmatic--;
  }

  // ── columnOrder slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ────────
  // table-core hands ColumnOrderState = string[]; write a FRESH order array (never an
  // in-place splice) + fire `reorder-change` REGARDLESS of binding.
  function writeColumnOrder(next: any) {
    if (programmatic) return;
    programmatic++;
    setColumnOrderDefault(next);
    setColumnOrder(next);
    _props.onReorderChange?.(next);
    programmatic--;
  }

  // ── columnPinning slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
  // table-core hands ColumnPinningState = { left: string[], right: string[] }; write a
  // FRESH object (never in-place push into left/right) + fire `pin-change` REGARDLESS of
  // binding.
  function writeColumnPinning(next: any) {
    if (programmatic) return;
    programmatic++;
    setColumnPinningDefault(next);
    setColumnPinning(next);
    _props.onPinChange?.(next);
    programmatic--;
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

  // Re-read the row model + header groups into $data (fresh arrays → the template
  // re-renders). A plain fn (NOT a $computed — getRowModel() must be pulled AFTER a
  // setOptions re-feed, imperatively). Defined inside $onMount so it captures the live
  // `table`.
  let refreshRowModel: any = null;

  // PER-SLICE callbacks hoisted to top-level consts (NOT inlined in createTable) so the
  // re-feed $watch can re-pass them on every setOptions. On React the createTable
  // callbacks would otherwise capture the MOUNT-render's currentState() closure (table
  // instance is built once in $onMount); table-core's setOptions keeps the prior
  // callbacks unless new ones are supplied, so a stale callback applied each updater
  // against the mount-time empty slice → the sort cycle never advances + multi-row
  // selection collapses to the last row (React stale-closure, F6). Re-passing these
  // fresh (recreated each render on React, reading fresh currentState) in the re-feed
  // keeps the Updater base value current. No-op cost on the other five.
  function onSortingChangeCb(updater: any) {
    writeSorting(applyUpdater(updater, currentState().sorting));
  }
  function onGlobalFilterChangeCb(updater: any) {
    writeGlobalFilter(applyUpdater(updater, currentState().globalFilter));
  }
  function onColumnFiltersChangeCb(updater: any) {
    writeColumnFilters(applyUpdater(updater, currentState().columnFilters));
  }
  function onPaginationChangeCb(updater: any) {
    writePagination(applyUpdater(updater, currentState().pagination));
  }
  function onRowSelectionChangeCb(updater: any) {
    writeRowSelection(applyUpdater(updater, currentState().rowSelection));
  }
  function onColumnVisibilityChangeCb(updater: any) {
    writeColumnVisibility(applyUpdater(updater, currentState().columnVisibility));
  }
  function onColumnSizingChangeCb(updater: any) {
    writeColumnSizing(applyUpdater(updater, currentState().columnSizing));
  }
  function onColumnOrderChangeCb(updater: any) {
    writeColumnOrder(applyUpdater(updater, currentState().columnOrder));
  }
  function onColumnPinningChangeCb(updater: any) {
    writeColumnPinning(applyUpdater(updater, currentState().columnPinning));
  }
  function onColumnSizingInfoChangeCb(updater: any) {
    const next = applyUpdater(updater, columnSizingInfo());
    setColumnSizingInfo(next != null ? next : columnSizingInfo());
  }
  // Push fresh options into table-core + re-pull the row model. Extracted so BOTH the
  // re-feed $watch (above) and the Lit data-change $onUpdate (below) call it.
  function reFeed() {
    if (!table) return;
    table.setOptions((prev: any) => ({
      ...prev,
      data: local.data,
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: local.selectionMode !== 'none',
      enableMultiRowSelection: local.selectionMode === 'multiple',
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
    if (refreshRowModel) refreshRowModel();
  }

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
  let lastData: any = null;
  let lastDataLen = -1;
  // Header click → toggle sort. Shift-click → ADD a secondary sort (multi-sort). Driven
  // through table-core's column API so the onSortingChange funnel emits the fresh state.
  function onHeaderSort(colId: any, evt: any) {
    if (!table) return;
    const col = table.getColumn(colId);
    if (!col || !col.getCanSort()) return;
    const multi = !!(evt && evt.shiftKey);
    // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
    col.toggleSorting(undefined, multi);
  }

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
    return rowModelVer();
  }
  // the live sort direction off the table-core column (string-safe — never a bound
  // boolean, the listbox aria lesson).
  function ariaSortFor(colId: any) {
    if (tick() < 0 || !table) return 'none';
    const col = table.getColumn(colId);
    if (!col) return 'none';
    const dir = col.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }

  // A small sort-direction glyph for the header (▲/▼/empty). Decorative — aria-hidden.
  function sortIndicator(colId: any) {
    if (tick() < 0 || !table) return '';
    const col = table.getColumn(colId);
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
  // set. Solid's reference-keyed <For> keeps the existing <tr> and will NOT re-run a
  // child loop whose `each` reads no signal — so a bare `row.getVisibleCells()` goes
  // stale (header reorders, cells don't). Reading `$data.rowModelVer` (bumped by every
  // refreshRowModel) inside the `each` puts the inner loop in the reactive scope, so it
  // re-derives the cells on every row-model change. No-op on the coarse-render targets.
  function visibleCellsFor(row: any) {
    return rowModelVer() >= 0 ? row.getVisibleCells() : [];
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
    if (tick() < 0 || !table) return null;
    const col = table.getColumn(colId);
    if (!col) return null;
    const w = col.getSize();
    return w != null && w > 0 ? w + 'px' : null;
  }

  // Pointer-drag resize handler for a resizable header — table-core's getResizeHandler()
  // returns a function bound to a pointerdown/touchstart event that drives the column
  // size through onColumnSizingChange (our writeColumnSizing funnel) under
  // columnResizeMode:'onChange'. Pure delegation; no scratch gesture state held in a
  // top-level const (the React fragile-binding rule — table-core owns the gesture state).
  function onResizeStart(colId: any, evt: any) {
    // stop here (NOT a `.stop` modifier) — the Angular `.stop`-in-@for hoist is broken (F5).
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table) return;
    const header = findHeader(colId);
    if (!header || !header.getResizeHandler) return;
    const handler = header.getResizeHandler();
    if (handler) handler(evt);
  }
  // Find the live header object for a column id across the rendered header groups.
  function findHeader(colId: any) {
    const groups = headerGroups() || [];
    for (const hg of groups as any) {
      const hs = hg.headers || [];
      for (const h of hs as any) if (h && h.column && h.column.id === colId) return h;
    }
    return null;
  }
  function columnIsResizing(colId: any) {
    if (tick() < 0 || !table) return false;
    const header = findHeader(colId);
    return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
  }

  // Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
  // onColumnVisibilityChange funnel emits the fresh state.
  function columnIsVisible(colId: any) {
    if (tick() < 0 || !table) return true;
    const col = table.getColumn(colId);
    return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
  }
  function onToggleVisibility(colId: any) {
    if (!table) return;
    const col = table.getColumn(colId);
    if (col && col.toggleVisibility) col.toggleVisibility();
  }
  // The full set of leaf columns (for the visibility-toggle menu) — id + header label +
  // current visibility. Excludes the auto-injected select column (always present).
  function allLeafColumns() {
    if (tick() < 0 || !table) return [];
    const cols = table.getAllLeafColumns ? table.getAllLeafColumns() : [];
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

  // Pinning (req-11) — drive table-core's column.pin('left'|'right'|false) so the
  // onColumnPinningChange funnel emits a fresh state. Sticky offsets read the live column
  // start/after positions (table-core computes them from the pinned column sizes).
  function columnPinSide(colId: any) {
    if (tick() < 0 || !table) return false;
    const col = table.getColumn(colId);
    if (!col || !col.getIsPinned) return false;
    return col.getIsPinned();
  }
  // NOTE: the event is stopped HERE (evt.stopPropagation()) rather than via a `.stop`
  // template modifier. The Angular emitter, hoisting a `.stop`-modified handler that
  // lives INSIDE an `@for` loop into a class-field wrapper, drops the component `this.`
  // qualifier (→ `onPinColumn(...)` bare ReferenceError) and fails to capture the loop
  // var — so a `@click.stop="onPinColumn(...)"` inside the header `@for` breaks on
  // Angular (F5). Stopping inside the handler sidesteps the broken hoist on all six.
  function onPinColumn(colId: any, side: any, evt: any) {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (!table) return;
    const col = table.getColumn(colId);
    if (col && col.pin) col.pin(side);
  }
  // Sticky inline style for a pinned header/cell — position:sticky + the computed left or
  // right offset. Returns '' (no sticky) for unpinned columns. Returned as a STRING (the
  // :style binding is value-driven — never an eval'd attr).
  function pinStyle(colId: any) {
    if (tick() < 0 || !table) return '';
    const col = table.getColumn(colId);
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
  // Combined inline style for a <th> (width + pin) and a <td> (pin). Plain string concat —
  // uniform on all 6, no bound-object trap.
  function thStyle(colId: any) {
    let s = '';
    const w = headerWidth(colId);
    if (w) s += 'width:' + w + ';';
    s += pinStyle(colId);
    return s;
  }

  // ── Filter chrome handlers ─────────────────────────────────────────────────────────
  // Global search input → funnel through table-core's setGlobalFilter so the
  // onGlobalFilterChange callback fires the echo-guarded writer. Capture the fresh local
  // value (never re-read a just-written $data key — React stale-read).
  function onGlobalFilterInput(evt: any) {
    const value = evt && evt.target ? evt.target.value : '';
    if (table) {
      table.setGlobalFilter(value);
      return;
    }
    writeGlobalFilter(value);
  }
  // Per-column filter input → setColumnFilter (fresh-array funnel).
  function onColumnFilterInput(colId: any, evt: any) {
    const value = evt && evt.target ? evt.target.value : '';
    setColumnFilter(colId, value);
  }
  // The live global filter value (bound to the search <input>, value-driven NOT eval'd).
  function globalFilterValue() {
    const v = currentState().globalFilter;
    return v != null ? v : '';
  }

  // ── Pagination chrome ────────────────────────────────────────────────────────────
  // Read the live pagination state off table-core (post-mount) with a currentState()
  // fallback (pre-mount / SSR). All string-safe (no bound booleans).
  function pageIndex() {
    if (tick() >= 0 && table) return table.getState().pagination.pageIndex;
    const p = currentState().pagination;
    return p && p.pageIndex != null ? p.pageIndex : 0;
  }
  function pageSize() {
    if (tick() >= 0 && table) return table.getState().pagination.pageSize;
    const p = currentState().pagination;
    return p && p.pageSize != null ? p.pageSize : 10;
  }
  function pageCount() {
    if (tick() < 0 || !table) return 1;
    const c = table.getPageCount();
    return c != null && c > 0 ? c : 1;
  }
  function canPrevPage() {
    return !!(tick() >= 0 && table && table.getCanPreviousPage());
  }
  function canNextPage() {
    return !!(tick() >= 0 && table && table.getCanNextPage());
  }
  function onPrevPage() {
    if (table) table.previousPage();
  }
  function onNextPage() {
    if (table) table.nextPage();
  }
  function onPageSizeChange(evt: any) {
    if (!table) return;
    const v = evt && evt.target ? evt.target.value : '';
    const n = parseInt(v, 10);
    table.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
  }

  // ── Row-selection chrome (req-7) ───────────────────────────────────────────────────
  // Detect the auto-injected leading checkbox column by its constant id (template uses
  // this to render checkbox chrome instead of an accessor value).
  function isSelectColumn(colId: any) {
    return colId === SELECT_COL_ID;
  }
  // Plain stop-propagation handler (used in place of the `@click.stop` bare modifier —
  // a bare `.stop` with no handler hoists to `_guardedUndefined` → `this.undefined($event)`
  // on Angular inside an `@for`, F5). Calling an explicit handler is uniform on all six.
  function stopEvent(evt: any) {
    if (evt && evt.stopPropagation) evt.stopPropagation();
  }
  // select-all header state (D-06: scopes to all filtered rows = TanStack default).
  // `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
  function isAllRowsSelected() {
    return !!(tick() >= 0 && table && table.getIsAllRowsSelected());
  }
  function isSomeRowsSelected() {
    return !!(tick() >= 0 && table && table.getIsSomeRowsSelected());
  }
  function onToggleAllRows(evt: any) {
    if (!table) return;
    table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
  }
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
  function onToggleRow(row: any, evt: any) {
    if (!row || !row.toggleSelected) return;
    row.toggleSelected(!!(evt && evt.target && evt.target.checked));
  }
  // `indeterminate` is a DOM PROPERTY, not an HTML attribute — a `:indeterminate="…"`
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
  let selectAllBox: any = null;
  function syncIndeterminate() {
    if (!__rozieRootRef! || !__rozieRootRef!.querySelector) return;
    selectAllBox = __rozieRootRef!.querySelector('.rdt-select-all');
    if (selectAllBox) selectAllBox.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
  }

  // The registry API handed to <Column> children (whole-object-replace — T-48-PP guard).

  // Imperative handle (consumer-callable). Each verb is a PRE-DECLARED top-level
  // `const` (the canonical $expose contract — `$expose({ name })` references a
  // binding ALREADY in scope; an INLINE-defined verb `$expose({ name: () => {} })`
  // is dropped on ALL SIX targets, only the by-reference key survives → a
  // runtime ReferenceError at `defineExpose`/`useImperativeHandle`). Sorting verbs +
  // a fresh column-def readout, selection, pagination, and column-management verbs.
  function sortColumn(colId: any, desc: any) {
    if (table) table.getColumn(colId) && table.getColumn(colId).toggleSorting(desc, false);
  }
  function clearSorting() {
    if (table) table.resetSorting(true);
  }
  function getColumnDefs() {
    return columnDefs();
  }
  // selection verbs (req-7) — drive table-core so the onRowSelectionChange funnel
  // emits the fresh state + selection-change.
  function toggleAllRows(value: any) {
    if (table) table.toggleAllRowsSelected(value);
  }
  function clearSelection() {
    if (table) table.resetRowSelection(true);
  }
  function getSelectedRows() {
    return table ? table.getSelectedRowModel().rows.map((r: any) => r.original) : [];
  }
  // pagination verbs.
  function setPage(idx: any) {
    if (table) table.setPageIndex(idx);
  }
  function setRowsPerPage(size: any) {
    if (table) table.setPageSize(size);
  }
  // column-management verbs (req-8/9/10/11) — drive table-core so the funnels fire.
  function toggleColumnVisibility(colId: any) {
    if (table) {
      const c = table.getColumn(colId);
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
    if (table) table.setColumnOrder(order);
  }
  function resetColumnSizing() {
    if (table) table.resetColumnSizing(true);
  }
  // pinColumn: the verb that drives column.pin; distinct from the template handler
  // onPinColumn (no shadow — the deferred-items finding #4 collision check).
  function pinColumn(colId: any, side: any) {
    if (table) {
      const c = table.getColumn(colId);
      if (c && c.pin) c.pin(side);
    }
  }

  // ══ Grid interaction mode (phase 49) — STATE + STRUCTURE only ═══════════════════════════
  // This plan (02) establishes the gated ARIA roles, the roving single-tab-stop tabindex,
  // the active-cell index-pair state, the data-* cell markers, and the SINGLE
  // focusActiveCell() seam. Plan 03 adds the keydown navigation math, the $expose verbs
  // (focusCell/getActiveCell/clearActiveCell), and the activecell-change event ON TOP.

  // interactionMode gate. 'grid' lights up roving nav; 'table' (default) is byte-behaviorally
  // identical to phase 48 (roles fall back to the literals, tabindex drops).
  function isGrid() {
    return local.interactionMode === 'grid';
  }

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
    return tick() >= 0 ? (rows() || []).indexOf(row) : -1;
  }
  // colIndexOf: a body cell's position in its row's visible cell list.
  function colIndexOf(row: any, cellCtx: any) {
    return tick() >= 0 ? visibleCellsFor(row).indexOf(cellCtx) : -1;
  }
  // headerColIndexOf: a header cell's position in its header group's leaf headers.
  function headerColIndexOf(hg: any, header: any) {
    return (hg && hg.headers ? hg.headers : []).indexOf(header);
  }

  // Roving tabindex (RESEARCH Code Examples). Reads ONLY reactive $data (ROZ123-safe,
  // fine-grained-reactive). Returns null in 'table' mode → the bound attribute DROPS
  // entirely (rozieAttr nullish-drop), keeping 'table'-mode DOM clean. rowKey is the literal
  // '__header' for header cells or the String(bodyRowIndex) for body cells, so the active
  // header state (activeIsHeader) is addressable through the same computed.
  function cellTabindex(rowKey: any, colIndex: any) {
    if (!isGrid()) return null;
    const activeKey = activeIsHeader() ? '__header' : String(activeRow());
    const isActive = rowKey === activeKey && colIndex === activeColIndex();
    return isActive ? 0 : -1;
  }

  // ── The focus SEAM (RESEARCH Pattern 1 + 3, req-6) ─────────────────────────────────────
  // resolveCellEl: index pair → DOM element, via a data-* attribute query off the stable
  // post-mount root. Uniform on all six, shadow-safe (the query runs from inside the
  // component's own scope). rowKey is the literal '__header' or a String(integer index) and
  // colIndex is an integer — NO consumer string is interpolated into the selector (T-49-01).
  function resolveCellEl(rowKey: any, colIndex: any) {
    if (!gridRoot) return null;
    return gridRoot.querySelector('[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]');
  }

  // focusActiveCell: THE single DOM-focus-resolution path (req-6). Every focus change —
  // the D-04 entry cell here, and (plan 03) arrow nav / focusCell() / the data-change clamp —
  // routes through this one function, so a verifier can point to it and phase 53 windowing
  // hooks it without a rewrite. Accepts OPTIONAL explicit (nextRow,nextCol) so callers can
  // pass FRESH post-write locals (React ROZ138 / Angular signal async — pinned by plan 01);
  // falls back to $data when none passed. NEVER stores a DOM node (index-only state).
  function focusActiveCell(nextRow: any, nextCol: any) {
    if (!isGrid() || !gridRoot) return;
    // ── phase 53 hooks HERE: scrollRowIntoWindow(nextRow ?? $data.activeRow) before resolve ──
    const r = nextRow == null ? activeRow() : nextRow;
    const c = nextCol == null ? activeColIndex() : nextCol;
    const rowKey = activeIsHeader() ? '__header' : String(r);
    const el = resolveCellEl(rowKey, c);
    if (el) el.focus();
  }

  return (
    <__ctx_data_table_columns.Provider value={{
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    setColReg({
      ...colReg(),
      [key]: spec
    });
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...colReg()
    };
    delete r[String(id)];
    setColReg(r);
  }
}}>
    <>

    <div class={"rozie-data-table-wrap"} ref={(el) => { __rozieRootRef = el as HTMLElement; }} data-rozie-s-d5dcab4c="">

    <div class={"rdt-column-defs"} style={{ display: "none" }} aria-hidden="true" data-rozie-s-d5dcab4c="">{resolved()}</div>

    <div class={"rdt-toolbar"} data-rozie-s-d5dcab4c="">
      <input type="text" role="searchbox" aria-label="Search table" class={"rdt-global-filter"} value={globalFilterValue()} onInput={($event) => { onGlobalFilterInput($event); }} data-rozie-s-d5dcab4c="" />
      
      {<Show when={allLeafColumns().length}><details class={"rdt-colvis"} data-rozie-s-d5dcab4c="">
        <summary class={"rdt-colvis-summary"} data-rozie-s-d5dcab4c="">Columns</summary>
        <div class={"rdt-colvis-menu"} role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c="">
          <For each={allLeafColumns()}>{(lc) => <label class={"rdt-colvis-item"} data-rozie-s-d5dcab4c="">
            <input type="checkbox" class={"rdt-colvis-checkbox"} checked={lc.visible} onChange={($event) => { onToggleVisibility(lc.id); }} data-rozie-s-d5dcab4c="" />
            <span class={"rdt-colvis-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(lc.label)}</span>
          </label>}</For>
        </div>
      </details></Show>}</div>

    <table class={"rozie-data-table"} classList={{ 'rdt-sticky': local.stickyHeader }} role={rozieAttr(tableRole())} data-rozie-s-d5dcab4c="">
      <thead class={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <For each={headerGroups()}>{(hg) => <tr class={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          <For each={hg.headers}>{(header) => <th class={"rdt-th"} classList={{ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header)))} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
            {<Show when={isSelectColumn(header.column.id)} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              
              {<Show when={header.column.getCanSort && header.column.getCanSort()} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(_props.colHeaderSlot ?? _props.slots?.['colHeader'])?.({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) ?? rozieDisplay(headerLabel(header.column.id))}
                </span>
              </span>}><button type="button" class={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                
                <span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {(_props.colHeaderSlot ?? _props.slots?.['colHeader'])?.({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }) ?? rozieDisplay(headerLabel(header.column.id))}
                </span>
                <span class={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button></Show>}{<Show when={columnIsFilterable(header.column.id)}><input type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} class={"rdt-col-filter"} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" /></Show>}<span class={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
                <button type="button" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} class={"rdt-pin-btn rdt-pin-left"} onClick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c="">⇤</button>
                <button type="button" aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} class={"rdt-pin-btn rdt-pin-none"} onClick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c="">⇔</button>
                <button type="button" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} class={"rdt-pin-btn rdt-pin-right"} onClick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c="">⇥</button>
              </span>
              
              <button type="button" aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} class={"rdt-resize-handle"} onPointerDown={($event) => { onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span class={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectAllSlot ?? _props.slots?.['selectAll'])?.({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) ?? <Show when={local.selectionMode === 'multiple'}><input type="checkbox" aria-label="Select all rows" class={"rdt-select-all"} checked={isAllRowsSelected()} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" /></Show>}
            </span></Show>}</th>}</For>
        </tr>}</For>
      </thead>

      <tbody class={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <For each={rows()}>{(row) => <tr class={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          <For each={visibleCellsFor(row)}>{(cellCtx) => <td class={"rdt-td"} classList={{ 'rdt-select-td': isSelectColumn(cellCtx.column.id) }} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cellCtx))} tabIndex={rozieAttr(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx)))} style={parseInlineStyle(pinStyle(cellCtx.column.id))} data-rozie-s-d5dcab4c="">
            
            {<Show when={isSelectColumn(cellCtx.column.id)} fallback={<span class={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(_props.cellSlot ?? _props.slots?.['cell'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) ?? rozieDisplay(cellCtx.getValue())}
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectCellSlot ?? _props.slots?.['selectCell'])?.({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) ?? <input type="checkbox" aria-label="Select row" class={"rdt-select-row"} checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span></Show>}</td>}</For>
        </tr>}</For>
      </tbody>
    </table>


    <div class={"rdt-pagination"} role="group" aria-label="Pagination" data-rozie-s-d5dcab4c="">
      <button type="button" class={"rdt-page-btn rdt-page-prev"} disabled={!canPrevPage()} onClick={($event) => { onPrevPage(); }} data-rozie-s-d5dcab4c="">Prev</button>
      <span class={"rdt-page-status"} aria-live="polite" data-rozie-s-d5dcab4c="">
        {rozieDisplay('Page ' + (pageIndex() + 1) + ' of ' + pageCount())}
      </span>
      <button type="button" class={"rdt-page-btn rdt-page-next"} disabled={!canNextPage()} onClick={($event) => { onNextPage(); }} data-rozie-s-d5dcab4c="">Next</button>
      <select aria-label="Rows per page" class={"rdt-page-size"} value={pageSize()} onChange={($event) => { onPageSizeChange($event); }} data-rozie-s-d5dcab4c="">
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
}
