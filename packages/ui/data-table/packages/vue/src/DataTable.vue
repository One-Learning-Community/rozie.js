<template>


<div class="rozie-data-table-wrap" ref="__rozieRootRef">

<div class="rdt-column-defs" style="display:none" aria-hidden="true"><slot></slot></div>

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
        
        
        <span v-if="isSelectColumn(header.column.id)" style="display:contents">
          <slot name="selectAll" :checked="isAllRowsSelected()" :indeterminate="isSomeRowsSelected()" :toggle="onToggleAllRows">
            
            <input v-if="props.selectionMode === 'multiple'" class="rdt-select-all" type="checkbox" aria-label="Select all rows" :checked="isAllRowsSelected()" @change="onToggleAllRows($event)" /></slot>
        </span><span v-else style="display:contents">
          
          <button v-if="header.column.getCanSort && header.column.getCanSort()" type="button" class="rdt-sort-btn" @click="onHeaderSort(header.column.id, $event)">
            
            <span class="rdt-header-label">
              <slot name="colHeader" :columnId="header.column.id" :column="header.column" :label="headerLabel(header.column.id)">{{ headerLabel(header.column.id) }}</slot>
            </span>
            <span class="rdt-sort-ind" aria-hidden="true">{{ sortIndicator(header.column.id) }}</span>
          </button><span v-else style="display:contents">
            <span class="rdt-header-label">
              <slot name="colHeader" :columnId="header.column.id" :column="header.column" :label="headerLabel(header.column.id)">{{ headerLabel(header.column.id) }}</slot>
            </span>
          </span><input v-if="columnIsFilterable(header.column.id)" class="rdt-col-filter" type="text" :aria-label="'Filter ' + headerLabel(header.column.id)" :value="columnFilterValue(header.column.id)" @input="onColumnFilterInput(header.column.id, $event)" @click="stopEvent($event)" /><span class="rdt-pin-controls" role="group" :aria-label="'Pin ' + headerLabel(header.column.id)">
            <button type="button" class="rdt-pin-btn rdt-pin-left" :aria-label="'Pin ' + headerLabel(header.column.id) + ' to left'" :aria-pressed="columnPinSide(header.column.id) === 'left'" @click="onPinColumn(header.column.id, 'left', $event)">⇤</button>
            <button type="button" class="rdt-pin-btn rdt-pin-none" :aria-label="'Unpin ' + headerLabel(header.column.id)" :aria-pressed="!columnPinSide(header.column.id)" @click="onPinColumn(header.column.id, false, $event)">⇔</button>
            <button type="button" class="rdt-pin-btn rdt-pin-right" :aria-label="'Pin ' + headerLabel(header.column.id) + ' to right'" :aria-pressed="columnPinSide(header.column.id) === 'right'" @click="onPinColumn(header.column.id, 'right', $event)">⇥</button>
          </span>
          
          <button type="button" class="rdt-resize-handle" :aria-label="'Resize ' + headerLabel(header.column.id)" @pointerdown="onResizeStart(header.column.id, $event)" @touchstart="onResizeStart(header.column.id, $event)"><span class="rdt-resize-grip" aria-hidden="true"></span></button>
        </span></th>
    </tr>
  </thead>

  <tbody class="rdt-tbody" role="rowgroup">
    <tr v-for="row in rows" :key="row.id" class="rdt-tr" role="row">
      <td v-for="cellCtx in visibleCellsFor(row)" :key="cellCtx.id" :class="['rdt-td', { 'rdt-select-td': isSelectColumn(cellCtx.column.id) }]" role="cell" :data-col="cellCtx.column.id" :style="pinStyle(cellCtx.column.id)">
        
        <span v-if="isSelectColumn(cellCtx.column.id)" style="display:contents">
          <slot name="selectCell" :row="row.original" :checked="rowIsSelected(row)" :toggle="e => onToggleRow(row, e)">
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" :checked="rowIsSelected(row)" @change="onToggleRow(row, $event)" />
          </slot>
        </span><span v-else class="rdt-cell-value">
          <slot name="cell" :columnId="cellCtx.column.id" :column="cellCtx.column" :row="row.original" :value="cellCtx.getValue()">{{ cellCtx.getValue() }}</slot>
        </span></td>
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
import { onMounted, onUpdated, provide, ref, watch } from 'vue';

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
  default(props: {  }): any;
  selectAll(props: { checked: any; indeterminate: any; toggle: any }): any;
  colHeader(props: { columnId: any; column: any; label: any }): any;
  colHeader(props: { columnId: any; column: any; label: any }): any;
  selectCell(props: { row: any; checked: any; toggle: any }): any;
  cell(props: { columnId: any; column: any; row: any; value: any }): any;
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
const columnSizingInfo = ref({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: []
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
  sorting: sorting.value != null ? sorting.value : sortingDefault.value,
  globalFilter: globalFilter.value != null ? globalFilter.value : globalFilterDefault.value,
  columnFilters: columnFilters.value != null ? columnFilters.value : columnFiltersDefault.value,
  pagination: pagination.value != null ? pagination.value : paginationDefault.value,
  rowSelection: rowSelection.value != null ? rowSelection.value : rowSelectionDefault.value,
  columnVisibility: columnVisibility.value != null ? columnVisibility.value : columnVisibilityDefault.value,
  columnSizing: columnSizing.value != null ? columnSizing.value : columnSizingDefault.value,
  columnOrder: columnOrder.value != null ? columnOrder.value : columnOrderDefault.value,
  columnPinning: columnPinning.value != null ? columnPinning.value : columnPinningDefault.value,
  // columnSizingInfo: table-core's transient resize-gesture state. We pass an
  // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
  // `column.getIsResizing()` / `getResizeHandler()` read
  // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
  // absent. Seed the default shape (matches table-core's
  // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
  // every render. Not a two-way model slice (transient gesture state, not consumer
  // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
  columnSizingInfo: columnSizingInfo.value
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
const selectionEnabled = () => props.selectionMode === 'single' || props.selectionMode === 'multiple';
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
  const next = applyUpdater(updater, columnSizingInfo.value);
  columnSizingInfo.value = next != null ? next : columnSizingInfo.value;
};
// Push fresh options into table-core + re-pull the row model. Extracted so BOTH the
// re-feed $watch (above) and the Lit data-change $onUpdate (below) call it.
const reFeed = () => {
  if (!table) return;
  table.setOptions((prev: any) => ({
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
const tick = () => rowModelVer.value;
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
const visibleCellsFor = (row: any) => rowModelVer.value >= 0 ? row.getVisibleCells() : [];
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
  const groups = headerGroups.value || [];
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
  if (!__rozieRootRef.value || !__rozieRootRef.value!.querySelector) return;
  selectAllBox = __rozieRootRef.value!.querySelector('.rdt-select-all');
  if (selectAllBox) selectAllBox.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
};

// The registry API handed to <Column> children (whole-object-replace — T-48-PP guard).
// Imperative handle (consumer-callable). Each verb is a PRE-DECLARED top-level
// `const` (the canonical $expose contract — `$expose({ name })` references a
// binding ALREADY in scope; an INLINE-defined verb `$expose({ name: () => {} })`
// is dropped on ALL SIX targets, only the by-reference key survives → a
// runtime ReferenceError at `defineExpose`/`useImperativeHandle`). Sorting verbs +
// a fresh column-def readout, selection, pagination, and column-management verbs.
const sortColumn = (colId: any, desc: any) => {
  if (table) table.getColumn(colId) && table.getColumn(colId).toggleSorting(desc, false);
};
const clearSorting = () => {
  if (table) table.resetSorting(true);
};
const getColumnDefs = () => columnDefs();
// selection verbs (req-7) — drive table-core so the onRowSelectionChange funnel
// emits the fresh state + selection-change.
// selection verbs (req-7) — drive table-core so the onRowSelectionChange funnel
// emits the fresh state + selection-change.
const toggleAllRows = (value: any) => {
  if (table) table.toggleAllRowsSelected(value);
};
const clearSelection = () => {
  if (table) table.resetRowSelection(true);
};
const getSelectedRows = () => table ? table.getSelectedRowModel().rows.map((r: any) => r.original) : [];
// pagination verbs.
// pagination verbs.
const setPage = (idx: any) => {
  if (table) table.setPageIndex(idx);
};
const setRowsPerPage = (size: any) => {
  if (table) table.setPageSize(size);
};
// column-management verbs (req-8/9/10/11) — drive table-core so the funnels fire.
// column-management verbs (req-8/9/10/11) — drive table-core so the funnels fire.
const toggleColumnVisibility = (colId: any) => {
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
const applyColumnOrder = (order: any) => {
  if (table) table.setColumnOrder(order);
};
const resetColumnSizing = () => {
  if (table) table.resetColumnSizing(true);
};
// pinColumn: the verb that drives column.pin; distinct from the template handler
// onPinColumn (no shadow — the deferred-items finding #4 collision check).
// pinColumn: the verb that drives column.pin; distinct from the template handler
// onPinColumn (no shadow — the deferred-items finding #4 collision check).
const pinColumn = (colId: any, side: any) => {
  if (table) {
    const c = table.getColumn(colId);
    if (c && c.pin) c.pin(side);
  }
};

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

onMounted(() => {
  // Build the table instance HERE so the closures below capture the live `table`.
  table = createTable({
    // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
    // `this` to the options object, and the Angular/Lit emitters resolve $props via
    // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
    // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
    // on every change by the watch's setOptions below, exactly like columns/state, so
    // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
    data: props.data,
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
    rows.value = nextRows;
    headerGroups.value = nextGroups;
    rowModelVer.value = rowModelVer.value + 1;
    // keep the select-all checkbox's `indeterminate` DOM property in lockstep with the
    // selection state (bound :indeterminate is inert on 5/6 targets). The box persists
    // across selection changes; a microtask defer covers React's post-render DOM patch.
    syncIndeterminate();
    if (typeof queueMicrotask !== 'undefined') queueMicrotask(syncIndeterminate);else Promise.resolve().then(syncIndeterminate);
  };

  // initial pull
  refreshRowModel();
});
onUpdated(() => {
  if (!table) return;
  const d = props.data || [];
  if (d === lastData && d.length === lastDataLen) return;
  lastData = d;
  lastDataLen = d.length;
  reFeed();
});

watch(() => [sorting.value, globalFilter.value, columnFilters.value, pagination.value, rowSelection.value, columnVisibility.value, columnSizing.value, columnOrder.value, columnPinning.value, props.selectionMode, (props.data || []).length, colReg.value], () => {
  reFeed();
});

defineExpose({ sortColumn, clearSorting, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn });
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
