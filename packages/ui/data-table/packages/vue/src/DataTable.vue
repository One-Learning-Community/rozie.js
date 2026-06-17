<template>


<div class="rozie-data-table-wrap" ref="__rozieRootRef">

<div class="rdt-toolbar">
  <input class="rdt-global-filter" type="text" role="searchbox" aria-label="Search table" :value="globalFilterValue()" @input="onGlobalFilterInput($event)" />
  
  <details v-if="allLeafColumns().length" class="rdt-colvis">
    <summary class="rdt-colvis-summary">Columns</summary>
    <div class="rdt-colvis-menu" role="group" aria-label="Toggle columns">
      <label v-for="lc in allLeafColumns()" :key="lc.id" class="rdt-colvis-item">
        <input type="checkbox" class="rdt-colvis-checkbox" :checked="lc.visible" @change="onToggleVisibility(lc.id)" />
        <span class="rdt-colvis-label">{{ lc.label }}</span>
      </label>
    </div>
  </details></div>

<table :class="['rozie-data-table', { 'rdt-sticky': props.stickyHeader }]" role="table">
  <thead class="rdt-thead" role="rowgroup">
    <tr v-for="hg in headerGroups" :key="hg.id" class="rdt-tr" role="row">
      <th v-for="header in hg.headers" :key="header.id" :class="['rdt-th', { 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }]" role="columnheader" :data-col="header.column.id" :aria-sort="ariaSortFor(header.column.id)" :style="thStyle(header.column.id)">
        
        <template v-if="isSelectColumn(header.column.id)">
          <slot name="selectAll" :checked="isAllRowsSelected()" :indeterminate="isSomeRowsSelected()" :toggle="onToggleAllRows">
            <input class="rdt-select-all" type="checkbox" aria-label="Select all rows" :checked="isAllRowsSelected()" :indeterminate="isSomeRowsSelected()" @change="onToggleAllRows($event)" />
          </slot>
        </template><template v-else>
          
          <button v-if="header.column.getCanSort && header.column.getCanSort()" type="button" class="rdt-sort-btn" @click="onHeaderSort(header.column.id, $event)">
            
            <span v-if="columnHasHeaderTemplate(header.column.id)" class="rdt-header-host" :data-header-host="'h:' + header.column.id" :data-col="header.column.id"></span><span v-else class="rdt-header-label">{{ headerLabel(header.column.id) }}</span><span class="rdt-sort-ind" aria-hidden="true">{{ sortIndicator(header.column.id) }}</span>
          </button><template v-else>
            <span v-if="columnHasHeaderTemplate(header.column.id)" class="rdt-header-host" :data-header-host="'h:' + header.column.id" :data-col="header.column.id"></span><span v-else class="rdt-header-label">{{ headerLabel(header.column.id) }}</span></template><input v-if="columnIsFilterable(header.column.id)" class="rdt-col-filter" type="text" :aria-label="'Filter ' + headerLabel(header.column.id)" :value="columnFilterValue(header.column.id)" @input="onColumnFilterInput(header.column.id, $event)" @click.stop="undefined" /><span class="rdt-pin-controls" role="group" :aria-label="'Pin ' + headerLabel(header.column.id)">
            <button type="button" class="rdt-pin-btn rdt-pin-left" :aria-label="'Pin ' + headerLabel(header.column.id) + ' to left'" :aria-pressed="columnPinSide(header.column.id) === 'left'" @click.stop="onPinColumn(header.column.id, 'left')">⇤</button>
            <button type="button" class="rdt-pin-btn rdt-pin-none" :aria-label="'Unpin ' + headerLabel(header.column.id)" :aria-pressed="!columnPinSide(header.column.id)" @click.stop="onPinColumn(header.column.id, false)">⇔</button>
            <button type="button" class="rdt-pin-btn rdt-pin-right" :aria-label="'Pin ' + headerLabel(header.column.id) + ' to right'" :aria-pressed="columnPinSide(header.column.id) === 'right'" @click.stop="onPinColumn(header.column.id, 'right')">⇥</button>
          </span>
          
          <button type="button" class="rdt-resize-handle" :aria-label="'Resize ' + headerLabel(header.column.id)" @pointerdown.stop="onResizeStart(header.column.id, $event)" @touchstart.stop="onResizeStart(header.column.id, $event)"><span class="rdt-resize-grip" aria-hidden="true"></span></button>
        </template></th>
    </tr>
  </thead>

  <tbody class="rdt-tbody" role="rowgroup">
    <tr v-for="row in rows" :key="row.id" class="rdt-tr" role="row">
      <td v-for="cellCtx in row.getVisibleCells()" :key="cellCtx.id" :class="['rdt-td', { 'rdt-select-td': isSelectColumn(cellCtx.column.id) }]" role="cell" :data-col="cellCtx.column.id" :style="pinStyle(cellCtx.column.id)">
        
        <template v-if="isSelectColumn(cellCtx.column.id)">
          <slot name="selectCell" :row="row.original" :checked="rowIsSelected(row)" :toggle="e => onToggleRow(row, e)">
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" :checked="rowIsSelected(row)" @change="onToggleRow(row, $event)" />
          </slot>
        </template><template v-else>
          
          <span v-if="columnHasCellTemplate(cellCtx.column.id)" class="rdt-cell-host" :data-cell-host="'c:' + row.id + ':' + cellCtx.column.id" :data-col="cellCtx.column.id" :data-row="row.id"></span><span v-else class="rdt-cell-value">{{ cellCtx.getValue() }}</span></template></td>
    </tr>
  </tbody>
