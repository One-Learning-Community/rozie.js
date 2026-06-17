import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
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

interface SelectCellSlotCtx { row: any; checked: any; toggle: any; }

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
  selectCellSlot?: (ctx: SelectCellSlotCtx) => JSX.Element;
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
  onMount(() => {
    const _cleanup = (() => {
    // Build the table instance HERE so the closures below capture the live `table`.
    table = createTable({
      get data() {
        return local.data;
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
      manualPagination: local.manual === true,
      manualFiltering: local.manual === true,
      manualSorting: local.manual === true,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: local.selectionMode !== 'none',
      enableMultiRowSelection: local.selectionMode === 'multiple',
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
        const next = applyUpdater(updater, columnSizingInfo());
        setColumnSizingInfo(next != null ? next : columnSizingInfo());
      },
      // Resize mode: 'onChange' so the bound columnSizing model updates live during the
      // drag (the behavioral width-delta assertion observes the in-progress width). Column
      // resizing is enabled at the table level; per-column opt-out is via the ColumnDef.
      columnResizeMode: 'onChange',
      enableColumnResizing: true,
      renderFallbackValue: null
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
    };

    // initial pull
    refreshRowModel();
    // project the per-column #cell / #header templates into the freshly-rendered
    // framework-owned hosts — DEFERRED (scheduleReconcile) so the keyed r-for DOM
    // hosts exist before we query for them (a synchronous call here finds zero hosts
    // on first paint).
    scheduleReconcile();
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    // dispose every live cell/header projection on unmount.
    if (cellMounts) {
      for (const h of cellMounts.values() as any) {
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
      cellMounts.clear();
    }
  });
  });
  createEffect(on(() => (() => [sorting(), globalFilter(), columnFilters(), pagination(), rowSelection(), columnVisibility(), columnSizing(), columnOrder(), columnPinning(), local.selectionMode, (local.data || []).length, colReg()])(), (v) => untrack(() => (() => {
    if (!table) return;
    table.setOptions((prev: any) => ({
      ...prev,
      data: local.data,
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: local.selectionMode !== 'none',
      enableMultiRowSelection: local.selectionMode === 'multiple'
    }));
    if (refreshRowModel) refreshRowModel();
  })()), { defer: true }));
  createEffect(on(() => (() => rowModelVer())(), (v) => untrack(() => (() => {
    scheduleReconcile();
  })()), { defer: true }));
  let __rozieRootRef: HTMLElement | null = null;

  // table-core instance — top-level `let` referenced from hooks → React hoists to
  // useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
  // getRowModel-reading closures capture the LIVE instance, NOT an empty initial
  // snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
  // freezes the table at the empty-initial state on React).
  let table: any = null;

  // Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
  // the funnel. A counter (not a boolean) so nested writes are safe.
  let programmatic = 0;

  // Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
  // All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
  // this whole object as `state`.
  function currentState() {
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
  // cannot pollute Object.prototype. Returns the table-core ColumnDef[] PLUS the per-
  // column render metadata (hasCell/cellRenderer/hasHeader/headerRenderer) the template
  // uses to decide plain-value fast path vs per-column slot dispatch.
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
        // config-array columns carry no template → plain-value fast path.
        hasCell: false,
        cellRenderer: null,
        hasHeader: false,
        headerRenderer: null,
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

  // Per-cell / per-header projection bookkeeping: ONE live handle per rendered host,
  // keyed by host element, so a re-render disposes ONLY the handles for hosts that went
  // away (the Column owns its own per-cell handle Set; this parent owns the disposal
  // timing). Module-scope so the Solid-hoisted teardown can sweep it.
  let cellMounts: any = null;
  cellMounts = new Map();
  // Walk the rendered framework-owned hosts ([data-cell-host] / [data-header-host]) and
  // mount the matching column's cellRenderer / headerRenderer into each — ONE handle per
  // host. Hosts that disappeared get their handle disposed. Columns with no template
  // render the plain value inline (the host element is simply not emitted for them), so
  // this only touches template-bearing columns. $el is the component root; querying it
  // is post-mount safe (called from $onMount + the post-refresh $watch).
  function reconcileProjections() {
    if (!__rozieRootRef! || !cellMounts) return;
    const seen = new Set();
    const defs = columnDefs();
    const defById = Object.create(null);
    for (const d of defs as any) defById[d.id] = d;
    // cells
    const cellHosts = __rozieRootRef!.querySelectorAll('[data-cell-host]');
    for (const host of cellHosts as any) {
      const key = host.getAttribute('data-cell-host');
      seen.add(key);
      if (cellMounts.has(key)) continue;
      const colId = host.getAttribute('data-col');
      const rowId = host.getAttribute('data-row');
      const def = defById[colId];
      if (!def || !def.hasCell || !def.cellRenderer) continue;
      const row = (rows() || []).find((r: any) => String(r.id) === String(rowId));
      if (!row) continue;
      const handle = def.cellRenderer(host, {
        row: row.original,
        value: row.getValue(def.accessorKey),
        column: def
      });
      if (handle) cellMounts.set(key, handle);
    }
    // headers
    const headerHosts = __rozieRootRef!.querySelectorAll('[data-header-host]');
    for (const host of headerHosts as any) {
      const key = host.getAttribute('data-header-host');
      seen.add(key);
      if (cellMounts.has(key)) continue;
      const colId = host.getAttribute('data-col');
      const def = defById[colId];
      if (!def || !def.hasHeader || !def.headerRenderer) continue;
      const handle = def.headerRenderer(host, {
        column: def
      });
      if (handle) cellMounts.set(key, handle);
    }
    // dispose handles whose host went away
    for (const key of Array.from(cellMounts.keys()) as any) {
      if (!seen.has(key)) {
        const h = cellMounts.get(key);
        cellMounts.delete(key);
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
  function scheduleReconcile() {
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
  }

  // Reactive re-feed: when the bound sorting slice OR data length OR the column registry
  // changes, push fresh options into table-core and re-pull the row model. Watch the
  // bound references / a derived primitive — never a freshly-built array (Pitfall 3).
  // Lazy by default ($onMount did the first pull). EXTENSION: add the other bound slices
  // to this getter array as they are wired.

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
  // the live sort direction off the table-core column (string-safe — never a bound
  // boolean, the listbox aria lesson).
  function ariaSortFor(colId: any) {
    if (!table) return 'none';
    const col = table.getColumn(colId);
    if (!col) return 'none';
    const dir = col.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }

  // A small sort-direction glyph for the header (▲/▼/empty). Decorative — aria-hidden.
  function sortIndicator(colId: any) {
    if (!table) return '';
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

  // ── Column-management chrome (req-8/9/10/11) ────────────────────────────────────────
  // Live header width (px) for a column — drives the <th> :style width binding. Reads the
  // table-core column size (post-mount) with a fallback to undefined (auto width).
  function headerWidth(colId: any) {
    if (!table) return null;
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
    if (!table) return false;
    const header = findHeader(colId);
    return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
  }

  // Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
  // onColumnVisibilityChange funnel emits the fresh state.
  function columnIsVisible(colId: any) {
    if (!table) return true;
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
    if (!table) return [];
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
    if (!table) return false;
    const col = table.getColumn(colId);
    if (!col || !col.getIsPinned) return false;
    return col.getIsPinned();
  }
  function onPinColumn(colId: any, side: any) {
    if (!table) return;
    const col = table.getColumn(colId);
    if (col && col.pin) col.pin(side);
  }
  // Sticky inline style for a pinned header/cell — position:sticky + the computed left or
  // right offset. Returns '' (no sticky) for unpinned columns. Returned as a STRING (the
  // :style binding is value-driven — never an eval'd attr).
  function pinStyle(colId: any) {
    if (!table) return '';
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
    if (table) return table.getState().pagination.pageIndex;
    const p = currentState().pagination;
    return p && p.pageIndex != null ? p.pageIndex : 0;
  }
  function pageSize() {
    if (table) return table.getState().pagination.pageSize;
    const p = currentState().pagination;
    return p && p.pageSize != null ? p.pageSize : 10;
  }
  function pageCount() {
    if (!table) return 1;
    const c = table.getPageCount();
    return c != null && c > 0 ? c : 1;
  }
  function canPrevPage() {
    return !!(table && table.getCanPreviousPage());
  }
  function canNextPage() {
    return !!(table && table.getCanNextPage());
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
  // select-all header state (D-06: scopes to all filtered rows = TanStack default).
  // `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
  function isAllRowsSelected() {
    return !!(table && table.getIsAllRowsSelected());
  }
  function isSomeRowsSelected() {
    return !!(table && table.getIsSomeRowsSelected());
  }
  function onToggleAllRows(evt: any) {
    if (!table) return;
    table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
  }
  // per-row checkbox state + toggle (checkbox-only, D-05 — row body does NOT select).
  function rowIsSelected(row: any) {
    return !!(row && row.getIsSelected && row.getIsSelected());
  }
  function onToggleRow(row: any, evt: any) {
    if (!row || !row.toggleSelected) return;
    row.toggleSelected(!!(evt && evt.target && evt.target.checked));
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

    <table class={"rozie-data-table"} classList={{ 'rdt-sticky': local.stickyHeader }} role="table" data-rozie-s-d5dcab4c="">
      <thead class={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <For each={headerGroups()}>{(hg) => <tr class={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          <For each={hg.headers}>{(header) => <th class={"rdt-th"} classList={{ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }} role="columnheader" data-col={rozieAttr(header.column.id)} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
            {<Show when={isSelectColumn(header.column.id)} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              
              {<Show when={header.column.getCanSort && header.column.getCanSort()} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {<Show when={columnHasHeaderTemplate(header.column.id)} fallback={<span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(headerLabel(header.column.id))}</span>}><span class={"rdt-header-host"} data-header-host={rozieAttr('h:' + header.column.id)} data-col={rozieAttr(header.column.id)} data-rozie-s-d5dcab4c="" /></Show>}</span>}><button type="button" class={"rdt-sort-btn"} onClick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c="">
                
                {<Show when={columnHasHeaderTemplate(header.column.id)} fallback={<span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(headerLabel(header.column.id))}</span>}><span class={"rdt-header-host"} data-header-host={rozieAttr('h:' + header.column.id)} data-col={rozieAttr(header.column.id)} data-rozie-s-d5dcab4c="" /></Show>}<span class={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header.column.id))}</span>
              </button></Show>}{<Show when={columnIsFilterable(header.column.id)}><input type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} class={"rdt-col-filter"} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { $event.stopPropagation(); undefined(); }} data-rozie-s-d5dcab4c="" /></Show>}<span class={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
                <button type="button" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} class={"rdt-pin-btn rdt-pin-left"} onClick={($event) => { $event.stopPropagation(); onPinColumn(header.column.id, 'left'); }} data-rozie-s-d5dcab4c="">⇤</button>
                <button type="button" aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} class={"rdt-pin-btn rdt-pin-none"} onClick={($event) => { $event.stopPropagation(); onPinColumn(header.column.id, false); }} data-rozie-s-d5dcab4c="">⇔</button>
                <button type="button" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} class={"rdt-pin-btn rdt-pin-right"} onClick={($event) => { $event.stopPropagation(); onPinColumn(header.column.id, 'right'); }} data-rozie-s-d5dcab4c="">⇥</button>
              </span>
              
              <button type="button" aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} class={"rdt-resize-handle"} onPointerDown={($event) => { $event.stopPropagation(); onResizeStart(header.column.id, $event); }} onTouchStart={($event) => { $event.stopPropagation(); onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c=""><span class={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectAllSlot ?? _props.slots?.['selectAll'])?.({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }) ?? <Show when={local.selectionMode === 'multiple'}><input type="checkbox" aria-label="Select all rows" class={"rdt-select-all"} checked={isAllRowsSelected()} indeterminate={rozieAttr(isSomeRowsSelected())} onChange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c="" /></Show>}
            </span></Show>}</th>}</For>
        </tr>}</For>
      </thead>

      <tbody class={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <For each={rows()}>{(row) => <tr class={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          <For each={row.getVisibleCells()}>{(cellCtx) => <td class={"rdt-td"} classList={{ 'rdt-select-td': isSelectColumn(cellCtx.column.id) }} role="cell" data-col={rozieAttr(cellCtx.column.id)} style={parseInlineStyle(pinStyle(cellCtx.column.id))} data-rozie-s-d5dcab4c="">
            
            {<Show when={isSelectColumn(cellCtx.column.id)} fallback={<Show when={columnHasCellTemplate(cellCtx.column.id)} fallback={<span class={"rdt-cell-value"} data-rozie-s-d5dcab4c="">{rozieDisplay(cellCtx.getValue())}</span>}><span class={"rdt-cell-host"} data-cell-host={rozieAttr('c:' + row.id + ':' + cellCtx.column.id)} data-col={rozieAttr(cellCtx.column.id)} data-row={rozieAttr(row.id)} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
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
