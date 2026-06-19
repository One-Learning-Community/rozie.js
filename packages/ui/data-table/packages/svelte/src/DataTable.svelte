<script lang="ts">
import { rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onDestroy, onMount, setContext, untrack } from 'svelte';

interface Props {
  data: any[];
  columns?: any[];
  selectionMode?: string;
  sorting?: any[];
  globalFilter?: string;
  columnFilters?: any[];
  pagination?: any;
  manual?: boolean;
  rowSelection?: any;
  columnVisibility?: any;
  columnSizing?: any;
  columnOrder?: any[];
  columnPinning?: any;
  stickyHeader?: boolean;
  interactionMode?: string;
  virtual?: boolean;
  estimateRowHeight?: number;
  maxHeight?: string;
  children?: Snippet;
  selectAll?: Snippet<[{ checked: any; indeterminate: any; toggle: any }]>;
  colHeader?: Snippet<[{ columnId: any; column: any; label: any }]>;
  selectCell?: Snippet<[{ row: any; checked: any; toggle: any }]>;
  cell?: Snippet<[{ columnId: any; column: any; row: any; value: any }]>;
  snippets?: Record<string, any>;
  onsortchange?: (...args: unknown[]) => void;
  onfilterchange?: (...args: unknown[]) => void;
  onpagechange?: (...args: unknown[]) => void;
  onselectionchange?: (...args: unknown[]) => void;
  onvisibilitychange?: (...args: unknown[]) => void;
  onresizechange?: (...args: unknown[]) => void;
  onreorderchange?: (...args: unknown[]) => void;
  onpinchange?: (...args: unknown[]) => void;
  onactivecellchange?: (...args: unknown[]) => void;
}

let __defaultColumns = (() => [])();

