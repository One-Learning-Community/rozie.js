import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieStyle } from '@rozie/runtime-lit';
import { ContextProvider, createContext } from '@lit/context';
import { repeat } from 'lit/directives/repeat.js';
import './Popover';
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

const __rozieCtx_data_table_columns = createContext(Symbol.for("rozie:data-table:columns"));

interface RozieGroupBarSlotCtx {
  grouping: unknown;
  groupableColumns: unknown;
  applyGrouping: unknown;
  clearGrouping: unknown;
}

interface RozieSelectAllSlotCtx {
  checked: unknown;
  indeterminate: unknown;
  toggle: unknown;
}

interface RozieColHeaderSlotCtx {
  columnId: unknown;
  column: unknown;
  label: unknown;
}

interface RozieFilterSlotCtx {
  columnId: unknown;
  value: unknown;
  uniqueValues: unknown;
  minMax: unknown;
  setFilter: unknown;
}

interface RozieSelectCellSlotCtx {
  row: unknown;
  checked: unknown;
  toggle: unknown;
}

interface RozieCellSlotCtx {
  columnId: unknown;
  column: unknown;
  row: unknown;
  value: unknown;
}

interface RozieEditorSlotCtx {
  columnId: unknown;
  column: unknown;
  row: unknown;
  value: unknown;
  commit: unknown;
  cancel: unknown;
}

interface RozieDetailSlotCtx {
  row: unknown;
}