</table>


<div class="rdt-pagination" role="group" aria-label="Pagination">
  <button type="button" class="rdt-page-btn rdt-page-prev" :disabled="!canPrevPage()" @click="onPrevPage()">Prev</button>
  <span class="rdt-page-status" aria-live="polite">
    {{ 'Page ' + (pageIndex() + 1) + ' of ' + pageCount() }}
  </span>
  <button type="button" class="rdt-page-btn rdt-page-next" :disabled="!canNextPage()" @click="onNextPage()">Next</button>
  <select class="rdt-page-size" aria-label="Rows per page" :value="pageSize()" @change="onPageSizeChange($event)">
    <option :value="10">10</option>
    <option :value="25">25</option>
    <option :value="50">50</option>
    <option :value="100">100</option>
  </select>
</div>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ data: any[]; columns?: any[]; selectionMode?: string; manual?: boolean; stickyHeader?: boolean; interactionMode?: string }>(),
  { columns: () => [], selectionMode: 'none', manual: false, stickyHeader: false, interactionMode: 'table' }
);

const sorting = defineModel<any[]>('sorting', { default: () => [] });
const globalFilter = defineModel<string>('globalFilter', { default: '' });
const columnFilters = defineModel<any[]>('columnFilters', { default: () => [] });
const pagination = defineModel<Record<string, any>>('pagination', { default: () => ({
  pageIndex: 0,
  pageSize: 10
}) });
const rowSelection = defineModel<Record<string, any>>('rowSelection', { default: () => ({}) });
const columnVisibility = defineModel<Record<string, any>>('columnVisibility', { default: () => ({}) });
const columnSizing = defineModel<Record<string, any>>('columnSizing', { default: () => ({}) });
const columnOrder = defineModel<any[]>('columnOrder', { default: () => [] });
const columnPinning = defineModel<Record<string, any>>('columnPinning', { default: () => ({
  left: [],
  right: []
}) });

const emit = defineEmits<{
  'sort-change': [...args: any[]];
  'filter-change': [...args: any[]];
  'page-change': [...args: any[]];
  'selection-change': [...args: any[]];
  'visibility-change': [...args: any[]];
  'resize-change': [...args: any[]];
  'reorder-change': [...args: any[]];
  'pin-change': [...args: any[]];
}>();

defineSlots<{
  selectAll(props: { checked: any; indeterminate: any; toggle: any }): any;
  selectCell(props: { row: any; checked: any; toggle: any }): any;
}>();

const sortingDefault = ref<any[]>([]);
const globalFilterDefault = ref('');
const columnFiltersDefault = ref<any[]>([]);
const paginationDefault = ref({
  pageIndex: 0,
  pageSize: 10
});
const rowSelectionDefault = ref({});
const columnVisibilityDefault = ref({});
const columnSizingDefault = ref({});
const columnOrderDefault = ref<any[]>([]);
const columnPinningDefault = ref({
  left: [],
  right: []
});
const colReg = ref({});
const rows = ref<any[]>([]);
const headerGroups = ref<any[]>([]);
const rowModelVer = ref(0);