let {
  data,
  columns = __defaultColumns,
  selectionMode = 'none',
  sorting = $bindable((() => [])()),
  globalFilter = $bindable(''),
  columnFilters = $bindable((() => [])()),
  pagination = $bindable((() => ({
  pageIndex: 0,
  pageSize: 10
}))()),
  manual = false,
  rowSelection = $bindable((() => ({}))()),
  columnVisibility = $bindable((() => ({}))()),
  columnSizing = $bindable((() => ({}))()),
  columnOrder = $bindable((() => [])()),
  columnPinning = $bindable((() => ({
  left: [],
  right: []
}))()),
  stickyHeader = false,
  interactionMode = 'table',
  virtual = false,
  estimateRowHeight = 40,
  maxHeight = '',
  children: __childrenProp,
  selectAll: __selectAllProp,
  colHeader: __colHeaderProp,
  selectCell: __selectCellProp,
  cell: __cellProp,
  snippets,
  onsortchange,
  onfilterchange,
  onpagechange,
  onselectionchange,
  onvisibilitychange,
  onresizechange,
  onreorderchange,
  onpinchange,
  onactivecellchange
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
const selectAll = $derived(__selectAllProp ?? snippets?.selectAll);
const colHeader = $derived(__colHeaderProp ?? snippets?.colHeader);
const selectCell = $derived(__selectCellProp ?? snippets?.selectCell);
const cell = $derived(__cellProp ?? snippets?.cell);

let sortingDefault: any[] = $state([]);
let globalFilterDefault = $state('');
let columnFiltersDefault: any[] = $state([]);
let paginationDefault = $state({
  pageIndex: 0,
  pageSize: 10
});
let rowSelectionDefault = $state({});
let columnVisibilityDefault = $state({});
let columnSizingDefault = $state({});
let columnOrderDefault: any[] = $state([]);
let columnPinningDefault = $state({
  left: [],
  right: []
});
let columnSizingInfo = $state({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: []
});
let colReg = $state({});
let rows: any[] = $state([]);
let headerGroups: any[] = $state([]);
let rowModelVer = $state(0);
let windowVer = $state(0);
let activeRow = $state(0);
let activeColIndex = $state(0);
let activeIsHeader = $state(false);
let activeInControl = $state(false);

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

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
// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).
let table: any = null;

// ── Vertical row windowing instance state (phase 53) ──────────────────────────────────
// Mutable top-level instances (the `let table` precedent — React hoists to useRef; do NOT
// const). NULL until $onMount, and ONLY constructed when $props.virtual. virtualizerCleanup
// holds the _didMount() teardown for $onUnmount; gridScrollEl is the captured .rdt-scroll div
// the virtualizer observes.
// ── Vertical row windowing instance state (phase 53) ──────────────────────────────────
// Mutable top-level instances (the `let table` precedent — React hoists to useRef; do NOT
// const). NULL until $onMount, and ONLY constructed when $props.virtual. virtualizerCleanup
// holds the _didMount() teardown for $onUnmount; gridScrollEl is the captured .rdt-scroll div
// the virtualizer observes.
let virtualizer: any = null;
let virtualizerCleanup: any = null;
let gridScrollEl: any = null;
// CR-01 remeasure scheduling state. remeasurePending dedupes the deferred sweep — at most ONE
// rAF is in flight, so a burst of onChange ticks (a fast scroll) collapses to a single measure
// pass per frame instead of piling up rAF callbacks that fire mid-gesture. The piled-up
// callbacks were what broke the Solid scroll-then-focus seam (D-12 focusActiveCell →
// scrollToIndex → double-rAF focus): a stray remeasure firing inside that focus deferral
// disrupted the focus landing. The sweep ALSO bails while virtual-core is mid-scroll
// (virtualizer.isScrolling), so a measure can't run during scrollToIndex; the next settled
// onChange re-measures the now-stable window. Scroll-driven recycling (the CR-01 case, measured
// once motion settles between scroll steps) is unaffected.
// CR-01 remeasure scheduling state. remeasurePending dedupes the deferred sweep — at most ONE
// rAF is in flight, so a burst of onChange ticks (a fast scroll) collapses to a single measure
// pass per frame instead of piling up rAF callbacks that fire mid-gesture. The piled-up
// callbacks were what broke the Solid scroll-then-focus seam (D-12 focusActiveCell →
// scrollToIndex → double-rAF focus): a stray remeasure firing inside that focus deferral
// disrupted the focus landing. The sweep ALSO bails while virtual-core is mid-scroll
// (virtualizer.isScrolling), so a measure can't run during scrollToIndex; the next settled
// onChange re-measures the now-stable window. Scroll-driven recycling (the CR-01 case, measured
// once motion settles between scroll steps) is unaffected.
let remeasurePending = false;

// ── Grid interaction-mode constants + DOM root (phase 49, REQ-2/6) ────────────────────
// Fixed PageUp/PageDown row step (D-06). Phase 53 swaps this for the visible-window size
// via the same focusActiveCell() scroll-into-view seam — kept a top-level const so that
// later change is a one-line edit.
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
// The stable table-root element, captured in $onMount (the ONLY ROZ123-safe place to read
// $el / query DOM across all six). focusActiveCell() resolves cells off this root; it is
// shadow-safe because the query runs from INSIDE the component's own scope (the listbox
// querySelector-off-root precedent, proven ×6 by plan 01's probe). NEVER read in a
// computed/template binding (ROZ123).
let gridRoot: any = null;

// Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
// the funnel. A counter (not a boolean) so nested writes are safe.
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
// Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
// All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
// this whole object as `state`. Return type annotated `any`: the inferred object-literal
// type does not structurally match table-core's `Partial<TableState>` under the strict
// bundled-leaf tsc (the columnSizingInfo/pagination shapes widen to Record) — the
// runtime shape is correct; `any` sidesteps the over-strict structural check (the
// deferred-items strict-tsc #2 / leaf-output-strict-typecheck close).
const currentState = (): any => ({
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
});

// Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
// applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
// byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
// cannot pollute Object.prototype. Returns the table-core ColumnDef[]. (No per-column
// render callbacks — cells render via the single #cell/#header scoped slot on this
// component, dispatched by columnId; <Column> carries metadata only.)
// Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
// applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
// byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
// cannot pollute Object.prototype. Returns the table-core ColumnDef[]. (No per-column
// render callbacks — cells render via the single #cell/#header scoped slot on this
// component, dispatched by columnId; <Column> carries metadata only.)
const isSafeKey = (k: any) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const columnDefs = () => {
  const byId = Object.create(null);
  const order = [];
  const cfg = columns || [];
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
};

// The constant id of the auto-injected leading checkbox column (D-04). Distinct from
// any consumer column id (the registry/config guard never produces a leading "__").
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
// The table-core ColumnDef set actually fed to createTable / setOptions: the resolved
// user columns, PLUS a LEADING checkbox column when selectionMode is 'single' OR
// 'multiple' (D-04). The select column carries enableSorting/enableColumnFilter:false
// and an isSelectColumn marker the template uses to render checkbox chrome (NOT an
// accessor value). 'none' injects nothing. In 'single' mode the per-row checkbox
// renders but the select-all HEADER checkbox is suppressed (selecting a row caps at
// ≤1 via enableMultiRowSelection:false) — a single-select needs a per-row control,
// not a select-all, so without injecting the column single mode would expose NO
// selection UI at all.
const selectionEnabled = () => selectionMode === 'single' || selectionMode === 'multiple';
const tableColumns = () => {
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
};

// ── sorting slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────────
// table-core hands an Updater<SortingState> = value | (old)=>new; the onSortingChange
// callback applies it against the CURRENT sorting, then this funnel writes a FRESH
// array to the uncontrolled default + the two-way model + fires the change event
// REGARDLESS of binding. STATIC key (`$data.sortingDefault` / `$model.sorting`) — a
// dynamic-key funnel is ROZ106 on all six. The remaining 8 slices each get their own
// such funnel in Plans 04/05.
// ── sorting slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────────
// table-core hands an Updater<SortingState> = value | (old)=>new; the onSortingChange
// callback applies it against the CURRENT sorting, then this funnel writes a FRESH
// array to the uncontrolled default + the two-way model + fires the change event
// REGARDLESS of binding. STATIC key (`$data.sortingDefault` / `$model.sorting`) — a
// dynamic-key funnel is ROZ106 on all six. The remaining 8 slices each get their own
// such funnel in Plans 04/05.
const writeSorting = (next: any) => {
  if (programmatic) return;
  programmatic++;
  sortingDefault = next; // fresh array only (never in-place)
  sorting = next; // two-way emit if bound (no-op-diff if not)
  onsortchange?.(next);
  programmatic--;
};
const applyUpdater = (updater: any, current: any) => typeof updater === 'function' ? updater(current) : updater;

// ── globalFilter slice: STATIC-KEY fresh-value echo-guarded write funnel (A4) ──────
// A fresh string (primitive) to the uncontrolled default + the two-way model + fires
// `filter-change` REGARDLESS of binding.
// ── globalFilter slice: STATIC-KEY fresh-value echo-guarded write funnel (A4) ──────
// A fresh string (primitive) to the uncontrolled default + the two-way model + fires
// `filter-change` REGARDLESS of binding.
const writeGlobalFilter = (next: any) => {
  if (programmatic) return;
  programmatic++;
  globalFilterDefault = next;
  globalFilter = next;
  onfilterchange?.({
    globalFilter: next
  });
  programmatic--;
};

// ── columnFilters slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ─────
// table-core hands ColumnFiltersState = [{ id, value }]; write a FRESH array (never
// in-place push) + fire `filter-change`. globalFilter + columnFilters both surface
// through `filter-change` (per the plan: filter-change fires regardless of binding).
// ── columnFilters slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ─────
// table-core hands ColumnFiltersState = [{ id, value }]; write a FRESH array (never
// in-place push) + fire `filter-change`. globalFilter + columnFilters both surface
// through `filter-change` (per the plan: filter-change fires regardless of binding).
const writeColumnFilters = (next: any) => {
  if (programmatic) return;
  programmatic++;
  columnFiltersDefault = next;
  columnFilters = next;
  onfilterchange?.({
    columnFilters: next
  });
  programmatic--;
};

// ── pagination slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ───────
// table-core hands { pageIndex, pageSize }; write a FRESH object + fire `page-change`.
// ── pagination slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ───────
// table-core hands { pageIndex, pageSize }; write a FRESH object + fire `page-change`.
const writePagination = (next: any) => {
  if (programmatic) return;
  programmatic++;
  paginationDefault = next;
  pagination = next;
  onpagechange?.(next);
  programmatic--;
};

// ── rowSelection slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
// table-core hands RowSelectionState = { [rowId]: true }; write a FRESH object (never
// in-place key-set) + fire `selection-change` REGARDLESS of binding.
// ── rowSelection slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
// table-core hands RowSelectionState = { [rowId]: true }; write a FRESH object (never
// in-place key-set) + fire `selection-change` REGARDLESS of binding.
const writeRowSelection = (next: any) => {
  if (programmatic) return;
  programmatic++;
  rowSelectionDefault = next;
  rowSelection = next;
  onselectionchange?.(next);
  programmatic--;
};

// ── columnVisibility slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──
// table-core hands VisibilityState = { [colId]: boolean }; write a FRESH object (never
// in-place key-set) + fire `visibility-change` REGARDLESS of binding.
// ── columnVisibility slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──
// table-core hands VisibilityState = { [colId]: boolean }; write a FRESH object (never
// in-place key-set) + fire `visibility-change` REGARDLESS of binding.
const writeColumnVisibility = (next: any) => {
  if (programmatic) return;
  programmatic++;
  columnVisibilityDefault = next;
  columnVisibility = next;
  onvisibilitychange?.(next);
  programmatic--;
};

// ── columnSizing slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────
// table-core hands ColumnSizingState = { [colId]: number }; the pointer-drag resize
// handle funnels a FRESH sizing object + fires `resize-change` REGARDLESS of binding.
// ── columnSizing slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ──────
// table-core hands ColumnSizingState = { [colId]: number }; the pointer-drag resize
// handle funnels a FRESH sizing object + fires `resize-change` REGARDLESS of binding.
const writeColumnSizing = (next: any) => {
  if (programmatic) return;
  programmatic++;
  columnSizingDefault = next;
  columnSizing = next;
  onresizechange?.(next);
  programmatic--;
};

// ── columnOrder slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ────────
// table-core hands ColumnOrderState = string[]; write a FRESH order array (never an
// in-place splice) + fire `reorder-change` REGARDLESS of binding.
// ── columnOrder slice: STATIC-KEY fresh-array echo-guarded write funnel (A4) ────────
// table-core hands ColumnOrderState = string[]; write a FRESH order array (never an
// in-place splice) + fire `reorder-change` REGARDLESS of binding.
const writeColumnOrder = (next: any) => {
  if (programmatic) return;
  programmatic++;
  columnOrderDefault = next;
  columnOrder = next;
  onreorderchange?.(next);
  programmatic--;
};

// ── columnPinning slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
// table-core hands ColumnPinningState = { left: string[], right: string[] }; write a
// FRESH object (never in-place push into left/right) + fire `pin-change` REGARDLESS of
// binding.
// ── columnPinning slice: STATIC-KEY fresh-object echo-guarded write funnel (A4) ─────
// table-core hands ColumnPinningState = { left: string[], right: string[] }; write a
// FRESH object (never in-place push into left/right) + fire `pin-change` REGARDLESS of
// binding.
const writeColumnPinning = (next: any) => {
  if (programmatic) return;
  programmatic++;
  columnPinningDefault = next;
  columnPinning = next;
  onpinchange?.(next);
  programmatic--;
};

// Read the live columnFilters value for a given column id (string-safe; drives the
// per-column filter input's bound value). Reads currentState() (NOT a $data re-read
// of a just-written key → React stale-read safe).
// Read the live columnFilters value for a given column id (string-safe; drives the
// per-column filter input's bound value). Reads currentState() (NOT a $data re-read
// of a just-written key → React stale-read safe).
const columnFilterValue = (colId: any) => {
  const cf = currentState().columnFilters || [];
  for (const f of cf as any) if (f && f.id === colId) return f.value != null ? f.value : '';
  return '';
};

// Apply a per-column filter value: build a FRESH ColumnFiltersState array (drop the
// column's prior entry, append the new one unless empty) and funnel it. Never mutate
// the existing array in place (silent on React/Solid/Angular/Lit).
// Apply a per-column filter value: build a FRESH ColumnFiltersState array (drop the
// column's prior entry, append the new one unless empty) and funnel it. Never mutate
// the existing array in place (silent on React/Solid/Angular/Lit).
const setColumnFilter = (colId: any, value: any) => {
  const prev = currentState().columnFilters || [];
  const next = [];
  for (const f of prev as any) if (f && f.id !== colId) next.push(f);
  if (value != null && value !== '') next.push({
    id: colId,
    value
  });
  writeColumnFilters(next);
};

// Re-read the row model + header groups into $data (fresh arrays → the template
// re-renders). A plain fn (NOT a $computed — getRowModel() must be pulled AFTER a
// setOptions re-feed, imperatively). Defined inside $onMount so it captures the live
// `table`.
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
// PER-SLICE callbacks hoisted to top-level consts (NOT inlined in createTable) so the
// re-feed $watch can re-pass them on every setOptions. On React the createTable
// callbacks would otherwise capture the MOUNT-render's currentState() closure (table
// instance is built once in $onMount); table-core's setOptions keeps the prior
// callbacks unless new ones are supplied, so a stale callback applied each updater
// against the mount-time empty slice → the sort cycle never advances + multi-row
// selection collapses to the last row (React stale-closure, F6). Re-passing these
// fresh (recreated each render on React, reading fresh currentState) in the re-feed
// keeps the Updater base value current. No-op cost on the other five.
const onSortingChangeCb = (updater: any) => {
  writeSorting(applyUpdater(updater, currentState().sorting));
};
const onGlobalFilterChangeCb = (updater: any) => {
  writeGlobalFilter(applyUpdater(updater, currentState().globalFilter));
};
const onColumnFiltersChangeCb = (updater: any) => {
  writeColumnFilters(applyUpdater(updater, currentState().columnFilters));
};
const onPaginationChangeCb = (updater: any) => {
  writePagination(applyUpdater(updater, currentState().pagination));
};
const onRowSelectionChangeCb = (updater: any) => {
  writeRowSelection(applyUpdater(updater, currentState().rowSelection));
};
const onColumnVisibilityChangeCb = (updater: any) => {
  writeColumnVisibility(applyUpdater(updater, currentState().columnVisibility));
};
const onColumnSizingChangeCb = (updater: any) => {
  writeColumnSizing(applyUpdater(updater, currentState().columnSizing));
};
const onColumnOrderChangeCb = (updater: any) => {
  writeColumnOrder(applyUpdater(updater, currentState().columnOrder));
};
const onColumnPinningChangeCb = (updater: any) => {
  writeColumnPinning(applyUpdater(updater, currentState().columnPinning));
};
const onColumnSizingInfoChangeCb = (updater: any) => {
  const next = applyUpdater(updater, columnSizingInfo);
  columnSizingInfo = next != null ? next : columnSizingInfo;
};

// ══ Vertical row windowing (phase 53, req-1/2/3/6/9/10) — the virtual-core bridge ════════
// virtual-core is a pure state machine EXACTLY like table-core: constructed once in $onMount
// (ONLY when $props.virtual), its imperative onChange push converted to per-target reactivity
// via the SEPARATE $data.windowVer tick, re-fed via setOptions()+_willUpdate() in the
// refreshRowModel path (NEVER a render helper — Pitfall 1). Every runtime reference is guarded
// so the virtual=false emitted path is dead (req-1).

// windowingSource(): the rows fed to the virtualizer AND held in $data.rows. When virtual, the
// FULL filtered+sorted PRE-PAGINATION model (A2-verified table.getPrePaginationRowModel()) so
// windowing REPLACES client pagination (req-9); else the normal (paginated) row model — the
// non-virtual path is byte-unchanged.
// ══ Vertical row windowing (phase 53, req-1/2/3/6/9/10) — the virtual-core bridge ════════
// virtual-core is a pure state machine EXACTLY like table-core: constructed once in $onMount
// (ONLY when $props.virtual), its imperative onChange push converted to per-target reactivity
// via the SEPARATE $data.windowVer tick, re-fed via setOptions()+_willUpdate() in the
// refreshRowModel path (NEVER a render helper — Pitfall 1). Every runtime reference is guarded
// so the virtual=false emitted path is dead (req-1).

// windowingSource(): the rows fed to the virtualizer AND held in $data.rows. When virtual, the
// FULL filtered+sorted PRE-PAGINATION model (A2-verified table.getPrePaginationRowModel()) so
// windowing REPLACES client pagination (req-9); else the normal (paginated) row model — the
// non-virtual path is byte-unchanged.
const windowingSource = () => {
  if (!table) return [];
  if (virtual) return table.getPrePaginationRowModel().rows;
  return table.getRowModel().rows;
};

// getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
// React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
// id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
// getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
// React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
// id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
const virtualItemKey = (i: any) => {
  const src = windowingSource();
  return src && src[i] ? src[i].id : undefined;
};

// The FULL virtualizer options. virtual-core's setOptions REPLACES options with
// `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
// source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
// Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
// on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
// increment the React emitter lowers to functional setState — correct even from a mount closure.
// The FULL virtualizer options. virtual-core's setOptions REPLACES options with
// `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
// source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
// Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
// on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
// increment the React emitter lowers to functional setState — correct even from a mount closure.
const virtualizerOptions = (): any => ({
  count: windowingSource().length,
  getScrollElement: () => gridScrollEl,
  estimateSize: () => estimateRowHeight,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  measureElement,
  overscan: 8,
  getItemKey: virtualItemKey,
  onChange: () => {
    windowVer = windowVer + 1;
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
});

// Defer remeasureWindow() one frame (the recycled <tr> nodes must exist in the DOM first —
// onChange fires BEFORE React/Solid commit the new window), falling back to a microtask/timeout
// where rAF is unavailable (SSR / test envs). DEDUPED via remeasurePending so a scroll burst
// queues at most one sweep per frame (piled-up rAF sweeps broke the Solid scroll-then-focus
// seam). The sweep clears the flag first, then measures.
// Defer remeasureWindow() one frame (the recycled <tr> nodes must exist in the DOM first —
// onChange fires BEFORE React/Solid commit the new window), falling back to a microtask/timeout
// where rAF is unavailable (SSR / test envs). DEDUPED via remeasurePending so a scroll burst
// queues at most one sweep per frame (piled-up rAF sweeps broke the Solid scroll-then-focus
// seam). The sweep clears the flag first, then measures.
const scheduleRemeasure = () => {
  if (remeasurePending) return;
  remeasurePending = true;
  const run = () => {
    remeasurePending = false;
    remeasureWindow();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);else if (typeof queueMicrotask !== 'undefined') queueMicrotask(run);else setTimeout(run, 0);
};

// windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
// { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
// $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
// full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
// `rows` binding → TS2448 self-shadow, line ~1149 lesson).
// windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
// { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
// $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
// full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
// `rows` binding → TS2448 self-shadow, line ~1149 lesson).
const windowedRows = () => {
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
  if (!virtualizer) {
    // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
    // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
    // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
    // rows appear on the first onChange after _didMount.
    if (!virtual) {
      const rowList = rows || [];
      return rowList.map((r: any) => ({
        vi: null,
        row: r
      }));
    }
    return [];
  }
  const items = virtualizer.getVirtualItems();
  const rowList = rows || [];
  // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
  // shrink window where the virtualizer count is stale relative to $data.rows on the async
  // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
  // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
  return items.map((vi: any) => ({
    vi,
    row: rowList[vi.index]
  })).filter((wr: any) => wr.row);
};

// Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
// the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
// (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
// Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
// the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
// (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
const padTop = () => {
  // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer at the TOP so the spacer-<td>
  // :style binding subscribes on the fine-grained targets before the `!virtualizer` early return.
  void windowVer;
  if (!virtual || !virtualizer) return 0;
  const items = virtualizer.getVirtualItems();
  return items.length ? items[0].start : 0;
};
const padBottom = () => {
  // subscribe-first, see windowedRows() (IN-04): touch windowVer before the early return so the
  // fine-grained spacer :style binding subscribes on its first eval while virtualizer is null.
  void windowVer;
  if (!virtual || !virtualizer) return 0;
  const items = virtualizer.getVirtualItems();
  if (!items.length) return 0;
  return virtualizer.getTotalSize() - items[items.length - 1].end;
};
// rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
// window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
// rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
// window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
const rowIsOutsideWindow = (r: any) => {
  if (!virtual || !virtualizer) return false;
  const items = virtualizer.getVirtualItems();
  for (const it of items as any) if (it.index === r) return false;
  return true;
};
// measureElement sweep (D-10 / CR-01): refine estimated heights to MEASURED ones. The off-root
// querySelector idiom (chartjs/cropper/embla precedent — no per-row callback ref). Each rendered
// <tr> MUST be handed to virtualizer.measureElement on every window commit for it to be observed:
// virtual-core does NOT auto-register rendered rows — measureElement is the SOLE caller of its
// internal ResizeObserver's observe() (virtual-core@3.17.1 dist/esm/index.js:794-817), keyed by
// getItemKey. So this sweep must run not just once at mount but on every onChange tick (via
// scheduleRemeasure), or recycled rows keep the estimateRowHeight seed forever. measureElement is
// idempotent on an already-observed node (the `prevNode !== node` guard), so re-sweeping the
// visible window each commit is cheap and loop-free.
// measureElement sweep (D-10 / CR-01): refine estimated heights to MEASURED ones. The off-root
// querySelector idiom (chartjs/cropper/embla precedent — no per-row callback ref). Each rendered
// <tr> MUST be handed to virtualizer.measureElement on every window commit for it to be observed:
// virtual-core does NOT auto-register rendered rows — measureElement is the SOLE caller of its
// internal ResizeObserver's observe() (virtual-core@3.17.1 dist/esm/index.js:794-817), keyed by
// getItemKey. So this sweep must run not just once at mount but on every onChange tick (via
// scheduleRemeasure), or recycled rows keep the estimateRowHeight seed forever. measureElement is
// idempotent on an already-observed node (the `prevNode !== node` guard), so re-sweeping the
// visible window each commit is cheap and loop-free.
const remeasureWindow = () => {
  if (!virtualizer || !gridRoot) return;
  // Bail ONLY while a PROGRAMMATIC scroll is in flight: virtualizer.scrollState is non-null
  // exclusively during scrollToIndex / scrollToOffset (the D-12 scroll-then-focus seam) and
  // null for ordinary user/scrollTop-driven scrolling (verified virtual-core@3.17.1: set in
  // scrollToIndex L992, cleared to null on reconcile L378). Measuring mid-scrollToIndex lets
  // resizeItem nudge the offset and starve the scroll target (the Solid off-window focus
  // regression); the next settled onChange re-measures the stable window. Manual-scroll
  // recycling (the CR-01 case) has scrollState === null, so it measures normally.
  if (virtualizer.scrollState) return;
  const trs = gridRoot.querySelectorAll('tbody.rdt-tbody > tr[data-index]');
  for (const tr of trs as any) virtualizer.measureElement(tr);
};
// Push fresh options into table-core + re-pull the row model. Extracted so BOTH the
// re-feed $watch (above) and the Lit data-change $onUpdate (below) call it.
const reFeed = () => {
  if (!table) return;
  table.setOptions((prev: any) => ({
    ...prev,
    data: data,
    columns: tableColumns(),
    state: currentState(),
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multiple',
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
};

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
const onHeaderSort = (colId: any, evt: any) => {
  if (!table) return;
  const col = table.getColumn(colId);
  if (!col || !col.getCanSort()) return;
  const multi = !!(evt && evt.shiftKey);
  // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
  col.toggleSorting(undefined, multi);
};

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
const tick = () => rowModelVer;
// the live sort direction off the table-core column (string-safe — never a bound
// boolean, the listbox aria lesson).
// the live sort direction off the table-core column (string-safe — never a bound
// boolean, the listbox aria lesson).
const ariaSortFor = (colId: any) => {
  if (tick() < 0 || !table) return 'none';
  const col = table.getColumn(colId);
  if (!col) return 'none';
  const dir = col.getIsSorted();
  if (dir === 'asc') return 'ascending';
  if (dir === 'desc') return 'descending';
  return 'none';
};

// A small sort-direction glyph for the header (▲/▼/empty). Decorative — aria-hidden.
// A small sort-direction glyph for the header (▲/▼/empty). Decorative — aria-hidden.
const sortIndicator = (colId: any) => {
  if (tick() < 0 || !table) return '';
  const col = table.getColumn(colId);
  if (!col) return '';
  const dir = col.getIsSorted();
  if (dir === 'asc') return '▲';
  if (dir === 'desc') return '▼';
  return '';
};

// Template helpers reading the resolved column-def metadata by id (plain fns — used
// in template predicates + interpolation; uniform on all 6, no $computed alias trap).
// Template helpers reading the resolved column-def metadata by id (plain fns — used
// in template predicates + interpolation; uniform on all 6, no $computed alias trap).
const defFor = (colId: any) => {
  const defs = columnDefs();
  for (const d of defs as any) if (d.id === colId) return d;
  return null;
};
// Per-row visible cells for the body loop. table-core memoizes row objects by id,
// so a re-pull after a column change (visibility/reorder/pin, or the late <Column>
// registry on first mount) returns the SAME row references with a different cell
// set. Solid's reference-keyed <For> keeps the existing <tr> and will NOT re-run a
// child loop whose `each` reads no signal — so a bare `row.getVisibleCells()` goes
// stale (header reorders, cells don't). Reading `$data.rowModelVer` (bumped by every
// refreshRowModel) inside the `each` puts the inner loop in the reactive scope, so it
// re-derives the cells on every row-model change. No-op on the coarse-render targets.
// Per-row visible cells for the body loop. table-core memoizes row objects by id,
// so a re-pull after a column change (visibility/reorder/pin, or the late <Column>
// registry on first mount) returns the SAME row references with a different cell
// set. Solid's reference-keyed <For> keeps the existing <tr> and will NOT re-run a
// child loop whose `each` reads no signal — so a bare `row.getVisibleCells()` goes
// stale (header reorders, cells don't). Reading `$data.rowModelVer` (bumped by every
// refreshRowModel) inside the `each` puts the inner loop in the reactive scope, so it
// re-derives the cells on every row-model change. No-op on the coarse-render targets.
const visibleCellsFor = (row: any) => rowModelVer >= 0 ? row.getVisibleCells() : [];
const columnIsFilterable = (colId: any) => {
  const d = defFor(colId);
  return !!(d && d.filterable);
};
const headerLabel = (colId: any) => {
  const d = defFor(colId);
  return d ? d.header : colId;
};

// ── Column-management chrome (req-8/9/10/11) ────────────────────────────────────────
// Live header width (px) for a column — drives the <th> :style width binding. Reads the
// table-core column size (post-mount) with a fallback to undefined (auto width).
// ── Column-management chrome (req-8/9/10/11) ────────────────────────────────────────
// Live header width (px) for a column — drives the <th> :style width binding. Reads the
// table-core column size (post-mount) with a fallback to undefined (auto width).
const headerWidth = (colId: any) => {
  if (tick() < 0 || !table) return null;
  const col = table.getColumn(colId);
  if (!col) return null;
  const w = col.getSize();
  return w != null && w > 0 ? w + 'px' : null;
};

// Pointer-drag resize handler for a resizable header — table-core's getResizeHandler()
// returns a function bound to a pointerdown/touchstart event that drives the column
// size through onColumnSizingChange (our writeColumnSizing funnel) under
// columnResizeMode:'onChange'. Pure delegation; no scratch gesture state held in a
// top-level const (the React fragile-binding rule — table-core owns the gesture state).
// Pointer-drag resize handler for a resizable header — table-core's getResizeHandler()
// returns a function bound to a pointerdown/touchstart event that drives the column
// size through onColumnSizingChange (our writeColumnSizing funnel) under
// columnResizeMode:'onChange'. Pure delegation; no scratch gesture state held in a
// top-level const (the React fragile-binding rule — table-core owns the gesture state).
const onResizeStart = (colId: any, evt: any) => {
  // stop here (NOT a `.stop` modifier) — the Angular `.stop`-in-@for hoist is broken (F5).
  if (evt && evt.stopPropagation) evt.stopPropagation();
  if (!table) return;
  const header = findHeader(colId);
  if (!header || !header.getResizeHandler) return;
  const handler = header.getResizeHandler();
  if (handler) handler(evt);
};
// Find the live header object for a column id across the rendered header groups.
// Find the live header object for a column id across the rendered header groups.
const findHeader = (colId: any) => {
  const groups = headerGroups || [];
  for (const hg of groups as any) {
    const hs = hg.headers || [];
    for (const h of hs as any) if (h && h.column && h.column.id === colId) return h;
  }
  return null;
};
const columnIsResizing = (colId: any) => {
  if (tick() < 0 || !table) return false;
  const header = findHeader(colId);
  return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
};

// Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
// onColumnVisibilityChange funnel emits the fresh state.
// Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
// onColumnVisibilityChange funnel emits the fresh state.
const columnIsVisible = (colId: any) => {
  if (tick() < 0 || !table) return true;
  const col = table.getColumn(colId);
  return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
};
const onToggleVisibility = (colId: any) => {
  if (!table) return;
  const col = table.getColumn(colId);
  if (col && col.toggleVisibility) col.toggleVisibility();
};
// The full set of leaf columns (for the visibility-toggle menu) — id + header label +
// current visibility. Excludes the auto-injected select column (always present).
// The full set of leaf columns (for the visibility-toggle menu) — id + header label +
// current visibility. Excludes the auto-injected select column (always present).
const allLeafColumns = () => {
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
};

// Pinning (req-11) — drive table-core's column.pin('left'|'right'|false) so the
// onColumnPinningChange funnel emits a fresh state. Sticky offsets read the live column
// start/after positions (table-core computes them from the pinned column sizes).
// Pinning (req-11) — drive table-core's column.pin('left'|'right'|false) so the
// onColumnPinningChange funnel emits a fresh state. Sticky offsets read the live column
// start/after positions (table-core computes them from the pinned column sizes).
const columnPinSide = (colId: any) => {
  if (tick() < 0 || !table) return false;
  const col = table.getColumn(colId);
  if (!col || !col.getIsPinned) return false;
  return col.getIsPinned();
};
// NOTE: the event is stopped HERE (evt.stopPropagation()) rather than via a `.stop`
// template modifier. The Angular emitter, hoisting a `.stop`-modified handler that
// lives INSIDE an `@for` loop into a class-field wrapper, drops the component `this.`
// qualifier (→ `onPinColumn(...)` bare ReferenceError) and fails to capture the loop
// var — so a `@click.stop="onPinColumn(...)"` inside the header `@for` breaks on
// Angular (F5). Stopping inside the handler sidesteps the broken hoist on all six.
// NOTE: the event is stopped HERE (evt.stopPropagation()) rather than via a `.stop`
// template modifier. The Angular emitter, hoisting a `.stop`-modified handler that
// lives INSIDE an `@for` loop into a class-field wrapper, drops the component `this.`
// qualifier (→ `onPinColumn(...)` bare ReferenceError) and fails to capture the loop
// var — so a `@click.stop="onPinColumn(...)"` inside the header `@for` breaks on
// Angular (F5). Stopping inside the handler sidesteps the broken hoist on all six.
const onPinColumn = (colId: any, side: any, evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
  if (!table) return;
  const col = table.getColumn(colId);
  if (col && col.pin) col.pin(side);
};
// Sticky inline style for a pinned header/cell — position:sticky + the computed left or
// right offset. Returns '' (no sticky) for unpinned columns. Returned as a STRING (the
// :style binding is value-driven — never an eval'd attr).
// Sticky inline style for a pinned header/cell — position:sticky + the computed left or
// right offset. Returns '' (no sticky) for unpinned columns. Returned as a STRING (the
// :style binding is value-driven — never an eval'd attr).
const pinStyle = (colId: any) => {
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
};
// Combined inline style for a <th> (width + pin) and a <td> (pin). Plain string concat —
// uniform on all 6, no bound-object trap.
// Combined inline style for a <th> (width + pin) and a <td> (pin). Plain string concat —
// uniform on all 6, no bound-object trap.
const thStyle = (colId: any) => {
  let s = '';
  const w = headerWidth(colId);
  if (w) s += 'width:' + w + ';';
  s += pinStyle(colId);
  return s;
};

// ── Filter chrome handlers ─────────────────────────────────────────────────────────
// Global search input → funnel through table-core's setGlobalFilter so the
// onGlobalFilterChange callback fires the echo-guarded writer. Capture the fresh local
// value (never re-read a just-written $data key — React stale-read).
// ── Filter chrome handlers ─────────────────────────────────────────────────────────
// Global search input → funnel through table-core's setGlobalFilter so the
// onGlobalFilterChange callback fires the echo-guarded writer. Capture the fresh local
// value (never re-read a just-written $data key — React stale-read).
const onGlobalFilterInput = (evt: any) => {
  const value = evt && evt.target ? evt.target.value : '';
  if (table) {
    table.setGlobalFilter(value);
    return;
  }
  writeGlobalFilter(value);
};
// Per-column filter input → setColumnFilter (fresh-array funnel).
// Per-column filter input → setColumnFilter (fresh-array funnel).
const onColumnFilterInput = (colId: any, evt: any) => {
  const value = evt && evt.target ? evt.target.value : '';
  setColumnFilter(colId, value);
};
// The live global filter value (bound to the search <input>, value-driven NOT eval'd).
// The live global filter value (bound to the search <input>, value-driven NOT eval'd).
const globalFilterValue = () => {
  const v = currentState().globalFilter;
  return v != null ? v : '';
};

// ── Pagination chrome ────────────────────────────────────────────────────────────
// Read the live pagination state off table-core (post-mount) with a currentState()
// fallback (pre-mount / SSR). All string-safe (no bound booleans).
// ── Pagination chrome ────────────────────────────────────────────────────────────
// Read the live pagination state off table-core (post-mount) with a currentState()
// fallback (pre-mount / SSR). All string-safe (no bound booleans).
const pageIndex = () => {
  if (tick() >= 0 && table) return table.getState().pagination.pageIndex;
  const p = currentState().pagination;
  return p && p.pageIndex != null ? p.pageIndex : 0;
};
const pageSize = () => {
  if (tick() >= 0 && table) return table.getState().pagination.pageSize;
  const p = currentState().pagination;
  return p && p.pageSize != null ? p.pageSize : 10;
};
const pageCount = () => {
  if (tick() < 0 || !table) return 1;
  const c = table.getPageCount();
  return c != null && c > 0 ? c : 1;
};
const canPrevPage = () => !!(tick() >= 0 && table && table.getCanPreviousPage());
const canNextPage = () => !!(tick() >= 0 && table && table.getCanNextPage());
const onPrevPage = () => {
  if (table) table.previousPage();
};
const onNextPage = () => {
  if (table) table.nextPage();
};
const onPageSizeChange = (evt: any) => {
  if (!table) return;
  const v = evt && evt.target ? evt.target.value : '';
  const n = parseInt(v, 10);
  table.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
};

// ── Row-selection chrome (req-7) ───────────────────────────────────────────────────
// Detect the auto-injected leading checkbox column by its constant id (template uses
// this to render checkbox chrome instead of an accessor value).
// ── Row-selection chrome (req-7) ───────────────────────────────────────────────────
// Detect the auto-injected leading checkbox column by its constant id (template uses
// this to render checkbox chrome instead of an accessor value).
const isSelectColumn = (colId: any) => colId === SELECT_COL_ID;
// Plain stop-propagation handler (used in place of the `@click.stop` bare modifier —
// a bare `.stop` with no handler hoists to `_guardedUndefined` → `this.undefined($event)`
// on Angular inside an `@for`, F5). Calling an explicit handler is uniform on all six.
// Plain stop-propagation handler (used in place of the `@click.stop` bare modifier —
// a bare `.stop` with no handler hoists to `_guardedUndefined` → `this.undefined($event)`
// on Angular inside an `@for`, F5). Calling an explicit handler is uniform on all six.
const stopEvent = (evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
};
// select-all header state (D-06: scopes to all filtered rows = TanStack default).
// `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
// select-all header state (D-06: scopes to all filtered rows = TanStack default).
// `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
const isAllRowsSelected = () => !!(tick() >= 0 && table && table.getIsAllRowsSelected());
const isSomeRowsSelected = () => !!(tick() >= 0 && table && table.getIsSomeRowsSelected());
const onToggleAllRows = (evt: any) => {
  if (!table) return;
  table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
};
// per-row checkbox state + toggle (checkbox-only, D-05 — row body does NOT select).
// Read selection from the LIVE controlled state (currentState().rowSelection keyed by
// row.id) — NOT row.getIsSelected(). The latter reads table-core's row model, which
// only reflects a selection AFTER the re-feed watch pushes the new `state` + re-pulls
// (two reactive cycles on React). The controlled-state read updates in the SAME cycle
// as the write funnel, so the controlled <input :checked> reflects the toggle without
// the row-model-re-pull latency — the React controlled-checkbox revert that left
// `.check()` seeing no state change (F6). row.getIsSelected() is the fallback.
// per-row checkbox state + toggle (checkbox-only, D-05 — row body does NOT select).
// Read selection from the LIVE controlled state (currentState().rowSelection keyed by
// row.id) — NOT row.getIsSelected(). The latter reads table-core's row model, which
// only reflects a selection AFTER the re-feed watch pushes the new `state` + re-pulls
// (two reactive cycles on React). The controlled-state read updates in the SAME cycle
// as the write funnel, so the controlled <input :checked> reflects the toggle without
// the row-model-re-pull latency — the React controlled-checkbox revert that left
// `.check()` seeing no state change (F6). row.getIsSelected() is the fallback.
const rowIsSelected = (row: any) => {
  if (!row) return false;
  const id = row.id;
  const sel = currentState().rowSelection || {};
  if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
  return !!(row.getIsSelected && row.getIsSelected());
};
const onToggleRow = (row: any, evt: any) => {
  if (!row || !row.toggleSelected) return;
  row.toggleSelected(!!(evt && evt.target && evt.target.checked));
};
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
const syncIndeterminate = () => {
  if (!__rozieRoot || !__rozieRoot!.querySelector) return;
  selectAllBox = __rozieRoot!.querySelector('.rdt-select-all');
  if (selectAllBox) selectAllBox.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
};

// The registry API handed to <Column> children (whole-object-replace — T-48-PP guard).
// Imperative handle (consumer-callable). Each verb is a PRE-DECLARED top-level
// `const` (the canonical $expose contract — `$expose({ name })` references a
// binding ALREADY in scope; an INLINE-defined verb `$expose({ name: () => {} })`
// is dropped on ALL SIX targets, only the by-reference key survives → a
// runtime ReferenceError at `defineExpose`/`useImperativeHandle`). Sorting verbs +
// a fresh column-def readout, selection, pagination, and column-management verbs.
export const sortColumn = (colId: any, desc: any) => {
  if (table) table.getColumn(colId) && table.getColumn(colId).toggleSorting(desc, false);
};
export const clearSorting = () => {
  if (table) table.resetSorting(true);
};
export const getColumnDefs = () => columnDefs();
// selection verbs (req-7) — drive table-core so the onRowSelectionChange funnel
// emits the fresh state + selection-change.
// selection verbs (req-7) — drive table-core so the onRowSelectionChange funnel
// emits the fresh state + selection-change.
export const toggleAllRows = (value: any) => {
  if (table) table.toggleAllRowsSelected(value);
};
export const clearSelection = () => {
  if (table) table.resetRowSelection(true);
};
export const getSelectedRows = () => table ? table.getSelectedRowModel().rows.map((r: any) => r.original) : [];
// pagination verbs.
// pagination verbs.
export const setPage = (idx: any) => {
  if (table) table.setPageIndex(idx);
};
export const setRowsPerPage = (size: any) => {
  if (table) table.setPageSize(size);
};
// column-management verbs (req-8/9/10/11) — drive table-core so the funnels fire.
// column-management verbs (req-8/9/10/11) — drive table-core so the funnels fire.
export const toggleColumnVisibility = (colId: any) => {
  if (table) {
    const c = table.getColumn(colId);
    if (c && c.toggleVisibility) c.toggleVisibility();
  }
};
// NOT `setColumnOrder`: a verb named `set<ModelProp>` collides with React's
// auto-generated `setColumnOrder` useState setter for the `columnOrder` model
// prop, and an $expose verb is PUBLIC-CONTRACT-PROTECTED from the React
// deconfliction rename (ROZ524 — the rename target is the verb, which is
// off-limits). So the public verb is `applyColumnOrder` (semantically: apply a
// new column order). The other set* verbs (setPage/setRowsPerPage) do NOT match
// any model prop's setter, so they are collision-free.
// NOT `setColumnOrder`: a verb named `set<ModelProp>` collides with React's
// auto-generated `setColumnOrder` useState setter for the `columnOrder` model
// prop, and an $expose verb is PUBLIC-CONTRACT-PROTECTED from the React
// deconfliction rename (ROZ524 — the rename target is the verb, which is
// off-limits). So the public verb is `applyColumnOrder` (semantically: apply a
// new column order). The other set* verbs (setPage/setRowsPerPage) do NOT match
// any model prop's setter, so they are collision-free.
export const applyColumnOrder = (order: any) => {
  if (table) table.setColumnOrder(order);
};
export const resetColumnSizing = () => {
  if (table) table.resetColumnSizing(true);
};
// pinColumn: the verb that drives column.pin; distinct from the template handler
// onPinColumn (no shadow — the deferred-items finding #4 collision check).
// pinColumn: the verb that drives column.pin; distinct from the template handler
// onPinColumn (no shadow — the deferred-items finding #4 collision check).
export const pinColumn = (colId: any, side: any) => {
  if (table) {
    const c = table.getColumn(colId);
    if (c && c.pin) c.pin(side);
  }
};

// ══ Grid interaction mode (phase 49) — STATE + STRUCTURE only ═══════════════════════════
// This plan (02) establishes the gated ARIA roles, the roving single-tab-stop tabindex,
// the active-cell index-pair state, the data-* cell markers, and the SINGLE
// focusActiveCell() seam. Plan 03 adds the keydown navigation math, the $expose verbs
// (focusCell/getActiveCell/clearActiveCell), and the activecell-change event ON TOP.

// interactionMode gate. 'grid' lights up roving nav; 'table' (default) is byte-behaviorally
// identical to phase 48 (roles fall back to the literals, tabindex drops).
// ══ Grid interaction mode (phase 49) — STATE + STRUCTURE only ═══════════════════════════
// This plan (02) establishes the gated ARIA roles, the roving single-tab-stop tabindex,
// the active-cell index-pair state, the data-* cell markers, and the SINGLE
// focusActiveCell() seam. Plan 03 adds the keydown navigation math, the $expose verbs
// (focusCell/getActiveCell/clearActiveCell), and the activecell-change event ON TOP.

// interactionMode gate. 'grid' lights up roving nav; 'table' (default) is byte-behaviorally
// identical to phase 48 (roles fall back to the literals, tabindex drops).
const isGrid = () => interactionMode === 'grid';

// Role computeds (RESEARCH Pattern 4). The 'table' branch returns the EXACT phase-48
// literal so 'table'-mode DOM is unchanged. Header cells keep 'columnheader' and rows keep
// 'row'/'rowgroup' in BOTH modes (APG grid) — those stay static literals in the template.
// Role computeds (RESEARCH Pattern 4). The 'table' branch returns the EXACT phase-48
// literal so 'table'-mode DOM is unchanged. Header cells keep 'columnheader' and rows keep
// 'row'/'rowgroup' in BOTH modes (APG grid) — those stay static literals in the template.
const tableRole = () => isGrid() ? 'grid' : 'table';
const cellRole = () => isGrid() ? 'gridcell' : 'cell';

// ── Cell addressing helpers (plain fns — no $computed alias trap; safe in template) ────
// rowIndexOf: a body row's index over the visible model ($data.rows). tick() puts the read
// in the fine-grained reactive scope (Solid/Lit) so the data-row marker re-derives on a
// re-pull (reorder/filter) — matching visibleCellsFor's discipline.
// ── Cell addressing helpers (plain fns — no $computed alias trap; safe in template) ────
// rowIndexOf: a body row's index over the visible model ($data.rows). tick() puts the read
// in the fine-grained reactive scope (Solid/Lit) so the data-row marker re-derives on a
// re-pull (reorder/filter) — matching visibleCellsFor's discipline.
const rowIndexOf = (row: any) => tick() >= 0 ? (rows || []).indexOf(row) : -1;
// colIndexOf: a body cell's position in its row's visible cell list.
// colIndexOf: a body cell's position in its row's visible cell list.
const colIndexOf = (row: any, cellCtx: any) => tick() >= 0 ? visibleCellsFor(row).indexOf(cellCtx) : -1;
// headerColIndexOf: a header cell's position in its header group's leaf headers.
// headerColIndexOf: a header cell's position in its header group's leaf headers.
const headerColIndexOf = (hg: any, header: any) => (hg && hg.headers ? hg.headers : []).indexOf(header);

// Roving tabindex (RESEARCH Code Examples). Reads ONLY reactive $data (ROZ123-safe,
// fine-grained-reactive). Returns null in 'table' mode → the bound numeric attribute
// DROPS entirely (IN-01: on React via the `cellTabindex(...) ?? undefined` numeric-attr
// emitter path landed in 4bec3b8e — NOT rozieAttr, which would string-widen tabIndex and
// TS2322; the other five targets drop it via their own nullish-attr handling), keeping
// 'table'-mode DOM clean. rowKey is the literal
// '__header' for header cells or the String(bodyRowIndex) for body cells, so the active
// header state (activeIsHeader) is addressable through the same computed.
// Roving tabindex (RESEARCH Code Examples). Reads ONLY reactive $data (ROZ123-safe,
// fine-grained-reactive). Returns null in 'table' mode → the bound numeric attribute
// DROPS entirely (IN-01: on React via the `cellTabindex(...) ?? undefined` numeric-attr
// emitter path landed in 4bec3b8e — NOT rozieAttr, which would string-widen tabIndex and
// TS2322; the other five targets drop it via their own nullish-attr handling), keeping
// 'table'-mode DOM clean. rowKey is the literal
// '__header' for header cells or the String(bodyRowIndex) for body cells, so the active
// header state (activeIsHeader) is addressable through the same computed.
const cellTabindex = (rowKey: any, colIndex: any) => {
  if (!isGrid()) return null;
  const activeKey = activeIsHeader ? '__header' : String(activeRow);
  const isActive = rowKey === activeKey && colIndex === activeColIndex;
  return isActive ? 0 : -1;
};

// ── The focus SEAM (RESEARCH Pattern 1 + 3, req-6) ─────────────────────────────────────
// resolveCellEl: index pair → DOM element, via a data-* attribute query off the stable
// post-mount root. Uniform on all six, shadow-safe (the query runs from inside the
// component's own scope). rowKey is the literal '__header' or a String(integer index) and
// colIndex is an integer — NO consumer string is interpolated into the selector (T-49-01).
// ── The focus SEAM (RESEARCH Pattern 1 + 3, req-6) ─────────────────────────────────────
// resolveCellEl: index pair → DOM element, via a data-* attribute query off the stable
// post-mount root. Uniform on all six, shadow-safe (the query runs from inside the
// component's own scope). rowKey is the literal '__header' or a String(integer index) and
// colIndex is an integer — NO consumer string is interpolated into the selector (T-49-01).
const resolveCellEl = (rowKey: any, colIndex: any) => {
  if (!gridRoot) return null;
  return gridRoot.querySelector('[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]');
};

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
const focusActiveCell = (nextRow = null, nextCol = null, nextIsHeader = null) => {
  if (!isGrid() || !gridRoot) return;
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
  if (virtual && virtualizer && !header && rowIsOutsideWindow(r)) {
    virtualizer.scrollToIndex(r, {
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
};

// ══ Grid keyboard navigation (phase 49 plan 03 — RESEARCH Pattern 5 + the delegated handler) ═══
// The nav model is plain ARRAY-INDEX MATH over the VISIBLE model. table-core has already
// done the hard part: $data.rows (body) and $data.headerGroups (header) hold the visible,
// reordered, pinned cell set (row.getVisibleCells() / getHeaderGroups()) — hidden columns
// are ALREADY ABSENT, reorder/pinning is ALREADY REFLECTED (REQ-7). There is NO separate
// "compute visible order" step. Every index is clamped to [0,max] so an out-of-range key
// never throws or builds an injection-shaped selector (Security V5 / T-49-03).

// Column count = the visible cell list length (uniform header+body in a flat grid). Reads
// $data.rows (reactive) so it is fine-grained-correct on Solid/Lit; falls back to the
// header leaf count when there are no body rows.
// ══ Grid keyboard navigation (phase 49 plan 03 — RESEARCH Pattern 5 + the delegated handler) ═══
// The nav model is plain ARRAY-INDEX MATH over the VISIBLE model. table-core has already
// done the hard part: $data.rows (body) and $data.headerGroups (header) hold the visible,
// reordered, pinned cell set (row.getVisibleCells() / getHeaderGroups()) — hidden columns
// are ALREADY ABSENT, reorder/pinning is ALREADY REFLECTED (REQ-7). There is NO separate
// "compute visible order" step. Every index is clamped to [0,max] so an out-of-range key
// never throws or builds an injection-shaped selector (Security V5 / T-49-03).

// Column count = the visible cell list length (uniform header+body in a flat grid). Reads
// $data.rows (reactive) so it is fine-grained-correct on Solid/Lit; falls back to the
// header leaf count when there are no body rows.
const visibleColCount = () => {
  // NB: local is `rowList` (NOT `rows`) — the React emitter lowers `$data.rows` to the bare
  // state binding `rows`, so a `const rows = $data.rows` self-shadows it (TS2448 TDZ). Same
  // self-shadow class as the deconflictPropShadows finding; avoid the $data-key name as a local.
  const rowList = rows || [];
  if (rowList.length) return rowList[0].getVisibleCells().length;
  const hg = headerGroups || [];
  return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
};
const bodyRowCount = () => (rows || []).length;
const clamp = (v: any, lo: any, hi: any) => v < lo ? lo : v > hi ? hi : v;

// ── Nav helpers: compute the NEXT indices into LOCAL consts, write $data from them, and
// RETURN the fresh locals so the caller threads the SAME values into BOTH focusActiveCell
// AND the activecell-change emit. NEVER re-read $data.activeRow/activeColIndex after the
// write (React setState is async — ROZ138 — the re-read binds the PRE-write value; Angular
// signal writes are async too — both proven live by plan 01's probe). ──────────────────────

// ArrowRight/Left — clamp colIndex over [0, visibleColCount()-1] (no wrap; hidden cols
// already excluded from the visible list per REQ-7).
// ── Nav helpers: compute the NEXT indices into LOCAL consts, write $data from them, and
// RETURN the fresh locals so the caller threads the SAME values into BOTH focusActiveCell
// AND the activecell-change emit. NEVER re-read $data.activeRow/activeColIndex after the
// write (React setState is async — ROZ138 — the re-read binds the PRE-write value; Angular
// signal writes are async too — both proven live by plan 01's probe). ──────────────────────

// ArrowRight/Left — clamp colIndex over [0, visibleColCount()-1] (no wrap; hidden cols
// already excluded from the visible list per REQ-7).
const moveCol = (delta: any) => {
  const max = visibleColCount() - 1;
  const nextCol = clamp(activeColIndex + delta, 0, max < 0 ? 0 : max);
  activeColIndex = nextCol;
  return nextCol;
};

// ArrowUp/Down + PageUp/Down — cross the header boundary and clamp at body edges (no
// page-cross per D-06/REQ-7). Returns { row, isHeader } fresh locals.
//  - From the header, ArrowDown (delta>0) drops into body row 0 (activeIsHeader=false).
//  - From body row 0, ArrowUp (delta<0) crosses into the header (activeIsHeader=true).
//  - PageUp/Down jump by ±GRID_PAGE_STEP, clamped to the current page bounds (no cross).
// ArrowUp/Down + PageUp/Down — cross the header boundary and clamp at body edges (no
// page-cross per D-06/REQ-7). Returns { row, isHeader } fresh locals.
//  - From the header, ArrowDown (delta>0) drops into body row 0 (activeIsHeader=false).
//  - From body row 0, ArrowUp (delta<0) crosses into the header (activeIsHeader=true).
//  - PageUp/Down jump by ±GRID_PAGE_STEP, clamped to the current page bounds (no cross).
const moveRow = (delta: any) => {
  const lastRow = bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  if (activeIsHeader) {
    // In the header: any downward move lands on body row 0; upward stays in the header.
    if (delta > 0) {
      activeIsHeader = false;
      activeRow = 0;
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
    activeIsHeader = true;
    return {
      row: activeRow,
      isHeader: true
    };
  }
  const nextRow = clamp(activeRow + delta, 0, maxRow);
  activeRow = nextRow;
  activeIsHeader = false;
  return {
    row: nextRow,
    isHeader: false
  };
};

// Home/End within the current row → col 0 / max. Returns the fresh colIndex.
// Home/End within the current row → col 0 / max. Returns the fresh colIndex.
const gotoColEdge = (toEnd: any) => {
  const max = visibleColCount() - 1;
  const nextCol = toEnd ? max < 0 ? 0 : max : 0;
  activeColIndex = nextCol;
  return nextCol;
};

// Ctrl+Home → first body cell (0,0); Ctrl+End → last body cell (lastRow,max). Returns the
// fresh { row, col } locals. Both land in the body (activeIsHeader=false).
// Ctrl+Home → first body cell (0,0); Ctrl+End → last body cell (lastRow,max). Returns the
// fresh { row, col } locals. Both land in the body (activeIsHeader=false).
const gotoStart = () => {
  activeIsHeader = false;
  activeRow = 0;
  activeColIndex = 0;
  return {
    row: 0,
    col: 0
  };
};
const gotoEnd = () => {
  const lastRow = bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const max = visibleColCount() - 1;
  const maxCol = max < 0 ? 0 : max;
  activeIsHeader = false;
  activeRow = maxRow;
  activeColIndex = maxCol;
  return {
    row: maxRow,
    col: maxCol
  };
};

// Resolve the active cell element (for the in-cell trap) — uses the same data-* query as
// the focus seam. rowKey is the literal '__header' or String(integer) — no consumer string.
// Resolve the active cell element (for the in-cell trap) — uses the same data-* query as
// the focus seam. rowKey is the literal '__header' or String(integer) — no consumer string.
const currentCellEl = () => {
  const rowKey = activeIsHeader ? '__header' : String(activeRow);
  return resolveCellEl(rowKey, activeColIndex);
};

// The focusable descendants of a cell (non-disabled), in DOM order. Pure DOM — uniform ×6.
// The focusable descendants of a cell (non-disabled), in DOM order. Pure DOM — uniform ×6.
const focusables = (cellEl: any) => {
  if (!cellEl || !cellEl.querySelectorAll) return [];
  const list = Array.prototype.slice.call(cellEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  return list.filter((n: any) => !n.disabled);
};

// Enter/F2 → enter interaction mode: focus the active cell's FIRST interactive control
// (D-07 — uniform for header sort buttons and body controls; Enter does NOT sort directly).
// No-op (stay in navigation mode) if the cell has no focusable control.
// Enter/F2 → enter interaction mode: focus the active cell's FIRST interactive control
// (D-07 — uniform for header sort buttons and body controls; Enter does NOT sort directly).
// No-op (stay in navigation mode) if the cell has no focusable control.
const enterControl = () => {
  const cellEl = currentCellEl();
  const list = focusables(cellEl);
  if (!list.length) return;
  activeInControl = true;
  list[0].focus();
};

// Cycle focus among the controls WITHIN the active cell (D-08 focus containment) — Tab
// forward / Shift+Tab backward, wrapping at the ends. Uses the plan-01-PROVEN per-target
// activeElement read: gridRoot.getRootNode().activeElement is the UNIFORM correct read on
// ALL SIX (document in light DOM; the shadow root on Lit). Reuse verbatim — do NOT re-derive.
// Cycle focus among the controls WITHIN the active cell (D-08 focus containment) — Tab
// forward / Shift+Tab backward, wrapping at the ends. Uses the plan-01-PROVEN per-target
// activeElement read: gridRoot.getRootNode().activeElement is the UNIFORM correct read on
// ALL SIX (document in light DOM; the shadow root on Lit). Reuse verbatim — do NOT re-derive.
const cycleWithinCell = (cellEl: any, forward: any) => {
  const list = focusables(cellEl);
  if (!list.length) return;
  const active = gridRoot ? gridRoot.getRootNode().activeElement : null;
  const cur = list.indexOf(active);
  let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
  if (i >= list.length) i = 0;
  if (i < 0) i = list.length - 1;
  list[i].focus();
};

// THE single delegated keydown handler (RESEARCH "Single delegated keydown handler"). Wired
// as ONE keydown listener on the <table> root — NOT per-cell, NOT with .stop/.prevent modifiers (the
// Angular .stop-in-@for hoist bug, F5/ROZ723). e.preventDefault() is called IMPERATIVELY for
// handled keys. Each nav helper writes $data and RETURNS the fresh post-write locals; those
// SAME locals feed BOTH focusActiveCell AND the activecell-change emit (no $data re-read).
// THE single delegated keydown handler (RESEARCH "Single delegated keydown handler"). Wired
// as ONE keydown listener on the <table> root — NOT per-cell, NOT with .stop/.prevent modifiers (the
// Angular .stop-in-@for hoist bug, F5/ROZ723). e.preventDefault() is called IMPERATIVELY for
// handled keys. Each nav helper writes $data and RETURNS the fresh post-write locals; those
// SAME locals feed BOTH focusActiveCell AND the activecell-change emit (no $data re-read).
const onGridKeyDown = (e: any) => {
  if (!isGrid() || !e) return;
  const key = e.key;
  // Interaction mode (D-08): Tab cycles within the cell, Escape exits. Focus containment.
  if (activeInControl) {
    if (key === 'Escape') {
      e.preventDefault();
      activeInControl = false;
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
    onactivecellchange?.({
      rowIndex: nextRow,
      colIndex: nextCol
    });
  }
};

// WR-03: integrate mouse-click + programmatic focus with the roving model. A click on a
// tabindex="-1" cell (or focus arriving any way other than the keyboard nav path) moves
// DOM focus there but does NOT run onGridKeyDown — so activeRow/activeColIndex would stay
// on the OLD cell and the NEXT arrow key would jump from the stale active cell. Wired as
// ONE @focusin on the <table> root (focusin bubbles): resolve the focused element's owning
// [data-grid-cell], parse its data-row/data-col-index, and write them into the active-cell
// state (mirroring the keyboard path). Clears activeInControl ONLY when the cell ITSELF
// (not an inner control) received focus — focusing a control via Enter keeps the in-control
// flag. NEVER emits activecell-change (a focus sync is not a keyboard navigation event).
// WR-03: integrate mouse-click + programmatic focus with the roving model. A click on a
// tabindex="-1" cell (or focus arriving any way other than the keyboard nav path) moves
// DOM focus there but does NOT run onGridKeyDown — so activeRow/activeColIndex would stay
// on the OLD cell and the NEXT arrow key would jump from the stale active cell. Wired as
// ONE @focusin on the <table> root (focusin bubbles): resolve the focused element's owning
// [data-grid-cell], parse its data-row/data-col-index, and write them into the active-cell
// state (mirroring the keyboard path). Clears activeInControl ONLY when the cell ITSELF
// (not an inner control) received focus — focusing a control via Enter keeps the in-control
// flag. NEVER emits activecell-change (a focus sync is not a keyboard navigation event).
const syncActiveFromEvent = (e: any) => {
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
  activeIsHeader = isHeader;
  if (!isHeader) {
    const row = parseInt(rowAttr, 10);
    if (Number.isFinite(row)) activeRow = row;
  }
  activeColIndex = col;
  // The cell box (not an inner control) receiving focus = navigation mode.
  if (tgt === cellEl) activeInControl = false;
};

// WR-02: reset the interaction-mode flag when focus leaves the active cell's subtree.
// Without this, activeInControl could stick `true` — a mouse click OUTSIDE the cell, or
// the focused inner control being removed from the DOM — leaving onGridKeyDown wedged in
// the in-cell-trap branch so arrow nav is dead until Escape. Wired as ONE @focusout on
// the <table> root (focusout bubbles, unlike blur). relatedTarget is the element RECEIVING
// focus (null when focus leaves the document / is retargeted across a shadow boundary). If
// focus is NOT moving to a descendant of the active cell, drop the flag. A Tab-cycle WITHIN
// the cell (interaction mode) keeps relatedTarget inside cellEl → no reset.
// WR-02: reset the interaction-mode flag when focus leaves the active cell's subtree.
// Without this, activeInControl could stick `true` — a mouse click OUTSIDE the cell, or
// the focused inner control being removed from the DOM — leaving onGridKeyDown wedged in
// the in-cell-trap branch so arrow nav is dead until Escape. Wired as ONE @focusout on
// the <table> root (focusout bubbles, unlike blur). relatedTarget is the element RECEIVING
// focus (null when focus leaves the document / is retargeted across a shadow boundary). If
// focus is NOT moving to a descendant of the active cell, drop the flag. A Tab-cycle WITHIN
// the cell (interaction mode) keeps relatedTarget inside cellEl → no reset.
const onGridFocusOut = (e: any) => {
  if (!isGrid() || !activeInControl) return;
  const next = e ? e.relatedTarget : null;
  const cellEl = currentCellEl();
  if (!cellEl || !next || !cellEl.contains(next)) activeInControl = false;
};

// D-05: clamp the active cell to bounds on every underlying-data change (re-sort, filter,
// pagination, page-size). KEEP the same indices; clamp ONLY when the grid shrank — NO
// row-id following, NO bounce-to-top on a filter keystroke. Gated by isGrid() so 'table'
// mode is entirely untouched. Invoked at the rowModelVer bump path (refreshRowModel).
// D-05: clamp the active cell to bounds on every underlying-data change (re-sort, filter,
// pagination, page-size). KEEP the same indices; clamp ONLY when the grid shrank — NO
// row-id following, NO bounce-to-top on a filter keystroke. Gated by isGrid() so 'table'
// mode is entirely untouched. Invoked at the rowModelVer bump path (refreshRowModel).
const clampActiveCell = () => {
  if (!isGrid()) return;
  const maxCol = visibleColCount() - 1;
  const col = clamp(activeColIndex, 0, maxCol < 0 ? 0 : maxCol);
  if (col !== activeColIndex) activeColIndex = col;
  if (!activeIsHeader) {
    const lastRow = bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const row = clamp(activeRow, 0, maxRow);
    if (row !== activeRow) activeRow = row;
  }
};

// ── Grid active-cell $expose verbs (phase 49 plan 03, D-01) — exactly THREE, joining the
// existing 12 (→ 15). Collision-safe names (Pitfall 1): focusCell NOT `focus` (would shadow
// HTMLElement.focus on Lit — ROZ137); clearActiveCell NOT `clear` (listbox already exposes
// `clear`); getActiveCell is a read-style getter. None collide with the 9 *-change events,
// any prop, or a React auto-setter (ROZ121/137/524 clear). ──────────────────────────────────

// focusCell(rowIndex, colIndex) — move + focus the active cell, addressed BY INDEX over the
// visible model (D-03 — no id overload). Args are COERCED to integers and CLAMPED to [0,max]
// before the data-* selector is built (T-49-01: never interpolate a raw consumer string).
// Threads the SAME fresh clamped locals into focusActiveCell AND activecell-change (no $data
// re-read — consistent with the Task-1 fresh-local rule).
// ── Grid active-cell $expose verbs (phase 49 plan 03, D-01) — exactly THREE, joining the
// existing 12 (→ 15). Collision-safe names (Pitfall 1): focusCell NOT `focus` (would shadow
// HTMLElement.focus on Lit — ROZ137); clearActiveCell NOT `clear` (listbox already exposes
// `clear`); getActiveCell is a read-style getter. None collide with the 9 *-change events,
// any prop, or a React auto-setter (ROZ121/137/524 clear). ──────────────────────────────────
// focusCell(rowIndex, colIndex) — move + focus the active cell, addressed BY INDEX over the
// visible model (D-03 — no id overload). Args are COERCED to integers and CLAMPED to [0,max]
// before the data-* selector is built (T-49-01: never interpolate a raw consumer string).
// Threads the SAME fresh clamped locals into focusActiveCell AND activecell-change (no $data
// re-read — consistent with the Task-1 fresh-local rule).
export const focusCell = (rowIndex: any, colIndex: any) => {
  const lastRow = bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const maxCol = visibleColCount() - 1;
  const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
  const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
  activeIsHeader = false;
  activeInControl = false;
  activeRow = r;
  activeColIndex = c;
  // Thread isHeader=false EXPLICITLY (focusCell always lands in the body). Without it
  // focusActiveCell re-reads $data.activeIsHeader, which on React (setState async, ROZ138)
  // / Angular (async signal) returns the PRE-write value — and WR-03's @focusin sync sets
  // activeIsHeader=true whenever an inner control inside a HEADER cell (a sort button) was
  // last clicked, so a stale read would resolve focus to the header instead of body row r.
  focusActiveCell(r, c, false);
  onactivecellchange?.({
    rowIndex: r,
    colIndex: c
  });
};

// getActiveCell() — return the current active-cell position. Integers only — no row data,
// no DOM node (T-49-02 Information-Disclosure: return the screen position, nothing else).
// getActiveCell() — return the current active-cell position. Integers only — no row data,
// no DOM node (T-49-02 Information-Disclosure: return the screen position, nothing else).
export const getActiveCell = () => ({
  rowIndex: activeRow,
  colIndex: activeColIndex
});

// clearActiveCell() — reset the roving position to the D-04 entry cell (row 0, col 0) and
// exit interaction mode; the next Tab-in re-enters at the entry cell (D-01). Does NOT emit
// (no move to a new addressable cell — a reset, not a navigation).
// clearActiveCell() — reset the roving position to the D-04 entry cell (row 0, col 0) and
// exit interaction mode; the next Tab-in re-enters at the entry cell (D-01). Does NOT emit
// (no move to a new addressable cell — a reset, not a navigation).
export const clearActiveCell = () => {
  activeIsHeader = false;
  activeInControl = false;
  activeRow = 0;
  activeColIndex = 0;
};

setContext('data-table:columns', {
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    colReg = {
      ...colReg,
      [key]: spec
    };
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...colReg
    };
    delete r[String(id)];
    colReg = r;
  }
});

onMount(() => {
  // Build the table instance HERE so the closures below capture the live `table`.
  table = createTable({
    // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
    // `this` to the options object, and the Angular/Lit emitters resolve $props via
    // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
    // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
    // on every change by the watch's setOptions below, exactly like columns/state, so
    // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
    data: data,
    columns: tableColumns(),
    state: currentState(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Server-side hook (req-6): when `manual` is set, table-core trusts the consumer's
    // rows verbatim (no client-side filter/sort/paginate) and only emits the change
    // events so the consumer can fetch the next page/filtered slice.
    manualPagination: manual === true,
    manualFiltering: manual === true,
    manualSorting: manual === true,
    // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
    // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
    // default, D-06 — NOT overridden).
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multiple',
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
    // windowingSource(): the FULL pre-pagination model when virtual (windowing replaces client
    // pagination, req-9), else the normal paginated row model (non-virtual path byte-unchanged).
    const nextRows = windowingSource().slice();
    const nextGroups = table.getHeaderGroups().slice();
    rows = nextRows;
    headerGroups = nextGroups;
    rowModelVer = rowModelVer + 1;
    // Vertical windowing re-feed (Pitfall 2 — stale count): push the fresh full-model count
    // into the virtualizer + reconcile IMPERATIVELY here (the table.setOptions re-feed path),
    // NEVER in a render helper (Pitfall 1). Pass the COMPLETE options set (virtual-core's
    // setOptions replaces, not merges). Guarded so the off path executes no virtual-core code.
    if (virtual && virtualizer) {
      virtualizer.setOptions(virtualizerOptions());
      virtualizer._willUpdate();
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
  refreshRowModel();

  // ── Grid mode: capture the table root ──────────────────────────────────────────────
  // $el is the component root; the <table class="rozie-data-table"> is the grid root the
  // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
  // (post-mount) so it is non-null and ROZ123-clean.
  gridRoot = __rozieRoot ? __rozieRoot!.querySelector('.rozie-data-table') : null;
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
  if (virtual) {
    gridScrollEl = __rozieRoot ? __rozieRoot!.querySelector('.rdt-scroll') : null;
    virtualizer = new Virtualizer(virtualizerOptions());
    virtualizerCleanup = virtualizer._didMount();
    // FINE-GRAINED FIRST-WINDOW KICK (Solid/Svelte): the windowed <For>/{#each} accessor was first
    // evaluated at initial render — while `virtualizer` was still null — and (because windowedRows()
    // reads $data.windowVer up top) subscribed to windowVer then returned []. `virtualizer` is a
    // non-reactive `let`, so its assignment above does NOT notify the accessor; we must bump the
    // SIGNAL it subscribed to. _didMount() computes the first window synchronously but its onChange
    // only fires on SUBSEQUENT scroll/resize, so without this explicit bump the first window would
    // never paint on the fine-grained targets. Idempotent + harmless on the coarse targets (they
    // re-render wholesale anyway). One bump = one re-run that now sees the non-null virtualizer and
    // pulls getVirtualItems().
    windowVer = windowVer + 1;
    // After the first window commits (next frame), refine heights + fire the dev-mode warns
    // ONCE. Entirely inside the $props.virtual guard so the virtual=false emitted path adds NO
    // code and these warns can never fire there (req-1 byte-identical-off preserved).
    const afterFirstFrame = () => {
      // D-10: measure the rendered rows.
      remeasureWindow();
      // D-08/A1: a dev-mode runtime warn when the scroll container has no bounded height (the
      // bound may come from consumer CSS the compiler can't see — no compile diagnostic). No
      // process.env guard (not bundler-portable); always-warn-on-misconfig is acceptable.
      const h = gridScrollEl ? gridScrollEl.clientHeight : 0;
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
      const pg = pagination;
      const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
      if (manual !== true && pgConfigured) {
        console.warn('[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.');
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));else setTimeout(afterFirstFrame, 0);
  }
});
onDestroy(() => (() => {
  if (virtualizerCleanup) virtualizerCleanup();
})());
$effect(() => (() => {
  if (!table) return;
  const d = data || [];
  if (d === lastData && d.length === lastDataLen) return;
  lastData = d;
  lastDataLen = d.length;
  reFeed();
})());

let __rozieWatchInitial_0 = true;
$effect(() => { (() => [sorting, globalFilter, columnFilters, pagination, rowSelection, columnVisibility, columnSizing, columnOrder, columnPinning, selectionMode, (data || []).length, colReg])(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  reFeed();
})(); }); });
</script>

<div class="rozie-data-table-wrap" bind:this={__rozieRoot} data-rozie-s-d5dcab4c><div class="rdt-column-defs" style="display:none" aria-hidden="true" data-rozie-s-d5dcab4c>{@render children?.()}</div><div class="rdt-toolbar" data-rozie-s-d5dcab4c><input class="rdt-global-filter" type="text" role="searchbox" aria-label="Search table" value={globalFilterValue()} oninput={($event) => { onGlobalFilterInput($event); }} data-rozie-s-d5dcab4c />{#if allLeafColumns().length}<details class="rdt-colvis" data-rozie-s-d5dcab4c><summary class="rdt-colvis-summary" data-rozie-s-d5dcab4c>Columns</summary><div class="rdt-colvis-menu" role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c>{#each allLeafColumns() as lc (lc.id)}<label class="rdt-colvis-item" data-rozie-s-d5dcab4c><input type="checkbox" class="rdt-colvis-checkbox" checked={lc.visible} onchange={($event) => { onToggleVisibility(lc.id); }} data-rozie-s-d5dcab4c /><span class="rdt-colvis-label" data-rozie-s-d5dcab4c>{rozieDisplay(lc.label)}</span></label>{/each}</div></details>{/if}</div>{#if virtual}<div class="rdt-scroll" style={maxHeight ? 'max-height:' + maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + maxHeight : 'overflow:auto'} data-rozie-s-d5dcab4c><table class={["rozie-data-table", { 'rdt-sticky': stickyHeader }]} role={rozieAttr(tableRole())} aria-rowcount={rows.length} onkeydown={($event) => { onGridKeyDown($event); }} onfocusin={($event) => { syncActiveFromEvent($event); }} onfocusout={($event) => { onGridFocusOut($event); }} data-rozie-s-d5dcab4c><thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>{#each headerGroups as hg (hg.id)}<tr class="rdt-tr" role="row" data-rozie-s-d5dcab4c>{#each hg.headers as header (header.id)}<th class={["rdt-th", { 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }]} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabindex={rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header)))} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={thStyle(header.column.id)} data-rozie-s-d5dcab4c>{#if isSelectColumn(header.column.id)}<span style="display:contents" data-rozie-s-d5dcab4c>{#if selectAll}{@render selectAll({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows })}{:else}{#if selectionMode === 'multiple'}<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} onchange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c />{/if}{/if}</span>{:else}<span style="display:contents" data-rozie-s-d5dcab4c>{#if header.column.getCanSort && header.column.getCanSort()}<button type="button" class="rdt-sort-btn" onclick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-header-label" data-rozie-s-d5dcab4c>{#if colHeader}{@render colHeader({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) })}{:else}{rozieDisplay(headerLabel(header.column.id))}{/if}</span><span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>{rozieDisplay(sortIndicator(header.column.id))}</span></button>{:else}<span style="display:contents" data-rozie-s-d5dcab4c><span class="rdt-header-label" data-rozie-s-d5dcab4c>{#if colHeader}{@render colHeader({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) })}{:else}{rozieDisplay(headerLabel(header.column.id))}{/if}</span></span>{/if}{#if columnIsFilterable(header.column.id)}<input class="rdt-col-filter" type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} oninput={($event) => { onColumnFilterInput(header.column.id, $event); }} onclick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c />{/if}<span class="rdt-pin-controls" role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c><button type="button" class="rdt-pin-btn rdt-pin-left" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} onclick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c>⇤</button><button type="button" class="rdt-pin-btn rdt-pin-none" aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} onclick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c>⇔</button><button type="button" class="rdt-pin-btn rdt-pin-right" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} onclick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c>⇥</button></span><button type="button" class="rdt-resize-handle" aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onpointerdown={($event) => { onResizeStart(header.column.id, $event); }} ontouchstart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button></span>{/if}</th>{/each}</tr>{/each}</thead><tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c><tr class="rdt-spacer" aria-hidden="true" data-rozie-s-d5dcab4c><td colspan={rozieAttr(visibleColCount())} style={'height:' + padTop() + 'px;padding:0;border:0'} data-rozie-s-d5dcab4c></td></tr>{#each windowedRows() as wr (wr.row.id)}<tr class="rdt-tr" role="row" data-row={rozieAttr(wr.vi.index)} aria-rowindex={rozieAttr(wr.vi.index + 1)} data-index={rozieAttr(wr.vi.index)} data-rozie-s-d5dcab4c>{#each visibleCellsFor(wr.row) as cellCtx (cellCtx.id)}<td class={["rdt-td", { 'rdt-select-td': isSelectColumn(cellCtx.column.id) }]} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(wr.vi.index)} data-col-index={rozieAttr(colIndexOf(wr.row, cellCtx))} tabindex={rozieAttr(cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx)))} style={pinStyle(cellCtx.column.id)} data-rozie-s-d5dcab4c>{#if isSelectColumn(cellCtx.column.id)}<span style="display:contents" data-rozie-s-d5dcab4c>{#if selectCell}{@render selectCell({ row: wr.row.original, checked: rowIsSelected(wr.row), toggle: e => onToggleRow(wr.row, e) })}{:else}<input class="rdt-select-row" type="checkbox" aria-label="Select row" checked={rowIsSelected(wr.row)} onchange={($event) => { onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c />{/if}</span>{:else}<span class="rdt-cell-value" data-rozie-s-d5dcab4c>{#if cell}{@render cell({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() })}{:else}{rozieDisplay(cellCtx.getValue())}{/if}</span>{/if}</td>{/each}</tr>{/each}<tr class="rdt-spacer" aria-hidden="true" data-rozie-s-d5dcab4c><td colspan={rozieAttr(visibleColCount())} style={'height:' + padBottom() + 'px;padding:0;border:0'} data-rozie-s-d5dcab4c></td></tr></tbody></table></div>{:else}<table class={["rozie-data-table", { 'rdt-sticky': stickyHeader }]} role={rozieAttr(tableRole())} onkeydown={($event) => { onGridKeyDown($event); }} onfocusin={($event) => { syncActiveFromEvent($event); }} onfocusout={($event) => { onGridFocusOut($event); }} data-rozie-s-d5dcab4c><thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>{#each headerGroups as hg (hg.id)}<tr class="rdt-tr" role="row" data-rozie-s-d5dcab4c>{#each hg.headers as header (header.id)}<th class={["rdt-th", { 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }]} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabindex={rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header)))} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={thStyle(header.column.id)} data-rozie-s-d5dcab4c>{#if isSelectColumn(header.column.id)}<span style="display:contents" data-rozie-s-d5dcab4c>{#if selectAll}{@render selectAll({ checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows })}{:else}{#if selectionMode === 'multiple'}<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" checked={isAllRowsSelected()} onchange={($event) => { onToggleAllRows($event); }} data-rozie-s-d5dcab4c />{/if}{/if}</span>{:else}<span style="display:contents" data-rozie-s-d5dcab4c>{#if header.column.getCanSort && header.column.getCanSort()}<button type="button" class="rdt-sort-btn" onclick={($event) => { onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-header-label" data-rozie-s-d5dcab4c>{#if colHeader}{@render colHeader({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) })}{:else}{rozieDisplay(headerLabel(header.column.id))}{/if}</span><span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>{rozieDisplay(sortIndicator(header.column.id))}</span></button>{:else}<span style="display:contents" data-rozie-s-d5dcab4c><span class="rdt-header-label" data-rozie-s-d5dcab4c>{#if colHeader}{@render colHeader({ columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) })}{:else}{rozieDisplay(headerLabel(header.column.id))}{/if}</span></span>{/if}{#if columnIsFilterable(header.column.id)}<input class="rdt-col-filter" type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} value={columnFilterValue(header.column.id)} oninput={($event) => { onColumnFilterInput(header.column.id, $event); }} onclick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c />{/if}<span class="rdt-pin-controls" role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c><button type="button" class="rdt-pin-btn rdt-pin-left" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')} aria-pressed={columnPinSide(header.column.id) === 'left'} onclick={($event) => { onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c>⇤</button><button type="button" class="rdt-pin-btn rdt-pin-none" aria-label={rozieAttr('Unpin ' + headerLabel(header.column.id))} aria-pressed={!columnPinSide(header.column.id)} onclick={($event) => { onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c>⇔</button><button type="button" class="rdt-pin-btn rdt-pin-right" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')} aria-pressed={columnPinSide(header.column.id) === 'right'} onclick={($event) => { onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c>⇥</button></span><button type="button" class="rdt-resize-handle" aria-label={rozieAttr('Resize ' + headerLabel(header.column.id))} onpointerdown={($event) => { onResizeStart(header.column.id, $event); }} ontouchstart={($event) => { onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button></span>{/if}</th>{/each}</tr>{/each}</thead><tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>{#each rows as row (row.id)}<tr class="rdt-tr" role="row" data-rozie-s-d5dcab4c>{#each visibleCellsFor(row) as cellCtx (cellCtx.id)}<td class={["rdt-td", { 'rdt-select-td': isSelectColumn(cellCtx.column.id) }]} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cellCtx))} tabindex={rozieAttr(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx)))} style={pinStyle(cellCtx.column.id)} data-rozie-s-d5dcab4c>{#if isSelectColumn(cellCtx.column.id)}<span style="display:contents" data-rozie-s-d5dcab4c>{#if selectCell}{@render selectCell({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) })}{:else}<input class="rdt-select-row" type="checkbox" aria-label="Select row" checked={rowIsSelected(row)} onchange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c />{/if}</span>{:else}<span class="rdt-cell-value" data-rozie-s-d5dcab4c>{#if cell}{@render cell({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() })}{:else}{rozieDisplay(cellCtx.getValue())}{/if}</span>{/if}</td>{/each}</tr>{/each}</tbody></table>{/if}{#if !virtual}<div class="rdt-pagination" role="group" aria-label="Pagination" data-rozie-s-d5dcab4c><button type="button" class="rdt-page-btn rdt-page-prev" disabled={!canPrevPage()} onclick={($event) => { onPrevPage(); }} data-rozie-s-d5dcab4c>Prev</button><span class="rdt-page-status" aria-live="polite" data-rozie-s-d5dcab4c>{rozieDisplay('Page ' + (pageIndex() + 1) + ' of ' + pageCount())}</span><button type="button" class="rdt-page-btn rdt-page-next" disabled={!canNextPage()} onclick={($event) => { onNextPage(); }} data-rozie-s-d5dcab4c>Next</button><select class="rdt-page-size" aria-label="Rows per page" value={rozieAttr(pageSize())} onchange={($event) => { onPageSizeChange($event); }} data-rozie-s-d5dcab4c><option value={10} data-rozie-s-d5dcab4c>10</option><option value={25} data-rozie-s-d5dcab4c>25</option><option value={50} data-rozie-s-d5dcab4c>50</option><option value={100} data-rozie-s-d5dcab4c>100</option></select></div>{/if}</div>

<style>
:global {
  .rozie-data-table[data-rozie-s-d5dcab4c] {
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
  .rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-scroll[data-rozie-s-d5dcab4c] {
    max-height: var(--rozie-data-table-max-height);
    overflow: auto;
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
  }
}
</style>