@customElement('rozie-data-table')
export default class DataTable extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-data-table[data-rozie-s-d5dcab4c] {
  border-collapse: collapse;
  width: 100%;
  font: var(--rdt-font, 14px system-ui, sans-serif);
  color: var(--rdt-color, inherit);
}
.rdt-sr-live[data-rozie-s-d5dcab4c] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-cell-editor[data-rozie-s-d5dcab4c] {
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td[aria-invalid="true"][data-rozie-s-d5dcab4c] {
  outline: var(--rdt-invalid-outline, 2px solid #d33);
  outline-offset: -2px;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td.rdt-in-range[data-rozie-s-d5dcab4c] {
  background: var(--rdt-range-bg, rgba(37, 99, 235, 0.12));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td.rdt-cell-active[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th.rdt-cell-active[data-rozie-s-d5dcab4c] {
  outline: var(--rdt-active-cell-outline, 2px solid #2563eb);
  outline-offset: -2px;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td[data-rozie-s-d5dcab4c] {
  position: relative;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-fill-handle[data-rozie-s-d5dcab4c] {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 8px;
  height: 8px;
  background: var(--rdt-fill-handle-bg, #2563eb);
  border: 1px solid #fff;
  cursor: crosshair;
  z-index: 1;
  touch-action: none;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td[data-rozie-s-d5dcab4c] {
  padding: var(--rdt-cell-padding, 0.5rem 0.75rem);
  text-align: left;
  border-bottom: var(--rdt-border, 1px solid rgba(0, 0, 0, 0.08));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-thead[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  font-weight: var(--rdt-header-weight, 600);
  /* OPAQUE default (was rgba(0,0,0,0.03)): a translucent header lets the scrolling body
     bleed through in sticky mode. #f7f7f7 is the visual equivalent of the old 3%-black
     tint over white, but solid. The three design-system themes already ship opaque
     header backgrounds; this makes the zero-config default consistent with them. */
  background: var(--rdt-header-bg, #f7f7f7);
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
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-scroll[data-rozie-s-d5dcab4c] {
  max-height: var(--rozie-data-table-max-height);
  overflow: auto;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-group-bar-host[data-rozie-s-d5dcab4c] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rdt-group-bar-gap, 0.375rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-group-token {
  display: inline-flex;
  align-items: center;
  padding: var(--rdt-group-token-pad, 0.125rem 0.5rem);
  border-radius: var(--rdt-group-token-radius, 999px);
  background: var(--rdt-group-token-bg, rgba(0, 0, 0, 0.06));
  font-size: var(--rdt-group-token-size, 0.8125em);
}
::part(group-token) {
  display: inline-flex;
  align-items: center;
  padding: var(--rdt-group-token-pad, 0.125rem 0.5rem);
  border-radius: var(--rdt-group-token-radius, 999px);
  background: var(--rdt-group-token-bg, rgba(0, 0, 0, 0.06));
  font-size: var(--rdt-group-token-size, 0.8125em);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-group-header[data-rozie-s-d5dcab4c] {
  background: var(--rdt-group-header-bg, rgba(0, 0, 0, 0.025));
  font-weight: var(--rdt-group-header-weight, 600);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-group-toggle[data-rozie-s-d5dcab4c] {
  margin-right: var(--rdt-group-toggle-gap, 0.375rem);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-group-count[data-rozie-s-d5dcab4c] {
  margin-left: var(--rdt-group-count-gap, 0.375rem);
  opacity: var(--rdt-group-count-opacity, 0.65);
  font-weight: 400;
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
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-col-filter {
  font: inherit;
  /* border-box so the padding + border count INSIDE the declared width — without it
     the col-filter's \`width: 100%\` + padding overflows its (constrained) header cell. */
  box-sizing: border-box;
  padding: var(--rdt-filter-padding, 0.25rem 0.5rem);
  border: var(--rdt-filter-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-filter-radius, 4px);
  background: var(--rdt-filter-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-col-filter {
  display: block;
  margin-top: var(--rdt-col-filter-gap, 0.25rem);
  width: 100%;
  font-weight: normal;
}
::part(col-filter) {
  font: inherit;
  box-sizing: border-box;
  padding: var(--rdt-filter-padding, 0.25rem 0.5rem);
  border: var(--rdt-filter-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-filter-radius, 4px);
  background: var(--rdt-filter-bg, transparent);
  color: inherit;
  display: block;
  margin-top: var(--rdt-col-filter-gap, 0.25rem);
  width: 100%;
  font-weight: normal;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-filter-row[data-rozie-s-d5dcab4c] {
  background: var(--rdt-filter-row-bg, rgba(0, 0, 0, 0.015));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-filter-cell[data-rozie-s-d5dcab4c] {
  padding: var(--rdt-filter-cell-padding, 0.35rem 0.75rem);
  border-bottom: var(--rdt-border, 1px solid rgba(0, 0, 0, 0.08));
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-filter-row[data-rozie-s-d5dcab4c] .rdt-col-filter {
  font-size: var(--rdt-filter-row-input-size, 0.9em);
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
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-trigger[data-rozie-s-d5dcab4c] {
  font: inherit;
  font-size: var(--rdt-col-menu-trigger-size, 0.9em);
  line-height: 1;
  cursor: pointer;
  margin-left: var(--rdt-col-menu-trigger-margin, 0.35em);
  padding: var(--rdt-col-menu-trigger-padding, 0.15em 0.4em);
  border: var(--rdt-col-menu-trigger-border, 1px solid rgba(0, 0, 0, 0.15));
  border-radius: var(--rdt-col-menu-trigger-radius, 3px);
  background: var(--rdt-col-menu-trigger-bg, transparent);
  color: inherit;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-trigger[data-rozie-s-d5dcab4c]:hover {
  background: var(--rdt-col-menu-trigger-hover-bg, rgba(0, 0, 0, 0.06));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-trigger[data-rozie-s-d5dcab4c]:focus-visible {
  outline: var(--rdt-col-menu-trigger-focus-outline, 2px solid #2563eb);
  outline-offset: 1px;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu[data-rozie-s-d5dcab4c] {
  display: flex;
  flex-direction: column;
  gap: var(--rdt-col-menu-item-gap, 0.15rem);
  min-width: var(--rdt-col-menu-min-width, 9rem);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-item[data-rozie-s-d5dcab4c] {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  cursor: pointer;
  padding: var(--rdt-col-menu-item-padding, 0.35em 0.6em);
  border: none;
  border-radius: var(--rdt-col-menu-item-radius, 3px);
  background: none;
  color: inherit;
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-item[data-rozie-s-d5dcab4c]:hover {
  background: var(--rdt-col-menu-item-hover-bg, rgba(0, 0, 0, 0.06));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-item[aria-pressed='true'][data-rozie-s-d5dcab4c] {
  background: var(--rdt-pin-btn-active-bg, rgba(0, 0, 0, 0.1));
  font-weight: 700;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-col-menu-sep[data-rozie-s-d5dcab4c] {
  margin: var(--rdt-col-menu-sep-margin, 0.25rem 0);
  border: none;
  border-top: var(--rdt-col-menu-sep-border, 1px solid rgba(0, 0, 0, 0.1));
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
  width: var(--rdt-select-col-width, 44px);
  text-align: var(--rdt-select-col-align, center);
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-expander-th[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-expander-td[data-rozie-s-d5dcab4c] {
  width: var(--rdt-expander-col-width, 40px);
  text-align: var(--rdt-expander-col-align, center);
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-all[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-row[data-rozie-s-d5dcab4c] {
  cursor: pointer;
  accent-color: var(--rdt-select-accent, currentColor);
}
`;

  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable r-model:data="rows" :columns="cols" />
   */
  @property({ type: Array, attribute: 'data' }) _data_attr!: any[];
  private _dataControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'data-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union).
   */
  @property({ type: Array }) columns: any[] = [];
  /**
   * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
   */
  @property({ type: String, reflect: true }) selectionMode: string = 'none';
  /**
   * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
   */
  @property({ type: Array, attribute: 'sorting' }) _sorting_attr: any[] = [];
  private _sortingControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'sorting-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
   */
  @property({ type: String, attribute: 'global-filter' }) _globalFilter_attr: string = '';
  private _globalFilterControllable = createLitControllableProperty<string>({ host: this, eventName: 'global-filter-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
   */
  @property({ type: Array, attribute: 'column-filters' }) _columnFilters_attr: any[] = [];
  private _columnFiltersControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'column-filters-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
   */
  @property({ type: Object, attribute: 'pagination' }) _pagination_attr: any = {
  pageIndex: 0,
  pageSize: 10
};
  private _paginationControllable = createLitControllableProperty<any>({ host: this, eventName: 'pagination-change', defaultValue: {
  pageIndex: 0,
  pageSize: 10
}, initialControlledValue: undefined });
  /**
   * Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page).
   */
  @property({ type: Boolean, reflect: true }) manual: boolean = false;
  /**
   * Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset.
   */
  @property({ type: Number, reflect: true }) rowCount: number | null = null;
  /**
   * Explicit total page count for `manual` pagination; overrides rowCount-derived count.
   */
  @property({ type: Number, reflect: true }) pageCount: number | null = null;
  /**
   * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Bind `:expandable="true"` (a bare attr only coerces on Vue+Lit).
   */
  @property({ type: Boolean, reflect: true }) expandable: boolean = false;
  /**
   * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
   */
  @property({ type: Object, attribute: 'expanded' }) _expanded_attr: any | boolean = null;
  private _expandedControllable = createLitControllableProperty<any | boolean>({ host: this, eventName: 'expanded-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  @property({ type: Function }) getSubRows: ((...args: unknown[]) => unknown) | null = null;
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  @property({ type: Boolean, reflect: true }) groupable: boolean = false;
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
   */
  @property({ type: Array, attribute: 'grouping' }) _grouping_attr: any[] | null = null;
  private _groupingControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'grouping-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
   */
  @property({ type: Object, attribute: 'row-selection' }) _rowSelection_attr: any = {};
  private _rowSelectionControllable = createLitControllableProperty<any>({ host: this, eventName: 'row-selection-change', defaultValue: {}, initialControlledValue: undefined });
  /**
   * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
   */
  @property({ type: Object, attribute: 'column-visibility' }) _columnVisibility_attr: any = {};
  private _columnVisibilityControllable = createLitControllableProperty<any>({ host: this, eventName: 'column-visibility-change', defaultValue: {}, initialControlledValue: undefined });
  /**
   * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
   */
  @property({ type: Object, attribute: 'column-sizing' }) _columnSizing_attr: any = {};
  private _columnSizingControllable = createLitControllableProperty<any>({ host: this, eventName: 'column-sizing-change', defaultValue: {}, initialControlledValue: undefined });
  /**
   * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
   */
  @property({ type: Array, attribute: 'column-order' }) _columnOrder_attr: any[] = [];
  private _columnOrderControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'column-order-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
   */
  @property({ type: Object, attribute: 'column-pinning' }) _columnPinning_attr: any = {
  left: [],
  right: []
};
  private _columnPinningControllable = createLitControllableProperty<any>({ host: this, eventName: 'column-pinning-change', defaultValue: {
  left: [],
  right: []
}, initialControlledValue: undefined });
  /**
   * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
   */
  @property({ type: Boolean, reflect: true }) stickyHeader: boolean = false;
  /**
   * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` (GA since Phase 63) — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
   */
  @property({ type: String, reflect: true }) interactionMode: string = 'table';
  /**
   * Grid mode only. When `true`, a plain click on an **editable** cell opens its editor immediately (single-click-to-edit) instead of just activating the cell. Default `false` keeps click-to-activate (double-click opens the editor). Shift+click (range selection) and clicks on non-editable cells are unaffected.
   */
  @property({ type: Boolean, reflect: true }) singleClickEdit: boolean = false;
  /**
   * Grid mode. When `true`, every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Default `false` records no history and Ctrl+Z/Y are inert.
   */
  @property({ type: Boolean, reflect: true }) undoable: boolean = false;
  /**
   * The maximum number of undo steps retained (oldest evicted past this depth). Only consulted when `undoable` is `true`.
   */
  @property({ type: Number, reflect: true }) undoLimit: number = 100;
  /**
   * Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table.
   */
  @property({ type: Boolean, reflect: true }) virtual: boolean = false;
  /**
   * Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  @property({ type: Number, reflect: true }) estimateRowHeight: number = 40;
  /**
   * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
   */
  @property({ type: String, reflect: true }) maxHeight: string = '';
  private _dataDefault = signal<any[]>([]);
  private _sortingDefault = signal<any[]>([]);
  private _globalFilterDefault = signal('');
  private _columnFiltersDefault = signal<any[]>([]);
  private _paginationDefault = signal({
  pageIndex: 0,
  pageSize: 10
});
  private _rowSelectionDefault = signal<any>({});
  private _expandedDefault = signal<any>({});
  private _groupingDefault = signal<any[]>([]);
  private _columnVisibilityDefault = signal<any>({});
  private _columnSizingDefault = signal<any>({});
  private _columnOrderDefault = signal<any[]>([]);
  private _columnPinningDefault = signal({
  left: [],
  right: []
});
  private _columnSizingInfo = signal({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: []
});
  private _colReg = signal<any>({});
  private _rows = signal<any[]>([]);
  private _headerGroups = signal<any[]>([]);
  private _rowModelVer = signal(0);
  private _windowVer = signal(0);
  private _activeRow = signal(0);
  private _activeColIndex = signal(0);
  private _activeIsHeader = signal(false);
  private _activeHeaderLevel = signal(0);
  private _activeInControl = signal(false);
  private _editingRow = signal(-1);
  private _editingCol = signal(-1);
  private _draftValue = signal<any>(null);
  private _invalidMsg = signal('');
  private _editVer = signal(0);
  private _editingRowIndex = signal<any>(null);
  private _rowDraft = signal<any>({});
  private _rangeAnchor = signal<any>(null);
  private _rangeFocus = signal<any>(null);
  private _pasteAnnounce = signal('');
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieCtxProvider_data_table_columns = new ContextProvider(this, { context: __rozieCtx_data_table_columns, initialValue: ((__rozieCtxHost) => ({
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    __rozieCtxHost._colReg.value = {
      ...__rozieCtxHost._colReg.value,
      [key]: spec
    };
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...__rozieCtxHost._colReg.value
    };
    delete r[String(id)];
    __rozieCtxHost._colReg.value = r;
  }
}))(this) });

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @state() private _hasSlotGroupBar = false;
  @queryAssignedElements({ slot: 'groupBar', flatten: true }) private _slotGroupBarElements!: Element[];
  @property({ attribute: false }) groupBar?: (scope: { grouping: unknown; groupableColumns: unknown; applyGrouping: unknown; clearGrouping: unknown }) => unknown;
  @state() private _hasSlotSelectAll = false;
  @queryAssignedElements({ slot: 'selectAll', flatten: true }) private _slotSelectAllElements!: Element[];
  @property({ attribute: false }) selectAll?: (scope: { checked: unknown; indeterminate: unknown; toggle: unknown }) => unknown;
  @state() private _hasSlotColHeader = false;
  @queryAssignedElements({ slot: 'colHeader', flatten: true }) private _slotColHeaderElements!: Element[];
  @property({ attribute: false }) colHeader?: (scope: { columnId: unknown; column: unknown; label: unknown }) => unknown;
  @state() private _hasSlotFilter = false;
  @queryAssignedElements({ slot: 'filter', flatten: true }) private _slotFilterElements!: Element[];
  @property({ attribute: false }) filter?: (scope: { columnId: unknown; value: unknown; uniqueValues: unknown; minMax: unknown; setFilter: unknown }) => unknown;
  @state() private _hasSlotSelectCell = false;
  @queryAssignedElements({ slot: 'selectCell', flatten: true }) private _slotSelectCellElements!: Element[];
  @property({ attribute: false }) selectCell?: (scope: { row: unknown; checked: unknown; toggle: unknown }) => unknown;
  @state() private _hasSlotCell = false;
  @queryAssignedElements({ slot: 'cell', flatten: true }) private _slotCellElements!: Element[];
  @property({ attribute: false }) cell?: (scope: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => unknown;
  @state() private _hasSlotEditor = false;
  @queryAssignedElements({ slot: 'editor', flatten: true }) private _slotEditorElements!: Element[];
  @property({ attribute: false }) editor?: (scope: { columnId: unknown; column: unknown; row: unknown; value: unknown; commit: unknown; cancel: unknown }) => unknown;
  @state() private _hasSlotDetail = false;
  @queryAssignedElements({ slot: 'detail', flatten: true }) private _slotDetailElements!: Element[];
  @property({ attribute: false }) detail?: (scope: { row: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="groupBar"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotGroupBar = this._slotGroupBarElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="selectAll"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSelectAll = this._slotSelectAllElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="colHeader"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotColHeader = this._slotColHeaderElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="filter"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFilter = this._slotFilterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="selectCell"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSelectCell = this._slotSelectCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="cell"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotCell = this._slotCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="editor"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEditor = this._slotEditorElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="detail"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDetail = this._slotDetailElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotGroupBar = Array.from(this.children).some((el) => el.getAttribute('slot') === 'groupBar');
    this._hasSlotSelectAll = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selectAll');
    this._hasSlotColHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'colHeader');
    this._hasSlotFilter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'filter');
    this._hasSlotSelectCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selectCell');
    this._hasSlotCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'cell');
    this._hasSlotEditor = Array.from(this.children).some((el) => el.getAttribute('slot') === 'editor');
    this._hasSlotDetail = Array.from(this.children).some((el) => el.getAttribute('slot') === 'detail');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => [this.sorting, this.globalFilter, this.columnFilters, this.pagination, // Server-side page-count sources (#2): re-feed when the consumer's rowCount/pageCount
    // changes at runtime (e.g. a server response updates the total) so getPageCount() and the
    // Next button availability track the new total.
    this.rowCount, this.pageCount, this.rowSelection, this.expanded, this.expandable, this.grouping, this.groupable, this.columnVisibility, this.columnSizing, this.columnOrder, this.columnPinning, this.selectionMode, (this.data || []).length, // Phase 51 req-4: key on the data REFERENCE (both sinks) so a committed edit re-feeds
    // even when the fresh array is the SAME length (a single-cell edit replaces one row
    // object → new array ref, identical length → the .length key alone would miss it). The
    // controlled path observes $props.data; the uncontrolled path observes $data.dataDefault.
    // writeData is echo-guarded (programmatic) and reFeed writes neither sink, so no loop.
    this.data, this._dataDefault.value, // Column CONFIG prop (the `:columns` array form) — the sibling column source to
    // $data.colReg (the `<Column>` children). Watch it so a runtime `:columns` swap re-feeds:
    // columnDefs()/tableColumns() build the UNION of both, and reFeed re-passes columns.
    // (Consumers memoize the array as with $props.data/$props.sorting; the uncontrolled
    // <Column>-children path leaves $props.columns undefined — a stable no-op getter.)
    this.columns, this._colReg.value])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.reFeed();
    })(); }); }));

    this._disconnectCleanups.push(effect(() => { void this._colReg.value; this.__rozieCtxProvider_data_table_columns.setValue(((__rozieCtxHost) => ({
      registerColumn: (id: any, spec: any) => {
        if (id == null) return;
        const key = String(id);
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
        __rozieCtxHost._colReg.value = {
          ...__rozieCtxHost._colReg.value,
          [key]: spec
        };
      },
      unregisterColumn: (id: any) => {
        if (id == null) return;
        const r = {
          ...__rozieCtxHost._colReg.value
        };
        delete r[String(id)];
        __rozieCtxHost._colReg.value = r;
      }
    }))(this)); }));

    // Seed the uncontrolled `data` fallback (Phase 51 req-4) from the initial prop so an
    // edit committed BEFORE the consumer ever pushes new rows (or when the consumer passes
    // a one-way `:data`) has a base array to whole-array-replace. currentData() then sources
    // the bound prop when controlled, this fallback otherwise.
    this._dataDefault.value = this.data || [];
    // Build the table instance HERE so the closures below capture the live `table`.
    // Build the table instance HERE so the closures below capture the live `table`.
    this.table = createTable({
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      // currentData() = the bound prop when controlled, else the uncontrolled $data.dataDefault
      // (Phase 51 req-4 — so a committed edit's writeData re-feed is observed either way).
      data: this.currentData(),
      columns: this.tableColumns(),
      state: this.currentState(),
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
      getSubRows: (this.getSubRows || undefined) as any,
      getRowCanExpand: this.expandable === true && this.getSubRows == null ? () => true : undefined,
      onExpandedChange: this.onExpandedChangeCb,
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
      onGroupingChange: this.onGroupingChangeCb,
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
      manualPagination: this.manual === true,
      manualFiltering: this.manual === true,
      manualSorting: this.manual === true,
      // Server-side page-count sources (#2): pass the consumer-supplied total row count and/or
      // explicit page count so table-core can compute getPageCount() under `manual` (where it
      // does not hold the full dataset). undefined when unset → table-core auto-derives from the
      // loaded data (client-pagination path byte-unchanged). Precedence is table-core's: explicit
      // pageCount wins, else ⌈rowCount / pageSize⌉, else auto. With a real count getCanNextPage()
      // becomes true, so a server-pagination consumer can leave page 0.
      rowCount: this.rowCount ?? undefined,
      pageCount: this.pageCount ?? undefined,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: this.selectionMode !== 'none',
      enableMultiRowSelection: this.selectionMode === 'multiple',
      // PER-SLICE callbacks (Open-Q1: each maps 1:1 to a slice's r-model + change event,
      // no global onStateChange diff) — hoisted top-level consts, re-passed by the re-feed
      // $watch so React reads fresh currentState (the stale-closure fix, F6).
      onSortingChange: this.onSortingChangeCb,
      onGlobalFilterChange: this.onGlobalFilterChangeCb,
      onColumnFiltersChange: this.onColumnFiltersChangeCb,
      onPaginationChange: this.onPaginationChangeCb,
      onRowSelectionChange: this.onRowSelectionChangeCb,
      onColumnVisibilityChange: this.onColumnVisibilityChangeCb,
      onColumnSizingChange: this.onColumnSizingChangeCb,
      onColumnOrderChange: this.onColumnOrderChangeCb,
      onColumnPinningChange: this.onColumnPinningChangeCb,
      onColumnSizingInfoChange: this.onColumnSizingInfoChangeCb,
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
    this.refreshRowModel = () => {
      if (!this.table) return;
      // Capture fresh locals; never write a $data key then re-read it in the same fn
      // (ROZ138 / React stale-read — setState is async on React, the closure binds the
      // PRE-write value).
      // windowSource(): the FULL pre-pagination model when virtual (windowing replaces client
      // pagination, req-9), else the normal paginated row model (non-virtual path byte-unchanged).
      const nextRows = this.windowSource().slice();
      const nextGroups = this.table.getHeaderGroups().slice();
      this._rows.value = nextRows;
      this._headerGroups.value = nextGroups;
      this._rowModelVer.value = this._rowModelVer.value + 1;
      // Vertical windowing re-feed (Pitfall 2 — stale count): push the fresh full-model count
      // into the virtualizer + reconcile IMPERATIVELY here (the table.setOptions re-feed path),
      // NEVER in a render helper (Pitfall 1). Pass the COMPLETE options set (virtual-core's
      // setOptions replaces, not merges). Guarded so the off path executes no virtual-core code.
      if (this.virtual && this.virtualizer) {
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
      }
      // D-05: on every data change (re-sort/filter/paginate/page-size — all re-pull here),
      // clamp the active cell to the new bounds (same indices, clamped if the grid shrank;
      // no row-id following, no top-bounce). isGrid()-gated so 'table' mode is untouched.
      // B8/B23: pass the FRESH bounds derived from `nextRows` (NOT $data.rows, which is the
      // async-stale useState snapshot on React) so a filter-to-fewer clamps the active cell AND
      // the range corners on React too — never re-reading the pre-change model.
      const nextRowCount = nextRows.length;
      const nextColCount = nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0;
      this.clampActiveCell(nextRowCount, nextColCount);
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
      const pgState = this.table.getState().pagination;
      const pc = this.table.getPageCount();
      if (pc > 0 && pgState.pageIndex > pc - 1) {
        this.writePagination({
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
      if (this.pendingEditFollow && this.isGrid()) {
        const follow = this.pendingEditFollow;
        this.pendingEditFollow = null;
        const followIdx = this.indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
        if (followIdx >= 0) this.focusCellWhenReady(followIdx, follow.col);
      }
      // keep the select-all checkbox's `indeterminate` DOM property in lockstep with the
      // selection state (bound :indeterminate is inert on 5/6 targets). The box persists
      // across selection changes; a microtask defer covers React's post-render DOM patch.
      this.syncIndeterminate();
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(this.syncIndeterminate);else Promise.resolve().then(this.syncIndeterminate);
    };

    // initial pull
    // initial pull
    this.refreshRowModel();

    // ── Grid mode: capture the table root ──────────────────────────────────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean.
    // ── Grid mode: capture the table root ──────────────────────────────────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean.
    this.gridRoot = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-data-table') : null;
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
    if (this.virtual) {
      this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rdt-scroll') : null;
      this.virtualizer = new Virtualizer(this.virtualizerOptions());
      this.virtualizerCleanup = this.virtualizer._didMount();
      // FINE-GRAINED FIRST-WINDOW KICK (Solid/Svelte): the windowed <For>/{#each} accessor was first
      // evaluated at initial render — while `virtualizer` was still null — and (because windowedRows()
      // reads $data.windowVer up top) subscribed to windowVer then returned []. `virtualizer` is a
      // non-reactive `let`, so its assignment above does NOT notify the accessor; we must bump the
      // SIGNAL it subscribed to. _didMount() computes the first window synchronously but its onChange
      // only fires on SUBSEQUENT scroll/resize, so without this explicit bump the first window would
      // never paint on the fine-grained targets. Idempotent + harmless on the coarse targets (they
      // re-render wholesale anyway). One bump = one re-run that now sees the non-null virtualizer and
      // pulls getVirtualItems().
      this._windowVer.value = this._windowVer.value + 1;
      // After the first window commits (next frame), refine heights + fire the dev-mode warns
      // ONCE. Entirely inside the $props.virtual guard so the virtual=false emitted path adds NO
      // code and these warns can never fire there (req-1 byte-identical-off preserved).
      const afterFirstFrame = () => {
        // D-10: measure the rendered rows.
        this.remeasureWindow();
        // D-08/A1: a dev-mode runtime warn when the scroll container has no bounded height (the
        // bound may come from consumer CSS the compiler can't see — no compile diagnostic). No
        // process.env guard (not bundler-portable); always-warn-on-misconfig is acceptable.
        const h = this.gridScrollEl ? this.gridScrollEl.clientHeight : 0;
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
        const pg = this.pagination;
        const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
        if (this.manual !== true && pgConfigured) {
          console.warn('[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.');
        }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));else setTimeout(afterFirstFrame, 0);
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (!this.table) return;
    // Phase 51 req-4: track currentData() (the bound prop OR the uncontrolled
    // $data.dataDefault) so a committed edit re-feeds on Lit whether or not r-model:data is
    // bound. Compare by reference AND length so a same-length single-cell edit (fresh array,
    // identical length) still re-feeds.
    // Phase 51 req-4: track currentData() (the bound prop OR the uncontrolled
    // $data.dataDefault) so a committed edit re-feeds on Lit whether or not r-model:data is
    // bound. Compare by reference AND length so a same-length single-cell edit (fresh array,
    // identical length) still re-feeds.
    const d = this.currentData() || [];
    if (d === this.lastData && d.length === this.lastDataLen) return;
    this.lastData = d;
    this.lastDataLen = d.length;
    this.reFeed();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      () => {
        if (this.virtualizerCleanup) this.virtualizerCleanup();
        // CR-04: remove any live fill-drag document listeners if we unmount mid-drag.
        this.teardownFillDrag();
        // §6 (260709-3qt): remove any live drag-select document listeners on a mid-drag unmount.
        this.teardownRangeDrag();
      };
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'data') this._dataControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'sorting') this._sortingControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'global-filter') this._globalFilterControllable.notifyAttributeChange(value as unknown as string);
    if (name === 'column-filters') this._columnFiltersControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'pagination') this._paginationControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'expanded') this._expandedControllable.notifyAttributeChange(value as unknown as any | boolean);
    if (name === 'grouping') this._groupingControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'row-selection') this._rowSelectionControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'column-visibility') this._columnVisibilityControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'column-sizing') this._columnSizingControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'column-order') this._columnOrderControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'column-pinning') this._columnPinningControllable.notifyAttributeChange(value as unknown as any);
  }

  render() {
    return html`

<div class="rozie-data-table-wrap" data-rozie-ref="__rozieRoot" data-rozie-s-d5dcab4c>

<div class="rdt-column-defs" style="display:none" aria-hidden="true" data-rozie-s-d5dcab4c><slot></slot></div>

${!!this._invalidMsg.value ? html`<div class="rdt-sr-live" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c>${this._invalidMsg.value}</div>` : nothing}${!!this._pasteAnnounce.value ? html`<div class="rdt-sr-live rdt-sr-paste" data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c>${this._pasteAnnounce.value}</div>` : nothing}<div class="rdt-toolbar" data-rozie-s-d5dcab4c>
  <input class="rdt-global-filter" type="text" role="searchbox" aria-label="Search table" .value=${this.globalFilterValue()} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onGlobalFilterInput($event); }} data-rozie-s-d5dcab4c />
  
  ${this.allLeafColumns().length ? html`<details class="rdt-colvis" data-rozie-s-d5dcab4c>
    <summary class="rdt-colvis-summary" data-rozie-s-d5dcab4c>Columns</summary>
    <div class="rdt-colvis-menu" role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c>
      ${repeat<any>(this.allLeafColumns(), (lc, _idx) => lc.id, (lc, _idx) => html`<label class="rdt-colvis-item" key=${rozieAttr(lc.id)} data-rozie-s-d5dcab4c>
        <input class="rdt-colvis-checkbox" type="checkbox" ?checked=${lc.visible} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onToggleVisibility(lc.id); }} data-rozie-s-d5dcab4c />
        <span class="rdt-colvis-label" data-rozie-s-d5dcab4c>${rozieDisplay(lc.label)}</span>
      </label>`)}
    </div>
  </details>` : nothing}</div>


${this.groupable ? html`<div class="rdt-group-bar-host" data-rozie-s-d5dcab4c>
  ${this.groupBar !== undefined ? this.groupBar({grouping: this.groupingKeys(), groupableColumns: this.groupableColumns(), applyGrouping: this.applyGrouping, clearGrouping: this.clearGrouping}) : html`<slot name="groupBar" data-rozie-params=${(() => { try { return JSON.stringify({grouping: this.groupingKeys(), groupableColumns: this.groupableColumns()}); } catch { return '{}'; } })()} @rozie-group-bar-apply-grouping=${($event: CustomEvent) => ((this.applyGrouping) as (...args: any[]) => any)($event.detail)} @rozie-group-bar-clear-grouping=${($event: CustomEvent) => ((this.clearGrouping) as (...args: any[]) => any)($event.detail)}>
    ${repeat<any>(this.groupingKeys(), (gk, _idx) => gk, (gk, _idx) => html`<span class="rdt-group-token" data-group-token="" key=${rozieAttr(gk)} data-rozie-s-d5dcab4c>${rozieDisplay(gk)}</span>`)}
  </slot>`}
</div>` : nothing}${this.virtual ? html`<div class="rdt-scroll" style=${rozieStyle(this.maxHeight ? 'max-height:' + this.maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + this.maxHeight : 'overflow:auto')} data-rozie-s-d5dcab4c>
<table class="${Object.entries({ "rozie-data-table": true, 'rdt-sticky': this.stickyHeader }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role=${rozieAttr(this.tableRole())} aria-rowcount=${rozieAttr(this.gridAriaRowCount())} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridKeyDown($event); }} @focusin=${($event: Event & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.syncActiveFromEvent($event); }} @focusout=${($event: Event & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridFocusOut($event); }} @mousedown=${($event: MouseEvent & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridMouseDown($event); }} @dblclick=${($event: Event & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridDblClick($event); }} @click=${($event: MouseEvent & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridClick($event); }} data-rozie-s-d5dcab4c>
  <thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat<any>(this._headerGroups.value, (hg, hgLevel) => hg.id, (hg, hgLevel) => html`<tr class="rdt-tr" role="row" key=${rozieAttr(hg.id)} aria-rowindex=${rozieAttr(hgLevel + 1)} data-rozie-s-d5dcab4c>
      ${repeat<any>(hg.headers, (header, _idx) => header.id, (header, _idx) => html`<th class="${Object.entries({ "rdt-th": true, 'rdt-select-th': this.isSelectColumn(header.column.id), 'rdt-expander-th': this.isExpanderColumn(header.column.id), 'rdt-th-resizing': this.columnIsResizing(header.column.id), 'rdt-cell-active': this.isActiveCell('__header', this.headerColIndexOf(hg, header), hgLevel) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="columnheader" key=${rozieAttr(header.id)} data-col=${rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level=${rozieAttr(hgLevel)} colspan=${rozieAttr(header.colSpan > 1 ? header.colSpan : null)} data-col-index=${rozieAttr(this.headerColIndexOf(hg, header))} tabindex=${rozieAttr(this.cellTabindex('__header', this.headerColIndexOf(hg, header), hgLevel))} aria-sort=${rozieAttr(this.ariaSortFor(header.column.id))} style=${rozieStyle(this.thStyle(header.column.id))} data-rozie-s-d5dcab4c>
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectAll !== undefined ? this.selectAll({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected(), toggle: this.onToggleAllRows}) : html`<slot name="selectAll" data-rozie-params=${(() => { try { return JSON.stringify({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected()}); } catch { return '{}'; } })()} @rozie-select-all-toggle=${($event: CustomEvent) => ((this.onToggleAllRows) as (...args: any[]) => any)($event.detail)}>
            ${this.selectionMode === 'multiple' ? html`<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" ?checked=${this.isAllRowsSelected()} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onToggleAllRows($event); }} data-rozie-s-d5dcab4c />` : nothing}</slot>`}
        </span>` : this.isExpanderColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${header.column.getCanSort && header.column.getCanSort() ? html`<button class="rdt-sort-btn" type="button" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.colHeader !== undefined ? this.colHeader({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}) : html`<slot name="colHeader" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}); } catch { return '{}'; } })()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
            </span>
            <span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>${rozieDisplay(this.sortIndicator(header.column.id))}</span>
          </button>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.colHeader !== undefined ? this.colHeader({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}) : html`<slot name="colHeader" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}); } catch { return '{}'; } })()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
            </span>
          </span>`}<rozie-popover trigger="click" placement="bottom-end" strategy="fixed" .offset=${4} data-rozie-s-d5dcab4c><button class="rdt-col-menu-trigger" type="button" aria-label=${rozieAttr('Column options for ' + this.headerLabel(header.column.id))} data-rozie-s-d5dcab4c slot="anchor">⋯</button><div class="rdt-col-menu" role="menu" data-rozie-s-d5dcab4c>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(header.column.id) === 'left'} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c>Pin left</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(header.column.id) === 'right'} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c>Pin right</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${!this.columnPinSide(header.column.id)} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c>Unpin</button>
              <hr class="rdt-col-menu-sep" data-rozie-s-d5dcab4c />
              <button class="rdt-col-menu-item" type="button" role="menuitem" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onHideColumn(header.column.id, $event); }} data-rozie-s-d5dcab4c>Hide column</button>
            </div></rozie-popover>
          <button class="rdt-resize-handle" type="button" aria-label=${rozieAttr('Resize ' + this.headerLabel(header.column.id))} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onResizeStart(header.column.id, $event); }} @touchstart=${($event: TouchEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button>
        </span>`}</th>`)}
    </tr>`)}
    
    ${this.hasAnyFilterableColumn() ? html`<tr class="rdt-filter-row" data-rozie-s-d5dcab4c>
      ${repeat<any>(this._headerGroups.value[this._headerGroups.value.length - 1].headers, (header, _idx) => header.id, (header, _idx) => html`<th class="rdt-filter-cell" role="presentation" key=${rozieAttr(header.id)} style=${rozieStyle(this.pinStyle(header.column.id))} data-rozie-s-d5dcab4c>
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : this.isExpanderColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.columnIsFilterable(header.column.id) && !this.hasFilterSlot() ? html`<input class="rdt-col-filter" type="text" aria-label=${rozieAttr('Filter ' + this.headerLabel(header.column.id))} .value=${this.columnFilterValue(header.column.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onColumnFilterInput(header.column.id, $event); }} @click=${($event: MouseEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.stopEvent($event); }} data-rozie-s-d5dcab4c />` : nothing}${this.columnIsFilterable(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.filter !== undefined ? this.filter({columnId: header.column.id, value: this.columnFilterValue(header.column.id), uniqueValues: this.getFacetedUniqueValues(header.column.id), minMax: this.getFacetedMinMaxValues(header.column.id), setFilter: this.setColumnFilter}) : html`<slot name="filter" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, value: this.columnFilterValue(header.column.id), uniqueValues: this.getFacetedUniqueValues(header.column.id), minMax: this.getFacetedMinMaxValues(header.column.id)}); } catch { return '{}'; } })()} @rozie-filter-set-filter=${($event: CustomEvent) => ((this.setColumnFilter) as (...args: any[]) => any)($event.detail)}></slot>`}
          </span>` : nothing}</span>`}</th>`)}
    </tr>` : nothing}</thead>

  <tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>
    
    <tr class="rdt-spacer" aria-hidden="true" data-rozie-s-d5dcab4c>
      <td colspan=${rozieAttr(this.visibleColCount())} style=${rozieStyle('height:' + this.padTop() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c></td>
    </tr>
    
    ${repeat<any>(this.windowedRows(), (wr, _idx) => wr.row.id, (wr, _idx) => html`
    <tr class="${Object.entries({ "rdt-tr": true, 'rdt-group-header': this.rowIsGrouped(wr.row), 'rdt-row-pinned': wr.pinned }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="row" data-row=${rozieAttr(wr.vi.index)} aria-rowindex=${rozieAttr(this.headerRowCount() + wr.vi.index + 1)} data-index=${rozieAttr(wr.vi.index)} data-pinned=${rozieAttr(wr.pinned ? 'true' : null)} data-depth=${rozieAttr(wr.row.depth)} data-group-header=${rozieAttr(this.rowIsGrouped(wr.row) ? wr.row.id : null)} data-group-leaf=${rozieAttr(this.groupingActive() && !this.rowIsGrouped(wr.row) ? wr.row.id : null)} aria-expanded=${rozieAttr(this.rowIsGrouped(wr.row) ? !!this.rowIsExpanded(wr.row) : null)} aria-level=${rozieAttr(this.groupingActive() ? wr.row.depth + 1 : null)} data-rozie-s-d5dcab4c>
      ${repeat<any>(this.visibleCellsFor(wr.row), (cell, _idx) => cell.id, (cell, _idx) => html`<td class="${Object.entries({ "rdt-td": true, 'rdt-select-td': this.isSelectColumn(cell.column.id), 'rdt-expander-td': this.isExpanderColumn(cell.column.id), 'rdt-in-range': this.inRange(wr.vi.index, this.colIndexOf(wr.row, cell)), 'rdt-cell-active': this.isActiveCell(String(wr.vi.index), this.colIndexOf(wr.row, cell)) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role=${rozieAttr(this.cellRole())} key=${rozieAttr(cell.id)} data-col=${rozieAttr(cell.column.id)} data-grid-cell="" data-row=${rozieAttr(wr.vi.index)} data-col-index=${rozieAttr(this.colIndexOf(wr.row, cell))} tabindex=${rozieAttr(this.cellTabindex(String(wr.vi.index), this.colIndexOf(wr.row, cell)))} style=${rozieStyle(this.bodyCellStyle(wr.row, cell.column.id))} aria-invalid=${rozieAttr(this.cellAriaInvalid(wr.vi.index, this.colIndexOf(wr.row, cell)))} data-in-range=${rozieAttr(this.inRange(wr.vi.index, this.colIndexOf(wr.row, cell)) ? 'true' : null)} data-agg-cell=${rozieAttr(this.cellIsAggregated(cell) ? cell.column.id : null)} data-rozie-s-d5dcab4c>
        
        ${this.isExpanderColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.rowCanExpand(wr.row) ? html`<button class="rdt-expander" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(wr.row)} aria-label=${rozieAttr(this.rowIsExpanded(wr.row) ? 'Collapse row' : 'Expand row')} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onToggleExpand(wr.row, $event); }} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(wr.row) ? '▾' : '▸')}</button>` : nothing}</span>` : this.isSelectColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectCell !== undefined ? this.selectCell({row: wr.row.original, checked: this.rowIsSelected(wr.row), toggle: e => this.onToggleRow(wr.row, e)}) : html`<slot name="selectCell" data-rozie-params=${(() => { try { return JSON.stringify({row: wr.row.original, checked: this.rowIsSelected(wr.row)}); } catch { return '{}'; } })()} @rozie-select-cell-toggle=${($event: CustomEvent) => ((e => this.onToggleRow(wr.row, e)) as (...args: any[]) => any)($event.detail)}>
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" ?checked=${this.rowIsSelected(wr.row)} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c />
          </slot>`}
        </span>` : this.cellIsGrouped(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          <button class="rdt-expander rdt-group-toggle" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(wr.row)} aria-label=${rozieAttr(this.rowIsExpanded(wr.row) ? 'Collapse group' : 'Expand group')} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onToggleExpand(wr.row, $event); }} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(wr.row) ? '▾' : '▸')}</button>
          <span class="rdt-group-value" data-rozie-s-d5dcab4c>
            ${this.cell !== undefined ? this.cell({columnId: cell.column.id, column: cell.column, row: wr.row.original, value: cell.getValue()}) : html`<slot name="cell" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cell.column.id, column: cell.column, row: wr.row.original, value: cell.getValue()}); } catch { return '{}'; } })()}>${rozieDisplay(cell.getValue())}</slot>`}
          </span>
          <span class="rdt-group-count" data-rozie-s-d5dcab4c>${rozieDisplay('(' + this.groupSubRowCount(wr.row) + ')')}</span>
        </span>` : this.isEditing(wr.vi.index, this.colIndexOf(wr.row, cell)) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.hasEditorSlot(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.editor !== undefined ? this.editor({columnId: cell.column.id, column: cell.column, row: wr.row.original, value: this.editorValueFor(cell.column.id), commit: this.editorCommitFor(cell.column.id), cancel: this.editorCancelFor()}) : html`<slot name="editor" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cell.column.id, column: cell.column, row: wr.row.original, value: this.editorValueFor(cell.column.id), commit: this.editorCommitFor(cell.column.id), cancel: this.editorCancelFor()}); } catch { return '{}'; } })()}></slot>`}
          </span>` : this.editorTypeOf(cell.column.id) === 'number' ? html`<input class="rdt-cell-editor" type="number" data-editing-cell="" .value=${this.editorValueFor(cell.column.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onCellEditorInput(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c />` : this.editorTypeOf(cell.column.id) === 'select' ? html`<select class="rdt-cell-editor" data-editing-cell="" .value=${this.editorValueFor(cell.column.id)} @change=${($event: Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onCellEditorInput(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c>
            ${repeat<any>(this.editorOptionsOf(cell.column.id), (opt, _idx) => opt.value, (opt, _idx) => html`<option key=${rozieAttr(opt.value)} value=${rozieAttr(opt.value)} data-rozie-s-d5dcab4c>${rozieDisplay(opt.label)}</option>`)}
          </select>` : this.editorTypeOf(cell.column.id) === 'checkbox' ? html`<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" ?checked=${this.editorCheckedFor(cell.column.id)} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onCellEditorCheckbox(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c />` : html`<input class="rdt-cell-editor" type="text" data-editing-cell="" .value=${this.editorValueFor(cell.column.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onCellEditorInput(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c />`}</span>` : this.cellIsPlaceholder(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-cell-value" data-rozie-s-d5dcab4c>
          ${this.cell !== undefined ? this.cell({columnId: cell.column.id, column: cell.column, row: wr.row.original, value: cell.getValue()}) : html`<slot name="cell" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cell.column.id, column: cell.column, row: wr.row.original, value: cell.getValue()}); } catch { return '{}'; } })()}>${rozieDisplay(cell.getValue())}</slot>`}
        </span>`}${this.isFillHandleCell(wr.vi.index, this.colIndexOf(wr.row, cell)) ? html`<span class="rdt-fill-handle" data-fill-handle="" data-testid="fill-handle" aria-hidden="true" @pointerdown=${($event: PointerEvent & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c></span>` : nothing}</td>`)}
    </tr>
    
    ${this.rowShowsDetail(wr.row) ? html`<tr class="rdt-detail-row" role="row" data-detail-row=${rozieAttr(wr.row.id)} data-rozie-s-d5dcab4c>
      <td class="rdt-detail-cell" colspan=${rozieAttr(this.visibleColCount())} data-rozie-s-d5dcab4c>
        ${this.detail !== undefined ? this.detail({row: wr.row.original}) : html`<slot name="detail" data-rozie-params=${(() => { try { return JSON.stringify({row: wr.row.original}); } catch { return '{}'; } })()}></slot>`}
      </td>
    </tr>` : nothing}`)}
    
    <tr class="rdt-spacer" aria-hidden="true" data-rozie-s-d5dcab4c>
      <td colspan=${rozieAttr(this.visibleColCount())} style=${rozieStyle('height:' + this.padBottom() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c></td>
    </tr>
  </tbody>
</table>
</div>` : html`<table class="${Object.entries({ "rozie-data-table": true, 'rdt-sticky': this.stickyHeader }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role=${rozieAttr(this.tableRole())} aria-rowcount=${rozieAttr(this.gridAriaRowCount())} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridKeyDown($event); }} @focusin=${($event: Event & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.syncActiveFromEvent($event); }} @focusout=${($event: Event & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridFocusOut($event); }} @mousedown=${($event: MouseEvent & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridMouseDown($event); }} @dblclick=${($event: Event & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridDblClick($event); }} @click=${($event: MouseEvent & { currentTarget: HTMLTableElement; target: HTMLTableElement }) => { this.onGridClick($event); }} data-rozie-s-d5dcab4c>
  <thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat<any>(this._headerGroups.value, (hg, hgLevel) => hg.id, (hg, hgLevel) => html`<tr class="rdt-tr" role="row" key=${rozieAttr(hg.id)} aria-rowindex=${rozieAttr(hgLevel + 1)} data-rozie-s-d5dcab4c>
      ${repeat<any>(hg.headers, (header, _idx) => header.id, (header, _idx) => html`<th class="${Object.entries({ "rdt-th": true, 'rdt-select-th': this.isSelectColumn(header.column.id), 'rdt-expander-th': this.isExpanderColumn(header.column.id), 'rdt-th-resizing': this.columnIsResizing(header.column.id), 'rdt-cell-active': this.isActiveCell('__header', this.headerColIndexOf(hg, header), hgLevel) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="columnheader" key=${rozieAttr(header.id)} data-col=${rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level=${rozieAttr(hgLevel)} colspan=${rozieAttr(header.colSpan > 1 ? header.colSpan : null)} data-col-index=${rozieAttr(this.headerColIndexOf(hg, header))} tabindex=${rozieAttr(this.cellTabindex('__header', this.headerColIndexOf(hg, header), hgLevel))} aria-sort=${rozieAttr(this.ariaSortFor(header.column.id))} style=${rozieStyle(this.thStyle(header.column.id))} data-rozie-s-d5dcab4c>
        
        
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectAll !== undefined ? this.selectAll({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected(), toggle: this.onToggleAllRows}) : html`<slot name="selectAll" data-rozie-params=${(() => { try { return JSON.stringify({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected()}); } catch { return '{}'; } })()} @rozie-select-all-toggle=${($event: CustomEvent) => ((this.onToggleAllRows) as (...args: any[]) => any)($event.detail)}>
            
            ${this.selectionMode === 'multiple' ? html`<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" ?checked=${this.isAllRowsSelected()} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onToggleAllRows($event); }} data-rozie-s-d5dcab4c />` : nothing}</slot>`}
        </span>` : this.isExpanderColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          
          ${header.column.getCanSort && header.column.getCanSort() ? html`<button class="rdt-sort-btn" type="button" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c>
            
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.colHeader !== undefined ? this.colHeader({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}) : html`<slot name="colHeader" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}); } catch { return '{}'; } })()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
            </span>
            <span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>${rozieDisplay(this.sortIndicator(header.column.id))}</span>
          </button>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.colHeader !== undefined ? this.colHeader({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}) : html`<slot name="colHeader" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}); } catch { return '{}'; } })()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
            </span>
          </span>`}<rozie-popover trigger="click" placement="bottom-end" strategy="fixed" .offset=${4} data-rozie-s-d5dcab4c><button class="rdt-col-menu-trigger" type="button" aria-label=${rozieAttr('Column options for ' + this.headerLabel(header.column.id))} data-rozie-s-d5dcab4c slot="anchor">⋯</button><div class="rdt-col-menu" role="menu" data-rozie-s-d5dcab4c>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(header.column.id) === 'left'} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c>Pin left</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(header.column.id) === 'right'} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c>Pin right</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${!this.columnPinSide(header.column.id)} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c>Unpin</button>
              <hr class="rdt-col-menu-sep" data-rozie-s-d5dcab4c />
              <button class="rdt-col-menu-item" type="button" role="menuitem" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onHideColumn(header.column.id, $event); }} data-rozie-s-d5dcab4c>Hide column</button>
            </div></rozie-popover>
          
          <button class="rdt-resize-handle" type="button" aria-label=${rozieAttr('Resize ' + this.headerLabel(header.column.id))} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onResizeStart(header.column.id, $event); }} @touchstart=${($event: TouchEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button>
        </span>`}</th>`)}
    </tr>`)}
    
    ${this.hasAnyFilterableColumn() ? html`<tr class="rdt-filter-row" data-rozie-s-d5dcab4c>
      ${repeat<any>(this._headerGroups.value[this._headerGroups.value.length - 1].headers, (header, _idx) => header.id, (header, _idx) => html`<th class="rdt-filter-cell" role="presentation" key=${rozieAttr(header.id)} style=${rozieStyle(this.pinStyle(header.column.id))} data-rozie-s-d5dcab4c>
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : this.isExpanderColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.columnIsFilterable(header.column.id) && !this.hasFilterSlot() ? html`<input class="rdt-col-filter" type="text" aria-label=${rozieAttr('Filter ' + this.headerLabel(header.column.id))} .value=${this.columnFilterValue(header.column.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onColumnFilterInput(header.column.id, $event); }} @click=${($event: MouseEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.stopEvent($event); }} data-rozie-s-d5dcab4c />` : nothing}${this.columnIsFilterable(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.filter !== undefined ? this.filter({columnId: header.column.id, value: this.columnFilterValue(header.column.id), uniqueValues: this.getFacetedUniqueValues(header.column.id), minMax: this.getFacetedMinMaxValues(header.column.id), setFilter: this.setColumnFilter}) : html`<slot name="filter" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, value: this.columnFilterValue(header.column.id), uniqueValues: this.getFacetedUniqueValues(header.column.id), minMax: this.getFacetedMinMaxValues(header.column.id)}); } catch { return '{}'; } })()} @rozie-filter-set-filter=${($event: CustomEvent) => ((this.setColumnFilter) as (...args: any[]) => any)($event.detail)}></slot>`}
          </span>` : nothing}</span>`}</th>`)}
    </tr>` : nothing}</thead>

  <tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>
    
    ${repeat<any>(this._rows.value, (row, _idx) => row.id, (row, _idx) => html`
    <tr class="${Object.entries({ "rdt-tr": true, 'rdt-group-header': this.rowIsGrouped(row) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="row" data-depth=${rozieAttr(row.depth)} aria-rowindex=${rozieAttr(this.bodyAriaRowIndex(row))} data-group-header=${rozieAttr(this.rowIsGrouped(row) ? row.id : null)} data-group-leaf=${rozieAttr(this.groupingActive() && !this.rowIsGrouped(row) ? row.id : null)} aria-expanded=${rozieAttr(this.rowIsGrouped(row) ? !!this.rowIsExpanded(row) : null)} aria-level=${rozieAttr(this.groupingActive() ? row.depth + 1 : null)} data-rozie-s-d5dcab4c>
      ${repeat<any>(this.visibleCellsFor(row), (cell, _idx) => cell.id, (cell, _idx) => html`<td class="${Object.entries({ "rdt-td": true, 'rdt-select-td': this.isSelectColumn(cell.column.id), 'rdt-expander-td': this.isExpanderColumn(cell.column.id), 'rdt-in-range': this.inRange(this.rowIndexOf(row), this.colIndexOf(row, cell)), 'rdt-cell-active': this.isActiveCell(String(this.rowIndexOf(row)), this.colIndexOf(row, cell)) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role=${rozieAttr(this.cellRole())} key=${rozieAttr(cell.id)} data-col=${rozieAttr(cell.column.id)} data-grid-cell="" data-row=${rozieAttr(this.rowIndexOf(row))} data-col-index=${rozieAttr(this.colIndexOf(row, cell))} tabindex=${rozieAttr(this.cellTabindex(String(this.rowIndexOf(row)), this.colIndexOf(row, cell)))} style=${rozieStyle(this.bodyCellStyle(row, cell.column.id))} aria-invalid=${rozieAttr(this.cellAriaInvalid(this.rowIndexOf(row), this.colIndexOf(row, cell)))} data-in-range=${rozieAttr(this.inRange(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? 'true' : null)} data-agg-cell=${rozieAttr(this.cellIsAggregated(cell) ? cell.column.id : null)} data-rozie-s-d5dcab4c>
        
        ${this.isExpanderColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.rowCanExpand(row) ? html`<button class="rdt-expander" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(row)} aria-label=${rozieAttr(this.rowIsExpanded(row) ? 'Collapse row' : 'Expand row')} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(row) ? '▾' : '▸')}</button>` : nothing}</span>` : this.isSelectColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectCell !== undefined ? this.selectCell({row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e)}) : html`<slot name="selectCell" data-rozie-params=${(() => { try { return JSON.stringify({row: row.original, checked: this.rowIsSelected(row)}); } catch { return '{}'; } })()} @rozie-select-cell-toggle=${($event: CustomEvent) => ((e => this.onToggleRow(row, e)) as (...args: any[]) => any)($event.detail)}>
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" ?checked=${this.rowIsSelected(row)} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onToggleRow(row, $event); }} data-rozie-s-d5dcab4c />
          </slot>`}
        </span>` : this.cellIsGrouped(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          <button class="rdt-expander rdt-group-toggle" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(row)} aria-label=${rozieAttr(this.rowIsExpanded(row) ? 'Collapse group' : 'Expand group')} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(row) ? '▾' : '▸')}</button>
          <span class="rdt-group-value" data-rozie-s-d5dcab4c>
            ${this.cell !== undefined ? this.cell({columnId: cell.column.id, column: cell.column, row: row.original, value: cell.getValue()}) : html`<slot name="cell" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cell.column.id, column: cell.column, row: row.original, value: cell.getValue()}); } catch { return '{}'; } })()}>${rozieDisplay(cell.getValue())}</slot>`}
          </span>
          <span class="rdt-group-count" data-rozie-s-d5dcab4c>${rozieDisplay('(' + this.groupSubRowCount(row) + ')')}</span>
        </span>` : this.isEditing(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.hasEditorSlot(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.editor !== undefined ? this.editor({columnId: cell.column.id, column: cell.column, row: row.original, value: this.editorValueFor(cell.column.id), commit: this.editorCommitFor(cell.column.id), cancel: this.editorCancelFor()}) : html`<slot name="editor" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cell.column.id, column: cell.column, row: row.original, value: this.editorValueFor(cell.column.id), commit: this.editorCommitFor(cell.column.id), cancel: this.editorCancelFor()}); } catch { return '{}'; } })()}></slot>`}
          </span>` : this.editorTypeOf(cell.column.id) === 'number' ? html`<input class="rdt-cell-editor" type="number" data-editing-cell="" .value=${this.editorValueFor(cell.column.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onCellEditorInput(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c />` : this.editorTypeOf(cell.column.id) === 'select' ? html`<select class="rdt-cell-editor" data-editing-cell="" .value=${this.editorValueFor(cell.column.id)} @change=${($event: Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onCellEditorInput(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c>
            ${repeat<any>(this.editorOptionsOf(cell.column.id), (opt, _idx) => opt.value, (opt, _idx) => html`<option key=${rozieAttr(opt.value)} value=${rozieAttr(opt.value)} data-rozie-s-d5dcab4c>${rozieDisplay(opt.label)}</option>`)}
          </select>` : this.editorTypeOf(cell.column.id) === 'checkbox' ? html`<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" ?checked=${this.editorCheckedFor(cell.column.id)} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onCellEditorCheckbox(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c />` : html`<input class="rdt-cell-editor" type="text" data-editing-cell="" .value=${this.editorValueFor(cell.column.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onCellEditorInput(cell.column.id, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorKeyDown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onEditorBlur($event); }} data-rozie-s-d5dcab4c />`}</span>` : this.cellIsPlaceholder(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-cell-value" data-rozie-s-d5dcab4c>
          ${this.cell !== undefined ? this.cell({columnId: cell.column.id, column: cell.column, row: row.original, value: cell.getValue()}) : html`<slot name="cell" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cell.column.id, column: cell.column, row: row.original, value: cell.getValue()}); } catch { return '{}'; } })()}>${rozieDisplay(cell.getValue())}</slot>`}
        </span>`}${this.isFillHandleCell(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? html`<span class="rdt-fill-handle" data-fill-handle="" data-testid="fill-handle" aria-hidden="true" @pointerdown=${($event: PointerEvent & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c></span>` : nothing}</td>`)}
    </tr>
    
    ${this.rowShowsDetail(row) ? html`<tr class="rdt-detail-row" role="row" data-detail-row=${rozieAttr(row.id)} data-rozie-s-d5dcab4c>
      <td class="rdt-detail-cell" colspan=${rozieAttr(this.visibleColCount())} data-rozie-s-d5dcab4c>
        ${this.detail !== undefined ? this.detail({row: row.original}) : html`<slot name="detail" data-rozie-params=${(() => { try { return JSON.stringify({row: row.original}); } catch { return '{}'; } })()}></slot>`}
      </td>
    </tr>` : nothing}`)}
  </tbody>