const __rozieRootRef = ref<HTMLElement>();

import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';

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

// Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
// the funnel. A counter (not a boolean) so nested writes are safe.
// Echo-guard: while WE are writing a slice back, the re-feed watcher must not re-enter
// the funnel. A counter (not a boolean) so nested writes are safe.
let programmatic = 0;

// Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
// All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
// this whole object as `state`.
// Assemble the live state object from bound r-model slices (?? uncontrolled fallback).
// All NINE slices are wired (each ?? its own $data.<slice>Default). table-core reads
// this whole object as `state`.
const currentState = () => ({
  sorting: sorting.value != null ? sorting.value : sortingDefault.value,
  globalFilter: globalFilter.value != null ? globalFilter.value : globalFilterDefault.value,
  columnFilters: columnFilters.value != null ? columnFilters.value : columnFiltersDefault.value,
  pagination: pagination.value != null ? pagination.value : paginationDefault.value,
  rowSelection: rowSelection.value != null ? rowSelection.value : rowSelectionDefault.value,
  columnVisibility: columnVisibility.value != null ? columnVisibility.value : columnVisibilityDefault.value,
  columnSizing: columnSizing.value != null ? columnSizing.value : columnSizingDefault.value,
  columnOrder: columnOrder.value != null ? columnOrder.value : columnOrderDefault.value,
  columnPinning: columnPinning.value != null ? columnPinning.value : columnPinningDefault.value
});

// Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
// applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
// byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
// cannot pollute Object.prototype. Returns the table-core ColumnDef[] PLUS the per-
// column render metadata (hasCell/cellRenderer/hasHeader/headerRenderer) the template
// uses to decide plain-value fast path vs per-column slot dispatch.
// Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
// applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
// byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
// cannot pollute Object.prototype. Returns the table-core ColumnDef[] PLUS the per-
// column render metadata (hasCell/cellRenderer/hasHeader/headerRenderer) the template
// uses to decide plain-value fast path vs per-column slot dispatch.
const isSafeKey = (k: any) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const columnDefs = () => {
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
  const reg = colReg.value || {};
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
};

// The constant id of the auto-injected leading checkbox column (D-04). Distinct from
// any consumer column id (the registry/config guard never produces a leading "__").
// The constant id of the auto-injected leading checkbox column (D-04). Distinct from
// any consumer column id (the registry/config guard never produces a leading "__").
const SELECT_COL_ID = '__rdt_select';

// The table-core ColumnDef set actually fed to createTable / setOptions: the resolved
// user columns, PLUS a LEADING checkbox column when selectionMode === 'multiple'
// (D-04). The select column carries enableSorting/enableColumnFilter:false and an
// isSelectColumn marker the template uses to render checkbox chrome (NOT an accessor
// value). 'single' / 'none' inject nothing.
// The table-core ColumnDef set actually fed to createTable / setOptions: the resolved
// user columns, PLUS a LEADING checkbox column when selectionMode === 'multiple'
// (D-04). The select column carries enableSorting/enableColumnFilter:false and an
// isSelectColumn marker the template uses to render checkbox chrome (NOT an accessor
// value). 'single' / 'none' inject nothing.
const tableColumns = () => {
  const cols = columnDefs();
  if (props.selectionMode === 'multiple') {
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
  sortingDefault.value = next; // fresh array only (never in-place)
  sorting.value = next; // two-way emit if bound (no-op-diff if not)
  emit('sort-change', next);
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
  globalFilterDefault.value = next;
  globalFilter.value = next;
  emit('filter-change', {
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
  columnFiltersDefault.value = next;
  columnFilters.value = next;
  emit('filter-change', {
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
  paginationDefault.value = next;
  pagination.value = next;
  emit('page-change', next);
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
  rowSelectionDefault.value = next;
  rowSelection.value = next;
  emit('selection-change', next);
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
  columnVisibilityDefault.value = next;
  columnVisibility.value = next;
  emit('visibility-change', next);
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
  columnSizingDefault.value = next;
  columnSizing.value = next;
  emit('resize-change', next);
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
  columnOrderDefault.value = next;
  columnOrder.value = next;
  emit('reorder-change', next);
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
  columnPinningDefault.value = next;
  columnPinning.value = next;
  emit('pin-change', next);
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

// Per-cell / per-header projection bookkeeping: ONE live handle per rendered host,
// keyed by host element, so a re-render disposes ONLY the handles for hosts that went
// away (the Column owns its own per-cell handle Set; this parent owns the disposal
// timing). Module-scope so the Solid-hoisted teardown can sweep it.
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
const reconcileProjections = () => {
  if (!__rozieRootRef.value || !cellMounts) return;
  const seen = new Set();
  const defs = columnDefs();
  const defById = Object.create(null);
  for (const d of defs as any) defById[d.id] = d;
  // cells
  const cellHosts = __rozieRootRef.value!.querySelectorAll('[data-cell-host]');
  for (const host of cellHosts as any) {
    const key = host.getAttribute('data-cell-host');
    seen.add(key);
    if (cellMounts.has(key)) continue;
    const colId = host.getAttribute('data-col');
    const rowId = host.getAttribute('data-row');
    const def = defById[colId];
    if (!def || !def.hasCell || !def.cellRenderer) continue;
    const row = (rows.value || []).find((r: any) => String(r.id) === String(rowId));
    if (!row) continue;
    const handle = def.cellRenderer(host, {
      row: row.original,
      value: row.getValue(def.accessorKey),
      column: def
    });
    if (handle) cellMounts.set(key, handle);
  }
  // headers
  const headerHosts = __rozieRootRef.value!.querySelectorAll('[data-header-host]');
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
};

// Reactive re-feed: when the bound sorting slice OR data length OR the column registry
// changes, push fresh options into table-core and re-pull the row model. Watch the
// bound references / a derived primitive — never a freshly-built array (Pitfall 3).
// Lazy by default ($onMount did the first pull). EXTENSION: add the other bound slices
// to this getter array as they are wired.
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
// the live sort direction off the table-core column (string-safe — never a bound
// boolean, the listbox aria lesson).
// aria-sort string for a column header: 'ascending' | 'descending' | 'none'. Reads
// the live sort direction off the table-core column (string-safe — never a bound
// boolean, the listbox aria lesson).
const ariaSortFor = (colId: any) => {
  if (!table) return 'none';
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
  if (!table) return '';
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
const columnHasCellTemplate = (colId: any) => {
  const d = defFor(colId);
  return !!(d && d.hasCell && d.cellRenderer);
};
const columnHasHeaderTemplate = (colId: any) => {
  const d = defFor(colId);
  return !!(d && d.hasHeader && d.headerRenderer);
};
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
  if (!table) return null;
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
  if (!table) return;
  const header = findHeader(colId);
  if (!header || !header.getResizeHandler) return;
  const handler = header.getResizeHandler();
  if (handler) handler(evt);
};
// Find the live header object for a column id across the rendered header groups.
// Find the live header object for a column id across the rendered header groups.
const findHeader = (colId: any) => {
  const groups = headerGroups.value || [];
  for (const hg of groups as any) {
    const hs = hg.headers || [];
    for (const h of hs as any) if (h && h.column && h.column.id === colId) return h;
  }
  return null;
};
const columnIsResizing = (colId: any) => {
  if (!table) return false;
  const header = findHeader(colId);
  return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
};

// Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
// onColumnVisibilityChange funnel emits the fresh state.
// Visibility toggle (req-8) — drive table-core's column.toggleVisibility so the
// onColumnVisibilityChange funnel emits the fresh state.
const columnIsVisible = (colId: any) => {
  if (!table) return true;
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
};

// Pinning (req-11) — drive table-core's column.pin('left'|'right'|false) so the
// onColumnPinningChange funnel emits a fresh state. Sticky offsets read the live column
// start/after positions (table-core computes them from the pinned column sizes).
// Pinning (req-11) — drive table-core's column.pin('left'|'right'|false) so the
// onColumnPinningChange funnel emits a fresh state. Sticky offsets read the live column
// start/after positions (table-core computes them from the pinned column sizes).
const columnPinSide = (colId: any) => {
  if (!table) return false;
  const col = table.getColumn(colId);
  if (!col || !col.getIsPinned) return false;
  return col.getIsPinned();
};
const onPinColumn = (colId: any, side: any) => {
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
  if (table) return table.getState().pagination.pageIndex;
  const p = currentState().pagination;
  return p && p.pageIndex != null ? p.pageIndex : 0;
};
const pageSize = () => {
  if (table) return table.getState().pagination.pageSize;
  const p = currentState().pagination;
  return p && p.pageSize != null ? p.pageSize : 10;
};
const pageCount = () => {
  if (!table) return 1;
  const c = table.getPageCount();
  return c != null && c > 0 ? c : 1;
};
const canPrevPage = () => !!(table && table.getCanPreviousPage());
const canNextPage = () => !!(table && table.getCanNextPage());
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
// select-all header state (D-06: scopes to all filtered rows = TanStack default).
// `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
// select-all header state (D-06: scopes to all filtered rows = TanStack default).
// `!!`-coerced booleans (the listbox aria lesson — never a bound rozieAttr string).
const isAllRowsSelected = () => !!(table && table.getIsAllRowsSelected());
const isSomeRowsSelected = () => !!(table && table.getIsSomeRowsSelected());
const onToggleAllRows = (evt: any) => {
  if (!table) return;
  table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
};
// per-row checkbox state + toggle (checkbox-only, D-05 — row body does NOT select).
// per-row checkbox state + toggle (checkbox-only, D-05 — row body does NOT select).
const rowIsSelected = (row: any) => !!(row && row.getIsSelected && row.getIsSelected());
const onToggleRow = (row: any, evt: any) => {
  if (!row || !row.toggleSelected) return;
  row.toggleSelected(!!(evt && evt.target && evt.target.checked));
};

// The registry API handed to <Column> children (whole-object-replace — T-48-PP guard).

provide('data-table:columns', {
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    colReg.value = {
      ...colReg.value,
      [key]: spec
    };
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...colReg.value
    };
    delete r[String(id)];
    colReg.value = r;
  }
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // Build the table instance HERE so the closures below capture the live `table`.
  table = createTable({
    get data() {
      return props.data;
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
    enableRowSelection: props.selectionMode !== 'none',
    enableMultiRowSelection: props.selectionMode === 'multiple',
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
    rows.value = nextRows;
    headerGroups.value = nextGroups;
    rowModelVer.value = rowModelVer.value + 1;
  };

  // initial pull
  refreshRowModel();
  // project the per-column #cell / #header templates into the freshly-rendered
  // framework-owned hosts (deferred a tick so the r-for DOM exists).
  reconcileProjections();
  _cleanup_0 = () => {
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
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => [sorting.value, globalFilter.value, columnFilters.value, pagination.value, rowSelection.value, columnVisibility.value, columnSizing.value, columnOrder.value, columnPinning.value, props.selectionMode, (props.data || []).length, colReg.value], () => {
  if (!table) return;
  table.setOptions((prev: any) => ({
    ...prev,
    data: props.data,
    columns: tableColumns(),
    state: currentState(),
    enableRowSelection: props.selectionMode !== 'none',
    enableMultiRowSelection: props.selectionMode === 'multiple'
  }));
  if (refreshRowModel) refreshRowModel();
});
watch(() => rowModelVer.value, () => {
  reconcileProjections();
});

defineExpose({ sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, setColumnOrder, resetColumnSizing, pinColumn });
</script>

<style scoped>
.rozie-data-table {
  border-collapse: collapse;
  width: 100%;
  font: var(--rdt-font, 14px system-ui, sans-serif);
  color: var(--rdt-color, inherit);
}
.rozie-data-table .rdt-th,
.rozie-data-table .rdt-td {
  padding: var(--rdt-cell-padding, 0.5rem 0.75rem);
  text-align: left;
  border-bottom: var(--rdt-border, 1px solid rgba(0, 0, 0, 0.08));
}
.rozie-data-table .rdt-thead .rdt-th {
  font-weight: var(--rdt-header-weight, 600);
  background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
}
.rozie-data-table .rdt-sort-btn {
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
.rozie-data-table .rdt-sort-ind {
  font-size: 0.8em;
  opacity: var(--rdt-sort-ind-opacity, 0.7);
}
.rozie-data-table.rdt-sticky .rdt-thead .rdt-th {
  position: sticky;
  top: var(--rdt-sticky-top, 0);
  z-index: var(--rdt-sticky-z, 2);
  background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
}
.rozie-data-table-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--rdt-chrome-gap, 0.5rem);
}
.rozie-data-table-wrap .rdt-toolbar {
  display: flex;
  gap: var(--rdt-toolbar-gap, 0.5rem);
}
.rozie-data-table-wrap .rdt-global-filter,
.rozie-data-table-wrap .rdt-col-filter {
  font: inherit;
  padding: var(--rdt-filter-padding, 0.25rem 0.5rem);
  border: var(--rdt-filter-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-filter-radius, 4px);
  background: var(--rdt-filter-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap .rdt-col-filter {
  display: block;
  margin-top: var(--rdt-col-filter-gap, 0.25rem);
  width: 100%;
  font-weight: normal;
}
.rozie-data-table-wrap .rdt-pagination {
  display: flex;
  align-items: center;
  gap: var(--rdt-pagination-gap, 0.5rem);
}
.rozie-data-table-wrap .rdt-page-btn {
  font: inherit;
  cursor: pointer;
  padding: var(--rdt-page-btn-padding, 0.25rem 0.6rem);
  border: var(--rdt-page-btn-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-page-btn-radius, 4px);
  background: var(--rdt-page-btn-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap .rdt-page-btn:disabled {
  opacity: var(--rdt-page-btn-disabled-opacity, 0.4);
  cursor: default;
}
.rozie-data-table-wrap .rdt-page-status {
  font-size: var(--rdt-page-status-size, 0.9em);
}
.rozie-data-table-wrap .rdt-page-size {
  font: inherit;
  padding: var(--rdt-page-size-padding, 0.2rem 0.4rem);
  border: var(--rdt-page-size-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-page-size-radius, 4px);
  background: var(--rdt-page-size-bg, transparent);
  color: inherit;
}
.rozie-data-table .rdt-th {
  position: relative;
}
.rozie-data-table .rdt-resize-handle {
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
.rozie-data-table .rdt-resize-grip {
  display: block;
  width: var(--rdt-resize-grip-width, 2px);
  height: 100%;
  margin: 0 auto;
  background: var(--rdt-resize-grip-color, rgba(0, 0, 0, 0.12));
}
.rozie-data-table .rdt-resize-handle:hover .rdt-resize-grip,
.rozie-data-table .rdt-th-resizing .rdt-resize-grip {
  background: var(--rdt-resize-grip-active, rgba(0, 0, 0, 0.4));
}
.rozie-data-table .rdt-pin-controls {
  display: inline-flex;
  gap: var(--rdt-pin-gap, 0.1em);
  margin-left: var(--rdt-pin-margin, 0.35em);
}
.rozie-data-table .rdt-pin-btn {
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
.rozie-data-table .rdt-pin-btn[aria-pressed='true'] {
  background: var(--rdt-pin-btn-active-bg, rgba(0, 0, 0, 0.1));
  font-weight: 700;
}
.rozie-data-table-wrap .rdt-colvis {
  position: relative;
}
.rozie-data-table-wrap .rdt-colvis-summary {
  cursor: pointer;
  font: inherit;
  padding: var(--rdt-colvis-summary-padding, 0.25rem 0.6rem);
  border: var(--rdt-colvis-summary-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-colvis-summary-radius, 4px);
  list-style: none;
  user-select: none;
}
.rozie-data-table-wrap .rdt-colvis-menu {
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
.rozie-data-table-wrap .rdt-colvis-item {
  display: flex;
  align-items: center;
  gap: var(--rdt-colvis-label-gap, 0.4em);
  cursor: pointer;
  white-space: nowrap;
}
.rozie-data-table .rdt-select-th,
.rozie-data-table .rdt-select-td {
  width: var(--rdt-select-col-width, 1%);
  text-align: var(--rdt-select-col-align, center);
  white-space: nowrap;
}
.rozie-data-table .rdt-select-all,
.rozie-data-table .rdt-select-row {
  cursor: pointer;
  accent-color: var(--rdt-select-accent, currentColor);
}
</style>