</table>`}${!this.virtual ? html`<div class="rdt-pagination" role="group" aria-label="Pagination" data-rozie-s-d5dcab4c>
  <button class="rdt-page-btn rdt-page-prev" type="button" ?disabled=${!this.canPrevPage()} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onPrevPage(); }} data-rozie-s-d5dcab4c>Prev</button>
  <span class="rdt-page-status" aria-live="polite" data-rozie-s-d5dcab4c>
    ${rozieDisplay('Page ' + (this.pageIndex() + 1) + ' of ' + this.displayPageCount())}
  </span>
  <button class="rdt-page-btn rdt-page-next" type="button" ?disabled=${!this.canNextPage()} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onNextPage(); }} data-rozie-s-d5dcab4c>Next</button>
  <select class="rdt-page-size" aria-label="Rows per page" .value=${this.pageSize()} @change=${($event: Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onPageSizeChange($event); }} data-rozie-s-d5dcab4c>
    <option value=${10} data-rozie-s-d5dcab4c>10</option>
    <option value=${25} data-rozie-s-d5dcab4c>25</option>
    <option value=${50} data-rozie-s-d5dcab4c>50</option>
    <option value=${100} data-rozie-s-d5dcab4c>100</option>
  </select>
</div>` : nothing}</div>
`;
  }

  table: any = null;

  virtualizer: any = null;

  virtualizerCleanup: any = null;

  gridScrollEl: any = null;

  remeasurePending = false;

  GRID_PAGE_STEP = 10;

  gridRoot: any = null;

  programmatic = 0;

  focusIntentEpoch = 0;

  undoStack: unknown[] = [];

  redoStack: unknown[] = [];

  restoringHistory: boolean = false;

  dataWriteSettling: boolean = false;

  dataWriteSettleHandle: ReturnType<typeof setTimeout> | null = null;

  expandedTouched = false;

  groupingActiveDefault = () => ((this.grouping != null ? this.grouping : this._groupingDefault.value) || []).length > 0;

  effectiveColumnPinning = (): any => {
  const base = this.columnPinning != null ? this.columnPinning : this._columnPinningDefault.value;
  const rail: string[] = [];
  if (this.selectionEnabled()) rail.push(this.SELECT_COL_ID);
  if (this.expandable === true) rail.push(this.EXPANDER_COL_ID);
  if (rail.length === 0) return base;
  const left = base && base.left ? base.left : [];
  const deduped = left.filter((id: string) => id !== this.SELECT_COL_ID && id !== this.EXPANDER_COL_ID);
  return {
    ...base,
    left: rail.concat(deduped)
  };
};

  currentState = (): any => ({
  sorting: this.sorting != null ? this.sorting : this._sortingDefault.value,
  globalFilter: this.globalFilter != null ? this.globalFilter : this._globalFilterDefault.value,
  columnFilters: this.columnFilters != null ? this.columnFilters : this._columnFiltersDefault.value,
  pagination: this.pagination != null ? this.pagination : this._paginationDefault.value,
  rowSelection: this.rowSelection != null ? this.rowSelection : this._rowSelectionDefault.value,
  // expanded (phase 50 req-1/3): ExpandedState ({ [rowId]: true } | the `true` expand-all
  // literal). Passed to table-core verbatim — never Object.keys'd without a `=== true`
  // guard (Pitfall 2). Falls back to $data.expandedDefault when r-model:expanded is unbound.
  // GROUPING AUTO-EXPAND (req-4): when grouping is active and the consumer has neither bound
  // `expanded` nor toggled a group yet (!expandedTouched), default to the `true` expand-all
  // literal so the grouped subtree is visible by default; the first toggle latches
  // expandedTouched and the user's expanded state wins thereafter. Non-grouping path is
  // unchanged → byte-identical-off (the table + the expandable-rows feature both keep
  // $data.expandedDefault).
  expanded: this.expanded != null ? this.expanded : this.groupingActiveDefault() && !this.expandedTouched ? true : this._expandedDefault.value,
  // grouping (phase 50 reqs 4-7): GroupingState = ordered string[] of column ids. Falls back
  // to $data.groupingDefault when r-model:grouping is unbound. table-core's getGroupedRowModel
  // is inert when this is empty (byte-identical-off, req-10).
  grouping: this.grouping != null ? this.grouping : this._groupingDefault.value,
  columnVisibility: this.columnVisibility != null ? this.columnVisibility : this._columnVisibilityDefault.value,
  columnSizing: this.columnSizing != null ? this.columnSizing : this._columnSizingDefault.value,
  columnOrder: this.columnOrder != null ? this.columnOrder : this._columnOrderDefault.value,
  columnPinning: this.effectiveColumnPinning(),
  // columnSizingInfo: table-core's transient resize-gesture state. We pass an
  // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
  // `column.getIsResizing()` / `getResizeHandler()` read
  // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
  // absent. Seed the default shape (matches table-core's
  // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
  // every render. Not a two-way model slice (transient gesture state, not consumer
  // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
  columnSizingInfo: this._columnSizingInfo.value
});

  currentData = (): any => this.data != null ? this.data : this._dataDefault.value;

  isSafeKey = (k: any) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';

  wrapAggregationFn = (fn: any) => {
  if (typeof fn === 'string') return fn;
  if (typeof fn !== 'function') return undefined;
  return (columnId: any, leafRows: any, childRows: any) => {
    try {
      return fn(columnId, leafRows, childRows);
    } catch (err: any) {
      return undefined;
    }
  };
};

  buildConfigDef = (c: any) => {
  if (!c) return null;
  // Grouped (multi-level) header column: an entry carrying a `columns` array. table-core's
  // getHeaderGroups() yields ONE extra header-row level per group depth — the parent group
  // header spans its leaf children (B12). The group id falls back to its header text so it
  // stays addressable (no accessor; group columns carry no data).
  if (Array.isArray(c.columns)) {
    const gid = c.id != null ? c.id : c.header;
    if (gid == null) return null;
    const id = String(gid);
    if (!this.isSafeKey(id)) return null;
    const kids = [];
    for (const child of c.columns as any) {
      const cd = this.buildConfigDef(child);
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
  if (!this.isSafeKey(id)) return null;
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
    aggregationFn: this.wrapAggregationFn(c.aggregationFn),
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
};

  columnDefs = () => {
  const byId = Object.create(null);
  const order = [];
  const cfg = this.columns || [];
  for (const c of cfg as any) {
    const def = this.buildConfigDef(c);
    if (!def) continue;
    const id = def.id;
    if (!(id in byId)) order.push(id);
    byId[id] = def;
  }
  const reg = this._colReg.value || {};
  for (const id in reg) {
    if (!this.isSafeKey(id)) continue;
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
      aggregationFn: this.wrapAggregationFn(spec.aggregationFn),
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
};

  SELECT_COL_ID = '__rdt_select';

  EXPANDER_COL_ID = '__rdt_expander';

  selectionEnabled = () => this.selectionMode === 'single' || this.selectionMode === 'multiple';

  tableColumns = () => {
  const cols = this.columnDefs();
  // Expander column (phase 50, D-04): injected LEADING when expandable, carrying an
  // isExpanderColumn marker the template uses to render the chevron toggle (NOT an accessor
  // value). enableSorting/enableColumnFilter:false (it is chrome, not data). Off by default
  // → byte-identical-off (req-10).
  let withExpander = cols;
  if (this.expandable === true) {
    const expanderCol = {
      id: this.EXPANDER_COL_ID,
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
  if (this.selectionEnabled()) {
    const selectCol = {
      id: this.SELECT_COL_ID,
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
};

  writeSorting = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._sortingDefault.value = next; // fresh array only (never in-place)
  this._sortingControllable.write(next); // two-way emit if bound (no-op-diff if not)
  this.dispatchEvent(new CustomEvent("sort-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  applyUpdater = (updater: any, current: any) => typeof updater === 'function' ? updater(current) : updater;

  writeExpanded = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  // Latch the grouping auto-expand default (req-4): the FIRST expand/collapse toggle means
  // the user now owns the expanded state, so currentState() stops defaulting grouped rows to
  // the `true` expand-all literal and honors $data.expandedDefault from here on.
  this.expandedTouched = true;
  this._expandedDefault.value = next; // fresh value only (never in-place)
  this._expandedControllable.write(next); // two-way emit if bound (no-op-diff if not)
  // Event stem is `expand-change`, NOT `expanded-change`: the model:true `expanded`
  // prop auto-generates an `onExpandedChange` callback on the React/Solid flat Props
  // interface, and an `expanded-change` event would camelCase to the SAME identifier
  // → duplicate-identifier TS2300 (the model-prop==emit-name collision class). Every
  // sibling slice avoids this by stemming the event off a DISTINCT name (sorting→
  // sort-change, rowSelection→selection-change); `expanded`→`expand-change` follows suit.
  this.dispatchEvent(new CustomEvent("expand-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeGrouping = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._groupingDefault.value = next; // fresh ordered array only (never in-place push)
  this._groupingControllable.write(next); // two-way emit if bound (no-op-diff if not)
  this.dispatchEvent(new CustomEvent("group-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeGlobalFilter = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._globalFilterDefault.value = next;
  this._globalFilterControllable.write(next);
  this.dispatchEvent(new CustomEvent("filter-change", {
    detail: {
      globalFilter: next
    },
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnFilters = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnFiltersDefault.value = next;
  this._columnFiltersControllable.write(next);
  this.dispatchEvent(new CustomEvent("filter-change", {
    detail: {
      columnFilters: next
    },
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writePagination = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._paginationDefault.value = next;
  this._paginationControllable.write(next);
  this.dispatchEvent(new CustomEvent("page-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeRowSelection = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._rowSelectionDefault.value = next;
  this._rowSelectionControllable.write(next);
  this.dispatchEvent(new CustomEvent("selection-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnVisibility = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnVisibilityDefault.value = next;
  this._columnVisibilityControllable.write(next);
  this.dispatchEvent(new CustomEvent("visibility-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnSizing = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnSizingDefault.value = next;
  this._columnSizingControllable.write(next);
  this.dispatchEvent(new CustomEvent("resize-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnOrder = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnOrderDefault.value = next;
  this._columnOrderControllable.write(next);
  this.dispatchEvent(new CustomEvent("reorder-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnPinning = (next: any) => {
  if (this.programmatic) return;
  // effectiveColumnPinning() forces the auto-injected chrome ids (select/expander) into the
  // table-core `left` rail, so table-core hands them back here on every pin change. Strip them
  // before persisting: the CONSUMER's columnPinning model + the pin-change event must reflect
  // only their own columns, never our internal rail ids (which re-inject each render anyway).
  const strip = (ids: any) => (ids || []).filter((id: any) => id !== this.SELECT_COL_ID && id !== this.EXPANDER_COL_ID);
  const clean = {
    ...next,
    left: strip(next && next.left),
    right: strip(next && next.right)
  };
  this.programmatic++;
  this._columnPinningDefault.value = clean;
  this._columnPinningControllable.write(clean);
  this.dispatchEvent(new CustomEvent("pin-change", {
    detail: clean,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeData = (next: any) => {
  if (this.programmatic) return;
  if (this.undoable && !this.restoringHistory) {
    const prevU = this.canUndo();
    const prevR = this.canRedo();
    this.recordSnapshot(this.currentData());
    this.emitHistoryChangeIfEdged(prevU, prevR);
  }
  this.dataWriteSettling = true;
  // Re-arm: a rapid back-to-back write cancels the prior pending close so the window
  // never shuts BETWEEN two writes of one logical action.
  if (this.dataWriteSettleHandle != null && typeof clearTimeout === 'function') clearTimeout(this.dataWriteSettleHandle);
  const closeSettleWindow = () => {
    this.dataWriteSettling = false;
    this.dataWriteSettleHandle = null;
  };
  // WALL-CLOCK macrotask backstop (was a double-rAF nesting — 260709-8ct). reFeed's
  // re-feed `$watch` on React runs as a POST-COMMIT passive effect; an rAF callback
  // fires BEFORE paint, so under CI load React's reFeed landed AFTER the 2-frame rAF
  // window had already closed → it read `dataWriteSettling === false` and WRONGLY
  // cleared history (data-table-grid-undo [react] (c): paste block → Ctrl+Z was a
  // no-op). A `setTimeout` runs strictly after React's MessageChannel-scheduled
  // passive effect (MessageChannel drains before setTimeout), and a ~6-frame window
  // gives every fine-grained target (Solid/Lit) FAR more settle room than 2 frames.
  // A genuine external swap still happens outside any write's window → flag `false`
  // → history cleared, exactly as before.
  if (typeof setTimeout === 'function') {
    this.dataWriteSettleHandle = setTimeout(closeSettleWindow, 96);
  } else {
    closeSettleWindow();
  }
  this.programmatic++;
  this._dataDefault.value = next; // fresh array only (never in-place)
  this._dataControllable.write(next); // two-way emit if bound (no-op-diff if not)
  this.programmatic--;
};

  columnFilterValue = (colId: any) => {
  const cf = this.currentState().columnFilters || [];
  for (const f of cf as any) if (f && f.id === colId) return f.value != null ? f.value : '';
  return '';
};

  setColumnFilter = (colId: any, value: any) => {
  const prev = this.currentState().columnFilters || [];
  const next = [];
  for (const f of prev as any) if (f && f.id !== colId) next.push(f);
  if (value != null && value !== '') next.push({
    id: colId,
    value
  });
  this.writeColumnFilters(next);
};

  recordSnapshot = (current: any) => {
  this.undoStack.push(current);
  const limit = this.undoLimit != null ? this.undoLimit : 100;
  while (this.undoStack.length > limit) this.undoStack.shift();
  this.redoStack = [];
};

  canUndo = () => this.undoStack.length > 0;

  canRedo = () => this.redoStack.length > 0;

  clearHistory = () => {
  this.undoStack = [];
  this.redoStack = [];
};

  emitHistoryChange = () => {
  this.dispatchEvent(new CustomEvent("history-change", {
    detail: {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    },
    bubbles: true,
    composed: true
  }));
};

  emitHistoryChangeIfEdged = (prevU: any, prevR: any) => {
  const nextU = this.canUndo();
  const nextR = this.canRedo();
  if (nextU !== prevU || nextR !== prevR) this.emitHistoryChange();
};

  undo = () => {
  if (!this.canUndo()) return;
  const prev = this.undoStack.pop();
  this.redoStack.push(this.currentData());
  this.restoringHistory = true;
  this.writeData(prev);
  this.restoringHistory = false;
  this.emitHistoryChange();
};

  redo = () => {
  if (!this.canRedo()) return;
  const next = this.redoStack.pop();
  this.undoStack.push(this.currentData());
  this.restoringHistory = true;
  this.writeData(next);
  this.restoringHistory = false;
  this.emitHistoryChange();
};

  refreshRowModel: any = null;

  onSortingChangeCb = (updater: any) => {
  this.writeSorting(this.applyUpdater(updater, this.currentState().sorting));
};

  onExpandedChangeCb = (updater: any) => {
  this.writeExpanded(this.applyUpdater(updater, this.currentState().expanded));
};

  onGroupingChangeCb = (updater: any) => {
  this.writeGrouping(this.applyUpdater(updater, this.currentState().grouping));
};

  onGlobalFilterChangeCb = (updater: any) => {
  this.writeGlobalFilter(this.applyUpdater(updater, this.currentState().globalFilter));
};

  onColumnFiltersChangeCb = (updater: any) => {
  this.writeColumnFilters(this.applyUpdater(updater, this.currentState().columnFilters));
};

  onPaginationChangeCb = (updater: any) => {
  this.writePagination(this.applyUpdater(updater, this.currentState().pagination));
};

  onRowSelectionChangeCb = (updater: any) => {
  this.writeRowSelection(this.applyUpdater(updater, this.currentState().rowSelection));
};

  onColumnVisibilityChangeCb = (updater: any) => {
  this.writeColumnVisibility(this.applyUpdater(updater, this.currentState().columnVisibility));
};

  onColumnSizingChangeCb = (updater: any) => {
  this.writeColumnSizing(this.applyUpdater(updater, this.currentState().columnSizing));
};

  onColumnOrderChangeCb = (updater: any) => {
  this.writeColumnOrder(this.applyUpdater(updater, this.currentState().columnOrder));
};

  onColumnPinningChangeCb = (updater: any) => {
  this.writeColumnPinning(this.applyUpdater(updater, this.currentState().columnPinning));
};

  onColumnSizingInfoChangeCb = (updater: any) => {
  const next = this.applyUpdater(updater, this._columnSizingInfo.value);
  this._columnSizingInfo.value = next != null ? next : this._columnSizingInfo.value;
};

  windowSource = () => {
  if (!this.table) return [];
  if (this.virtual) return this.table.getPrePaginationRowModel().rows;
  return this.table.getRowModel().rows;
};

  scheduleRemeasure = () => {
  if (this.remeasurePending) return;
  this.remeasurePending = true;
  let ranMicro = false;
  const microPass = () => {
    this.remeasureWindow();
  };
  const rafPass = () => {
    this.remeasurePending = false;
    this.remeasureWindow();
  };
  if (typeof queueMicrotask !== 'undefined') {
    ranMicro = true;
    queueMicrotask(microPass);
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) this.remeasurePending = false;else setTimeout(rafPass, 0);
};

  pinnedEditIndex = () => {
  if (this._editingRow.value >= 0) return this._editingRow.value;
  if (this._editingRowIndex.value != null) return this._editingRowIndex.value;
  return -1;
};

  pinnedMeasurement = (pin: any) => {
  if (!this.virtualizer || pin < 0) return null;
  const ms = this.virtualizer.getMeasurements();
  return ms && ms[pin] ? ms[pin] : null;
};

  remeasureWindow = () => {
  if (!this.virtualizer || !this.gridRoot) return;
  // Bail ONLY while a PROGRAMMATIC scroll is in flight: virtualizer.scrollState is non-null
  // exclusively during scrollToIndex / scrollToOffset (the D-12 scroll-then-focus seam) and
  // null for ordinary user/scrollTop-driven scrolling (verified virtual-core@3.17.1: set in
  // scrollToIndex L992, cleared to null on reconcile L378). Measuring mid-scrollToIndex lets
  // resizeItem nudge the offset and starve the scroll target (the Solid off-window focus
  // regression); the next settled onChange re-measures the stable window. Manual-scroll
  // recycling (the CR-01 case) has scrollState === null, so it measures normally.
  if (this.virtualizer.scrollState) return;
  const trs = this.gridRoot.querySelectorAll('tbody.rdt-tbody > tr[data-index]');
  for (const tr of trs as any) this.virtualizer.measureElement(tr);
};

  virtualItemKey = (i: any) => {
  const src = this.windowSource();
  return src && src[i] ? src[i].id : undefined;
};

  virtualizerOptions = (): any => ({
  count: this.windowSource().length,
  getScrollElement: () => this.gridScrollEl,
  estimateSize: () => this.estimateRowHeight,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  measureElement,
  overscan: 8,
  getItemKey: this.virtualItemKey,
  onChange: () => {
    this._windowVer.value = this._windowVer.value + 1;
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
    this.scheduleRemeasure();
  }
});

  pinMeasurement = (pin: number): {
  start: number;
  size: number;
  index: number;
  end: number;
} | null => this.pinnedMeasurement(pin);

  windowedRows = () => {
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
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtualizer) {
    // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
    // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
    // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
    // rows appear on the first onChange after _didMount.
    if (!this.virtual) {
      const rowList = this._rows.value || [];
      return rowList.map((r: any) => ({
        vi: null,
        row: r
      }));
    }
    return [];
  }
  const items = this.virtualizer.getVirtualItems();
  const rowList = this._rows.value || [];
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
  const pin = this.pinnedEditIndex();
  if (pin >= 0 && rowList[pin]) {
    let inWindow = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].index === pin) {
        inWindow = true;
        break;
      }
    }
    if (!inWindow) {
      const pm = this.pinMeasurement(pin);
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
};

  padTop = () => {
  // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
  // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
  // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtual || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  let pad = items.length ? items[0].start : 0;
  // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
  // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
  // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinMeasurement(pin);
    const inWindow = this.pmIndexInWindow(items, pin);
    if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
  }
  return pad < 0 ? 0 : pad;
};

  padBottom = () => {
  // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
  // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
  // on pin/unpin.
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtual || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  if (!items.length) return 0;
  let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
  // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
  // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinMeasurement(pin);
    const inWindow = this.pmIndexInWindow(items, pin);
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
};

  pmIndexInWindow = (items: any, idx: any) => {
  for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
  return false;
};

  rowIsOutsideWindow = (r: any) => {
  if (!this.virtual || !this.virtualizer) return false;
  const items = this.virtualizer.getVirtualItems();
  for (const it of items as any) if (it.index === r) return false;
  return true;
};

  reFeed = () => {
  if (!this.table) return;
  // 260709-8ct (grid-wide undo/redo, external-swap reset): every INTERNAL writeback (incl. an
  // undo()/redo() replay) sets `dataWriteSettling = true` inside writeData and arms a deferred
  // `rAF` reset. reFeed() fires on EVERY data-ref change — internal writeback and an external
  // swap (new dataset, server refetch) look identical here — so read the flag: while `true`
  // (we are still inside a just-triggered write's settling window) skip the clear, no matter
  // how many redundant/transiently-stale reFeed passes fire during that window; once the
  // window closes (the flag is back to `false`) a data change reaching reFeed is, by
  // definition, one WE did not cause → an external swap → clear history (undoing across a
  // dataset boundary is incoherent). See `let dataWriteSettling`'s declaration comment for the
  // three rejected alternatives (a raw reference latch, a single-consume flag, and an
  // idempotent content-signature compare — each broken by a different target's reactivity
  // timing). undoable-gated so a shipped grid with undoable unset never pays this check.
  if (this.undoable && !this.dataWriteSettling) this.clearHistory();
  this.table.setOptions((prev: any) => ({
    ...prev,
    data: this.currentData(),
    columns: this.tableColumns(),
    state: this.currentState(),
    enableRowSelection: this.selectionMode !== 'none',
    enableMultiRowSelection: this.selectionMode === 'multiple',
    // Re-pass the server-side page-count sources (#2) so a RUNTIME rowCount/pageCount change
    // takes effect: setOptions REPLACES via `...prev`, which holds the value captured at
    // createTable time, so an omitted key would freeze the mount-time count. The re-feed
    // $watch keys on both props below.
    rowCount: this.rowCount ?? undefined,
    pageCount: this.pageCount ?? undefined,
    // Re-pass the expand model fns + callback (Pitfall 4 — virtual-core/table-core's
    // setOptions REPLACES, so an omitted fn would drop the model on re-feed; on React the
    // onExpandedChange callback must re-capture fresh currentState each cycle, F6).
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (this.getSubRows || undefined) as any,
    getRowCanExpand: this.expandable === true && this.getSubRows == null ? () => true : undefined,
    onExpandedChange: this.onExpandedChangeCb,
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
    onGroupingChange: this.onGroupingChangeCb,
    // Re-pass the 3 faceted models (Pitfall 4 — setOptions REPLACES, so an omitted fn would
    // drop the model on re-feed; on React the faceted closures must re-capture so exposed
    // unique values + min/max update when an upstream filter changes, F6 / req-8 cross-filter).
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: makeFacetedUniqueValues(),
    getFacetedMinMaxValues: makeFacetedMinMaxValues(),
    // Re-pass the per-slice callbacks so React captures fresh currentState each cycle
    // (table-core keeps the prior callbacks otherwise → mount-time stale closure, F6).
    onSortingChange: this.onSortingChangeCb,
    onGlobalFilterChange: this.onGlobalFilterChangeCb,
    onColumnFiltersChange: this.onColumnFiltersChangeCb,
    onPaginationChange: this.onPaginationChangeCb,
    onRowSelectionChange: this.onRowSelectionChangeCb,
    onColumnVisibilityChange: this.onColumnVisibilityChangeCb,
    onColumnSizingChange: this.onColumnSizingChangeCb,
    onColumnOrderChange: this.onColumnOrderChangeCb,
    onColumnPinningChange: this.onColumnPinningChangeCb,
    onColumnSizingInfoChange: this.onColumnSizingInfoChangeCb
  }));
  if (this.refreshRowModel) this.refreshRowModel();
};

  lastData: any = null;

  lastDataLen = -1;

  onHeaderSort = (colId: any, evt: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (!col || !col.getCanSort()) return;
  const multi = !!(evt && evt.shiftKey);
  // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
  col.toggleSorting(undefined, multi);
};

  tick = () => this._rowModelVer.value;

  ariaSortFor = (colId: any) => {
  if (this.tick() < 0 || !this.table) return 'none';
  const col = this.table.getColumn(colId);
  if (!col) return 'none';
  const dir = col.getIsSorted();
  if (dir === 'asc') return 'ascending';
  if (dir === 'desc') return 'descending';
  return 'none';
};

  sortIndicator = (colId: any) => {
  if (this.tick() < 0 || !this.table) return '';
  const col = this.table.getColumn(colId);
  if (!col) return '';
  const dir = col.getIsSorted();
  if (dir === 'asc') return '▲';
  if (dir === 'desc') return '▼';
  return '';
};

  defFor = (colId: any) => {
  const defs = this.columnDefs();
  for (const d of defs as any) if (d.id === colId) return d;
  return null;
};

  visibleCellsFor = (row: any) => this._rowModelVer.value >= 0 ? row.getVisibleCells() : [];

  editMetaOf = (colId: any) => {
  const d = this.defFor(colId);
  return d && d.meta ? d.meta : null;
};

  columnEditable = (colId: any) => {
  const m = this.editMetaOf(colId);
  return !!(m && m.editable === true);
};

  editorTypeOf = (colId: any) => {
  const m = this.editMetaOf(colId);
  return m && m.editor != null ? m.editor : 'text';
};

  editorOptionsOf = (colId: any) => {
  const m = this.editMetaOf(colId);
  return m && m.editorOptions != null ? m.editorOptions : [];
};

  hasEditorSlot = (colId: any) => this.editorTypeOf(colId) === 'custom' && !!(this._hasSlotEditor || this.editor !== undefined);

  hasFilterSlot = () => !!(this._hasSlotFilter || this.filter !== undefined);

  columnIsFilterable = (colId: any) => {
  const d = this.defFor(colId);
  return !!(d && d.filterable);
};

  headerLabel = (colId: any) => {
  const d = this.defFor(colId);
  return d ? d.header : colId;
};

  headerWidth = (colId: any) => {
  if (this.tick() < 0 || !this.table) return null;
  const col = this.table.getColumn(colId);
  if (!col) return null;
  const w = col.getSize();
  return w != null && w > 0 ? w + 'px' : null;
};

  onResizeStart = (colId: any, evt: any) => {
  // stop here (NOT a `.stop` modifier) — the Angular `.stop`-in-@for hoist is broken (F5).
  if (evt && evt.stopPropagation) evt.stopPropagation();
  if (!this.table) return;
  const header = this.findHeader(colId);
  if (!header || !header.getResizeHandler) return;
  const handler = header.getResizeHandler();
  if (handler) handler(evt);
};

  findHeader = (colId: any) => {
  const groups = this._headerGroups.value || [];
  for (const hg of groups as any) {
    const hs = hg.headers || [];
    for (const h of hs as any) if (h && h.column && h.column.id === colId) return h;
  }
  return null;
};

  columnIsResizing = (colId: any) => {
  if (this.tick() < 0 || !this.table) return false;
  const header = this.findHeader(colId);
  return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
};

  columnIsVisible = (colId: any) => {
  if (this.tick() < 0 || !this.table) return true;
  const col = this.table.getColumn(colId);
  return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
};

  onToggleVisibility = (colId: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.toggleVisibility) col.toggleVisibility();
};

  allLeafColumns = () => {
  if (this.tick() < 0 || !this.table) return [];
  const cols = this.table.getAllLeafColumns ? this.table.getAllLeafColumns() : [];
  const out = [];
  for (const c of cols as any) {
    if (!c || c.id === this.SELECT_COL_ID || c.id === this.EXPANDER_COL_ID) continue;
    out.push({
      id: c.id,
      label: this.headerLabel(c.id),
      visible: !!(c.getIsVisible && c.getIsVisible())
    });
  }
  return out;
};

  columnPinSide = (colId: any) => {
  if (this.tick() < 0 || !this.table) return false;
  const col = this.table.getColumn(colId);
  if (!col || !col.getIsPinned) return false;
  return col.getIsPinned();
};

  onPinColumn = (colId: any, side: any, evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.pin) col.pin(side);
};

  pinStyle = (colId: any, zIndex = 1) => {
  if (this.tick() < 0 || !this.table) return '';
  const col = this.table.getColumn(colId);
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
};

  thStyle = (colId: any) => {
  let s = '';
  const w = this.headerWidth(colId);
  if (w) s += 'width:' + w + ';';
  s += this.pinStyle(colId, 2);
  return s;
};

  onGlobalFilterInput = (evt: any) => {
  const value = evt && evt.target ? evt.target.value : '';
  if (this.table) {
    this.table.setGlobalFilter(value);
    return;
  }
  this.writeGlobalFilter(value);
};

  onColumnFilterInput = (colId: any, evt: any) => {
  const value = evt && evt.target ? evt.target.value : '';
  this.setColumnFilter(colId, value);
};

  globalFilterValue = () => {
  const v = this.currentState().globalFilter;
  return v != null ? v : '';
};

  pageIndex = () => {
  if (this.tick() >= 0 && this.table) return this.table.getState().pagination.pageIndex;
  const p = this.currentState().pagination;
  return p && p.pageIndex != null ? p.pageIndex : 0;
};

  pageSize = () => {
  if (this.tick() >= 0 && this.table) return this.table.getState().pagination.pageSize;
  const p = this.currentState().pagination;
  return p && p.pageSize != null ? p.pageSize : 10;
};

  displayPageCount = () => {
  if (this.tick() < 0 || !this.table) return 1;
  const c = this.table.getPageCount();
  return c != null && c > 0 ? c : 1;
};

  canPrevPage = () => !!(this.tick() >= 0 && this.table && this.table.getCanPreviousPage());

  canNextPage = () => !!(this.tick() >= 0 && this.table && this.table.getCanNextPage());

  onPrevPage = () => {
  if (this.table) this.table.previousPage();
};

  onNextPage = () => {
  if (this.table) this.table.nextPage();
};

  onPageSizeChange = (evt: any) => {
  if (!this.table) return;
  const v = evt && evt.target ? evt.target.value : '';
  const n = parseInt(v, 10);
  this.table.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
};

  isSelectColumn = (colId: any) => colId === this.SELECT_COL_ID;

  isExpanderColumn = (colId: any) => colId === this.EXPANDER_COL_ID;

  rowCanExpand = (row: any) => !!(this.tick() >= 0 && row && row.getCanExpand && row.getCanExpand() && !(row.getIsGrouped && row.getIsGrouped()));

  rowIsExpanded = (row: any) => !!(this.tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());

  rowShowsDetail = (row: any) => this.getSubRows == null && !this.rowIsGrouped(row) && this.rowIsExpanded(row);

  onToggleExpand = (row: any, evt: any) => {
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
};

  bodyCellStyle = (row: any, colId: any) => {
  const base = this.pinStyle(colId);
  if (this.isExpanderColumn(colId) && row && row.depth) {
    const pad = 'padding-left:' + (0.5 + row.depth * 1.25) + 'rem';
    // pinStyle() already ends with ';', so append `pad` directly — inserting a
    // second ';' produces a `;;` empty declaration. Browsers tolerate that in a
    // raw style attribute (React/Vue/Svelte/Lit) and Solid's cssText path does
    // too, but Angular's [style] binding parses the string via ɵɵstyleMap and
    // DROPS the declaration following the empty one — so the depth padding-left
    // silently vanished on Angular only. Emit a single, well-formed separator.
    const sep = base.endsWith(';') ? '' : ';';
    return base ? base + sep + pad : pad;
  }
  return base;
};

  rowIsGrouped = (row: any) => !!(this.tick() >= 0 && row && row.getIsGrouped && row.getIsGrouped());

  groupingActive = () => this.tick() >= 0 && (this.currentState().grouping || []).length > 0;

  cellIsGrouped = (cellCtx: any) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsGrouped && cellCtx.getIsGrouped());

  cellIsAggregated = (cellCtx: any) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsAggregated && cellCtx.getIsAggregated());

  cellIsPlaceholder = (cellCtx: any) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsPlaceholder && cellCtx.getIsPlaceholder());

  groupSubRowCount = (row: any) => row && row.subRows ? row.subRows.length : 0;

  groupingKeys = () => this.currentState().grouping || [];

  groupableColumns = () => {
  const out = [];
  const defs = this.columnDefs();
  for (const d of defs as any) {
    if (!d || d.groupable === false) continue;
    out.push({
      id: d.id,
      label: d.header != null ? d.header : d.id
    });
  }
  return out;
};

  stopEvent = (evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
};

  isAllRowsSelected = () => !!(this.tick() >= 0 && this.table && this.table.getIsAllRowsSelected());

  isSomeRowsSelected = () => !!(this.tick() >= 0 && this.table && this.table.getIsSomeRowsSelected());

  onToggleAllRows = (evt: any) => {
  if (!this.table) return;
  this.table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
};

  rowIsSelected = (row: any) => {
  if (!row) return false;
  const id = row.id;
  const sel = this.currentState().rowSelection || {};
  if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
  return !!(row.getIsSelected && row.getIsSelected());
};

  onToggleRow = (row: any, evt: any) => {
  if (!row || !row.toggleSelected) return;
  row.toggleSelected(!!(evt && evt.target && evt.target.checked));
};

  onHideColumn = (colId: any, evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.toggleVisibility) col.toggleVisibility(false);
};

  hasAnyFilterableColumn = () => {
  const cols = this.allLeafColumns();
  for (const c of cols as any) {
    if (c && this.columnIsFilterable(c.id)) return true;
  }
  return false;
};

  selectAllBox: any = null;

  syncIndeterminate = () => {
  if (!this._ref__rozieRoot || !this._ref__rozieRoot.querySelector) return;
  this.selectAllBox = this._ref__rozieRoot.querySelector('.rdt-select-all');
  if (this.selectAllBox) this.selectAllBox.indeterminate = this.isSomeRowsSelected() && !this.isAllRowsSelected();
};

  sortColumn = (colId: any, desc: any) => {
  if (this.table) this.table.getColumn(colId) && this.table.getColumn(colId).toggleSorting(desc, false);
};

  clearSorting = () => {
  if (this.table) this.table.resetSorting(true);
};

  getColumnDefs = () => this.columnDefs();

  toggleAllRows = (value: any) => {
  if (this.table) this.table.toggleAllRowsSelected(value);
};

  clearSelection = () => {
  if (this.table) this.table.resetRowSelection(true);
};

  getSelectedRows = () => this.table ? this.table.getSelectedRowModel().rows.map((r: any) => r.original) : [];

  setPage = (idx: any) => {
  if (this.table) this.table.setPageIndex(idx);
};

  setRowsPerPage = (size: any) => {
  if (this.table) this.table.setPageSize(size);
};

  toggleColumnVisibility = (colId: any) => {
  if (this.table) {
    const c = this.table.getColumn(colId);
    if (c && c.toggleVisibility) c.toggleVisibility();
  }
};

  applyColumnOrder = (order: any) => {
  if (this.table) this.table.setColumnOrder(order);
};

  resetColumnSizing = () => {
  if (this.table) this.table.resetColumnSizing(true);
};

  pinColumn = (colId: any, side: any) => {
  if (this.table) {
    const c = this.table.getColumn(colId);
    if (c && c.pin) c.pin(side);
  }
};

  getRowIndexRelativeToPage = (absRow: any) => {
  const abs = absRow == null ? this.toAbsRow(this._activeRow.value) : Math.trunc(Number(absRow)) || 0;
  if (this.virtual) return abs;
  return abs - this.pageRowOffset();
};

  cut = () => this.cutRange();

  isGrid = () => this.interactionMode === 'grid';

  tableRole = () => this.isGrid() ? 'grid' : 'table';

  cellRole = () => this.isGrid() ? 'gridcell' : 'cell';

  rowIndexOf = (row: any) => this.tick() >= 0 ? (this._rows.value || []).indexOf(row) : -1;

  colIndexOf = (row: any, cellCtx: any) => this.tick() >= 0 ? this.visibleCellsFor(row).indexOf(cellCtx) : -1;

  headerColIndexOf = (hg: any, header: any) => (hg && hg.headers ? hg.headers : []).indexOf(header);

  pageRowOffset = () => {
  if (!this.isGrid() || this.virtual) return 0;
  return this.pageIndex() * this.pageSize();
};

  toAbsRow = (localRow: any) => localRow + this.pageRowOffset();

  prePaginationRowCount = () => {
  if (!this.table || this.virtual) return this.bodyRowCount();
  const pm = this.table.getPrePaginationRowModel();
  return pm && pm.rows ? pm.rows.length : this.bodyRowCount();
};

  cellTabindex = (rowKey: any, colIndex: any, level = null) => {
  if (!this.isGrid()) return null;
  // B6: an empty / all-filtered grid (no body rows) must STILL be keyboard-reachable. Fall
  // the single roving tab-stop back to the FIRST leaf-header cell so the grid never has ZERO
  // tab-stops (a keyboard trap). Only the leaf-level header col 0 carries the tab-stop.
  if (this.bodyRowCount() === 0) {
    return rowKey === '__header' && colIndex === 0 && level === this.headerLeafLevel() ? 0 : -1;
  }
  // B12: when a header cell is active, address it by BOTH its level AND its colIndex so a
  // grouped multi-level header carries exactly ONE tab-stop. The pre-fix level-blind compare
  // lit BOTH the parent (level 0) and the leaf (level 1) at the same colIndex → multiple
  // tab-stops (the roving invariant broke under grouped headers).
  if (this._activeIsHeader.value) {
    if (rowKey !== '__header') return -1;
    return colIndex === this._activeColIndex.value && level === this._activeHeaderLevel.value ? 0 : -1;
  }
  const isActive = rowKey === String(this._activeRow.value) && colIndex === this._activeColIndex.value;
  return isActive ? 0 : -1;
};

  isActiveCell = (rowKey: any, colIndex: any, level = null) => {
  if (!this.isGrid()) return false;
  if (this._activeIsHeader.value) {
    if (rowKey !== '__header') return false;
    return colIndex === this._activeColIndex.value && level === this._activeHeaderLevel.value;
  }
  if (rowKey === '__header') return false;
  return rowKey === String(this._activeRow.value) && colIndex === this._activeColIndex.value;
};

  resolveCellEl = (rowKey: any, colIndex: any, level = null) => {
  if (!this.gridRoot) return null;
  // B12: a grouped multi-level header has MULTIPLE cells sharing data-row="__header" at the
  // same data-col-index across levels (parent vs leaf). Disambiguate header lookups by the
  // integer data-header-level so resolveCellEl('__header', 0) no longer returns the FIRST DOM
  // match (the parent) when the leaf is meant. level is an integer (NO consumer string is
  // interpolated — T-49-01 stays safe); body lookups pass level=null → the selector is
  // byte-unchanged.
  let sel = '[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]';
  if (rowKey === '__header' && level != null) sel = sel + '[data-header-level="' + level + '"]';
  return this.gridRoot.querySelector(sel);
};

  focusActiveCell = (nextRow = null, nextCol = null, nextIsHeader = null, nextLevel = null) => {
  if (!this.isGrid() || !this.gridRoot) return;
  // #9 focus-intent epoch: focusActiveCell is THE single seam every keyboard nav re-asserts
  // focus through, so it establishes a fresh "where focus should be" on every call — bump the
  // epoch here (BEFORE arming the virtual-scroll focusWhenReady poll below). A SUBSEQUENT
  // focusActiveCell (the next user nav) bumps again → any pending focusWhenReady captured the
  // OLD value → aborts instead of yanking focus back. The poll captures the POST-bump value so
  // a lone scroll-to-focus with no later nav still lands (epoch stable across its own frames).
  this.focusIntentEpoch = this.focusIntentEpoch + 1;
  const r = nextRow == null ? this._activeRow.value : nextRow;
  const c = nextCol == null ? this._activeColIndex.value : nextCol;
  // B12: thread the FRESH post-write header level (the grouped-header analog of the
  // nextIsHeader threading) so a leaf↔parent header move resolves the cell at the correct
  // level, never the async-stale $data.activeHeaderLevel re-read (React ROZ138 / Angular signal).
  const lvl = nextLevel == null ? this._activeHeaderLevel.value : nextLevel;
  // Thread the FRESH post-write isHeader flag (the plan-01-PROVEN contract): a header
  // crossing sets $data.activeIsHeader inside moveRow, but React's setState (ROZ138) and
  // Angular's signal write are async within one handler — re-reading $data.activeIsHeader
  // here returns the PRE-write value, resolving focus to the BODY cell instead of the
  // header. Callers pass the fresh isHeader local; falls back to $data when omitted.
  const header = nextIsHeader == null ? this._activeIsHeader.value : nextIsHeader;
  // ── phase 53 scroll-then-focus (D-12): when windowing AND the target body row is OUTSIDE the
  // rendered window, scroll it in first, then defer focus to AFTER the new window commits (the
  // double-rAF — a single rAF can fire before React's async commit, Pitfall 4). Header cells and
  // in-window rows keep the synchronous path below (table-mode / non-windowed stay byte-stable).
  // The guard reads the resolved `header` (NOT the raw `nextIsHeader`) so an omitted-arg call
  // while a header cell is active falls back to $data.activeIsHeader and skips the scroll path.
  if (this.virtual && this.virtualizer && !header && this.rowIsOutsideWindow(r)) {
    this.virtualizer.scrollToIndex(r, {
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
    // #9: capture the epoch AFTER this call's own bump (above) so the poll never aborts itself
    // (its captured value equals the current epoch). A LATER focusActiveCell / focusCell /
    // active-cell-moving focusin bumps the epoch → the check below aborts this stale poll.
    const myEpoch = this.focusIntentEpoch;
    const focusWhenReady = () => {
      // A newer focus intent superseded this poll — abort WITHOUT focusing (the user has since
      // navigated / clicked elsewhere; re-focusing this off-window target would yank focus back).
      if (this.focusIntentEpoch !== myEpoch) return;
      const el = this.resolveCellEl(String(r), c);
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
  const el = this.resolveCellEl(rowKey, c, header ? lvl : null);
  if (el) el.focus();
};

  totalRowCount = () => {
  if (!this.table) return (this._rows.value || []).length;
  const fm = this.table.getFilteredRowModel();
  return fm && fm.rows ? fm.rows.length : (this._rows.value || []).length;
};

  headerRowCount = () => (this._headerGroups.value || []).length;

  gridAriaRowCount = () => this.headerRowCount() + this.totalRowCount();

  ariaPageOffset = () => this.table ? this.pageIndex() * this.pageSize() : 0;

  bodyAriaRowIndex = (row: any) => this.headerRowCount() + this.rowIndexOf(row) + this.ariaPageOffset() + 1;

  visibleColCount = () => {
  // NB: local is `rowList` (NOT `rows`) — the React emitter lowers `$data.rows` to the bare
  // state binding `rows`, so a `const rows = $data.rows` self-shadows it (TS2448 TDZ). Same
  // self-shadow class as the deconflictPropShadows finding; avoid the $data-key name as a local.
  const rowList = this._rows.value || [];
  if (rowList.length) return rowList[0].getVisibleCells().length;
  const hg = this._headerGroups.value || [];
  return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
};

  bodyRowCount = () => (this._rows.value || []).length;

  clamp = (v: any, lo: any, hi: any) => v < lo ? lo : v > hi ? hi : v;

  headerLeafLevel = () => {
  const hg = this._headerGroups.value || [];
  return hg.length ? hg.length - 1 : 0;
};

  headerCountAtLevel = (level: any) => {
  const hg = this._headerGroups.value || [];
  if (!hg.length) return this.visibleColCount();
  const grp = level >= 0 && level < hg.length ? hg[level] : null;
  if (!grp || !grp.headers) return this.visibleColCount();
  return grp.headers.length;
};

  headerAt = (level: any, colIndex: any) => {
  const hg = this._headerGroups.value || [];
  const grp = hg[level];
  if (!grp || !grp.headers) return null;
  return grp.headers[colIndex] || null;
};

  parentHeaderColIndex = (level: any, colIndex: any) => {
  if (level <= 0) return -1;
  const h = this.headerAt(level, colIndex);
  if (!h || !h.column || !h.column.parent) return -1;
  const parentId = h.column.parent.id;
  const hg = this._headerGroups.value || [];
  const pg = hg[level - 1];
  if (!pg || !pg.headers) return -1;
  for (let i = 0; i < pg.headers.length; i++) {
    const ph = pg.headers[i];
    if (ph && ph.column && ph.column.id === parentId) return i;
  }
  return -1;
};

  firstChildHeaderColIndex = (level: any, colIndex: any) => {
  const h = this.headerAt(level, colIndex);
  if (!h || !h.column) return -1;
  const kids = h.column.columns || [];
  if (!kids.length) return -1;
  const childId = kids[0].id;
  const hg = this._headerGroups.value || [];
  const cg = hg[level + 1];
  if (!cg || !cg.headers) return -1;
  for (let i = 0; i < cg.headers.length; i++) {
    const ch = cg.headers[i];
    if (ch && ch.column && ch.column.id === childId) return i;
  }
  return -1;
};

  moveCol = (delta: any) => {
  // #10: when a grouped PARENT header is active, clamp against the header count AT THE ACTIVE
  // LEVEL (which may be fewer than the leaf-column count) so ArrowRight never overruns onto a
  // phantom cell past that level's headers. Body cells + the leaf header level keep visibleColCount().
  const count = this._activeIsHeader.value ? this.headerCountAtLevel(this._activeHeaderLevel.value) : this.visibleColCount();
  const max = count - 1;
  const nextCol = this.clamp(this._activeColIndex.value + delta, 0, max < 0 ? 0 : max);
  this._activeColIndex.value = nextCol;
  return nextCol;
};

  moveRow = (delta: any) => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const leafLevel = this.headerLeafLevel();
  if (this._activeIsHeader.value) {
    if (delta > 0) {
      // B12 — Down: from a PARENT header level, descend to its FIRST child leaf header (one
      // level down); from the LEAF header level, drop into the body (row 0). A header-level
      // move re-targets activeColIndex (parent↔child column indices differ), so the fresh
      // col is RETURNED for the caller to thread into the focus seam (NOT re-read from $data).
      if (this._activeHeaderLevel.value < leafLevel) {
        const childCol = this.firstChildHeaderColIndex(this._activeHeaderLevel.value, this._activeColIndex.value);
        if (childCol >= 0) {
          const nextLevel = this._activeHeaderLevel.value + 1;
          this._activeHeaderLevel.value = nextLevel;
          this._activeColIndex.value = childCol;
          return {
            row: this._activeRow.value,
            col: childCol,
            isHeader: true,
            level: nextLevel
          };
        }
      }
      // At the leaf header: an empty grid has no body to drop into → stay put.
      if (this.bodyRowCount() === 0) return {
        row: this._activeRow.value,
        col: this._activeColIndex.value,
        isHeader: true,
        level: this._activeHeaderLevel.value
      };
      // B17: crossing from the leaf header INTO the body consumes ONE step; the REMAINING
      // (delta-1) continues the descent, so PageDown (delta=GRID_PAGE_STEP) lands a real
      // page-down body row, NOT row 0 (== ArrowDown). ArrowDown (delta=1) still lands row 0
      // (delta-1 = 0); clamped to the page-last body row.
      const landRow = this.clamp(delta - 1, 0, maxRow);
      this._activeIsHeader.value = false;
      this._activeRow.value = landRow;
      return {
        row: landRow,
        col: this._activeColIndex.value,
        isHeader: false,
        level: 0
      };
    }
    // B12 — Up: from the leaf (or any non-top) header level, ascend to the PARENT header that
    // spans the active column; at the top level (or no real parent) stay put. The parent col
    // index differs from the leaf's, so the fresh col is RETURNED (threaded into focus).
    const parentCol = this.parentHeaderColIndex(this._activeHeaderLevel.value, this._activeColIndex.value);
    if (parentCol >= 0) {
      const nextLevel = this._activeHeaderLevel.value - 1;
      this._activeHeaderLevel.value = nextLevel;
      this._activeColIndex.value = parentCol;
      return {
        row: this._activeRow.value,
        col: parentCol,
        isHeader: true,
        level: nextLevel
      };
    }
    return {
      row: this._activeRow.value,
      col: this._activeColIndex.value,
      isHeader: true,
      level: this._activeHeaderLevel.value
    };
  }
  // In the body: an upward move from row 0 crosses into the LEAF header level (the header row
  // adjacent to the body). The body col index aligns 1:1 with the leaf header col index, so
  // activeColIndex carries over unchanged.
  if (delta < 0 && this._activeRow.value === 0) {
    this._activeIsHeader.value = true;
    this._activeHeaderLevel.value = leafLevel;
    return {
      row: this._activeRow.value,
      col: this._activeColIndex.value,
      isHeader: true,
      level: leafLevel
    };
  }
  const nextRow = this.clamp(this._activeRow.value + delta, 0, maxRow);
  this._activeRow.value = nextRow;
  this._activeIsHeader.value = false;
  return {
    row: nextRow,
    col: this._activeColIndex.value,
    isHeader: false,
    level: 0
  };
};

  gotoColEdge = (toEnd: any) => {
  // #10: End on a grouped PARENT header lands on that level's LAST header (headerCountAtLevel-1),
  // not the leaf-column max — otherwise the ring strands on a phantom cell past the level's
  // headers. Home is index 0 either way. Body cells + the leaf header level keep visibleColCount().
  const count = this._activeIsHeader.value ? this.headerCountAtLevel(this._activeHeaderLevel.value) : this.visibleColCount();
  const max = count - 1;
  const nextCol = toEnd ? max < 0 ? 0 : max : 0;
  this._activeColIndex.value = nextCol;
  return nextCol;
};

  gotoRowEdge = (toEnd: any) => {
  const lastRow = this.bodyRowCount() - 1;
  const nextRow = toEnd ? lastRow < 0 ? 0 : lastRow : 0;
  this._activeRow.value = nextRow;
  this._activeIsHeader.value = false;
  return nextRow;
};

  gotoStart = () => {
  this._activeIsHeader.value = false;
  this._activeRow.value = 0;
  this._activeColIndex.value = 0;
  return {
    row: 0,
    col: 0
  };
};

  gotoEnd = () => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const max = this.visibleColCount() - 1;
  const maxCol = max < 0 ? 0 : max;
  this._activeIsHeader.value = false;
  this._activeRow.value = maxRow;
  this._activeColIndex.value = maxCol;
  return {
    row: maxRow,
    col: maxCol
  };
};

  currentCellEl = () => {
  const rowKey = this._activeIsHeader.value ? '__header' : String(this._activeRow.value);
  return this.resolveCellEl(rowKey, this._activeColIndex.value, this._activeIsHeader.value ? this._activeHeaderLevel.value : null);
};

  focusables = (cellEl: any) => {
  if (!cellEl || !cellEl.querySelectorAll) return [];
  const list = Array.prototype.slice.call(cellEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  return list.filter((n: any) => !n.disabled);
};

  enterControl = () => {
  const cellEl = this.currentCellEl();
  const list = this.focusables(cellEl);
  if (!list.length) return;
  this._activeInControl.value = true;
  list[0].focus();
};

  cycleWithinCell = (cellEl: any, forward: any) => {
  const list = this.focusables(cellEl);
  if (!list.length) return;
  const active = this.gridRoot ? this.gridRoot.getRootNode().activeElement : null;
  const cur = list.indexOf(active);
  let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
  if (i >= list.length) i = 0;
  if (i < 0) i = list.length - 1;
  list[i].focus();
};

  onGridKeyDown = (e: any) => {
  if (!this.isGrid() || !e) return;
  const key = e.key;
  // Editing mode (phase 51, Pitfall 5): an OPEN editor owns Tab/Enter/Escape (+ caret keys)
  // via its local onEditorKeyDown handler. This top check (BEFORE activeInControl) returns
  // early so the grid nav keymap never hijacks an arrow/Tab/Enter while editing — the three
  // modes (editing / in-control / navigation) stay mutually exclusive and ordered.
  if (this._editingRow.value >= 0) return;
  // Full-row edit (phase 51 req-6): an OPEN row editor owns Enter/Escape/Tab via the cell
  // editors' local onEditorKeyDown. Return early (before activeInControl) so the grid nav
  // keymap never hijacks while a row is in edit — the three modes stay mutually exclusive.
  if (this._editingRowIndex.value != null) return;
  // Interaction mode (D-08): Tab cycles within the cell, Escape exits. Focus containment.
  if (this._activeInControl.value) {
    if (key === 'Escape') {
      e.preventDefault();
      this._activeInControl.value = false;
      // Return focus to the OWNING cell (no move happened) — pass the current indices
      // explicitly (the React-emitted seam types both params as required; a zero-arg call
      // is TS2554). Reading $data here is safe: no write to activeRow/activeColIndex precedes it.
      this.focusActiveCell(this._activeRow.value, this._activeColIndex.value);
    } else if (key === 'Tab') {
      e.preventDefault();
      this.cycleWithinCell(this.currentCellEl(), !e.shiftKey);
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
  const prevRow = this._activeRow.value;
  const prevCol = this._activeColIndex.value;
  const prevIsHeader = this._activeIsHeader.value;
  const prevLevel = this._activeHeaderLevel.value;
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
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !this._activeIsHeader.value && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')) {
    e.preventDefault();
    if (key === 'ArrowUp') this.extendRange(-this._activeRow.value, 0);else if (key === 'ArrowDown') this.extendRange(this.bodyRowCount() - 1 - this._activeRow.value, 0);else if (key === 'ArrowLeft') this.extendRange(0, -this._activeColIndex.value);else this.extendRange(0, this.visibleColCount() - 1 - this._activeColIndex.value);
    return;
  } else if ((e.ctrlKey || e.metaKey) && !this._activeIsHeader.value && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')) {
    e.preventDefault();
    this.clearRange();
    if (key === 'ArrowUp') {
      nextRow = this.gotoRowEdge(false);
      nextIsHeader = false;
    } else if (key === 'ArrowDown') {
      nextRow = this.gotoRowEdge(true);
      nextIsHeader = false;
    } else if (key === 'ArrowLeft') {
      nextCol = this.gotoColEdge(false);
    } else {
      nextCol = this.gotoColEdge(true);
    }
  } else if (key === 'ArrowRight' && e.shiftKey && !this._activeIsHeader.value) {
    e.preventDefault();
    this.extendRange(0, 1);
    return;
  } else if (key === 'ArrowLeft' && e.shiftKey && !this._activeIsHeader.value) {
    e.preventDefault();
    this.extendRange(0, -1);
    return;
  } else if (key === 'ArrowDown' && e.shiftKey && !this._activeIsHeader.value) {
    e.preventDefault();
    this.extendRange(1, 0);
    return;
  } else if (key === 'ArrowUp' && e.shiftKey && !this._activeIsHeader.value) {
    e.preventDefault();
    this.extendRange(-1, 0);
    return;
  } else if (key === 'ArrowRight') {
    e.preventDefault();
    this.clearRange();
    nextCol = this.moveCol(1);
  } else if (key === 'ArrowLeft') {
    e.preventDefault();
    this.clearRange();
    nextCol = this.moveCol(-1);
  } else if (key === 'ArrowDown') {
    e.preventDefault();
    this.clearRange();
    const m = this.moveRow(1);
    nextRow = m.row;
    nextCol = m.col;
    nextIsHeader = m.isHeader;
    nextLevel = m.level;
  } else if (key === 'ArrowUp') {
    e.preventDefault();
    this.clearRange();
    const m = this.moveRow(-1);
    nextRow = m.row;
    nextCol = m.col;
    nextIsHeader = m.isHeader;
    nextLevel = m.level;
  } else if (key === 'PageDown') {
    e.preventDefault();
    const m = this.moveRow(this.GRID_PAGE_STEP);
    nextRow = m.row;
    nextCol = m.col;
    nextIsHeader = m.isHeader;
    nextLevel = m.level;
  } else if (key === 'PageUp') {
    e.preventDefault();
    const m = this.moveRow(-this.GRID_PAGE_STEP);
    nextRow = m.row;
    nextCol = m.col;
    nextIsHeader = m.isHeader;
    nextLevel = m.level;
  } else if (key === 'Home') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const s = this.gotoStart();
      nextRow = s.row;
      nextCol = s.col;
      nextIsHeader = false;
    } else {
      nextCol = this.gotoColEdge(false);
    }
  } else if (key === 'End') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const en = this.gotoEnd();
      nextRow = en.row;
      nextCol = en.col;
      nextIsHeader = false;
    } else {
      nextCol = this.gotoColEdge(true);
    }
  }
  // ── Clipboard (phase 51 req-8 / D-03) — Ctrl/Cmd+C copies the range as TSV; Ctrl/Cmd+V
  // pastes TSV into the range under the D-03 skip rule. Placed BEFORE the printable-key
  // edit-entry branch (which excludes ctrl/meta) so the shortcuts are never swallowed as a
  // type-to-edit char. Copy/paste act on the whole range (or the single active cell). B11:
  // gated by clipboardActiveAllowed() (== !activeIsHeader) so a header-active Ctrl+C/Ctrl+V
  // falls through to NATIVE behavior — never preventDefault'd, never a silent body mutation
  // (copyRange/pasteRange also self-guard; the verb guard is what plan 63-09's Cut reuses). ──
  else if ((key === 'c' || key === 'C') && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed()) {
    e.preventDefault();
    this.copyRange();
    return;
  } else if ((key === 'v' || key === 'V') && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed()) {
    e.preventDefault();
    this.pasteRange();
    return;
  }
  // ── C3 (phase 63 wave-9) — Ctrl/Cmd+X CUTS the range: copy the range as TSV then clear the
  // source cells through the SAME write-funnel as paste (one writeData). Same B11 gate as
  // Ctrl+C/Ctrl+V (clipboardActiveAllowed) so a header-active Ctrl+X falls through to NATIVE cut
  // and never silently clears a body cell (cutRange also self-guards). Placed beside the C/V
  // shortcuts, BEFORE the printable-key edit-entry branch (which excludes ctrl/meta). ──
  else if ((key === 'x' || key === 'X') && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed()) {
    e.preventDefault();
    this.cutRange();
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
    if (this.undoable) {
      e.preventDefault();
      this.redo();
      return;
    }
  } else if ((key === 'y' || key === 'Y') && (e.ctrlKey || e.metaKey)) {
    if (this.undoable) {
      e.preventDefault();
      this.redo();
      return;
    }
  } else if ((key === 'z' || key === 'Z') && (e.ctrlKey || e.metaKey)) {
    if (this.undoable) {
      e.preventDefault();
      this.undo();
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
  else if ((key === 'Delete' || key === 'Backspace') && this.clipboardActiveAllowed()) {
    e.preventDefault();
    this.clearActiveRange();
    return;
  }
  // ── §8 (260709-3qt) — Ctrl/Cmd+A selects the WHOLE BODY range (drives the same range corners
  // shift+arrow uses). preventDefault ALWAYS so the page is never selected in grid mode; only a
  // body-active Ctrl+A builds the range (a header-active Ctrl+A is a no-op — selects nothing). ──
  else if ((key === 'a' || key === 'A') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (!this._activeIsHeader.value) this.selectAllBody();
    return;
  }
  // ── Full-row edit entry (phase 51 req-6 / D-06) — Shift+F2 on an editable active cell puts
  // EVERY editable cell in the active row into edit at once. Tested BEFORE the plain F2 branch
  // (a Shift+F2 must NOT fall through to single-cell F2). Shift+F2 was chosen for the lowest
  // collision risk against the Phase-49 keymap. Gated by isActiveCellEditable() (the row has
  // at least the active editable column); a non-editable active cell falls through unchanged.
  else if (key === 'F2' && e.shiftKey && this.isActiveCellEditable()) {
    e.preventDefault();
    this.beginRowEdit((this._rows.value || [])[this._activeRow.value]);
    return;
  }
  // ── Boolean in-place toggle (design doc 2026-07-05, Change 1) — a built-in
  // editor:'checkbox' cell toggles + commits INSTANTLY on Space/Enter/F2, no editor opens
  // (the spreadsheet-standard shape for a two-state value). Tested BEFORE the generic
  // Enter/F2 edit-entry branch below (a checkbox cell must never fall into the open-an-
  // editor ceremony) and gated the SAME way (isActiveCellEditable) plus editorTypeOf ===
  // 'checkbox'. Full-row edit mode is unaffected — the editingRowIndex early return at the
  // top of onGridKeyDown already excludes it.
  else if ((key === 'Enter' || key === 'F2' || key === ' ') && this.isActiveCellEditable() && this.editorTypeOf(this.activeCellColumnId()) === 'checkbox') {
    e.preventDefault();
    this.toggleActiveBooleanCell();
    return;
  }
  // ── Edit-entry (phase 51 req-1/3, D-05) — BEFORE the reserved enterControl branch.
  // Gated by isActiveCellEditable(): a non-editable active cell falls through to
  // enterControl (the Phase-49 behavior is unchanged). F2/Enter seed the EXISTING value
  // (in-place edit); a single printable char (no Ctrl/Meta/Alt) REPLACES the value.
  else if ((key === 'Enter' || key === 'F2') && this.isActiveCellEditable()) {
    e.preventDefault();
    this.beginEdit(this._activeRow.value, this._activeColIndex.value, null);
    return;
  } else if (this.isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && this.editorTypeOf(this.activeCellColumnId()) !== 'checkbox') {
    // B24: a printable key only SEEDS a draft on a free-text editor (text/number). A
    // checkbox/select/date editor must NOT take the typed char as its value (it would
    // force-check the checkbox, seed a garbage select option, or corrupt the date) — open
    // those with the EXISTING value (seed=null), identical to the F2/Enter in-place entry.
    // Checkbox is excluded entirely (type-to-edit disabled — the branch above already
    // handles Space/Enter/F2; any OTHER printable key on a checkbox cell is a no-op).
    e.preventDefault();
    const editType = this.editorTypeOf(this.activeCellColumnId());
    const seed = editType === 'text' || editType === 'number' ? key : null;
    this.beginEdit(this._activeRow.value, this._activeColIndex.value, seed);
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
  else if (key === 'Enter' && !this._activeIsHeader.value && this.rowIsGrouped((this._rows.value || [])[this._activeRow.value])) {
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
    const grpRow = this._activeRow.value;
    const grpCol = this._activeColIndex.value;
    this.onToggleExpand((this._rows.value || [])[this._activeRow.value], e);
    // guardMoved=true: the group header row is UNCHANGED by its own collapse, so a stale late
    // rAF poll must not steal focus back after the user has already ArrowDown'd to another row.
    this.recoverGridFocus(String(grpRow), grpCol, null, true);
    return;
  } else if (key === 'Enter' || key === 'F2') {
    e.preventDefault();
    this.enterControl();
    return;
  } else return;
  // THE seam — built from the SAME fresh post-write locals (Pitfall 2). Always re-assert
  // focus on the resolved cell (harmless on a no-op clamp; corrects any drift otherwise).
  this.focusActiveCell(nextRow, nextCol, nextIsHeader, nextLevel);
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
    this.dispatchEvent(new CustomEvent("activecell-change", {
      detail: nextIsHeader ? {
        rowIndex: null,
        colIndex: nextCol,
        isHeader: true
      } : {
        rowIndex: this.toAbsRow(nextRow),
        colIndex: nextCol,
        isHeader: false
      },
      bubbles: true,
      composed: true
    }));
  }
};

  syncActiveFromEvent = (e: any) => {
  if (!this.isGrid() || !e) return;
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
  const prevIsHeader = this._activeIsHeader.value;
  const prevRow = this._activeRow.value;
  const prevCol = this._activeColIndex.value;
  const prevLevel = this._activeHeaderLevel.value;
  const isHeader = rowAttr === '__header';
  this._activeIsHeader.value = isHeader;
  let movedRow = prevRow;
  let movedLevel = prevLevel;
  if (isHeader) {
    // B12: a click/focus onto a grouped header cell must capture its header LEVEL too, so the
    // roving model + a subsequent ArrowUp/ArrowDown resolve from the correct level (not a stale
    // one). data-header-level is an integer marker on the <th>; fall back to the leaf level.
    const lvlAttr = cellEl.getAttribute('data-header-level');
    const lvl = lvlAttr != null ? parseInt(lvlAttr, 10) : this.headerLeafLevel();
    movedLevel = Number.isFinite(lvl) ? lvl : this.headerLeafLevel();
    this._activeHeaderLevel.value = movedLevel;
  } else {
    const row = parseInt(rowAttr, 10);
    if (Number.isFinite(row)) {
      movedRow = row;
      this._activeRow.value = row;
    }
  }
  this._activeColIndex.value = col;
  // #9: a genuine active-cell MOVE is a fresh focus intent — supersede any pending async focus
  // poll (scroll-to / page-switch). Compare against the PRE-write snapshot: bump only when the
  // header-flag, column, or (per mode) the header LEVEL / body ROW actually changed.
  if (isHeader !== prevIsHeader || col !== prevCol || (isHeader ? movedLevel !== prevLevel : movedRow !== prevRow)) {
    this.focusIntentEpoch = this.focusIntentEpoch + 1;
  }
  // A plain focus collapses any range back to the single active cell — EXCEPT (a) the
  // programmatic settle of an in-flight extendRange (rangeTransition): that focus move lands
  // ON the new range-focus corner and must NOT wipe the range we just set; and (b) the
  // focusin that follows a Shift+Click (rangeClickPending): @mousedown already set the range
  // BEFORE this focusin fires, and a focusin carries no reliable shiftKey, so the @mousedown
  // path owns the shift case and flags it here so the collapse is skipped.
  if (this.rangeTransition) {
    this.rangeTransition = false;
  } else if (this.rangeClickPending) {
    this.rangeClickPending = false;
  } else {
    this.clearRange();
  }
  // The cell box (not an inner control) receiving focus = navigation mode.
  if (tgt === cellEl) this._activeInControl.value = false;
};

  onGridMouseDown = (e: any) => {
  if (!this.isGrid() || !e) return;
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
    this.setRangeFocus(row, col);
    this._activeIsHeader.value = false;
    this._activeRow.value = row;
    this._activeColIndex.value = col;
    this.rangeClickPending = true;
    return;
  }
  // §6 plain mousedown → begin a document-level drag-select anchored at this cell. The mousedown's
  // native focusin commits the ACTIVE cell to (row,col); beginRangeDrag's first cross-cell
  // pointermove paints the range via setRangeFocus (anchored at the active cell). A mousedown with
  // no move collapses to a single active cell (no range).
  this.beginRangeDrag(row, col);
};

  onGridDblClick = (e: any) => {
  if (!this.isGrid() || !e) return;
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
  const rowObj = (this._rows.value || [])[row];
  if (this.rowIsGrouped(rowObj)) {
    // Group-header cell → toggle its collapse/expand through the SAME onToggleExpand funnel the
    // chevron uses (mirrors the C2 Enter-on-group path verbatim), then re-seat focus after the
    // re-render (guardMoved=true — the group-header row is unchanged by its own collapse, so a
    // stale late rAF must not steal focus back after a subsequent nav).
    e.preventDefault();
    this.onToggleExpand(rowObj, e);
    this.recoverGridFocus(String(row), col, null, true);
    return;
  }
  // Editable body cell → open its editor (seed=null → seed the EXISTING value, the in-place F2/
  // Enter entry). A non-editable body cell is a no-op: the cell stays active (focusin already set
  // it + the §1 ring), matching the spreadsheet display-vs-edit convention.
  const colId = this.columnIdAt(row, col);
  if (colId != null && this.columnEditable(colId)) {
    e.preventDefault();
    this.beginEdit(row, col, null);
  }
};

  onGridClick = (e: any) => {
  if (!this.isGrid() || !e) return;
  if (!this.singleClickEdit) return;
  if (e.shiftKey) return;
  // §6 (260709-3qt): a drag-select that MOVED must never open the editor — the editor opens only
  // on a genuine mouseup-no-drag click. beginRangeDrag resets rangeDragMoved=false per gesture, so
  // the flag is always fresh; consume it here so a subsequent plain click still edits.
  if (this.rangeDragMoved) {
    this.rangeDragMoved = false;
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
  if (this._editingRow.value === row && this._editingCol.value === col) return;
  const colId = this.columnIdAt(row, col);
  if (colId != null && this.columnEditable(colId)) this.beginEdit(row, col, null);
};

  onGridFocusOut = (e: any) => {
  if (!this.isGrid() || !this._activeInControl.value) return;
  const next = e ? e.relatedTarget : null;
  const cellEl = this.currentCellEl();
  if (!cellEl || !next || !cellEl.contains(next)) this._activeInControl.value = false;
};

  recoverGridFocus = (rowKey: any, col: any, level: any, guardMoved = false) => {
  if (!this.gridRoot) return;
  let attempts = 0;
  const tryFocus = () => {
    if (guardMoved) {
      const ae = this.gridRoot && this.gridRoot.getRootNode ? this.gridRoot.getRootNode().activeElement : null;
      const aeCell = ae && ae.closest ? ae.closest('[data-grid-cell]') : null;
      if (aeCell && this.gridRoot.contains(aeCell)) {
        const aeRow = aeCell.getAttribute('data-row');
        if (aeRow != null && aeRow !== rowKey) return;
      }
    }
    const el = this.resolveCellEl(rowKey, col, level);
    if (el) {
      el.focus();
      return;
    }
    attempts = attempts + 1;
    if (attempts >= 30) return;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
};

  clampActiveCell = (rowCount: any, colCount: any) => {
  if (!this.isGrid()) return;
  // B8/B23 React-stale guard: the bounds come from the FRESH model the caller (refreshRowModel)
  // just derived and passes in — NEVER re-read $data.rows here. `$data.rows = nextRows` is an
  // async useState on React, so bodyRowCount()/visibleColCount() would see the PRE-change model
  // and SKIP a legitimate shrink-clamp (a filter-to-fewer left the active cell / range corners
  // out of bounds on React only). Falls back to the live helpers when called without bounds.
  const colN = colCount != null ? colCount : this.visibleColCount();
  const rowN = rowCount != null ? rowCount : this.bodyRowCount();
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
  if (this.gridRoot) {
    const rootNode = this.gridRoot.getRootNode ? this.gridRoot.getRootNode() : null;
    const focusedEl = rootNode ? rootNode.activeElement : null;
    const focusedCell = focusedEl && focusedEl.closest ? focusedEl.closest('[data-grid-cell]') : null;
    if (focusedCell && this.gridRoot.contains(focusedCell)) {
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
  const col = this.clamp(this._activeColIndex.value, 0, maxCol < 0 ? 0 : maxCol);
  if (col !== this._activeColIndex.value) this._activeColIndex.value = col;
  // B6: an empty / all-filtered grid has NO body cell to hold the active cell. Park the active
  // cell on the leaf-header fallback (col 0) so the roving tab-stop stays on a REAL cell (never
  // an absent body cell → focus lost into <body>), and flag it so the next non-empty refresh
  // re-seats a body cell. The cellTabindex empty-fallback keeps exactly one header tab-stop.
  if (rowN <= 0) {
    this._activeIsHeader.value = true;
    this._activeHeaderLevel.value = this.headerLeafLevel();
    this._activeColIndex.value = 0;
    // B6 — `gridEmptyFallback` is a plain component-scope `let` (NOT $data): clampActiveCell is
    // reached through the mount-time refreshRowModel closure, so a `$data` READ here binds the
    // async-stale mount-time value on React (setState is async — the rangeActive / B23-nextRows
    // class). A synchronously-written plain `let` is read FRESH on all six so the empty→non-empty
    // recovery branch below actually runs on React too.
    this.gridEmptyFallback = true;
    this.clampRange(rowN - 1, colN - 1);
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
  if (this.gridEmptyFallback) {
    this.gridEmptyFallback = false;
    this._activeIsHeader.value = false;
    this._activeRow.value = 0;
  }
  if (!this._activeIsHeader.value) {
    const lastRow = rowN - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const row = this.clamp(this._activeRow.value, 0, maxRow);
    if (row !== this._activeRow.value) this._activeRow.value = row;
  }
  // B8: clamp the range-selection corners to the same FRESH bounds (a sort/filter/paginate that
  // shrank the model would otherwise leave a stale rectangle → phantom copy rows + an
  // out-of-bounds getSelectedRange). Reconcile-only (no range-change emit here, B18/B19).
  this.clampRange(rowN - 1, colN - 1);
  // B25: recover DOM focus onto the re-indexed valid cell (deferred until the new model renders)
  // when the shrink removed the focused cell. The target is the DOOMED cell's own coords clamped
  // into the fresh bounds (React-stale-safe — see the doomedRow/doomedCol note above).
  if (recoverFocus) {
    const recRow = this.clamp(doomedRow, 0, rowN - 1);
    const recCol = this.clamp(doomedCol, 0, maxCol < 0 ? 0 : maxCol);
    this.recoverGridFocus(String(recRow), recCol, null);
  }
};

  gridEmptyFallback = false;

  rangeTransition = false;

  rangeClickPending = false;

  rangeActive = false;

  inRange = (rIdx: any, cIdx: any) => {
  const a = this._rangeAnchor.value;
  const f = this._rangeFocus.value;
  if (!a || !f) return false;
  const r0 = a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex;
  const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
  const c0 = a.colIndex < f.colIndex ? a.colIndex : f.colIndex;
  const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
  return rIdx >= r0 && rIdx <= r1 && cIdx >= c0 && cIdx <= c1;
};

  getSelectedRange = () => {
  // B8: clamp the corners to the CURRENT bounds ON READ so the verb (and the range-change emit
  // payload) never reports a corner past a shrunken model — React-stale-safe (the eager
  // refreshRowModel clamp is async-defeated on React; this read-time clamp is the guarantee).
  const a = this._rangeAnchor.value;
  const f = this._rangeFocus.value;
  if (!a && !f) return {
    anchor: null,
    focus: null
  };
  const maxRow = this.bodyRowCount() - 1;
  const maxCol = this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) return {
    anchor: null,
    focus: null
  };
  const clampCorner = (c: any) => c == null ? null : {
    rowIndex: this.clamp(c.rowIndex, 0, maxRow),
    colIndex: this.clamp(c.colIndex, 0, maxCol)
  };
  return {
    anchor: clampCorner(a),
    focus: clampCorner(f)
  };
};

  isFillHandleCell = (rIdx: any, cIdx: any) => {
  const a = this._rangeAnchor.value;
  const f = this._rangeFocus.value;
  if (!a || !f) return false;
  const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
  const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
  return rIdx === r1 && cIdx === c1;
};

  emitRangeChange = (anchor: any, focus: any) => {
  this.dispatchEvent(new CustomEvent("range-change", {
    detail: {
      anchor,
      focus
    },
    bubbles: true,
    composed: true
  }));
};

  extendRange = (dRow: any, dCol: any) => {
  if (this._activeIsHeader.value) return;
  const maxRow = this.bodyRowCount() - 1;
  const maxCol = this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) return;
  // Seed the anchor + focus from the active cell on the FIRST extend (no range yet).
  let anchor = this._rangeAnchor.value;
  let focus = this._rangeFocus.value;
  const hadRange = !!(anchor && focus);
  if (!anchor || !focus) {
    anchor = {
      rowIndex: this._activeRow.value,
      colIndex: this._activeColIndex.value
    };
    focus = {
      rowIndex: this._activeRow.value,
      colIndex: this._activeColIndex.value
    };
  }
  const nextRow = this.clamp(focus.rowIndex + dRow, 0, maxRow);
  const nextCol = this.clamp(focus.colIndex + dCol, 0, maxCol);
  const nextFocus = {
    rowIndex: nextRow,
    colIndex: nextCol
  };
  this._rangeAnchor.value = anchor;
  this._rangeFocus.value = nextFocus;
  this.rangeActive = true;
  // Keep the active cell tracking the moving focus corner (so a follow-up F2 / arrow acts
  // from the range's leading edge, the spreadsheet convention).
  this._activeRow.value = nextRow;
  this._activeColIndex.value = nextCol;
  // Suppress the focus-move's @focusin clearRange (no shiftKey on a programmatic focus): the
  // settle on the new focus corner is part of THIS range extension, not a fresh navigation.
  this.rangeTransition = true;
  this.focusActiveCell(nextRow, nextCol, false);
  // B18: emit range-change ONLY on an actual change. A clamped no-op (a range already exists
  // and the focus corner did not move — Shift+Arrow into the grid boundary) is not a selection
  // change → no emit. Seeding a brand-new range (no prior range) is always a change (the
  // rectangle came into existence) even if its first corner is a degenerate 1×1.
  if (!hadRange || nextRow !== focus.rowIndex || nextCol !== focus.colIndex) {
    this.emitRangeChange(anchor, nextFocus);
  }
};

  setRangeFocus = (rIdx: any, cIdx: any) => {
  const maxRow = this.bodyRowCount() - 1;
  const maxCol = this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) return;
  let anchor = this._rangeAnchor.value;
  if (!anchor) anchor = {
    rowIndex: this._activeRow.value,
    colIndex: this._activeColIndex.value
  };
  const r = this.clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow);
  const c = this.clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol);
  const nextFocus = {
    rowIndex: r,
    colIndex: c
  };
  this._rangeAnchor.value = anchor;
  this._rangeFocus.value = nextFocus;
  this.rangeActive = true;
  this.emitRangeChange(anchor, nextFocus);
};

  selectAllBody = () => {
  const maxRow = this.bodyRowCount() - 1;
  const maxCol = this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) return;
  const anchor = {
    rowIndex: 0,
    colIndex: 0
  };
  const focus = {
    rowIndex: maxRow,
    colIndex: maxCol
  };
  this._rangeAnchor.value = anchor;
  this._rangeFocus.value = focus;
  this.rangeActive = true;
  this.emitRangeChange(anchor, focus);
};

  clearRange = () => {
  // B19: gate on the SYNCHRONOUS rangeActive mirror, NOT a $data re-read. clearRange runs twice
  // in one plain-arrow keydown (explicit collapse + the focusin after the programmatic focus
  // move); on React `$data.rangeAnchor = null` is async, so a `$data.rangeAnchor == null` guard
  // would let the SECOND call through and emit a duplicate range-change. rangeActive flips
  // synchronously → the second call returns here.
  if (!this.rangeActive) return;
  this.rangeActive = false;
  this._rangeAnchor.value = null;
  this._rangeFocus.value = null;
  this.emitRangeChange(null, null);
};

  clampRange = (maxRowArg: any, maxColArg: any) => {
  const a = this._rangeAnchor.value;
  const f = this._rangeFocus.value;
  if (!a && !f) return;
  // Bounds passed from the FRESH model (clampActiveCell → refreshRowModel's nextRows) so the
  // shrink-clamp is React-stale-safe; fall back to the live helpers for a direct call.
  const maxRow = maxRowArg != null ? maxRowArg : this.bodyRowCount() - 1;
  const maxCol = maxColArg != null ? maxColArg : this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) {
    this._rangeAnchor.value = null;
    this._rangeFocus.value = null;
    this.rangeActive = false;
    return;
  }
  if (a) {
    const ar = this.clamp(a.rowIndex, 0, maxRow);
    const ac = this.clamp(a.colIndex, 0, maxCol);
    if (ar !== a.rowIndex || ac !== a.colIndex) this._rangeAnchor.value = {
      rowIndex: ar,
      colIndex: ac
    };
  }
  if (f) {
    const fr = this.clamp(f.rowIndex, 0, maxRow);
    const fc = this.clamp(f.colIndex, 0, maxCol);
    if (fr !== f.rowIndex || fc !== f.colIndex) this._rangeFocus.value = {
      rowIndex: fr,
      colIndex: fc
    };
  }
};

  announce = (msg: any) => {
  this._pasteAnnounce.value = msg != null ? msg : '';
};

  clipboardActiveAllowed = () => !this._activeIsHeader.value;

  fieldOfColId = (colId: any) => {
  const d = this.defFor(colId);
  return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
};

  normalizedRange = () => {
  const a = this._rangeAnchor.value;
  const f = this._rangeFocus.value;
  if (!a || !f) return null;
  const maxRow = this.bodyRowCount() - 1;
  const maxCol = this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) return null;
  const ar = this.clamp(a.rowIndex, 0, maxRow);
  const ac = this.clamp(a.colIndex, 0, maxCol);
  const fr = this.clamp(f.rowIndex, 0, maxRow);
  const fc = this.clamp(f.colIndex, 0, maxCol);
  return {
    r0: ar < fr ? ar : fr,
    r1: ar > fr ? ar : fr,
    c0: ac < fc ? ac : fc,
    c1: ac > fc ? ac : fc
  };
};

  escapeTsvField = (s: any) => {
  if (s.indexOf('\t') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0 || s.indexOf('"') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

  rangeToTsv = () => {
  const box = this.normalizedRange();
  const r0 = box ? box.r0 : this._activeRow.value;
  const r1 = box ? box.r1 : this._activeRow.value;
  const c0 = box ? box.c0 : this._activeColIndex.value;
  const c1 = box ? box.c1 : this._activeColIndex.value;
  const lines = [];
  for (let r = r0; r <= r1; r++) {
    const cells = [];
    for (let c = c0; c <= c1; c++) {
      const v = this.cellValueAt(r, c);
      cells.push(this.escapeTsvField(v == null ? '' : String(v)));
    }
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
};

  parseTsv = (text: any) => {
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
};

  copyRange = () => {
  // B11: never copy from a header-active state (the reusable clipboard guard).
  if (!this.clipboardActiveAllowed()) return;
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) return;
  try {
    const p = navigator.clipboard.writeText(this.rangeToTsv());
    if (p && p.catch) p.catch(() => {});
  } catch (err: any) {/* best-effort copy */}
};

  applyGridToRange = (grid: any, originRow: any, originCol: any) => {
  const maxRow = this.bodyRowCount() - 1;
  const maxCol = this.visibleColCount() - 1;
  if (maxRow < 0 || maxCol < 0) return {
    wrote: 0,
    total: 0
  };
  let total = 0;
  let wrote = 0;
  const committed = [];
  // Build the fresh data array incrementally so the whole paste is ONE writeData.
  let next = this.currentData();
  for (let gr = 0; gr < grid.length; gr++) {
    const r = originRow + gr;
    if (r > maxRow) break;
    const cols = grid[gr] || [];
    for (let gc = 0; gc < cols.length; gc++) {
      const c = originCol + gc;
      if (c > maxCol) break;
      total = total + 1;
      const colId = this.columnIdAt(r, c);
      if (colId == null || !this.columnEditable(colId)) continue;
      const rowObj = this.rowOriginalAt(r);
      // B9: coerce the raw TSV string to the target column's type at commit (mirrors B3's
      // single-cell commit coercion) — a numeric column commits a real Number, an empty cell
      // commits null; every other editor type passes through verbatim. No mixed/garbage types
      // ever reach the model (T-63-03-01). Validation then runs on the COERCED value.
      const value = this.coerceCellValue(colId, cols[gc]);
      // T-51-01: validate the pasted value as plain DATA before any write.
      if (this.runValidator(colId, value, rowObj) !== true) continue;
      const field = this.fieldOfColId(colId);
      const srcIndex = this.sourceIndexOfRow(r);
      const oldValue = rowObj ? rowObj[field] : null;
      next = this.replaceRowValue(next, srcIndex, field, value);
      committed.push({
        rowId: this.rowIdAt(r),
        columnId: colId,
        oldValue,
        newValue: value
      });
      wrote = wrote + 1;
    }
  }
  if (wrote > 0) {
    this.editTransition = true;
    this.writeData(next);
    this.editTransition = false;
    // One cell-edit-commit per COMMITTED cell (the per-cell event contract, D-03).
    for (let i = 0; i < committed.length; i++) this.dispatchEvent(new CustomEvent("cell-edit-commit", {
      detail: committed[i],
      bubbles: true,
      composed: true
    }));
  }
  // WR-02: announce the N-of-M summary only when at least one cell was written. When the paste
  // targeted real cells but every one was skipped (validation-failed / non-editable), announce a
  // distinct validation-failed message instead of a misleading "0 of M cells pasted".
  if (wrote > 0) this.announce(wrote + ' of ' + total + ' cells pasted');else if (total > 0) this.announce('No cells pasted — ' + total + ' cells were invalid or read-only');
  return {
    wrote,
    total
  };
};

  rowOriginalAt = (rowIndex: any) => {
  const rowList = this._rows.value || [];
  const row = rowList[rowIndex];
  return row ? row.original : null;
};

  rowIdAt = (rowIndex: any) => {
  const rowList = this._rows.value || [];
  const row = rowList[rowIndex];
  return row ? row.id : null;
};

  tileGridToBox = (grid: any, box: any) => {
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
};

  pasteRange = () => {
  // B11: never paste into a header-active state (the reusable clipboard guard) — a header
  // anchor would silently write body row 0 at the header's column.
  if (!this.clipboardActiveAllowed()) return;
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) return;
  // CR-02 (ROZ138): SNAPSHOT the destination SYNCHRONOUSLY, before the clipboard read resolves.
  // C3: the destination is the SELECTED RANGE (the tiling target) when one exists, else the
  // single active cell. $data.rangeAnchor/rangeFocus + activeRow/activeColIndex are useState-backed
  // on React; re-reading them inside the async .then() returns the mount-render stale value, so a
  // selection/cell move between Ctrl+V and the read resolving would anchor the paste wrong. Capture
  // the box + anchor now and pass them into tileGridToBox / applyGridToRange.
  const box = this.normalizedRange();
  const anchorRow = box ? box.r0 : this._activeRow.value;
  const anchorCol = box ? box.c0 : this._activeColIndex.value;
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
    const grid = this.parseTsv(text);
    if (!grid.length) return;
    // C3: tile the clipboard block to fill the destination range (single→range fill,
    // smaller-tiles-into-larger); a clipboard larger than the box pastes its full block.
    const tiled = this.tileGridToBox(grid, destBox);
    this.applyGridToRange(tiled, anchorRow, anchorCol);
  }).catch(() => {});
};

  cutRange = () => {
  if (!this.clipboardActiveAllowed()) return;
  // Snapshot the source rectangle synchronously (same ROZ138 concern as pasteRange).
  const box = this.normalizedRange();
  const r0 = box ? box.r0 : this._activeRow.value;
  const r1 = box ? box.r1 : this._activeRow.value;
  const c0 = box ? box.c0 : this._activeColIndex.value;
  const c1 = box ? box.c1 : this._activeColIndex.value;
  // Copy first (best-effort) — rangeToTsv() reads the CURRENT range/active cell NOW, before the clear.
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      const cp = navigator.clipboard.writeText(this.rangeToTsv());
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
  this.applyGridToRange(grid, r0, c0);
};

  clearActiveRange = () => {
  if (!this.clipboardActiveAllowed()) return;
  // Snapshot the source rectangle synchronously (the ROZ138 concern cutRange/pasteRange share).
  const box = this.normalizedRange();
  const r0 = box ? box.r0 : this._activeRow.value;
  const r1 = box ? box.r1 : this._activeRow.value;
  const c0 = box ? box.c0 : this._activeColIndex.value;
  const c1 = box ? box.c1 : this._activeColIndex.value;
  const grid = [];
  for (let r = r0; r <= r1; r++) {
    const cols = [];
    for (let c = c0; c <= c1; c++) cols.push('');
    grid.push(cols);
  }
  this.applyGridToRange(grid, r0, c0);
};

  tileIndex = (i: any, lo: any, hi: any) => {
  const span = hi - lo + 1;
  if (span <= 1) return lo;
  let k = (i - lo) % span;
  if (k < 0) k = k + span;
  return lo + k;
};

  fillRange = (sourceBox: any, endCell: any) => {
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
    box = this.normalizedRange();
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
      const sr = this.tileIndex(r, src.r0, src.r1);
      const sc = this.tileIndex(c, src.c0, src.c1);
      const v = this.cellValueAt(sr, sc);
      cols.push(v == null ? '' : String(v));
    }
    grid.push(cols);
  }
  this.applyGridToRange(grid, box.r0, box.c0);
};

  fillDragging = false;

  fillDragMove: any = null;

  fillDragUp: any = null;

  teardownFillDrag = () => {
  if (typeof document !== 'undefined') {
    if (this.fillDragMove) document.removeEventListener('pointermove', this.fillDragMove);
    if (this.fillDragUp) document.removeEventListener('pointerup', this.fillDragUp);
  }
  this.fillDragMove = null;
  this.fillDragUp = null;
  this.fillDragging = false;
};

  cellIndexFromPoint = (clientX: any, clientY: any) => {
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
};

  onFillHandlePointerDown = (e: any) => {
  if (!e) return;
  if (e.preventDefault) e.preventDefault();
  if (e.stopPropagation) e.stopPropagation();
  this.fillDragging = true;
  // B7: snapshot the PRE-DRAG rectangle (the fill SOURCE) NOW, before pointermove grows the
  // range via setRangeFocus. fillRange reads each source column's own value off THIS box, so an
  // up/left drag copies from the real origin (not the post-drag corner that would flip to a
  // target cell). Captured per-gesture in the closure (no module-let needed).
  const sourceBox = this.normalizedRange();
  // B7: track the LAST cell the drag reached so fillRange computes the extended rectangle from
  // the gesture's fresh endpoint (React's `up` closure can't re-read the grown $data range).
  let lastCell = sourceBox ? {
    r: sourceBox.r1,
    c: sourceBox.c1
  } : null;
  const move = (ev: any) => {
    if (!this.fillDragging) return;
    const cell = this.cellIndexFromPoint(ev.clientX, ev.clientY);
    // B20: dedup by target cell. setRangeFocus emits range-change, so calling it on EVERY
    // pointermove (the pointer fires many per cell) spams the event with identical payloads.
    // Only extend (and emit) when the pointer enters a DIFFERENT cell than the last — lastCell
    // seeds from the pre-drag bottom-right corner, so a move that stays on the source corner
    // or re-enters the same cell is suppressed (the range is unchanged).
    if (cell && (!lastCell || cell.r !== lastCell.r || cell.c !== lastCell.c)) {
      lastCell = cell;
      this.setRangeFocus(cell.r, cell.c);
    }
  };
  const up = () => {
    // teardownFillDrag clears fillDragging + removes both listeners (CR-04 shared path).
    this.teardownFillDrag();
    // A plain click on the fill handle (pointerdown+up with NO intervening drag) leaves lastCell
    // at the source box's own origin corner (r1,c1), so fillRange(sourceBox, corner) would
    // recommit the source range onto ITSELF — a no-op write that pollutes undo history and fires
    // spurious per-cell cell-edit-commit events (oldValue === newValue). Only fill when the drag
    // actually reached a cell past the source origin.
    if (lastCell && sourceBox && (lastCell.r !== sourceBox.r1 || lastCell.c !== sourceBox.c1)) {
      this.fillRange(sourceBox, lastCell);
    }
  };
  // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
  this.fillDragMove = move;
  this.fillDragUp = up;
  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
};

  rangeDragging = false;

  rangeDragMove: any = null;

  rangeDragUp: any = null;

  rangeDragMoved = false;

  teardownRangeDrag = () => {
  if (typeof document !== 'undefined') {
    if (this.rangeDragMove) document.removeEventListener('pointermove', this.rangeDragMove);
    if (this.rangeDragUp) document.removeEventListener('pointerup', this.rangeDragUp);
  }
  this.rangeDragMove = null;
  this.rangeDragUp = null;
  this.rangeDragging = false;
};

  beginRangeDrag = (anchorR: any, anchorC: any) => {
  this.rangeDragging = true;
  this.rangeDragMoved = false;
  let lastCell = {
    r: anchorR,
    c: anchorC
  };
  const move = (ev: any) => {
    if (!this.rangeDragging) return;
    const cell = this.cellIndexFromPoint(ev.clientX, ev.clientY);
    if (cell && (cell.r !== lastCell.r || cell.c !== lastCell.c)) {
      lastCell = cell;
      this.rangeDragMoved = true;
      this.setRangeFocus(cell.r, cell.c);
    }
  };
  const up = () => {
    // teardownRangeDrag clears rangeDragging + removes both listeners (the fill-drag CR-04 path).
    this.teardownRangeDrag();
  };
  // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
  this.rangeDragMove = move;
  this.rangeDragUp = up;
  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
};

  activeCellColumnId = () => {
  if (this._activeIsHeader.value) return null;
  const rowList = this._rows.value || [];
  const row = rowList[this._activeRow.value];
  if (!row) return null;
  const cells = this.visibleCellsFor(row);
  const cell = cells[this._activeColIndex.value];
  return cell && cell.column ? cell.column.id : null;
};

  isActiveCellEditable = () => {
  const colId = this.activeCellColumnId();
  return colId != null && this.columnEditable(colId);
};

  isEditing = (rowIndex: any, colIndex: any) => {
  if (this._editVer.value < 0) return false;
  if (this._editingRowIndex.value != null && this._editingRowIndex.value === rowIndex) {
    const colId = this.columnIdAt(rowIndex, colIndex);
    return colId != null && this.columnEditable(colId);
  }
  return this._editingRow.value === rowIndex && this._editingCol.value === colIndex;
};

  cellAriaInvalid = (rowIndex: any, colIndex: any): 'true' | null => this.isEditing(rowIndex, colIndex) && !!this._invalidMsg.value ? 'true' : null;

  runValidator = (colId: any, value: any, row: any) => {
  const m = this.editMetaOf(colId);
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
};

  setInvalid = (msg: any) => {
  this._invalidMsg.value = msg != null ? msg : '';
};

  replaceRowValue = (rows: any, rowIndex: any, field: any, value: any) => {
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
};

  sourceIndexOfRow = (visibleRowIndex: any) => {
  const rowList = this._rows.value || [];
  const row = rowList[visibleRowIndex];
  if (!row) return visibleRowIndex;
  const orig = row.original;
  const data = this.currentData() || [];
  const idx = data.indexOf(orig);
  return idx >= 0 ? idx : visibleRowIndex;
};

  editingColumnId = () => {
  const rowList = this._rows.value || [];
  const row = rowList[this._editingRow.value];
  if (!row) return null;
  const cells = this.visibleCellsFor(row);
  const cell = cells[this._editingCol.value];
  return cell && cell.column ? cell.column.id : null;
};

  editingColumnField = () => {
  const colId = this.editingColumnId();
  if (colId == null) return null;
  const d = this.defFor(colId);
  return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
};

  editingCellValue = () => {
  const rowList = this._rows.value || [];
  const row = rowList[this._editingRow.value];
  if (!row) return null;
  const cells = this.visibleCellsFor(row);
  const cell = cells[this._editingCol.value];
  return cell ? cell.getValue() : null;
};

  editingRowOriginal = () => {
  const rowList = this._rows.value || [];
  const row = rowList[this._editingRow.value];
  return row ? row.original : null;
};

  editingRowId = () => {
  const rowList = this._rows.value || [];
  const row = rowList[this._editingRow.value];
  return row ? row.id : null;
};

  focusEditorWhenReady = (selectAll = true) => {
  if (!this.gridRoot) return;
  let attempts = 0;
  const tryFocus = () => {
    const el = this.gridRoot ? this.gridRoot.querySelector('[data-editing-cell]') : null;
    // Do NOT stomp focus a later interaction already placed in a DIFFERENT column's editor of
    // this row: focusEditorWhenReady only needs to get focus INTO the (first) freshly-mounted
    // editor; if focus already sits in another editable cell, a late rAF re-focus would steal it
    // back to the first editor and break row-mode Tab containment (the non-deterministic B21
    // focus-theft). Compare the OWNING cell's data-col-index (NOT node identity) so a stale
    // SAME-column editor node on Solid's node-replacing re-render still resolves as the target —
    // a genuinely dropped focus is still recovered.
    const ae = this.gridRoot && this.gridRoot.getRootNode ? this.gridRoot.getRootNode().activeElement : null;
    if (ae && el && ae !== el && ae.closest && this.gridRoot.contains(ae) && ae.hasAttribute && ae.hasAttribute('data-editing-cell')) {
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
};

  columnIdAt = (rowIndex: any, colIndex: any) => {
  const rowList = this._rows.value || [];
  const row = rowList[rowIndex];
  if (!row) return null;
  const cells = this.visibleCellsFor(row);
  const cell = cells[colIndex];
  return cell && cell.column ? cell.column.id : null;
};

  cellValueAt = (rowIndex: any, colIndex: any) => {
  const rowList = this._rows.value || [];
  const row = rowList[rowIndex];
  if (!row) return null;
  const cells = this.visibleCellsFor(row);
  const cell = cells[colIndex];
  return cell ? cell.getValue() : null;
};

  beginEdit = (rowIndex: any, colIndex: any, seed: any) => {
  const colId = this.columnIdAt(rowIndex, colIndex);
  if (colId == null || !this.columnEditable(colId)) return;
  // A new edit session starts — reset the sync idempotency latch so THIS session's eventual
  // commit is not silently no-op'd by a PRIOR session's already-set latch.
  this.committedThisSession = false;
  this.setInvalid('');
  // Single-cell and full-row edit are mutually exclusive (D-06): entering a single-cell
  // editor clears any row-edit state so isEditing never resolves both modes for one cell.
  this._editingRowIndex.value = null;
  this._rowDraft.value = {};
  this._editingRow.value = rowIndex;
  this._editingCol.value = colIndex;
  this._draftValue.value = seed != null ? seed : this.cellValueAt(rowIndex, colIndex);
  this._activeInControl.value = true;
  this._editVer.value = this._editVer.value + 1;
  // B2: a seeded (type-to-edit) entry must NOT select-all — keep the caret after the
  // seeded char so subsequent typing appends instead of replacing it.
  this.focusEditorWhenReady(seed == null);
};

  focusCellWhenReady = (row: any, col: any) => {
  if (!this.gridRoot) return;
  let attempts = 0;
  const tryFocus = () => {
    const el = this.resolveCellEl(String(row), col);
    if (el) {
      el.focus();
      return;
    }
    attempts = attempts + 1;
    if (attempts >= 30) return;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
};

  indexOfRowIn = (rows: any, rowOriginal: any, rowId: any) => {
  const list = rows || [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r) continue;
    if (rowId != null && r.id === rowId) return i;
    if (rowOriginal != null && r.original === rowOriginal) return i;
  }
  return -1;
};

  endEdit = () => {
  this._editingRow.value = -1;
  this._editingCol.value = -1;
  this._draftValue.value = null;
  this._invalidMsg.value = '';
  this._activeInControl.value = false;
  this._editVer.value = this._editVer.value + 1;
};

  endRowEdit = () => {
  this._editingRowIndex.value = null;
  this._rowDraft.value = {};
  this._invalidMsg.value = '';
  this._activeInControl.value = false;
  this._editVer.value = this._editVer.value + 1;
};

  coerceCellValue = (colId: any, raw: any) => {
  if (this.editorTypeOf(colId) !== 'number') return raw;
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

  commitEdit = (overrideValue = undefined, skipFocusReturn = false) => {
  if (this._editingRow.value < 0) return false;
  // Sync idempotency latch (drop-in double cell-edit-commit fix): a second commitEdit call
  // within the SAME edit session — the deferred drop-in's unmount-blur re-entry, which on
  // React fires while $data.editingRow is still async-stale ≥ 0 — no-ops here instead of
  // re-validating/re-writing/re-emitting. Reset by beginEdit/beginRowEdit/editCell.
  if (this.committedThisSession) return false;
  const colId = this.editingColumnId();
  if (colId == null) {
    this.endEdit();
    return false;
  }
  const field = this.editingColumnField();
  const oldValue = this.editingCellValue();
  const rowOriginal = this.editingRowOriginal();
  const rowId = this.editingRowId();
  // B3: coerce by the column's editor type BEFORE validation + write so the validator
  // and the model both see the typed value (number/null), not the raw draft string.
  const rawValue = overrideValue !== undefined ? overrideValue : this._draftValue.value;
  const newValue = this.coerceCellValue(colId, rawValue);
  const err = this.runValidator(colId, newValue, rowOriginal);
  if (err !== true) {
    // D-01: reject — keep the editor open, announce, re-trap focus, NEVER write the model.
    this.setInvalid(err);
    this.focusEditorWhenReady();
    return false;
  }
  this.setInvalid('');
  // #5: a no-op commit (the coerced value is UNCHANGED — a bare Enter/Tab/blur that edited
  // nothing) must do NO model write, NO history record, and NO commit event: writeData →
  // recordSnapshot UNCONDITIONALLY clears the redo stack and mints a fresh row identity, so an
  // unconditional write on a no-op would destroy redo + spuriously re-render + emit a no-op
  // cell-edit-commit. Compute `changed` and gate the write/emit on it; ALWAYS close the editor.
  const changed = !Object.is(newValue, oldValue);
  // Snapshot the EDITING cell to return focus to BEFORE endEdit clears editing state.
  const focusRow = this._editingRow.value;
  const focusCol = this._editingCol.value;
  // Guard the teardown blur: writeData/endEdit re-render unmounts the editor → its blur
  // must NOT re-enter commitEdit (double cell-edit-commit). Cleared after the focus return.
  this.editTransition = true;
  // Sync idempotency latch: flip BEFORE writeData/endEdit so the async unmount-blur re-entry
  // (which fires AFTER this call returns, once editTransition is already back to false) finds
  // it set at the top-of-function guard above and no-ops. Set on BOTH paths so a no-op commit
  // is just as re-entry-safe as a real one.
  this.committedThisSession = true;
  if (changed) {
    const srcIndex = this.sourceIndexOfRow(this._editingRow.value);
    const next = this.replaceRowValue(this.currentData(), srcIndex, field, newValue);
    this.writeData(next);
    // Exactly one emit per commit, from this single call site (writeData does NOT emit).
    this.dispatchEvent(new CustomEvent("cell-edit-commit", {
      detail: {
        rowId,
        columnId: colId,
        oldValue,
        newValue
      },
      bubbles: true,
      composed: true
    }));
  }
  this.endEdit();
  this.editTransition = false;
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
    if (skipFocusReturn !== true) this.pendingEditFollow = {
      rowOriginal,
      rowId,
      col: focusCol
    };
  } else if (skipFocusReturn !== true) {
    // #5 no-op path: nothing was written, so refreshRowModel never runs and would never consume
    // a pendingEditFollow — focus would drop to <body>. Return focus DIRECTLY. The row does NOT
    // relocate (no write), so the B23 relocation hazard that forces the pendingEditFollow path on
    // a real commit does not apply here: the fixed (focusRow, focusCol) is correct and safe.
    this.focusCellWhenReady(focusRow, focusCol);
  }
  return true;
};

  toggleActiveBooleanCell = () => {
  const colId = this.columnIdAt(this._activeRow.value, this._activeColIndex.value);
  if (colId == null || !this.columnEditable(colId)) return;
  const rowList = this._rows.value || [];
  const row = rowList[this._activeRow.value];
  if (!row) return;
  const rowOriginal = row.original;
  const rowId = row.id;
  const oldValue = this.cellValueAt(this._activeRow.value, this._activeColIndex.value);
  const newValue = !oldValue;
  // D-01: same discipline as commitEdit — a rejecting validator blocks the toggle. There is
  // no editor to keep open here, so the toggle simply does not apply (no model write).
  const err = this.runValidator(colId, newValue, rowOriginal);
  if (err !== true) {
    this.setInvalid(err);
    return;
  }
  this.setInvalid('');
  const def = this.defFor(colId);
  const field = def && def.accessorKey != null ? def.accessorKey : colId;
  const srcIndex = this.sourceIndexOfRow(this._activeRow.value);
  // Sync idempotency latch: this toggle is a commit-equivalent (mirrors commitEdit's D-07
  // single-emit discipline) — flip it too so a stray re-entry after this toggle no-ops.
  this.committedThisSession = true;
  this.writeData(this.replaceRowValue(this.currentData(), srcIndex, field, newValue));
  // Exactly one emit per toggle, from this single call site (writeData does NOT emit) —
  // mirrors commitEdit's D-07 single-emit discipline.
  this.dispatchEvent(new CustomEvent("cell-edit-commit", {
    detail: {
      rowId,
      columnId: colId,
      oldValue,
      newValue
    },
    bubbles: true,
    composed: true
  }));
  // Follow the toggled row's focus through a boolean sort/filter relocation AND a
  // fine-grained keyed-row replace (Solid) — the SAME recovery commitEdit relies on; even
  // with no editor to unmount, writeData's re-render can still drop focus.
  this.pendingEditFollow = {
    rowOriginal,
    rowId,
    col: this._activeColIndex.value
  };
};

  cancelEdit = () => {
  if (this._editingRow.value < 0) return;
  // CR-01: capture from the EDITING pair (authoritative), NOT the active-cell indices — a
  // Tab-advance writes activeRow/activeColIndex to the NEXT cell BEFORE opening its editor, so
  // an Escape on the just-opened editor would otherwise return focus to the Tab-target cell
  // instead of the cell being cancelled. commitEdit already snapshots editingRow/editingCol.
  const focusRow = this._editingRow.value;
  const focusCol = this._editingCol.value;
  this.editTransition = true;
  this.endEdit();
  this.editTransition = false;
  this.focusCellWhenReady(focusRow, focusCol);
};

  editableColumnsForRow = (rowIndex: any) => {
  const rowList = this._rows.value || [];
  const row = rowList[rowIndex];
  if (!row) return [];
  const cells = this.visibleCellsFor(row);
  const out = [];
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const colId = cell && cell.column ? cell.column.id : null;
    if (colId == null || !this.columnEditable(colId)) continue;
    const d = this.defFor(colId);
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
};

  focusRowEditorAt = (rowIndex: any, colIndex: any) => {
  if (!this.gridRoot) return;
  let attempts = 0;
  const tryFocus = () => {
    const cellEl = this.resolveCellEl(String(rowIndex), colIndex);
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
};

  beginRowEdit = (row: any) => {
  const rowIndex = this.rowIndexOf(row);
  if (rowIndex < 0) return;
  const editable = this.editableColumnsForRow(rowIndex);
  if (editable.length === 0) return;
  // A new edit session starts — reset the sync idempotency latch (see editCellLifecycle.rzts).
  this.committedThisSession = false;
  // Clear any single-cell editor first (mutual exclusivity).
  this._editingRow.value = -1;
  this._editingCol.value = -1;
  this._draftValue.value = null;
  this.setInvalid('');
  // Seed each editable cell's draft from its current value.
  const draft = {};
  const rowList = this._rows.value || [];
  const r = rowList[rowIndex];
  const orig = r ? r.original : null;
  for (let i = 0; i < editable.length; i++) {
    const ec = editable[i];
    draft[ec.colId] = orig ? orig[ec.field] : null;
  }
  this._rowDraft.value = draft;
  this._editingRowIndex.value = rowIndex;
  this._activeInControl.value = true;
  this._editVer.value = this._editVer.value + 1;
  this.focusEditorWhenReady();
};

  commitRow = () => {
  if (this._editingRowIndex.value == null) return false;
  const rowIndex = this._editingRowIndex.value;
  const editable = this.editableColumnsForRow(rowIndex);
  if (editable.length === 0) {
    this.endRowEdit();
    return false;
  }
  const rowList = this._rows.value || [];
  const r = rowList[rowIndex];
  const rowOriginal = r ? r.original : null;
  const rowId = r ? r.id : null;
  const draft = this._rowDraft.value || {};
  // Validate every edited column FIRST (D-01: a single failure blocks the whole row commit).
  // B3 (Rule 1): coerce each draft by the column's editor type BEFORE validation + write — a
  // 'number' editor must commit a real Number/null, never the raw editor STRING (the single-cell
  // commitEdit already coerces via coerceCellValue; the row path silently committed strings →
  // a number column ended up holding '99'). Coerce once here so the validator and the model both
  // see the typed value, identical to the single-cell funnel.
  for (let i = 0; i < editable.length; i++) {
    const ec = editable[i];
    const err = this.runValidator(ec.colId, this.coerceCellValue(ec.colId, draft[ec.colId]), rowOriginal);
    if (err !== true) {
      this.setInvalid(err);
      // B22: focus the OFFENDING column's editor (the one whose validator rejected), NOT
      // unconditionally the first editor (focusEditorWhenReady resolves the first
      // [data-editing-cell] in DOM order). ec.colIndex is the offending cell's visible col.
      this.focusRowEditorAt(rowIndex, ec.colIndex);
      return false;
    }
  }
  this.setInvalid('');
  // Build the changes payload (only the columns whose value actually changed) + the field→
  // value map for the single row-object replace.
  const changes = [];
  const fieldValues = {};
  for (let i = 0; i < editable.length; i++) {
    const ec = editable[i];
    // B3 (Rule 1): commit the TYPE-COERCED value (number editor → Number/null), not the raw draft
    // string — matches the single-cell commitEdit funnel so a row column never holds a stray string.
    const newValue = this.coerceCellValue(ec.colId, draft[ec.colId]);
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
  const focusRow = this._activeRow.value;
  const focusCol = this._activeColIndex.value;
  // #5: a no-op row commit (NO column's value actually changed — a bare Enter/save/outside-click
  // that edited nothing) must do NO model write, NO history record, NO row-edit-commit event:
  // writeData → recordSnapshot UNCONDITIONALLY clears the redo stack and mints a fresh row
  // identity, so an unconditional write on a no-op destroys redo + spuriously re-renders + emits
  // a no-op row-edit-commit. Gate the write/emit on `changes.length`; ALWAYS close the editor.
  const changed = changes.length > 0;
  this.editTransition = true;
  if (changed) {
    // ONE fresh-array replace of the SINGLE row object with all field values applied at once.
    const srcIndex = this.sourceIndexOfRow(rowIndex);
    const next = this.replaceRowValues(this.currentData(), srcIndex, fieldValues);
    this.writeData(next);
    // EXACTLY ONE emit per row commit, from THIS single call site (React multi-emit dedup, D-07).
    this.dispatchEvent(new CustomEvent("row-edit-commit", {
      detail: {
        rowId,
        changes
      },
      bubbles: true,
      composed: true
    }));
  }
  this.endRowEdit();
  this.editTransition = false;
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
    this.pendingEditFollow = {
      rowOriginal,
      rowId,
      col: focusCol
    };
  } else {
    // #5 no-op path: nothing was written, so refreshRowModel never runs and would never consume a
    // pendingEditFollow — focus would drop to <body>. Return focus DIRECTLY. The row does NOT
    // relocate (no write), so the B23 relocation hazard does not apply: (focusRow, focusCol) is safe.
    this.focusCellWhenReady(focusRow, focusCol);
  }
  return true;
};

  cancelRow = () => {
  if (this._editingRowIndex.value == null) return;
  const focusRow = this._activeRow.value;
  const focusCol = this._activeColIndex.value;
  this.editTransition = true;
  this.endRowEdit();
  this.editTransition = false;
  this.focusCellWhenReady(focusRow, focusCol);
};

  replaceRowValues = (rows: any, rowIndex: any, fieldValues: any) => {
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
};

  nextEditableCell = (fromRow: any, fromCol: any) => {
  const rowList = this._rows.value || [];
  const rowCount = rowList.length;
  if (rowCount === 0) return null;
  let r = fromRow;
  let c = fromCol + 1;
  while (r < rowCount) {
    const row = rowList[r];
    const cells = row ? this.visibleCellsFor(row) : [];
    while (c < cells.length) {
      const cell = cells[c];
      const cid = cell && cell.column ? cell.column.id : null;
      if (cid != null && this.columnEditable(cid)) return {
        row: r,
        col: c
      };
      c = c + 1;
    }
    r = r + 1;
    c = 0;
  }
  return null;
};

  prevEditableCell = (fromRow: any, fromCol: any) => {
  const rowList = this._rows.value || [];
  const rowCount = rowList.length;
  if (rowCount === 0) return null;
  let r = fromRow;
  let c = fromCol - 1;
  while (r >= 0) {
    const row = rowList[r];
    const cells = row ? this.visibleCellsFor(row) : [];
    while (c >= 0) {
      const cell = cells[c];
      const cid = cell && cell.column ? cell.column.id : null;
      if (cid != null && this.columnEditable(cid)) return {
        row: r,
        col: c
      };
      c = c - 1;
    }
    r = r - 1;
    if (r >= 0) {
      const prow = rowList[r];
      const pcells = prow ? this.visibleCellsFor(prow) : [];
      c = pcells.length - 1;
    }
  }
  return null;
};

  editTransition = false;

  pendingEditFollow: any = null;

  committedThisSession = false;

  inRowEdit = () => this._editingRowIndex.value != null;

  editorValueFor = (colId: any) => this.inRowEdit() ? this._rowDraft.value ? this._rowDraft.value[colId] : null : this._draftValue.value;

  editorCheckedFor = (colId: any) => !!(this.inRowEdit() ? this._rowDraft.value ? this._rowDraft.value[colId] : null : this._draftValue.value);

  editorCommitFor = (colId: any) => (value: any) => {
  if (this.inRowEdit()) {
    this.setRowDraft(colId, value);
    return;
  }
  this.commitEdit(value);
};

  editorCancelFor = () => () => {
  if (this.inRowEdit()) {
    this.cancelRow();
    return;
  }
  this.cancelEdit();
};

  onCellEditorInput = (colId: any, evt: any) => {
  const v = evt && evt.target ? evt.target.value : '';
  if (this.inRowEdit()) {
    this.setRowDraft(colId, v);
    return;
  }
  this._draftValue.value = v;
};

  onCellEditorCheckbox = (colId: any, evt: any) => {
  const v = !!(evt && evt.target && evt.target.checked);
  if (this.inRowEdit()) {
    this.setRowDraft(colId, v);
    return;
  }
  this._draftValue.value = v;
};

  setRowDraft = (colId: any, value: any) => {
  const src = this._rowDraft.value || {};
  const next = {};
  for (const k in src) next[k] = src[k];
  next[colId] = value;
  this._rowDraft.value = next;
};

  rowEditTab = (target: any, backward: any) => {
  const rowIndex = this._editingRowIndex.value;
  if (rowIndex == null) return;
  const editable = this.editableColumnsForRow(rowIndex);
  if (editable.length === 0) return;
  const cols = editable.map((ec: any) => ec.colIndex);
  const cell = target && target.closest ? target.closest('[data-grid-cell]') : null;
  const curAttr = cell ? cell.getAttribute('data-col-index') : null;
  const cur = curAttr != null ? parseInt(curAttr, 10) : -1;
  let pos = cols.indexOf(cur);
  if (pos < 0) pos = 0;
  const len = cols.length;
  const nextPos = backward ? (pos - 1 + len) % len : (pos + 1) % len;
  this.focusRowEditorAt(rowIndex, cols[nextPos]);
};

  onEditorKeyDown = (e: any) => {
  if (!e) return;
  const key = e.key;
  // Full-row mode (req-6): Enter from ANY cell editor commits the WHOLE row at once (ONE
  // model write + ONE row-edit-commit); Escape reverts the whole row. Tab moves between the
  // row's editors NATIVELY (no commit-per-cell) — let the browser advance focus, so we don't
  // preventDefault it here.
  if (this.inRowEdit()) {
    if (key === 'Enter') {
      e.preventDefault();
      this.commitRow();
    } else if (key === 'Escape') {
      e.preventDefault();
      this.cancelRow();
    }
    // B21: CONTAIN Tab within the editing row. Native Tab escapes the row at its first/last
    // editor (leaving editingRowIndex set so onGridKeyDown stays frozen → keyboard trap). Take
    // Tab over entirely and cycle between the row's editors WITH WRAP (forward off the last →
    // first; Shift+Tab off the first → last). Cross-target-safe (no reliance on the native DOM
    // tab order across a Lit shadow boundary).
    else if (key === 'Tab') {
      e.preventDefault();
      this.rowEditTab(e.target, e.shiftKey);
    }
    return;
  }
  if (key === 'Enter') {
    e.preventDefault();
    this.commitEdit(undefined);
  } else if (key === 'Tab') {
    e.preventDefault();
    // Resolve the advance target from the EDITING pair (the cell that is open), not the
    // active cell (they match here, but the editing pair is authoritative). B4: Shift+Tab
    // moves BACKWARD (prevEditableCell), a plain Tab FORWARD (nextEditableCell). Snapshot
    // the editing pair BEFORE commit (commitEdit resets it to -1).
    const fromRow = this._editingRow.value;
    const fromCol = this._editingCol.value;
    const target = e.shiftKey ? this.prevEditableCell(fromRow, fromCol) : this.nextEditableCell(fromRow, fromCol);
    // skipFocusReturn=true: don't bounce focus back to the committed cell — we advance
    // straight into the next editable cell's editor below. Use the RETURN value (not a
    // re-read of $data.editingRow — async-stale on React) to gate the advance: a validation
    // failure returns false and keeps the editor open (the user must fix the value first).
    const committed = this.commitEdit(undefined, true);
    if (committed && target) {
      this._activeRow.value = target.row;
      this._activeColIndex.value = target.col;
      this.beginEdit(target.row, target.col, null);
    } else if (committed) {
      // B5: no editable cell in the Tab direction (grid start/end) — keep focus INSIDE the
      // grid by returning it to the just-committed cell instead of letting it drop to <body>.
      this.focusCellWhenReady(fromRow, fromCol);
    }
  } else if (key === 'Escape') {
    e.preventDefault();
    this.cancelEdit();
  }
};

  onEditorBlur = (e: any) => {
  // Full-row mode (req-6): a blur that stays WITHIN the row editor — Tab/click between the
  // row's OWN fields — is a normal focus move and must NOT commit (a per-cell blur-commit
  // would split the row into N writes + N events, violating the one-write/one-event contract).
  // But an OUTSIDE-click blur (#7) MUST commit the row: otherwise the model is never written
  // AND editingRowIndex stays set, freezing onGridKeyDown's editingRowIndex early-return so
  // arrow-nav is dead the moment the user clicks back into the grid. Mirror the single-cell
  // branch's relatedTarget shape to tell an in-row focus move from a genuine click-away.
  if (this.inRowEdit()) {
    // Guard the teardown blur: commitRow's writeData/endRowEdit re-render unmounts the row's
    // editors → a same-tick re-render blur must NOT re-enter commitRow (double row-edit-commit).
    // commitRow sets editTransition synchronously BEFORE writeData, so it is set here during the
    // teardown window (the async unmount-blur that fires after endRowEdit finds editingRowIndex
    // already null → inRowEdit() false → the single-cell tail's editingRow<0 guard returns).
    if (this.editTransition) return;
    const rowNext = e ? e.relatedTarget : null;
    const rowNextCell = rowNext && rowNext.closest ? rowNext.closest('[data-grid-cell]') : null;
    const rowNextRow = rowNextCell ? rowNextCell.getAttribute('data-row') : null;
    // Focus landing on a cell of the SAME editing row (Tab/click between the row's own fields) →
    // controlled in-row move, do NOT commit. Anything else — a null relatedTarget, another row,
    // a toolbar/widget, or outside the grid entirely — is an outside-click → commit the row as a
    // unit. commitRow clears editingRowIndex, releasing onGridKeyDown's early-return so nav
    // resumes; a no-op row (nothing changed) takes commitRow's clean #5 no-write/no-emit path.
    if (rowNextRow != null && rowNextRow === String(this._editingRowIndex.value)) return;
    this.commitRow();
    return;
  }
  if (this._editingRow.value < 0 || this.editTransition) return;
  const next = e ? e.relatedTarget : null;
  // A null relatedTarget is an unmount-blur (the editor left the DOM) or a focus drop the
  // keyboard path owns; committing here would double-count (WR-04: the OLD editor's blur on
  // a Tab-advance fires with a TRANSIENT null relatedTarget while it unmounts). Keep the
  // conservative null=skip behavior.
  if (next == null) return;
  // Focus moving OUTSIDE the grid (a click into another widget) → commit (D-01 reject keeps
  // the editor open on an invalid value).
  if (!(this.gridRoot && this.gridRoot.contains && this.gridRoot.contains(next))) {
    this.commitEdit(undefined);
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
  if (fromRow !== String(this._editingRow.value) || fromCol !== String(this._editingCol.value)) return;
  // Genuine click-away to another grid cell → commit + close. skipFocusReturn=true so the
  // commit does NOT bounce focus back to the just-committed editing cell (which would fight
  // the click destination). The commit's writeData re-renders the table and can DROP DOM
  // focus on the fine-grained targets (Solid keyed-row replace). Re-seat focus on the CLICK
  // DESTINATION cell ONLY IF the re-render actually dropped it — a single deferred check
  // (not a 30-frame poll) so a target whose click-focus SURVIVED (Lit) is never re-focused
  // late, which would steal focus back from a subsequent navigation.
  const destRow = nextCell.getAttribute('data-row');
  const destCol = nextCell.getAttribute('data-col-index');
  this.commitEdit(undefined, true);
  const reseatDestFocus = () => {
    if (!this.gridRoot || destRow == null || destCol == null || destRow === '__header') return;
    const root = this.gridRoot.getRootNode ? this.gridRoot.getRootNode() : null;
    const act = root && root.activeElement ? root.activeElement : null;
    // Focus already landed inside the grid (the click-focus survived the re-render) — leave it.
    if (act && this.gridRoot.contains && this.gridRoot.contains(act)) return;
    const el = this.resolveCellEl(destRow, parseInt(destCol, 10));
    if (el) el.focus();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reseatDestFocus);else setTimeout(reseatDestFocus, 0);
};

  editCell = (rowIndex: any, colIndex: any) => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const maxCol = this.visibleColCount() - 1;
  const r = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
  const c = this.clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
  // A new edit session starts — reset the sync idempotency latch (see editCellLifecycle.rzts).
  this.committedThisSession = false;
  this._activeIsHeader.value = false;
  this._activeRow.value = r;
  this._activeColIndex.value = c;
  this.beginEdit(r, c, null);
};

  commitEditing = () => {
  if (this.inRowEdit()) {
    this.commitRow();
    return;
  }
  if (this._editingRow.value >= 0) this.commitEdit(undefined);
};

  editRow = (rowIndex: any) => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const r = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
  const rowList = this._rows.value || [];
  const row = rowList[r];
  if (!row) return;
  this._activeIsHeader.value = false;
  this._activeRow.value = r;
  this.beginRowEdit(row);
};

  focusAbsCellWhenReady = (absRow: any, localRow: any, col: any) => {
  if (!this.gridRoot) return;
  let attempts = 0;
  const want = String(absRow + 1);
  // #9: capture the focus-intent epoch at arm time (AFTER focusCell's own bump at its top, so
  // this poll never aborts itself). A LATER focus intent — a click landing on a new cell
  // (syncActiveFromEvent) or another focusCell / keyboard nav — bumps the epoch, so this
  // paginated page-switch poll aborts instead of grabbing focus frames after the user moved on.
  const myEpoch = this.focusIntentEpoch;
  const tryFocus = () => {
    if (this.focusIntentEpoch !== myEpoch) return;
    const el = this.resolveCellEl(String(localRow), col);
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
};

  focusCell = (rowIndex: any, colIndex: any) => {
  // B16: isGrid()-gate the verb. In 'table' mode there is no roving active cell, so focusCell
  // is a NO-OP (never an activecell-change emit) — the keyboard path (onGridKeyDown) is already
  // isGrid-gated; the exposed verb must mirror that so a consumer's focusCell on a table-mode
  // instance does not leak a spurious activecell-change.
  if (!this.isGrid()) return;
  // #9: focusCell is a focus-INTENT entry point — bump the epoch BEFORE arming any poll (the
  // switched-page focusAbsCellWhenReady captures the post-bump value; the same-page / virtual
  // branches route through focusActiveCell, which bumps again — harmless). A subsequent focusCell
  // or user nav bumps again → a pending focusAbsCellWhenReady from THIS call aborts.
  this.focusIntentEpoch = this.focusIntentEpoch + 1;
  const maxCol = this.visibleColCount() - 1;
  const c = this.clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
  // C1: clamp the ABSOLUTE row index to the full filtered+sorted (pre-pagination) bounds.
  const absLast = this.prePaginationRowCount() - 1;
  const absRow = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, absLast < 0 ? 0 : absLast);
  // B14: snapshot the PRE-write ABSOLUTE position so the activecell-change emit fires ONLY on a
  // real move (mirrors the keyboard path's WR-06 suppression). A no-op focusCell to the already-
  // active cell must NOT emit; a header→body landing (prevIsHeader) is a real move.
  const prevAbs = this.toAbsRow(this._activeRow.value);
  const prevIsHeader = this._activeIsHeader.value;
  if (this.virtual) {
    // Virtual mode: $data.activeRow IS the full pre-pagination index (the wr.vi.index space), so
    // the absolute index maps 1:1. focusActiveCell already runs the D-12 off-window scroll-then-
    // focus path (scrollToIndex(absRow) → deferred-rAF focus) when the row is outside the window.
    this._activeIsHeader.value = false;
    this._activeInControl.value = false;
    this._activeRow.value = absRow;
    this._activeColIndex.value = c;
    this.focusActiveCell(absRow, c, false);
  } else {
    // Paginated mode: resolve the page that HOLDS the absolute row, switch to it, then focus the
    // in-page cell. The page-relative local row = absRow - page*pageSize is what the non-virtual
    // body's data-row markers (and the roving tabindex) address.
    const size = this.pageSize();
    const targetPage = size > 0 ? Math.floor(absRow / size) : 0;
    const localRow = absRow - targetPage * size;
    const switched = targetPage !== this.pageIndex();
    if (switched) this.setPage(targetPage);
    this._activeIsHeader.value = false;
    this._activeInControl.value = false;
    this._activeRow.value = localRow;
    this._activeColIndex.value = c;
    if (switched) {
      // The switched-in page renders ASYNC — poll until the (localRow, c) cell carries the
      // TARGET page's absolute aria-rowindex (absRow+1) before focusing, so the OLD page's
      // same-indexed cell is never grabbed-then-removed (drop-to-<body>). DOM-only, React-safe.
      this.focusAbsCellWhenReady(absRow, localRow, c);
    } else {
      // Same page: re-seat focus synchronously (the REQ-5 idiom — re-focus after a button click).
      // Thread isHeader=false explicitly (focusActiveCell would otherwise re-read the React/Angular
      // async-stale $data.activeIsHeader, landing on a header when a sort button was last clicked).
      this.focusActiveCell(localRow, c, false);
    }
  }
  if (absRow !== prevAbs || prevIsHeader) {
    this.dispatchEvent(new CustomEvent("activecell-change", {
      detail: {
        rowIndex: absRow,
        colIndex: c
      },
      bubbles: true,
      composed: true
    }));
  }
};

  getActiveCell = () => this._activeIsHeader.value ? {
  rowIndex: null,
  colIndex: this._activeColIndex.value,
  isHeader: true
} : {
  rowIndex: this.toAbsRow(this._activeRow.value),
  colIndex: this._activeColIndex.value,
  isHeader: false
};

  clearActiveCell = () => {
  if (!this.isGrid()) return;
  this._activeIsHeader.value = false;
  this._activeInControl.value = false;
  this._activeRow.value = 0;
  this._activeColIndex.value = 0;
};

  toggleRowExpanded = (rowId: any) => {
  if (!this.table) return;
  const target = String(rowId);
  const flat = this.table.getCoreRowModel().flatRows;
  for (const r of flat as any) {
    if (r.id === target || r.original && String(r.original.id) === target) {
      r.toggleExpanded();
      return;
    }
  }
};

  expandAll = () => {
  if (!this.table) return;
  this.table.toggleAllRowsExpanded(true);
};

  collapseAll = () => {
  if (!this.table) return;
  this.table.resetExpanded(true);
};

  getExpandedRows = () => {
  if (!this.table) return [];
  const out = [];
  const flat = this.table.getCoreRowModel().flatRows;
  for (const r of flat as any) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
  return out;
};

  applyGrouping = (cols: any) => {
  if (this.table) this.table.setGrouping(cols);
};

  clearGrouping = () => {
  if (this.table) this.table.setGrouping([]);
};

  getFacetedUniqueValues = (colId: any) => {
  if (this.tick() < 0 || !this.table) return [];
  const col = this.table.getColumn(colId);
  if (!col || !col.getFacetedUniqueValues) return [];
  const map = col.getFacetedUniqueValues(); // Map<any, number>
  return map ? Array.from(map.keys()) : []; // KEYS only — counts deferred (D-03)
};

  getFacetedMinMaxValues = (colId: any) => {
  if (this.tick() < 0 || !this.table) return null;
  const col = this.table.getColumn(colId);
  if (!col || !col.getFacetedMinMaxValues) return null;
  return col.getFacetedMinMaxValues() || null; // [number, number] | null
};

  get data(): any[] { return this._dataControllable.read(); }
  set data(v: any[]) { this._dataControllable.notifyPropertyWrite(v); }
  get sorting(): any[] { return this._sortingControllable.read(); }
  set sorting(v: any[]) { this._sortingControllable.notifyPropertyWrite(v); }
  get globalFilter(): string { return this._globalFilterControllable.read(); }
  set globalFilter(v: string) { this._globalFilterControllable.notifyPropertyWrite(v); }
  get columnFilters(): any[] { return this._columnFiltersControllable.read(); }
  set columnFilters(v: any[]) { this._columnFiltersControllable.notifyPropertyWrite(v); }
  get pagination(): any { return this._paginationControllable.read(); }
  set pagination(v: any) { this._paginationControllable.notifyPropertyWrite(v); }
  get expanded(): any | boolean { return this._expandedControllable.read(); }
  set expanded(v: any | boolean) { this._expandedControllable.notifyPropertyWrite(v); }
  get grouping(): any[] { return this._groupingControllable.read(); }
  set grouping(v: any[]) { this._groupingControllable.notifyPropertyWrite(v); }
  get rowSelection(): any { return this._rowSelectionControllable.read(); }
  set rowSelection(v: any) { this._rowSelectionControllable.notifyPropertyWrite(v); }
  get columnVisibility(): any { return this._columnVisibilityControllable.read(); }
  set columnVisibility(v: any) { this._columnVisibilityControllable.notifyPropertyWrite(v); }
  get columnSizing(): any { return this._columnSizingControllable.read(); }
  set columnSizing(v: any) { this._columnSizingControllable.notifyPropertyWrite(v); }
  get columnOrder(): any[] { return this._columnOrderControllable.read(); }
  set columnOrder(v: any[]) { this._columnOrderControllable.notifyPropertyWrite(v); }
  get columnPinning(): any { return this._columnPinningControllable.read(); }
  set columnPinning(v: any) { this._columnPinningControllable.notifyPropertyWrite(v); }
}
