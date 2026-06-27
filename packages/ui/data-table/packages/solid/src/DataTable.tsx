import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieContext, rozieDisplay } from '@rozie/runtime-solid';
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

__rozieInjectStyle('DataTable-d5dcab4c', `.rozie-data-table[data-rozie-s-d5dcab4c] {
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
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-group-bar-host[data-rozie-s-d5dcab4c] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rdt-group-bar-gap, 0.375rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-group-token[data-rozie-s-d5dcab4c] {
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

interface GroupBarSlotCtx { grouping: any; groupableColumns: any; applyGrouping: any; clearGrouping: any; }

interface SelectAllSlotCtx { checked: any; indeterminate: any; toggle: any; }

interface ColHeaderSlotCtx { columnId: any; column: any; label: any; }

interface FilterSlotCtx { columnId: any; uniqueValues: any; minMax: any; setFilter: any; }

interface SelectCellSlotCtx { row: any; checked: any; toggle: any; }

interface EditorSlotCtx { columnId: any; column: any; row: any; value: any; commit: any; cancel: any; }

interface CellSlotCtx { columnId: any; column: any; row: any; value: any; }

interface DetailSlotCtx { row: any; }

interface DataTableProps {
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable r-model:data="rows" :columns="cols" />
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
  getSubRows?: ((...args: unknown[]) => unknown) | null;
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
   * `'table'` (default, row-oriented) | `'grid'`. `'grid'` lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)** — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation. `'table'` is byte-behaviorally identical to a plain accessible table.
   * @deprecated Reserved forward-compat seam — grid cell-navigation is not implemented yet; do not rely on the `grid` mode.
   */
  interactionMode?: string;
  /**
   * Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table.
   */
  virtual?: boolean;
  /**
   * Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
   */
  maxHeight?: string;
  onSortChange?: (...args: unknown[]) => void;
  onExpandChange?: (...args: unknown[]) => void;
  onGroupChange?: (...args: unknown[]) => void;
  onFilterChange?: (...args: unknown[]) => void;
  onPageChange?: (...args: unknown[]) => void;
  onSelectionChange?: (...args: unknown[]) => void;
  onVisibilityChange?: (...args: unknown[]) => void;
  onResizeChange?: (...args: unknown[]) => void;
  onReorderChange?: (...args: unknown[]) => void;
  onPinChange?: (...args: unknown[]) => void;
  onActivecellChange?: (...args: unknown[]) => void;
  onRangeChange?: (...args: unknown[]) => void;
  onCellEditCommit?: (...args: unknown[]) => void;
  onRowEditCommit?: (...args: unknown[]) => void;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  groupBarSlot?: (ctx: GroupBarSlotCtx) => JSX.Element;
  selectAllSlot?: (ctx: SelectAllSlotCtx) => JSX.Element;
  colHeaderSlot?: (ctx: ColHeaderSlotCtx) => JSX.Element;
  filterSlot?: (ctx: FilterSlotCtx) => JSX.Element;
  selectCellSlot?: (ctx: SelectCellSlotCtx) => JSX.Element;
  editorSlot?: (ctx: EditorSlotCtx) => JSX.Element;
  cellSlot?: (ctx: CellSlotCtx) => JSX.Element;
  detailSlot?: (ctx: DetailSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: DataTableHandle) => void;
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
}

export default function DataTable(_props: DataTableProps): JSX.Element {
  const _merged = mergeProps({ columns: (() => [])(), selectionMode: 'none', manual: false, expandable: false, getSubRows: null, groupable: false, stickyHeader: false, interactionMode: 'table', virtual: false, estimateRowHeight: 40, maxHeight: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['data', 'columns', 'selectionMode', 'sorting', 'globalFilter', 'columnFilters', 'pagination', 'manual', 'expandable', 'expanded', 'getSubRows', 'groupable', 'grouping', 'rowSelection', 'columnVisibility', 'columnSizing', 'columnOrder', 'columnPinning', 'stickyHeader', 'interactionMode', 'virtual', 'estimateRowHeight', 'maxHeight', 'children', 'ref']);
  const resolved = () => local.children;
  onMount(() => { local.ref?.({ sortColumn, clearSorting, toggleRowExpanded, expandAll, collapseAll, getExpandedRows, applyGrouping, clearGrouping, getFacetedUniqueValues, getFacetedMinMaxValues, getColumnDefs, toggleAllRows, clearSelection, getSelectedRows, setPage, setRowsPerPage, toggleColumnVisibility, applyColumnOrder, resetColumnSizing, pinColumn, focusCell, getActiveCell, clearActiveCell, getRowIndexRelativeToPage, editCell, commitEditing, editRow, getSelectedRange }); });

  const __ctx_data_table_columns = rozieContext("data-table:columns");
  const [data, setData] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'data', []);
  const [sorting, setSorting] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'sorting', (() => [])());
  const [globalFilter, setGlobalFilter] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'globalFilter', '');
  const [columnFilters, setColumnFilters] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'columnFilters', (() => [])());
  const [pagination, setPagination] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'pagination', (() => ({
    pageIndex: 0,
    pageSize: 10
  }))());
  const [expanded, setExpanded] = createControllableSignal<Record<string, any> | boolean>(_props as unknown as Record<string, unknown>, 'expanded', null);
  const [grouping, setGrouping] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'grouping', null);
  const [rowSelection, setRowSelection] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'rowSelection', (() => ({}))());
  const [columnVisibility, setColumnVisibility] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'columnVisibility', (() => ({}))());
  const [columnSizing, setColumnSizing] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'columnSizing', (() => ({}))());
  const [columnOrder, setColumnOrder] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'columnOrder', (() => [])());
  const [columnPinning, setColumnPinning] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'columnPinning', (() => ({
    left: [],
    right: []
  }))());
  const [dataDefault, setDataDefault] = createSignal([]);
  const [sortingDefault, setSortingDefault] = createSignal([]);
  const [globalFilterDefault, setGlobalFilterDefault] = createSignal('');
  const [columnFiltersDefault, setColumnFiltersDefault] = createSignal([]);
  const [paginationDefault, setPaginationDefault] = createSignal({
    pageIndex: 0,
    pageSize: 10
  });
  const [rowSelectionDefault, setRowSelectionDefault] = createSignal({});
  const [expandedDefault, setExpandedDefault] = createSignal({});
  const [groupingDefault, setGroupingDefault] = createSignal([]);
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
  const [windowVer, setWindowVer] = createSignal(0);
  const [activeRow, setActiveRow] = createSignal(0);
  const [activeColIndex, setActiveColIndex] = createSignal(0);
  const [activeIsHeader, setActiveIsHeader] = createSignal(false);
  const [activeHeaderLevel, setActiveHeaderLevel] = createSignal(0);
  const [gridEmptyFallback, setGridEmptyFallback] = createSignal(false);
  const [activeInControl, setActiveInControl] = createSignal(false);
  const [editingRow, setEditingRow] = createSignal(-1);
  const [editingCol, setEditingCol] = createSignal(-1);
  const [draftValue, setDraftValue] = createSignal(null);
  const [invalidMsg, setInvalidMsg] = createSignal('');
  const [editVer, setEditVer] = createSignal(0);
  const [editingRowIndex, setEditingRowIndex] = createSignal(null);
  const [rowDraft, setRowDraft] = createSignal({});
  const [rangeAnchor, setRangeAnchor] = createSignal(null);
  const [rangeFocus, setRangeFocus] = createSignal(null);
  const [pasteAnnounce, setPasteAnnounce] = createSignal('');
  onMount(() => {
    // Seed the uncontrolled `data` fallback (Phase 51 req-4) from the initial prop so an
    // edit committed BEFORE the consumer ever pushes new rows (or when the consumer passes
    // a one-way `:data`) has a base array to whole-array-replace. currentData() then sources
    // the bound prop when controlled, this fallback otherwise.
    setDataDefault(data() || []);
    // Build the table instance HERE so the closures below capture the live `table`.
    table = createTable({
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
      // Expandable rows (phase 50, D-04): the expanded row model is supplied UNCONDITIONALLY
      // (mirrors the other models) — inert when `expanded` is empty + no getSubRows
      // (byte-identical-off, req-10). getSubRows is the TABLE-level child accessor (NOT a
      // ColumnDef field). getRowCanExpand makes EVERY row expandable for the #detail seam
      // (no subRows to gate on); when getSubRows IS supplied, leave it undefined so the
      // default `!!subRows.length` rule applies (only parents with children expand).
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (local.getSubRows || undefined) as any,
      getRowCanExpand: local.expandable === true && local.getSubRows == null ? () => true : undefined,
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
      // Grouping (phase 50 reqs 4-7, D-04/D-05): the grouped row model is supplied
      // UNCONDITIONALLY (mirrors the expand model) — inert when `grouping` is empty
      // (byte-identical-off, req-10). When `grouping` is a non-empty ordered key list,
      // table-core FLATTENS group-header rows (carrying getIsGrouped()/subRows) and their
      // members into getRowModel().rows, so they ride the SAME D-04 <template r-for> seam (no
      // nested r-for — Pitfall 1). Group rows are expandable via the EXISTING expanded model
      // (getRowCanExpand default `!!subRows.length`), so collapsing a group hides its subtree.
      getGroupedRowModel: getGroupedRowModel(),
      onGroupingChange: onGroupingChangeCb,
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
      // windowingSource(): the FULL pre-pagination model when virtual (windowing replaces client
      // pagination, req-9), else the normal paginated row model (non-virtual path byte-unchanged).
      const nextRows = windowingSource().slice();
      const nextGroups = table.getHeaderGroups().slice();
      setRows(nextRows);
      setHeaderGroups(nextGroups);
      setRowModelVer(rowModelVer() + 1);
      // Vertical windowing re-feed (Pitfall 2 — stale count): push the fresh full-model count
      // into the virtualizer + reconcile IMPERATIVELY here (the table.setOptions re-feed path),
      // NEVER in a render helper (Pitfall 1). Pass the COMPLETE options set (virtual-core's
      // setOptions replaces, not merges). Guarded so the off path executes no virtual-core code.
      if (local.virtual && virtualizer) {
        virtualizer.setOptions(virtualizerOptions());
        virtualizer._willUpdate();
      }
      // D-05: on every data change (re-sort/filter/paginate/page-size — all re-pull here),
      // clamp the active cell to the new bounds (same indices, clamped if the grid shrank;
      // no row-id following, no top-bounce). isGrid()-gated so 'table' mode is untouched.
      // B8/B23: pass the FRESH bounds derived from `nextRows` (NOT $data.rows, which is the
      // async-stale useState snapshot on React) so a filter-to-fewer clamps the active cell AND
      // the range corners on React too — never re-reading the pre-change model.
      const nextRowCount = nextRows.length;
      const nextColCount = nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0;
      clampActiveCell(nextRowCount, nextColCount);
      // B23: a just-committed single-cell edit may have RELOCATED its row under an active sort/
      // filter. `nextRows` is the FRESH visible model (its index space == the rendered data-row
      // indices), so resolve the committed row's NEW index by identity HERE (never from the React-
      // stale state) and re-seat focus on that cell via the DOM-only poll (focusCellWhenReady reads
      // gridRoot only → React-safe). Consumed ONCE (cleared) so a multi-render re-feed focuses once;
      // a no-relocation commit resolves the same index → byte-behaviorally identical to before.
      if (pendingEditFollow && isGrid()) {
        const follow = pendingEditFollow;
        pendingEditFollow = null;
        const followIdx = indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
        if (followIdx >= 0) focusCellWhenReady(followIdx, follow.col);
      }
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
    gridRoot = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-data-table') : null;
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
    if (local.virtual) {
      gridScrollEl = __rozieRootRef! ? __rozieRootRef!.querySelector('.rdt-scroll') : null;
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
      setWindowVer(windowVer() + 1);
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
        const pg = pagination();
        const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
        if (local.manual !== true && pgConfigured) {
          console.warn('[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.');
        }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));else setTimeout(afterFirstFrame, 0);
    }
  });
  onCleanup(() => {
    if (virtualizerCleanup) virtualizerCleanup();
    // CR-04: remove any live fill-drag document listeners if we unmount mid-drag.
    teardownFillDrag();
  });
  createEffect(() => {
    if (!table) return;
    // Phase 51 req-4: track currentData() (the bound prop OR the uncontrolled
    // $data.dataDefault) so a committed edit re-feeds on Lit whether or not r-model:data is
    // bound. Compare by reference AND length so a same-length single-cell edit (fresh array,
    // identical length) still re-feeds.
    const d = currentData() || [];
    if (d === lastData && d.length === lastDataLen) return;
    lastData = d;
    lastDataLen = d.length;
    reFeed();
  });
  createEffect(on(() => (() => [sorting(), globalFilter(), columnFilters(), pagination(), rowSelection(), expanded(), local.expandable, grouping(), local.groupable, columnVisibility(), columnSizing(), columnOrder(), columnPinning(), local.selectionMode, (data() || []).length, // Phase 51 req-4: key on the data REFERENCE (both sinks) so a committed edit re-feeds
  // even when the fresh array is the SAME length (a single-cell edit replaces one row
  // object → new array ref, identical length → the .length key alone would miss it). The
  // controlled path observes $props.data; the uncontrolled path observes $data.dataDefault.
  // writeData is echo-guarded (programmatic) and reFeed writes neither sink, so no loop.
  data(), dataDefault(), colReg()])(), (v) => untrack(() => (() => {
    reFeed();
  })()), { defer: true }));
  let __rozieRootRef: HTMLElement | null = null;

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
  let remeasurePending = false;

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

  // Grouping auto-expand latch (phase 50 req-4): when grouping is ACTIVE and the consumer
  // has not bound `expanded` and has not yet toggled any group, group-header rows default to
  // EXPANDED (so the grouped subtree is visible — the standard grouped-grid affordance + the
  // roundout-VR leaf-visible baseline). The FIRST group/row toggle sets this true (in
  // writeExpanded), after which the user's expanded state wins. Stays false (untouched) on the
  // non-grouping path → byte-identical-off (the `expanded` slice resolves to $data.expandedDefault
  // exactly as before, both for the plain table AND the expandable-rows feature).
  let expandedTouched = false;

  // groupingActiveDefault(): is grouping currently engaged (a non-empty ordered key list)? Reads
  // the same source order as currentState().grouping ($props.grouping ?? $data.groupingDefault) so
  // the expanded auto-default below tracks the live grouping state on every target.
  function groupingActiveDefault() {
    return ((grouping() != null ? grouping() : groupingDefault()) || []).length > 0;
  }

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
      // expanded (phase 50 req-1/3): ExpandedState ({ [rowId]: true } | the `true` expand-all
      // literal). Passed to table-core verbatim — never Object.keys'd without a `=== true`
      // guard (Pitfall 2). Falls back to $data.expandedDefault when r-model:expanded is unbound.
      // GROUPING AUTO-EXPAND (req-4): when grouping is active and the consumer has neither bound
      // `expanded` nor toggled a group yet (!expandedTouched), default to the `true` expand-all
      // literal so the grouped subtree is visible by default; the first toggle latches
      // expandedTouched and the user's expanded state wins thereafter. Non-grouping path is
      // unchanged → byte-identical-off (the table + the expandable-rows feature both keep
      // $data.expandedDefault).
      expanded: expanded() != null ? expanded() : groupingActiveDefault() && !expandedTouched ? true : expandedDefault(),
      // grouping (phase 50 reqs 4-7): GroupingState = ordered string[] of column ids. Falls back
      // to $data.groupingDefault when r-model:grouping is unbound. table-core's getGroupedRowModel
      // is inert when this is empty (byte-identical-off, req-10).
      grouping: grouping() != null ? grouping() : groupingDefault(),
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

  // The live row data (Phase 51 req-4): the bound `data` prop when controlled, else the
  // uncontrolled $data.dataDefault fallback (mirrors currentState's per-slice ?? pattern).
  // A committed edit funnels a FRESH array through writeData, which writes BOTH sinks; the
  // re-feed sources here so editing works whether or not the consumer binds r-model:data.
  function currentData(): any {
    return data() != null ? data() : dataDefault();
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
  // wrapAggregationFn (phase 50 req-5, D-05, threat T-50-04): resolve a per-column
  // aggregationFn straight onto the ColumnDef (no component-side switch — RESEARCH
  // anti-pattern). A built-in NAME string ('sum'/'min'/'max'/'extent'/'mean'/'median'/
  // 'unique'/'uniqueCount'/'count') passes through verbatim — table-core resolves it from its
  // built-in `aggregationFns` map. A CUSTOM function `(columnId, leafRows, childRows) => any`
  // is DEFENSIVELY WRAPPED (the runValidator precedent): a consumer fn runs per group, so a
  // throw is coerced to `undefined` and can never crash getGroupedRowModel (DoS guard).
  // Anything else → undefined (no aggregation; the cell renders as a placeholder).
  function wrapAggregationFn(fn: any) {
    if (typeof fn === 'string') return fn;
    if (typeof fn !== 'function') return undefined;
    return (columnId: any, leafRows: any, childRows: any) => {
      try {
        return fn(columnId, leafRows, childRows);
      } catch (err: any) {
        return undefined;
      }
    };
  }
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
      const gid = c.id != null ? c.id : c.header;
      if (gid == null) return null;
      const id = String(gid);
      if (!isSafeKey(id)) return null;
      const kids = [];
      for (const child of c.columns as any) {
        const cd = buildConfigDef(child);
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
    const cfg = local.columns || [];
    for (const c of cfg as any) {
      const def = buildConfigDef(c);
      if (!def) continue;
      const id = def.id;
      if (!(id in byId)) order.push(id);
      byId[id] = def;
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
  const SELECT_COL_ID = '__rdt_select';

  // The constant id of the auto-injected leading chevron expander column (phase 50, D-04).
  // Distinct from any consumer column id (the registry/config guard never produces a leading
  // "__"). Injected AFTER the select column (so order is [select, expander, ...userCols]).
  const EXPANDER_COL_ID = '__rdt_expander';

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
    // Expander column (phase 50, D-04): injected LEADING when expandable, carrying an
    // isExpanderColumn marker the template uses to render the chevron toggle (NOT an accessor
    // value). enableSorting/enableColumnFilter:false (it is chrome, not data). Off by default
    // → byte-identical-off (req-10).
    let withExpander = cols;
    if (local.expandable === true) {
      const expanderCol = {
        id: EXPANDER_COL_ID,
        enableSorting: false,
        enableColumnFilter: false,
        filterable: false,
        isExpanderColumn: true,
        pinned: '',
        width: ''
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
        width: ''
      };
      return [selectCol].concat(withExpander);
    }
    return withExpander;
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

  // ── expanded slice: STATIC-KEY fresh-value echo-guarded write funnel (A4) ──────────
  // table-core hands an Updater<ExpandedState> = value | (old)=>new; onExpandedChange
  // applies it against the CURRENT expanded, then this funnel writes a FRESH value to the
  // uncontrolled default + the two-way model + fires `expanded-change` REGARDLESS of binding.
  // `next` may be the `true` expand-all literal OR a { [rowId]: true } object — written
  // verbatim (Pitfall 2). One emit per change (the shared `programmatic` guard dedups the
  // React multi-render re-entry, D-07). STATIC key ($data.expandedDefault / $model.expanded).
  function writeExpanded(next: any) {
    if (programmatic) return;
    programmatic++;
    // Latch the grouping auto-expand default (req-4): the FIRST expand/collapse toggle means
    // the user now owns the expanded state, so currentState() stops defaulting grouped rows to
    // the `true` expand-all literal and honors $data.expandedDefault from here on.
    expandedTouched = true;
    setExpandedDefault(next); // fresh value only (never in-place)
    setExpanded(next); // two-way emit if bound (no-op-diff if not)
    // Event stem is `expand-change`, NOT `expanded-change`: the model:true `expanded`
    // prop auto-generates an `onExpandedChange` callback on the React/Solid flat Props
    // interface, and an `expanded-change` event would camelCase to the SAME identifier
    // → duplicate-identifier TS2300 (the model-prop==emit-name collision class). Every
    // sibling slice avoids this by stemming the event off a DISTINCT name (sorting→
    // sort-change, rowSelection→selection-change); `expanded`→`expand-change` follows suit.
    _props.onExpandChange?.(next);
    programmatic--;
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
    if (programmatic) return;
    programmatic++;
    setGroupingDefault(next); // fresh ordered array only (never in-place push)
    setGrouping(next); // two-way emit if bound (no-op-diff if not)
    _props.onGroupChange?.(next);
    programmatic--;
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

  // ── data slice: STATIC-KEY fresh-array echo-guarded write funnel (Phase 51 req-4) ──
  // A committed cell/row edit (or paste/fill in a later wave) replaces ONE row object in
  // a FRESH array and funnels it here. Writes the uncontrolled default + the two-way
  // model so editing works controlled OR uncontrolled. CRITICAL: writeData does NOT emit —
  // unlike the 9 state slices (each has one change event fired inside its funnel), the
  // `data` slice's commit event (`cell-edit-commit`) carries a PER-CELL payload and fires
  // from the SINGLE commitEdit call site so the count stays exactly one per commit (React
  // multi-emit dedup, D-07). Echo-guarded by the shared `programmatic` counter so the
  // re-feed watch never re-enters mid-write.
  function writeData(next: any) {
    if (programmatic) return;
    programmatic++;
    setDataDefault(next); // fresh array only (never in-place)
    setData(next); // two-way emit if bound (no-op-diff if not)
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
  function onExpandedChangeCb(updater: any) {
    writeExpanded(applyUpdater(updater, currentState().expanded));
  }
  function onGroupingChangeCb(updater: any) {
    writeGrouping(applyUpdater(updater, currentState().grouping));
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
  function windowingSource() {
    if (!table) return [];
    if (local.virtual) return table.getPrePaginationRowModel().rows;
    return table.getRowModel().rows;
  }

  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  function virtualItemKey(i: any) {
    const src = windowingSource();
    return src && src[i] ? src[i].id : undefined;
  }

  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
  // increment the React emitter lowers to functional setState — correct even from a mount closure.
  function virtualizerOptions(): any {
    return {
      count: windowingSource().length,
      getScrollElement: () => gridScrollEl,
      estimateSize: () => local.estimateRowHeight,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      measureElement,
      overscan: 8,
      getItemKey: virtualItemKey,
      onChange: () => {
        setWindowVer(windowVer() + 1);
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
    };
  }

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
    if (remeasurePending) return;
    remeasurePending = true;
    let ranMicro = false;
    const microPass = () => {
      remeasureWindow();
    };
    const rafPass = () => {
      remeasurePending = false;
      remeasureWindow();
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) remeasurePending = false;else setTimeout(rafPass, 0);
  }

  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
  // pinnedEditIndex(): the FULL-MODEL row index of the row currently in edit (D-02 pin-row),
  // or -1 when no editor is open. Under virtualization `$data.rows` is the FULL pre-pagination
  // model, so editingRow (single-cell) / editingRowIndex (full-row) — both in that index space —
  // ARE the full-model index. The pinned row must never recycle while editing (req-9): it is
  // unioned into the windowed slice when it scrolls off-window and its height is subtracted from
  // the appropriate spacer so the total stays exactly getTotalSize() (the 51-01-proven mechanism).
  function pinnedEditIndex() {
    if (editingRow() >= 0) return editingRow();
    if (editingRowIndex() != null) return editingRowIndex();
    return -1;
  }
  // pinnedMeasurement(pin): the virtual-core measurement { index, start, size, end, key } for the
  // pinned full-model index — its measured (or estimated) height + offset, used to (a) decide
  // whether it sits above/below the rendered window and (b) subtract its height from the right
  // spacer. Null when out of range / not virtual.
  function pinnedMeasurement(pin: any) {
    if (!virtualizer || pin < 0) return null;
    const ms = virtualizer.getMeasurements();
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
    void windowVer();
    void editVer();
    if (!virtualizer) {
      // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
      // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
      // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
      // rows appear on the first onChange after _didMount.
      if (!local.virtual) {
        const rowList = rows() || [];
        return rowList.map((r: any) => ({
          vi: null,
          row: r
        }));
      }
      return [];
    }
    const items = virtualizer.getVirtualItems();
    const rowList = rows() || [];
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

  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void windowVer();
    void editVer();
    if (!local.virtual || !virtualizer) return 0;
    const items = virtualizer.getVirtualItems();
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
    void windowVer();
    void editVer();
    if (!local.virtual || !virtualizer) return 0;
    const items = virtualizer.getVirtualItems();
    if (!items.length) return 0;
    let pad = virtualizer.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinnedMeasurement(pin);
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
    if (!local.virtual || !virtualizer) return false;
    const items = virtualizer.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
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
  function remeasureWindow() {
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
  }
  // Push fresh options into table-core + re-pull the row model. Extracted so BOTH the
  // re-feed $watch (above) and the Lit data-change $onUpdate (below) call it.
  function reFeed() {
    if (!table) return;
    table.setOptions((prev: any) => ({
      ...prev,
      data: currentData(),
      columns: tableColumns(),
      state: currentState(),
      enableRowSelection: local.selectionMode !== 'none',
      enableMultiRowSelection: local.selectionMode === 'multiple',
      // Re-pass the expand model fns + callback (Pitfall 4 — virtual-core/table-core's
      // setOptions REPLACES, so an omitted fn would drop the model on re-feed; on React the
      // onExpandedChange callback must re-capture fresh currentState each cycle, F6).
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (local.getSubRows || undefined) as any,
      getRowCanExpand: local.expandable === true && local.getSubRows == null ? () => true : undefined,
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
    return editorTypeOf(colId) === 'custom' && !!(_props.editorSlot ?? _props.slots?.["editor"]);
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
  function rowCanExpand(row: any) {
    return !!(tick() >= 0 && row && row.getCanExpand && row.getCanExpand());
  }
  function rowIsExpanded(row: any) {
    return !!(tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());
  }
  // rowShowsDetail: the #detail <tr> renders ONLY in #detail mode (no getSubRows) when the
  // row is expanded. With getSubRows the children arrive as ordinary depth-indented rows in
  // $data.rows (table-core flattens) — NO additive detail row, NO nested r-for (Pitfall 1).
  function rowShowsDetail(row: any) {
    return local.getSubRows == null && rowIsExpanded(row);
  }
  // Toggle a row's expanded state through table-core so onExpandedChange → writeExpanded
  // fires exactly one expanded-change. Used by the chevron @click (native <button> handles
  // Enter/Space → click, so NO explicit @keydown.enter/.space — that would DOUBLE-toggle on
  // a real button; the grid @keydown is inert in 'table' mode, isGrid()-gated).
  function onToggleExpand(row: any, evt: any) {
    if (!row || !row.toggleExpanded) return;
    // Capture the owning row element BEFORE the toggle so DOM focus can be restored after the
    // expanded-state re-render. On Solid the expander <td>/<button> is RECREATED on that
    // re-render (the reference-keyed cell <For> receives fresh table-core cell instances each
    // pull — the <tr> persists but its cells are rebuilt), which drops DOM focus to <body> and
    // breaks keyboard activation (Enter/Space on the focused expander leaves nothing focused).
    // Re-focusing the (possibly-recreated) expander in the SAME row keeps the control focused —
    // the focusActiveCell imperative-refocus precedent. The rAF defers past the synchronous
    // reactive flush so the fresh node exists. Harmless on the targets that keep the node
    // (Vue/React/Svelte/Angular/Lit re-focus the same element → no-op).
    const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest('tr') : null;
    row.toggleExpanded();
    if (ownerRow && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const btn = ownerRow.querySelector('[data-expander]');
        if (btn) btn.focus();
      });
    }
  }
  // bodyCellStyle: the non-virtual <td> inline style — pinStyle PLUS a depth-proportional
  // left pad on the EXPANDER cell so nested getSubRows children visibly indent (row.depth).
  // Only the expander column indents (the tree affordance lives in its dedicated column);
  // data columns stay grid-aligned. depth 0 → unchanged (byte-identical-off).
  function bodyCellStyle(row: any, colId: any) {
    const base = pinStyle(colId);
    if (isExpanderColumn(colId) && row && row.depth) {
      const pad = 'padding-left:' + (0.5 + row.depth * 1.25) + 'rem';
      return base ? base + ';' + pad : pad;
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
  // groupSubRowCount: the number of immediate members under a group-header row (the count shown in
  // the header, e.g. "North (3)").
  function groupSubRowCount(row: any) {
    return row && row.subRows ? row.subRows.length : 0;
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
  // getRowIndexRelativeToPage(absRow?) — C1 (phase 63 wave-6) converter: an ABSOLUTE display-order
  // index (the focusCell/getActiveCell/activecell-change space) → the PAGE-RELATIVE index. Mirrors
  // MUI getRowIndexRelativeToVisibleRows. With NO argument it converts the CURRENT active cell
  // (toAbsRow($data.activeRow) - pageRowOffset() collapses to $data.activeRow). In virtual mode
  // there is no page (windowing replaces pagination) → the windowed model IS the full model, so it
  // returns the absolute index unchanged. Collision-safe: no *-change event, prop, React auto-setter,
  // or inherited Lit DOM method named getRowIndexRelativeToPage (ROZ121/124/137 clear).
  function getRowIndexRelativeToPage(absRow: any) {
    const abs = absRow == null ? toAbsRow(activeRow()) : Math.trunc(Number(absRow)) || 0;
    if (local.virtual) return abs;
    return abs - pageRowOffset();
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
    if (!isGrid() || local.virtual) return 0;
    return pageIndex() * pageSize();
  }
  // page-relative active row → absolute (display-order) index.
  function toAbsRow(localRow: any) {
    return localRow + pageRowOffset();
  }
  // A body row's ABSOLUTE display-order index = its page-relative index + the page offset. Drives
  // aria-rowindex on the non-virtual paginated body (B27); the virtual path uses wr.vi.index
  // directly (already absolute). Reactive via rowIndexOf's tick().
  function absRowIndexOf(row: any) {
    return rowIndexOf(row) + pageRowOffset();
  }
  // Total filtered+sorted PRE-pagination row count — the clamp bound for an absolute focusCell.
  // In virtual mode $data.rows IS the full pre-pagination model (bodyRowCount suffices); in the
  // non-virtual paginated body $data.rows is only the page slice, so read the live model.
  function prePaginationRowCount() {
    if (!table || local.virtual) return bodyRowCount();
    const pm = table.getPrePaginationRowModel();
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
    if (activeIsHeader()) {
      if (rowKey !== '__header') return -1;
      return colIndex === activeColIndex() && level === activeHeaderLevel() ? 0 : -1;
    }
    const isActive = rowKey === String(activeRow()) && colIndex === activeColIndex();
    return isActive ? 0 : -1;
  }

  // ── The focus SEAM (RESEARCH Pattern 1 + 3, req-6) ─────────────────────────────────────
  // resolveCellEl: index pair → DOM element, via a data-* attribute query off the stable
  // post-mount root. Uniform on all six, shadow-safe (the query runs from inside the
  // component's own scope). rowKey is the literal '__header' or a String(integer index) and
  // colIndex is an integer — NO consumer string is interpolated into the selector (T-49-01).
  function resolveCellEl(rowKey: any, colIndex: any, level = null) {
    if (!gridRoot) return null;
    // B12: a grouped multi-level header has MULTIPLE cells sharing data-row="__header" at the
    // same data-col-index across levels (parent vs leaf). Disambiguate header lookups by the
    // integer data-header-level so resolveCellEl('__header', 0) no longer returns the FIRST DOM
    // match (the parent) when the leaf is meant. level is an integer (NO consumer string is
    // interpolated — T-49-01 stays safe); body lookups pass level=null → the selector is
    // byte-unchanged.
    let sel = '[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]';
    if (rowKey === '__header' && level != null) sel = sel + '[data-header-level="' + level + '"]';
    return gridRoot.querySelector(sel);
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
    if (!isGrid() || !gridRoot) return;
    const r = nextRow == null ? activeRow() : nextRow;
    const c = nextCol == null ? activeColIndex() : nextCol;
    // B12: thread the FRESH post-write header level (the grouped-header analog of the
    // nextIsHeader threading) so a leaf↔parent header move resolves the cell at the correct
    // level, never the async-stale $data.activeHeaderLevel re-read (React ROZ138 / Angular signal).
    const lvl = nextLevel == null ? activeHeaderLevel() : nextLevel;
    // Thread the FRESH post-write isHeader flag (the plan-01-PROVEN contract): a header
    // crossing sets $data.activeIsHeader inside moveRow, but React's setState (ROZ138) and
    // Angular's signal write are async within one handler — re-reading $data.activeIsHeader
    // here returns the PRE-write value, resolving focus to the BODY cell instead of the
    // header. Callers pass the fresh isHeader local; falls back to $data when omitted.
    const header = nextIsHeader == null ? activeIsHeader() : nextIsHeader;
    // ── phase 53 scroll-then-focus (D-12): when windowing AND the target body row is OUTSIDE the
    // rendered window, scroll it in first, then defer focus to AFTER the new window commits (the
    // double-rAF — a single rAF can fire before React's async commit, Pitfall 4). Header cells and
    // in-window rows keep the synchronous path below (table-mode / non-windowed stay byte-stable).
    // The guard reads the resolved `header` (NOT the raw `nextIsHeader`) so an omitted-arg call
    // while a header cell is active falls back to $data.activeIsHeader and skips the scroll path.
    if (local.virtual && virtualizer && !header && rowIsOutsideWindow(r)) {
      virtualizer.scrollToIndex(r, {
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
    if (!table) return (rows() || []).length;
    const fm = table.getFilteredRowModel();
    return fm && fm.rows ? fm.rows.length : (rows() || []).length;
  }

  // Column count = the visible cell list length (uniform header+body in a flat grid). Reads
  // $data.rows (reactive) so it is fine-grained-correct on Solid/Lit; falls back to the
  // header leaf count when there are no body rows.
  function visibleColCount() {
    // NB: local is `rowList` (NOT `rows`) — the React emitter lowers `$data.rows` to the bare
    // state binding `rows`, so a `const rows = $data.rows` self-shadows it (TS2448 TDZ). Same
    // self-shadow class as the deconflictPropShadows finding; avoid the $data-key name as a local.
    const rowList = rows() || [];
    if (rowList.length) return rowList[0].getVisibleCells().length;
    const hg = headerGroups() || [];
    return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
  }
  function bodyRowCount() {
    return (rows() || []).length;
  }
  function clamp(v: any, lo: any, hi: any) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // ── Multi-level (grouped) header addressing (B12) ──────────────────────────────────────
  // $data.headerGroups is ordered top→bottom; the LEAF header row (the one adjacent to the
  // body) is the LAST group. The roving active-header state carries activeHeaderLevel (the
  // group index) alongside activeColIndex (the index within THAT level's headers) so the
  // single-tab-stop invariant + ArrowUp parent-resolution span every header level — a flat
  // grid has one level (leafLevel 0), so the table-mode/flat path is unchanged.
  function headerLeafLevel() {
    const hg = headerGroups() || [];
    return hg.length ? hg.length - 1 : 0;
  }
  function headerAt(level: any, colIndex: any) {
    const hg = headerGroups() || [];
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
    const hg = headerGroups() || [];
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
    const hg = headerGroups() || [];
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
    const max = visibleColCount() - 1;
    const nextCol = clamp(activeColIndex() + delta, 0, max < 0 ? 0 : max);
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
    if (activeIsHeader()) {
      if (delta > 0) {
        // B12 — Down: from a PARENT header level, descend to its FIRST child leaf header (one
        // level down); from the LEAF header level, drop into the body (row 0). A header-level
        // move re-targets activeColIndex (parent↔child column indices differ), so the fresh
        // col is RETURNED for the caller to thread into the focus seam (NOT re-read from $data).
        if (activeHeaderLevel() < leafLevel) {
          const childCol = firstChildHeaderColIndex(activeHeaderLevel(), activeColIndex());
          if (childCol >= 0) {
            const nextLevel = activeHeaderLevel() + 1;
            setActiveHeaderLevel(nextLevel);
            setActiveColIndex(childCol);
            return {
              row: activeRow(),
              col: childCol,
              isHeader: true,
              level: nextLevel
            };
          }
        }
        // At the leaf header: an empty grid has no body to drop into → stay put.
        if (bodyRowCount() === 0) return {
          row: activeRow(),
          col: activeColIndex(),
          isHeader: true,
          level: activeHeaderLevel()
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
          col: activeColIndex(),
          isHeader: false,
          level: 0
        };
      }
      // B12 — Up: from the leaf (or any non-top) header level, ascend to the PARENT header that
      // spans the active column; at the top level (or no real parent) stay put. The parent col
      // index differs from the leaf's, so the fresh col is RETURNED (threaded into focus).
      const parentCol = parentHeaderColIndex(activeHeaderLevel(), activeColIndex());
      if (parentCol >= 0) {
        const nextLevel = activeHeaderLevel() - 1;
        setActiveHeaderLevel(nextLevel);
        setActiveColIndex(parentCol);
        return {
          row: activeRow(),
          col: parentCol,
          isHeader: true,
          level: nextLevel
        };
      }
      return {
        row: activeRow(),
        col: activeColIndex(),
        isHeader: true,
        level: activeHeaderLevel()
      };
    }
    // In the body: an upward move from row 0 crosses into the LEAF header level (the header row
    // adjacent to the body). The body col index aligns 1:1 with the leaf header col index, so
    // activeColIndex carries over unchanged.
    if (delta < 0 && activeRow() === 0) {
      setActiveIsHeader(true);
      setActiveHeaderLevel(leafLevel);
      return {
        row: activeRow(),
        col: activeColIndex(),
        isHeader: true,
        level: leafLevel
      };
    }
    const nextRow = clamp(activeRow() + delta, 0, maxRow);
    setActiveRow(nextRow);
    setActiveIsHeader(false);
    return {
      row: nextRow,
      col: activeColIndex(),
      isHeader: false,
      level: 0
    };
  }

  // Home/End within the current row → col 0 / max. Returns the fresh colIndex.
  function gotoColEdge(toEnd: any) {
    const max = visibleColCount() - 1;
    const nextCol = toEnd ? max < 0 ? 0 : max : 0;
    setActiveColIndex(nextCol);
    return nextCol;
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
    const rowKey = activeIsHeader() ? '__header' : String(activeRow());
    return resolveCellEl(rowKey, activeColIndex(), activeIsHeader() ? activeHeaderLevel() : null);
  }

  // The focusable descendants of a cell (non-disabled), in DOM order. Pure DOM — uniform ×6.
  function focusables(cellEl: any) {
    if (!cellEl || !cellEl.querySelectorAll) return [];
    const list = Array.prototype.slice.call(cellEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
    return list.filter((n: any) => !n.disabled);
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
    const active = gridRoot ? gridRoot.getRootNode().activeElement : null;
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
  function onGridKeyDown(e: any) {
    if (!isGrid() || !e) return;
    const key = e.key;
    // Editing mode (phase 51, Pitfall 5): an OPEN editor owns Tab/Enter/Escape (+ caret keys)
    // via its local onEditorKeyDown handler. This top check (BEFORE activeInControl) returns
    // early so the grid nav keymap never hijacks an arrow/Tab/Enter while editing — the three
    // modes (editing / in-control / navigation) stay mutually exclusive and ordered.
    if (editingRow() >= 0) return;
    // Full-row edit (phase 51 req-6): an OPEN row editor owns Enter/Escape/Tab via the cell
    // editors' local onEditorKeyDown. Return early (before activeInControl) so the grid nav
    // keymap never hijacks while a row is in edit — the three modes stay mutually exclusive.
    if (editingRowIndex() != null) return;
    // Interaction mode (D-08): Tab cycles within the cell, Escape exits. Focus containment.
    if (activeInControl()) {
      if (key === 'Escape') {
        e.preventDefault();
        setActiveInControl(false);
        // Return focus to the OWNING cell (no move happened) — pass the current indices
        // explicitly (the React-emitted seam types both params as required; a zero-arg call
        // is TS2554). Reading $data here is safe: no write to activeRow/activeColIndex precedes it.
        focusActiveCell(activeRow(), activeColIndex());
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
    const prevRow = activeRow();
    const prevCol = activeColIndex();
    const prevIsHeader = activeIsHeader();
    const prevLevel = activeHeaderLevel();
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
    if (key === 'ArrowRight' && e.shiftKey && !activeIsHeader()) {
      e.preventDefault();
      extendRange(0, 1);
      return;
    } else if (key === 'ArrowLeft' && e.shiftKey && !activeIsHeader()) {
      e.preventDefault();
      extendRange(0, -1);
      return;
    } else if (key === 'ArrowDown' && e.shiftKey && !activeIsHeader()) {
      e.preventDefault();
      extendRange(1, 0);
      return;
    } else if (key === 'ArrowUp' && e.shiftKey && !activeIsHeader()) {
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
    // ── Full-row edit entry (phase 51 req-6 / D-06) — Shift+F2 on an editable active cell puts
    // EVERY editable cell in the active row into edit at once. Tested BEFORE the plain F2 branch
    // (a Shift+F2 must NOT fall through to single-cell F2). Shift+F2 was chosen for the lowest
    // collision risk against the Phase-49 keymap. Gated by isActiveCellEditable() (the row has
    // at least the active editable column); a non-editable active cell falls through unchanged.
    else if (key === 'F2' && e.shiftKey && isActiveCellEditable()) {
      e.preventDefault();
      beginRowEdit((rows() || [])[activeRow()]);
      return;
    }
    // ── Edit-entry (phase 51 req-1/3, D-05) — BEFORE the reserved enterControl branch.
    // Gated by isActiveCellEditable(): a non-editable active cell falls through to
    // enterControl (the Phase-49 behavior is unchanged). F2/Enter seed the EXISTING value
    // (in-place edit); a single printable char (no Ctrl/Meta/Alt) REPLACES the value.
    else if ((key === 'Enter' || key === 'F2') && isActiveCellEditable()) {
      e.preventDefault();
      beginEdit(activeRow(), activeColIndex(), null);
      return;
    } else if (isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // B24: a printable key only SEEDS a draft on a free-text editor (text/number). A
      // checkbox/select/date editor must NOT take the typed char as its value (it would
      // force-check the checkbox, seed a garbage select option, or corrupt the date) — open
      // those with the EXISTING value (seed=null), identical to the F2/Enter in-place entry.
      e.preventDefault();
      const editType = editorTypeOf(activeCellColumnId());
      const seed = editType === 'text' || editType === 'number' ? key : null;
      beginEdit(activeRow(), activeColIndex(), seed);
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
      _props.onActivecellChange?.({
        rowIndex: toAbsRow(nextRow),
        colIndex: nextCol
      });
    }
  }

  // WR-03: integrate mouse-click + programmatic focus with the roving model. A click on a
  // tabindex="-1" cell (or focus arriving any way other than the keyboard nav path) moves
  // DOM focus there but does NOT run onGridKeyDown — so activeRow/activeColIndex would stay
  // on the OLD cell and the NEXT arrow key would jump from the stale active cell. Wired as
  // ONE @focusin on the <table> root (focusin bubbles): resolve the focused element's owning
  // [data-grid-cell], parse its data-row/data-col-index, and write them into the active-cell
  // state (mirroring the keyboard path). Clears activeInControl ONLY when the cell ITSELF
  // (not an inner control) received focus — focusing a control via Enter keeps the in-control
  // flag. NEVER emits activecell-change (a focus sync is not a keyboard navigation event).
  function syncActiveFromEvent(e: any) {
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
    if (isHeader) {
      // B12: a click/focus onto a grouped header cell must capture its header LEVEL too, so the
      // roving model + a subsequent ArrowUp/ArrowDown resolve from the correct level (not a stale
      // one). data-header-level is an integer marker on the <th>; fall back to the leaf level.
      const lvlAttr = cellEl.getAttribute('data-header-level');
      const lvl = lvlAttr != null ? parseInt(lvlAttr, 10) : headerLeafLevel();
      setActiveHeaderLevel(Number.isFinite(lvl) ? lvl : headerLeafLevel());
    } else {
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
  }

  // onGridMouseDown: the Shift+Click range-extend seam (phase 51 req-7 / D-07). A focusin
  // event carries no reliable `shiftKey`, so the modifier MUST be read off the pointer event
  // — @mousedown fires BEFORE the cell's focusin and DOES carry shiftKey. A shift-held
  // mousedown on a BODY cell sets the range's moving corner to that cell (keeping the anchor),
  // riding the same data-row/data-col-index parse seam, then flags rangeClickPending so the
  // follow-up focusin does not collapse the range. A plain (non-shift) mousedown is ignored
  // here (the focusin owns the active-cell sync + the range collapse).
  function onGridMouseDown(e: any) {
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
  }

  // WR-02: reset the interaction-mode flag when focus leaves the active cell's subtree.
  // Without this, activeInControl could stick `true` — a mouse click OUTSIDE the cell, or
  // the focused inner control being removed from the DOM — leaving onGridKeyDown wedged in
  // the in-cell-trap branch so arrow nav is dead until Escape. Wired as ONE @focusout on
  // the <table> root (focusout bubbles, unlike blur). relatedTarget is the element RECEIVING
  // focus (null when focus leaves the document / is retargeted across a shadow boundary). If
  // focus is NOT moving to a descendant of the active cell, drop the flag. A Tab-cycle WITHIN
  // the cell (interaction mode) keeps relatedTarget inside cellEl → no reset.
  function onGridFocusOut(e: any) {
    if (!isGrid() || !activeInControl()) return;
    const next = e ? e.relatedTarget : null;
    const cellEl = currentCellEl();
    if (!cellEl || !next || !cellEl.contains(next)) setActiveInControl(false);
  }

  // B25: re-focus a resolved valid cell AFTER a programmatic shrink re-renders. The clamp
  // runs synchronously BEFORE the framework commits the new tbody, so a deferred rAF-poll
  // resolves the [data-row][data-col-index] cell off gridRoot once it has rendered (the fast
  // targets land on attempt 1; React/Solid retry across the async commit). Mirrors
  // focusCellWhenReady (B23) — DOM-only (reads gridRoot), so it is React-stale-safe.
  function recoverGridFocus(rowKey: any, col: any, level: any) {
    if (!gridRoot) return;
    let attempts = 0;
    const tryFocus = () => {
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
  function clampActiveCell(rowCount: any, colCount: any) {
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
    if (gridRoot) {
      const rootNode = gridRoot.getRootNode ? gridRoot.getRootNode() : null;
      const focusedEl = rootNode ? rootNode.activeElement : null;
      const focusedCell = focusedEl && focusedEl.closest ? focusedEl.closest('[data-grid-cell]') : null;
      if (focusedCell && gridRoot.contains(focusedCell)) {
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
    const col = clamp(activeColIndex(), 0, maxCol < 0 ? 0 : maxCol);
    if (col !== activeColIndex()) setActiveColIndex(col);
    // B6: an empty / all-filtered grid has NO body cell to hold the active cell. Park the active
    // cell on the leaf-header fallback (col 0) so the roving tab-stop stays on a REAL cell (never
    // an absent body cell → focus lost into <body>), and flag it so the next non-empty refresh
    // re-seats a body cell. The cellTabindex empty-fallback keeps exactly one header tab-stop.
    if (rowN <= 0) {
      setActiveIsHeader(true);
      setActiveHeaderLevel(headerLeafLevel());
      setActiveColIndex(0);
      setGridEmptyFallback(true);
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
    if (gridEmptyFallback()) {
      setGridEmptyFallback(false);
      setActiveIsHeader(false);
      setActiveRow(0);
    }
    if (!activeIsHeader()) {
      const lastRow = rowN - 1;
      const maxRow = lastRow < 0 ? 0 : lastRow;
      const row = clamp(activeRow(), 0, maxRow);
      if (row !== activeRow()) setActiveRow(row);
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
  }

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
  let rangeClickPending = false;
  // B19: a SYNCHRONOUS mirror of "a range currently exists" — extendRange/setRangeFocus set it
  // true, clearRange/clampRange-to-empty set it false. clearRange is invoked TWICE in one plain-
  // arrow keydown (the explicit collapse + the focusin that follows the programmatic focus move);
  // on React `$data.rangeAnchor = null` is an async setState, so the SECOND clearRange's
  // `$data.rangeAnchor == null` guard reads the STALE (pre-write) range and fires a duplicate
  // range-change. This module-let is written synchronously (no setState async), so the second
  // clearRange sees `rangeActive === false` and returns → exactly ONE range-change per real drop
  // across all six targets. A top-level let → React hoists to useRef.
  let rangeActive = false;
  function inRange(rIdx: any, cIdx: any) {
    const a = rangeAnchor();
    const f = rangeFocus();
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
    const a = rangeAnchor();
    const f = rangeFocus();
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
    const a = rangeAnchor();
    const f = rangeFocus();
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
    _props.onRangeChange?.({
      anchor,
      focus
    });
  }

  // extendRange(dRow, dCol): move rangeFocus by the (row,col) delta, clamped to the grid
  // bounds, seeding rangeAnchor from the active cell when no range exists yet (Shift+Arrow
  // from a bare active cell starts a 1×N / N×1 rectangle anchored at that cell). Body cells
  // only (header rows are not range-selectable). Emits range-change from this single site.
  function extendRange(dRow: any, dCol: any) {
    if (activeIsHeader()) return;
    const maxRow = bodyRowCount() - 1;
    const maxCol = visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return;
    // Seed the anchor + focus from the active cell on the FIRST extend (no range yet).
    let anchor = rangeAnchor();
    let focus = rangeFocus();
    const hadRange = !!(anchor && focus);
    if (!anchor || !focus) {
      anchor = {
        rowIndex: activeRow(),
        colIndex: activeColIndex()
      };
      focus = {
        rowIndex: activeRow(),
        colIndex: activeColIndex()
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
    rangeActive = true;
    // Keep the active cell tracking the moving focus corner (so a follow-up F2 / arrow acts
    // from the range's leading edge, the spreadsheet convention).
    setActiveRow(nextRow);
    setActiveColIndex(nextCol);
    // Suppress the focus-move's @focusin clearRange (no shiftKey on a programmatic focus): the
    // settle on the new focus corner is part of THIS range extension, not a fresh navigation.
    rangeTransition = true;
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
    let anchor = rangeAnchor();
    if (!anchor) anchor = {
      rowIndex: activeRow(),
      colIndex: activeColIndex()
    };
    const r = clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow);
    const c = clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol);
    const nextFocus = {
      rowIndex: r,
      colIndex: c
    };
    setRangeAnchor(anchor);
    setRangeFocus(nextFocus);
    rangeActive = true;
    emitRangeChange(anchor, nextFocus);
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
    if (!rangeActive) return;
    rangeActive = false;
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
    const a = rangeAnchor();
    const f = rangeFocus();
    if (!a && !f) return;
    // Bounds passed from the FRESH model (clampActiveCell → refreshRowModel's nextRows) so the
    // shrink-clamp is React-stale-safe; fall back to the live helpers for a direct call.
    const maxRow = maxRowArg != null ? maxRowArg : bodyRowCount() - 1;
    const maxCol = maxColArg != null ? maxColArg : visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) {
      setRangeAnchor(null);
      setRangeFocus(null);
      rangeActive = false;
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

  // ══ Clipboard (TSV copy/paste) + drag-fill (phase 51 plan 04 / req-8 / D-03 / D-04) ══════
  // The async Clipboard API (grantPermissions confirmed in 51-01). Copy = range→TSV; paste =
  // TSV→cells under the D-03 skip rule (editable AND validator-passing cells only) with an
  // N-of-M aria-live announce + one cell-edit-commit per committed cell; drag-fill = value-copy
  // ONLY (D-04, NO series detection). T-51-01 (BLOCKING-high): pasted TSV is UNTRUSTED — every
  // cell is written as plain string DATA through the per-column validator and rendered via the
  // SAME {{ }}/rozieDisplay text path as #cell (never innerHTML / a template / a selector); the
  // cell-resolution query interpolates integer indices only (resolveCellEl, T-49-01).

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
    return !activeIsHeader();
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
    const a = rangeAnchor();
    const f = rangeFocus();
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

  // B10: escape a TSV field per the spreadsheet convention — a field containing a tab, a CR/LF,
  // or a double-quote is wrapped in double-quotes with internal quotes DOUBLED; an ordinary
  // field is emitted verbatim. parseTsv() unescapes symmetrically, so a cell carrying a tab /
  // newline / quote round-trips without smearing into adjacent cells (T-63-03-02).
  function escapeTsvField(s: any) {
    if (s.indexOf('\t') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0 || s.indexOf('"') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // rangeToTsv(): serialize the current range to TSV — rows joined by '\n', cells by '\t',
  // reading each cell's value off the visible model by index (cellValueAt). A single active
  // cell (no range) serializes that one cell. Each field is B10-escaped. Pure read — never writes.
  function rangeToTsv() {
    const box = normalizedRange();
    const r0 = box ? box.r0 : activeRow();
    const r1 = box ? box.r1 : activeRow();
    const c0 = box ? box.c0 : activeColIndex();
    const c1 = box ? box.c1 : activeColIndex();
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

  // parseTsv(text): a TSV string → string[][] (rows of cells). Tolerates \r\n; a trailing
  // newline does not add a phantom empty row. Pure — produces plain string DATA only (T-51-01:
  // the cells are NEVER eval'd / interpolated into a selector / rendered as markup).
  function parseTsv(text: any) {
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
      editTransition = true;
      writeData(next);
      editTransition = false;
      // One cell-edit-commit per COMMITTED cell (the per-cell event contract, D-03).
      for (let i = 0; i < committed.length; i++) _props.onCellEditCommit?.(committed[i]);
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
    const rowList = rows() || [];
    const row = rowList[rowIndex];
    return row ? row.original : null;
  }
  function rowIdAt(rowIndex: any) {
    const rowList = rows() || [];
    const row = rowList[rowIndex];
    return row ? row.id : null;
  }

  // pasteRange(): read TSV from the clipboard (async), parse it, and apply it anchored at the
  // active cell under the D-03 skip rule. The grid is clamped to the grid bounds (T-51-02). A
  // failed/empty read is a silent no-op.
  function pasteRange() {
    // B11: never paste into a header-active state (the reusable clipboard guard) — a header
    // anchor would silently write body row 0 at the header's column.
    if (!clipboardActiveAllowed()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) return;
    // CR-02 (ROZ138): SNAPSHOT the anchor cell SYNCHRONOUSLY, before the clipboard read resolves.
    // On React these are useState-backed; re-reading $data inside the async .then() returns the
    // mount-render stale value, so a cell move between Ctrl+V and the read resolving would anchor
    // the paste at the wrong cell. Capture the locals now and pass them into applyGridToRange.
    const anchorRow = activeRow();
    const anchorCol = activeColIndex();
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
      applyGridToRange(grid, anchorRow, anchorCol);
    }).catch(() => {});
  }

  // tileIndex(i, lo, hi): map an index into the inclusive [lo,hi] source span by TILING (repeat
  // the source block), handling indices below lo (negative offset) correctly. A 1-wide source
  // (lo===hi) always returns lo. Used by fillRange to resolve, per target cell, WHICH source
  // cell it copies — so each column copies its OWN source value down its OWN column.
  function tileIndex(i: any, lo: any, hi: any) {
    const span = hi - lo + 1;
    if (span <= 1) return lo;
    let k = (i - lo) % span;
    if (k < 0) k = k + span;
    return lo + k;
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
  let fillDragging = false;
  // CR-04: track the live fill-drag document listeners in module-lets so $onUnmount can remove
  // them if the component unmounts MID-DRAG (the `up` handler clears them on a normal release,
  // but a mid-drag unmount would otherwise leak a pointermove/pointerup listener on document).
  let fillDragMove: any = null;
  let fillDragUp: any = null;
  function teardownFillDrag() {
    if (typeof document !== 'undefined') {
      if (fillDragMove) document.removeEventListener('pointermove', fillDragMove);
      if (fillDragUp) document.removeEventListener('pointerup', fillDragUp);
    }
    fillDragMove = null;
    fillDragUp = null;
    fillDragging = false;
  }
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
  function onFillHandlePointerDown(e: any) {
    if (!e) return;
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    fillDragging = true;
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
      if (!fillDragging) return;
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
      fillRange(sourceBox, lastCell);
    };
    // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
    fillDragMove = move;
    fillDragUp = up;
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }
  }

  // ══ Editable-cell lifecycle (phase 51 plan 02 — RESEARCH Pattern 1/3/4/5) ════════════════
  // Single-cell, non-virtual. Index-based state (editingRow/editingCol over the visible model),
  // the display↔editor branch in the keyed <td>, F2/Enter/printable entry off the reserved
  // onGridKeyDown seam, commit on Enter/Tab/blur, cancel+revert on Escape, sync validation with
  // D-01 keep-open. All gated by columnEditable() / the editing index pair so a table with no
  // editable columns lowers byte-identical (the editor branch r-if is always false).

  // The column id at the active cell (the active row's visible cell list @ activeColIndex).
  // Null when out of range (no body rows, or active cell is a header / select column).
  function activeCellColumnId() {
    if (activeIsHeader()) return null;
    const rowList = rows() || [];
    const row = rowList[activeRow()];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[activeColIndex()];
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
    if (editVer() < 0) return false;
    if (editingRowIndex() != null && editingRowIndex() === rowIndex) {
      const colId = columnIdAt(rowIndex, colIndex);
      return colId != null && columnEditable(colId);
    }
    return editingRow() === rowIndex && editingCol() === colIndex;
  }

  // cellAriaInvalid (req-5/D-01): the STRING 'true' ONLY for the editing cell while it holds
  // an invalid value — drives :aria-invalid on the <td>. Returns null otherwise so the bound
  // attribute DROPS (the rozieAttr nullish-attr path), keeping non-editing cells byte-clean.
  // Returns the literal 'true' (NOT boolean true) so rozieAttr's string-literal-union preserve
  // keeps React's aria-invalid (Booleanish incl. 'true') happy instead of widening to string.
  function cellAriaInvalid(rowIndex: any, colIndex: any): 'true' | null {
    return isEditing(rowIndex, colIndex) && !!invalidMsg() ? 'true' : null;
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

  // replaceRowValue: build a FRESH array with ONE row object replaced (the column's field
  // set to the new value); the rest share by reference (the family immutable whole-array
  // replace — in-place mutation is silently dropped on React/Solid/Angular/Lit). rowIndex
  // is over currentData() (== the visible model order for the non-virtual, unsorted/
  // unfiltered single-cell case; the row id is carried for the commit payload).
  function replaceRowValue(rows: any, rowIndex: any, field: any, value: any) {
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
  }

  // Map a visible-model body-row index ($data.rows index) to its underlying currentData()
  // index via the row's original object identity (sorting/filtering/pagination may reorder
  // the visible model away from the source array order). Falls back to the same index.
  function sourceIndexOfRow(visibleRowIndex: any) {
    const rowList = rows() || [];
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
    const rowList = rows() || [];
    const row = rowList[editingRow()];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[editingCol()];
    return cell && cell.column ? cell.column.id : null;
  }
  function editingColumnField() {
    const colId = editingColumnId();
    if (colId == null) return null;
    const d = defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  }
  function editingCellValue() {
    const rowList = rows() || [];
    const row = rowList[editingRow()];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[editingCol()];
    return cell ? cell.getValue() : null;
  }
  function editingRowOriginal() {
    const rowList = rows() || [];
    const row = rowList[editingRow()];
    return row ? row.original : null;
  }
  function editingRowId() {
    const rowList = rows() || [];
    const row = rowList[editingRow()];
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
  function focusEditorWhenReady(selectAll = true) {
    if (!gridRoot) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = gridRoot ? gridRoot.querySelector('[data-editing-cell]') : null;
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
    const rowList = rows() || [];
    const row = rowList[rowIndex];
    if (!row) return null;
    const cells = visibleCellsFor(row);
    const cell = cells[colIndex];
    return cell && cell.column ? cell.column.id : null;
  }
  function cellValueAt(rowIndex: any, colIndex: any) {
    const rowList = rows() || [];
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
    setInvalid('');
    // Single-cell and full-row edit are mutually exclusive (D-06): entering a single-cell
    // editor clears any row-edit state so isEditing never resolves both modes for one cell.
    setEditingRowIndex(null);
    setRowDraft({});
    setEditingRow(rowIndex);
    setEditingCol(colIndex);
    setDraftValue(seed != null ? seed : cellValueAt(rowIndex, colIndex));
    setActiveInControl(true);
    setEditVer(editVer() + 1);
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
  function focusCellWhenReady(row: any, col: any) {
    if (!gridRoot) return;
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

  // B23: the index of a committed row WITHIN a given (fresh) visible-model array, resolved by
  // row IDENTITY. table-core's default getRowId is source-index-based, so a row's id is stable
  // across a re-sort (only its VISIBLE position moves); a committed edit replaces the row object
  // via a fresh spread (the `original` reference changes), so match by `id` FIRST, `original`
  // only as a fallback. Returns -1 when the row filtered out of the view. PURE (the caller passes
  // the FRESH row list — refreshRowModel's just-pulled `nextRows`, never the React-stale state).
  function indexOfRowIn(rows: any, rowOriginal: any, rowId: any) {
    const list = rows || [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r) continue;
      if (rowId != null && r.id === rowId) return i;
      if (rowOriginal != null && r.original === rowOriginal) return i;
    }
    return -1;
  }

  // endEdit: tear down the editor (shared by commit/cancel). Clears the editing pair +
  // draft + invalid state and returns to navigation mode. Does NOT move focus (callers
  // decide where focus lands — commit/cancel return it to the owning cell).
  function endEdit() {
    setEditingRow(-1);
    setEditingCol(-1);
    setDraftValue(null);
    setInvalidMsg('');
    setActiveInControl(false);
    setEditVer(editVer() + 1);
  }

  // endRowEdit: tear down full-row edit (shared by commitRow/cancelRow). Clears the row
  // index + the per-cell drafts + invalid state and returns to navigation mode. Does NOT
  // move focus (callers return it to the active cell). Mirrors endEdit for the row mode.
  function endRowEdit() {
    setEditingRowIndex(null);
    setRowDraft({});
    setInvalidMsg('');
    setActiveInControl(false);
    setEditVer(editVer() + 1);
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
    if (editingRow() < 0) return false;
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
    const rawValue = overrideValue !== undefined ? overrideValue : draftValue();
    const newValue = coerceCellValue(colId, rawValue);
    const err = runValidator(colId, newValue, rowOriginal);
    if (err !== true) {
      // D-01: reject — keep the editor open, announce, re-trap focus, NEVER write the model.
      setInvalid(err);
      focusEditorWhenReady();
      return false;
    }
    setInvalid('');
    const srcIndex = sourceIndexOfRow(editingRow());
    const next = replaceRowValue(currentData(), srcIndex, field, newValue);
    // Snapshot the EDITING cell to return focus to BEFORE endEdit clears editing state.
    const focusRow = editingRow();
    const focusCol = editingCol();
    // Guard the teardown blur: writeData/endEdit re-render unmounts the editor → its blur
    // must NOT re-enter commitEdit (double cell-edit-commit). Cleared after the focus return.
    editTransition = true;
    writeData(next);
    // Exactly one emit per commit, from this single call site (writeData does NOT emit).
    _props.onCellEditCommit?.({
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
    // B23: do NOT focus the FIXED old index here — under an active sort/filter the committed row
    // RELOCATES, and focusCellWhenReady(oldRow,col) would land on whatever row now sits at the old
    // index (or drop to <body>). Instead record a pending follow-request the refreshRowModel pass
    // consumes AFTER the row model re-derives: it resolves the row's NEW display index from the
    // fresh model (React-stale-safe) and focuses THAT cell; the @focusin sync then re-seats the
    // active-cell state so it and DOM focus stay coherent. With no sort/filter the row keeps its
    // index → byte-behaviorally identical to before.
    if (skipFocusReturn !== true) pendingEditFollow = {
      rowOriginal,
      rowId,
      col: focusCol
    };
    return true;
  }

  // cancelEdit: discard the draft (D-05 — revert to the pre-edit value, no model write) and
  // return focus to the owning cell.
  function cancelEdit() {
    if (editingRow() < 0) return;
    // CR-01: capture from the EDITING pair (authoritative), NOT the active-cell indices — a
    // Tab-advance writes activeRow/activeColIndex to the NEXT cell BEFORE opening its editor, so
    // an Escape on the just-opened editor would otherwise return focus to the Tab-target cell
    // instead of the cell being cancelled. commitEdit already snapshots editingRow/editingCol.
    const focusRow = editingRow();
    const focusCol = editingCol();
    editTransition = true;
    endEdit();
    editTransition = false;
    focusCellWhenReady(focusRow, focusCol);
  }

  // ══ Full-row edit lifecycle (phase 51 plan 03 / req-6 / D-06, RESEARCH Pattern 6) ════════
  // Shift+F2 (and the editRow $expose verb) put EVERY editable cell in the active row into
  // edit at once; one save commits the whole row in ONE writeData (a single fresh-array row
  // replace) + ONE row-edit-commit event; Escape reverts the whole row as a unit. Per-column
  // validation still runs on each edited cell at commit (D-01 keep-open if ANY fails). The
  // editor template branch (isEditing's row arm) is re-used verbatim — no per-mode fork.

  // The editable [columnId, field] pairs for a body row at the given visible-model index,
  // in visible-cell order. field is the column's accessorKey (the row-object key to write).
  function editableColumnsForRow(rowIndex: any) {
    const rowList = rows() || [];
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
  function focusRowEditorAt(rowIndex: any, colIndex: any) {
    if (!gridRoot) return;
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
    // Clear any single-cell editor first (mutual exclusivity).
    setEditingRow(-1);
    setEditingCol(-1);
    setDraftValue(null);
    setInvalid('');
    // Seed each editable cell's draft from its current value.
    const draft = {};
    const rowList = rows() || [];
    const r = rowList[rowIndex];
    const orig = r ? r.original : null;
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      draft[ec.colId] = orig ? orig[ec.field] : null;
    }
    setRowDraft(draft);
    setEditingRowIndex(rowIndex);
    setActiveInControl(true);
    setEditVer(editVer() + 1);
    focusEditorWhenReady();
  }

  // commitRow(): validate EVERY edited column (D-01 — keep the row open if ANY fails: set
  // invalid + announce, NEVER write the model); on all-valid build ONE fresh array replacing
  // the single row object with all rowDraft values applied at once, call writeData ONCE, then
  // emit ONE row-edit-commit from THIS single call site, clear the row state, return focus.
  // Returns true on a written commit, false when a validation failure kept the row open.
  function commitRow() {
    if (editingRowIndex() == null) return false;
    const rowIndex = editingRowIndex();
    const editable = editableColumnsForRow(rowIndex);
    if (editable.length === 0) {
      endRowEdit();
      return false;
    }
    const rowList = rows() || [];
    const r = rowList[rowIndex];
    const rowOriginal = r ? r.original : null;
    const rowId = r ? r.id : null;
    const draft = rowDraft() || {};
    // Validate every edited column FIRST (D-01: a single failure blocks the whole row commit).
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      const err = runValidator(ec.colId, draft[ec.colId], rowOriginal);
      if (err !== true) {
        setInvalid(err);
        // B22: focus the OFFENDING column's editor (the one whose validator rejected), NOT
        // unconditionally the first editor (focusEditorWhenReady resolves the first
        // [data-editing-cell] in DOM order). ec.colIndex is the offending cell's visible col.
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
    const focusCol = activeColIndex();
    editTransition = true;
    writeData(next);
    // EXACTLY ONE emit per row commit, from THIS single call site (React multi-emit dedup, D-07).
    _props.onRowEditCommit?.({
      rowId,
      changes
    });
    endRowEdit();
    editTransition = false;
    focusCellWhenReady(focusRow, focusCol);
    return true;
  }

  // cancelRow(): revert the whole row as a unit (D-06 — drop every draft, NO model write) and
  // return focus to the active cell.
  function cancelRow() {
    if (editingRowIndex() == null) return;
    const focusRow = activeRow();
    const focusCol = activeColIndex();
    editTransition = true;
    endRowEdit();
    editTransition = false;
    focusCellWhenReady(focusRow, focusCol);
  }

  // replaceRowValues: like replaceRowValue but applies a MAP of field→value to ONE row object
  // in a single fresh-array replace (req-6 — the whole-row commit is ONE write, not per cell).
  function replaceRowValues(rows: any, rowIndex: any, fieldValues: any) {
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
  }

  // Compute the next editable cell for Tab-advance (req-3, RESEARCH Open-Q3 deterministic
  // rule): skip non-editable columns within the row; wrap to the NEXT row's first editable
  // cell at the row's end; stop (return null) at grid end. Pure index math over the visible
  // model. Returns { row, col } or null.
  function nextEditableCell(fromRow: any, fromCol: any) {
    const rowList = rows() || [];
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
    const rowList = rows() || [];
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
  let editTransition = false;

  // B23: a pending "follow the committed row's focus" request, set by commitEdit (a single-cell
  // commit that may relocate the row under an active sort/filter) and consumed ONCE by the next
  // refreshRowModel pass — which runs with the FRESH re-derived row model, so it can resolve the
  // committed row's NEW display index (React-stale-safe) and re-seat focus there. Shape:
  // { rowOriginal, rowId, col } or null. A top-level `let` (React hoists to useRef → persists).
  let pendingEditFollow: any = null;

  // ── Per-cell editor draft source (req-6) ──────────────────────────────────────────────
  // In single-cell mode every editor binds the shared $data.draftValue. In full-row mode
  // (editingRowIndex != null) each editable cell owns its OWN draft keyed by columnId in
  // rowDraft — so the four editors open simultaneously never clobber one shared value. These
  // helpers let the ONE editor template branch serve BOTH modes (no per-mode template fork):
  // the template binds editorValueFor(colId)/editorCheckedFor(colId) and writes via
  // onCellEditorInput(colId, evt)/onCellEditorCheckbox(colId, evt).
  function inRowEdit() {
    return editingRowIndex() != null;
  }
  function editorValueFor(colId: any) {
    return inRowEdit() ? rowDraft() ? rowDraft()[colId] : null : draftValue();
  }
  function editorCheckedFor(colId: any) {
    return !!(inRowEdit() ? rowDraft() ? rowDraft()[colId] : null : draftValue());
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
  function onCellEditorInput(colId: any, evt: any) {
    const v = evt && evt.target ? evt.target.value : '';
    if (inRowEdit()) {
      setRowDraft$local(colId, v);
      return;
    }
    setDraftValue(v);
  }
  function onCellEditorCheckbox(colId: any, evt: any) {
    const v = !!(evt && evt.target && evt.target.checked);
    if (inRowEdit()) {
      setRowDraft$local(colId, v);
      return;
    }
    setDraftValue(v);
  }
  // setRowDraft: write ONE key into a FRESH rowDraft object (whole-object replace — an
  // in-place mutation is silently dropped on React/Solid; the family immutable rule).
  function setRowDraft$local(colId: any, value: any) {
    const src = rowDraft() || {};
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
    const rowIndex = editingRowIndex();
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
    focusRowEditorAt(rowIndex, cols[nextPos]);
  }

  // onEditorKeyDown: the editor-LOCAL keymap (req-3). Enter → commit + stay (focus returns
  // to the cell); Tab → commit + advance to the next editable cell; Escape → cancel +
  // revert. preventDefault on handled keys so the grid keymap / native Tab don't double-act.
  function onEditorKeyDown(e: any) {
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
      const fromRow = editingRow();
      const fromCol = editingCol();
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
  }

  // onEditorBlur: commit on a genuine click/focus-away (D-01 — an invalid value keeps the
  // editor open via commitEdit's reject path). SKIP when:
  //  - editTransition is set (a synchronous commit/cancel teardown is unmounting the editor), or
  //  - the blur is part of a controlled keyboard transition: focus is moving to a grid cell
  //    or another editor inside our gridRoot (Tab-advance, Enter/Escape focus-return). On the
  //    async-render targets the unmount-blur can fire AFTER the synchronous flag cleared, so
  //    the relatedTarget/containment check is the load-bearing guard, not the flag alone.
  function onEditorBlur(e: any) {
    // Full-row mode (req-6): blur NEVER commits — the row commits as a UNIT only on an
    // explicit Enter / save / editRow-driven flow (a per-cell blur-commit would split the row
    // into N writes + N events, violating the one-write/one-event contract). Tabbing between
    // the row's own editors is a normal focus move, not a commit.
    if (inRowEdit()) return;
    if (editingRow() < 0 || editTransition) return;
    const next = e ? e.relatedTarget : null;
    // A null relatedTarget is an unmount-blur (the editor left the DOM) or a focus drop the
    // keyboard path owns; committing here would double-count (WR-04: the OLD editor's blur on
    // a Tab-advance fires with a TRANSIENT null relatedTarget while it unmounts). Keep the
    // conservative null=skip behavior.
    if (next == null) return;
    // Focus moving OUTSIDE the grid (a click into another widget) → commit (D-01 reject keeps
    // the editor open on an invalid value).
    if (!(gridRoot && gridRoot.contains && gridRoot.contains(next))) {
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
    if (fromRow !== String(editingRow()) || fromCol !== String(editingCol())) return;
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
      if (!gridRoot || destRow == null || destCol == null || destRow === '__header') return;
      const root = gridRoot.getRootNode ? gridRoot.getRootNode() : null;
      const act = root && root.activeElement ? root.activeElement : null;
      // Focus already landed inside the grid (the click-focus survived the re-render) — leave it.
      if (act && gridRoot.contains && gridRoot.contains(act)) return;
      const el = resolveCellEl(destRow, parseInt(destCol, 10));
      if (el) el.focus();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reseatDestFocus);else setTimeout(reseatDestFocus, 0);
  }

  // editCell(rowIndex, colIndex) — programmatic edit-entry ($expose, req-3). Coerces +
  // clamps indices, moves the active cell, and opens the editor (no-op on a non-editable
  // cell). Collision-clean (RESEARCH name-check): not a verb/event/prop/ROZ137 member.
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

  // commitEditing() — programmatic commit of the open editor ($expose, req-3). No-op when
  // no cell is editing. Collision-clean (not `commit`).
  function commitEditing() {
    if (editingRow() >= 0) commitEdit(undefined);
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
    const rowList = rows() || [];
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
    const maxCol = visibleColCount() - 1;
    const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    // C1: clamp the ABSOLUTE row index to the full filtered+sorted (pre-pagination) bounds.
    const absLast = prePaginationRowCount() - 1;
    const absRow = clamp(Math.trunc(Number(rowIndex)) || 0, 0, absLast < 0 ? 0 : absLast);
    // B14: snapshot the PRE-write ABSOLUTE position so the activecell-change emit fires ONLY on a
    // real move (mirrors the keyboard path's WR-06 suppression). A no-op focusCell to the already-
    // active cell must NOT emit; a header→body landing (prevIsHeader) is a real move.
    const prevAbs = toAbsRow(activeRow());
    const prevIsHeader = activeIsHeader();
    if (local.virtual) {
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
        // The switched-in page renders ASYNC on React/Solid/Lit — poll the in-page cell then focus
        // (the B23 focusCellWhenReady idiom; DOM-only off gridRoot, so React-stale-safe).
        focusCellWhenReady(localRow, c);
      } else {
        // Same page: re-seat focus synchronously (the REQ-5 idiom — re-focus after a button click).
        // Thread isHeader=false explicitly (focusActiveCell would otherwise re-read the React/Angular
        // async-stale $data.activeIsHeader, landing on a header when a sort button was last clicked).
        focusActiveCell(localRow, c, false);
      }
    }
    if (absRow !== prevAbs || prevIsHeader) {
      _props.onActivecellChange?.({
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
    return activeIsHeader() ? {
      rowIndex: null,
      colIndex: activeColIndex(),
      isHeader: true
    } : {
      rowIndex: toAbsRow(activeRow()),
      colIndex: activeColIndex(),
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
    if (!table) return;
    const target = String(rowId);
    const flat = table.getCoreRowModel().flatRows;
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
    if (!table) return;
    table.toggleAllRowsExpanded(true);
  }

  // collapseAll() — reset to a blank expanded state ({}). resetExpanded(true) forces the
  // blank reset (NOT the initialState) and fires onExpandedChange → one expanded-change.
  function collapseAll() {
    if (!table) return;
    table.resetExpanded(true);
  }

  // getExpandedRows() — return the original row data for every currently-expanded row
  // (read-verb twin of expanded-change). Integers/data only — scans the core flat rows and
  // filters by getIsExpanded(). Empty when nothing is expanded.
  function getExpandedRows() {
    if (!table) return [];
    const out = [];
    const flat = table.getCoreRowModel().flatRows;
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
    if (table) table.setGrouping(cols);
  }
  function clearGrouping() {
    if (table) table.setGrouping([]);
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
    if (tick() < 0 || !table) return [];
    const col = table.getColumn(colId);
    if (!col || !col.getFacetedUniqueValues) return [];
    const map = col.getFacetedUniqueValues(); // Map<any, number>
    return map ? Array.from(map.keys()) : []; // KEYS only — counts deferred (D-03)
  }
  // getFacetedMinMaxValues: the column's [min, max] numeric range, or null when unavailable.
  // Named to match the $expose verb (same shorthand contract as getFacetedUniqueValues above).
  function getFacetedMinMaxValues(colId: any) {
    if (tick() < 0 || !table) return null;
    const col = table.getColumn(colId);
    if (!col || !col.getFacetedMinMaxValues) return null;
    return col.getFacetedMinMaxValues() || null; // [number, number] | null
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

    {<Show when={!!invalidMsg()}><div class={"rdt-sr-live"} role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{invalidMsg()}</div></Show>}{<Show when={!!pasteAnnounce()}><div class={"rdt-sr-live rdt-sr-paste"} data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{pasteAnnounce()}</div></Show>}<div class={"rdt-toolbar"} data-rozie-s-d5dcab4c="">
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


    {<Show when={local.groupable}><div class={"rdt-group-bar-host"} data-rozie-s-d5dcab4c="">
      {(_props.groupBarSlot ?? _props.slots?.['groupBar'])?.({ grouping: groupingKeys(), groupableColumns: groupableColumns(), applyGrouping, clearGrouping }) ?? <For each={groupingKeys()}>{(gk) => <span class={"rdt-group-token"} data-group-token="" data-rozie-s-d5dcab4c="">{rozieDisplay(gk)}</span>}</For>}
    </div></Show>}{<Show when={local.virtual} fallback={<table aria-rowcount={rozieAttr(totalRowCount())} class={"rozie-data-table" + " " + rozieClass({ 'rdt-sticky': local.stickyHeader })} role={rozieAttr(tableRole())} onKeyDown={($event) => { onGridKeyDown($event); }} onFocusIn={($event) => { syncActiveFromEvent($event); }} onFocusOut={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} data-rozie-s-d5dcab4c="">
      <thead class={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <For each={headerGroups()}>{(hg, hgLevel) => <tr class={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          <For each={hg.headers}>{(header) => <th class={"rdt-th" + " " + rozieClass({ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel())} colSpan={rozieAttr(header.colSpan > 1 ? header.colSpan : null)} data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header), hgLevel()))} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
            
            
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
              </button></Show>}{<Show when={columnIsFilterable(header.column.id)}><input type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} class={"rdt-col-filter"} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" /></Show>}{<Show when={columnIsFilterable(header.column.id)}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(_props.filterSlot ?? _props.slots?.['filter'])?.({ columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter })}
              </span></Show>}<span class={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
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
        
        <For each={rows()}>{(row) => <>
        <tr class={"rdt-tr" + " " + rozieClass({ 'rdt-group-header': rowIsGrouped(row) })} role="row" data-depth={rozieAttr(row.depth)} aria-rowindex={rozieAttr(isGrid() ? absRowIndexOf(row) + 1 : null)} data-group-header={rozieAttr(rowIsGrouped(row) ? row.id : null)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(row) ? row.id : null)} data-rozie-s-d5dcab4c="">
          <For each={visibleCellsFor(row)}>{(cellCtx) => <td class={"rdt-td" + " " + rozieClass({ 'rdt-select-td': isSelectColumn(cellCtx.column.id), 'rdt-in-range': inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row))} data-col-index={rozieAttr(colIndexOf(row, cellCtx))} tabIndex={rozieAttr(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx)))} style={parseInlineStyle(bodyCellStyle(row, cellCtx.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cellCtx)))} data-in-range={rozieAttr(inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) ? 'true' : null)} data-agg-cell={rozieAttr(cellIsAggregated(cellCtx) ? cellCtx.column.id : null)} data-rozie-s-d5dcab4c="">
            
            {<Show when={isExpanderColumn(cellCtx.column.id)} fallback={<Show when={isSelectColumn(cellCtx.column.id)} fallback={<Show when={cellIsGrouped(cellCtx)} fallback={<Show when={isEditing(rowIndexOf(row), colIndexOf(row, cellCtx))} fallback={<span class={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(_props.cellSlot ?? _props.slots?.['cell'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) ?? rozieDisplay(cellCtx.getValue())}
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={hasEditorSlot(cellCtx.column.id)} fallback={<Show when={editorTypeOf(cellCtx.column.id) === 'number'} fallback={<Show when={editorTypeOf(cellCtx.column.id) === 'select'} fallback={<Show when={editorTypeOf(cellCtx.column.id) === 'checkbox'} fallback={<input type="text" data-editing-cell="" class={"rdt-cell-editor"} value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}><input type="checkbox" data-editing-cell="" class={"rdt-cell-editor"} checked={editorCheckedFor(cellCtx.column.id)} onChange={($event) => { onCellEditorCheckbox(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /></Show>}><select data-editing-cell="" class={"rdt-cell-editor"} value={editorValueFor(cellCtx.column.id)} onChange={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                <For each={editorOptionsOf(cellCtx.column.id)}>{(opt) => <option value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>}</For>
              </select></Show>}><input type="number" data-editing-cell="" class={"rdt-cell-editor"} value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(_props.editorSlot ?? _props.slots?.['editor'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() })}
              </span></Show>}</span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" data-expander="" aria-expanded={!!rowIsExpanded(row)} aria-label={rozieAttr(rowIsExpanded(row) ? 'Collapse group' : 'Expand group')} class={"rdt-expander rdt-group-toggle"} onClick={($event) => { onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row) ? '▾' : '▸')}</button>
              <span class={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {(_props.cellSlot ?? _props.slots?.['cell'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }) ?? rozieDisplay(cellCtx.getValue())}
              </span>
              <span class={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay('(' + groupSubRowCount(row) + ')')}</span>
            </span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectCellSlot ?? _props.slots?.['selectCell'])?.({ row: row.original, checked: rowIsSelected(row), toggle: e => onToggleRow(row, e) }) ?? <input type="checkbox" aria-label="Select row" class={"rdt-select-row"} checked={rowIsSelected(row)} onChange={($event) => { onToggleRow(row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={rowCanExpand(row)}><button type="button" data-expander="" aria-expanded={!!rowIsExpanded(row)} aria-label={rozieAttr(rowIsExpanded(row) ? 'Collapse row' : 'Expand row')} class={"rdt-expander"} onClick={($event) => { onToggleExpand(row, $event); }} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row) ? '▾' : '▸')}</button></Show>}</span></Show>}{<Show when={isFillHandleCell(rowIndexOf(row), colIndexOf(row, cellCtx))}><span data-fill-handle="" data-testid="fill-handle" aria-hidden="true" class={"rdt-fill-handle"} onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" /></Show>}</td>}</For>
        </tr>
        
        {<Show when={rowShowsDetail(row)}><tr class={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(row.id)} data-rozie-s-d5dcab4c="">
          <td class={"rdt-detail-cell"} colSpan={rozieAttr(visibleColCount())} data-rozie-s-d5dcab4c="">
            {(_props.detailSlot ?? _props.slots?.['detail'])?.({ row: row.original })}
          </td>
        </tr></Show>}</>}</For>
      </tbody>
    </table>}><div class={"rdt-scroll"} style={parseInlineStyle(local.maxHeight ? 'max-height:' + local.maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + local.maxHeight : 'overflow:auto')} data-rozie-s-d5dcab4c="">
    <table aria-rowcount={rows().length} class={"rozie-data-table" + " " + rozieClass({ 'rdt-sticky': local.stickyHeader })} role={rozieAttr(tableRole())} onKeyDown={($event) => { onGridKeyDown($event); }} onFocusIn={($event) => { syncActiveFromEvent($event); }} onFocusOut={($event) => { onGridFocusOut($event); }} onMouseDown={($event) => { onGridMouseDown($event); }} data-rozie-s-d5dcab4c="">
      <thead class={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <For each={headerGroups()}>{(hg, hgLevel) => <tr class={"rdt-tr"} role="row" data-rozie-s-d5dcab4c="">
          <For each={hg.headers}>{(header) => <th class={"rdt-th" + " " + rozieClass({ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) })} role="columnheader" data-col={rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel())} colSpan={rozieAttr(header.colSpan > 1 ? header.colSpan : null)} data-col-index={rozieAttr(headerColIndexOf(hg, header))} tabIndex={rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header), hgLevel()))} aria-sort={rozieAttr(ariaSortFor(header.column.id))} style={parseInlineStyle(thStyle(header.column.id))} data-rozie-s-d5dcab4c="">
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
              </button></Show>}{<Show when={columnIsFilterable(header.column.id)}><input type="text" aria-label={rozieAttr('Filter ' + headerLabel(header.column.id))} class={"rdt-col-filter"} value={columnFilterValue(header.column.id)} onInput={($event) => { onColumnFilterInput(header.column.id, $event); }} onClick={($event) => { stopEvent($event); }} data-rozie-s-d5dcab4c="" /></Show>}{<Show when={columnIsFilterable(header.column.id)}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(_props.filterSlot ?? _props.slots?.['filter'])?.({ columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter })}
              </span></Show>}<span class={"rdt-pin-controls"} role="group" aria-label={rozieAttr('Pin ' + headerLabel(header.column.id))} data-rozie-s-d5dcab4c="">
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
        
        <tr class={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={rozieAttr(visibleColCount())} style={parseInlineStyle('height:' + padTop() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
        
        <For each={windowedRows()}>{(wr) => <tr class={"rdt-tr" + " " + rozieClass({ 'rdt-row-pinned': wr.pinned })} role="row" data-row={rozieAttr(wr.vi.index)} aria-rowindex={rozieAttr(wr.vi.index + 1)} data-index={rozieAttr(wr.vi.index)} data-pinned={rozieAttr(wr.pinned ? 'true' : null)} data-rozie-s-d5dcab4c="">
          <For each={visibleCellsFor(wr.row)}>{(cellCtx) => <td class={"rdt-td" + " " + rozieClass({ 'rdt-select-td': isSelectColumn(cellCtx.column.id), 'rdt-in-range': inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) })} role={rozieAttr(cellRole())} data-col={rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row={rozieAttr(wr.vi.index)} data-col-index={rozieAttr(colIndexOf(wr.row, cellCtx))} tabIndex={rozieAttr(cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx)))} style={parseInlineStyle(pinStyle(cellCtx.column.id))} aria-invalid={rozieAttr(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cellCtx)))} data-in-range={rozieAttr(inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) ? 'true' : null)} data-rozie-s-d5dcab4c="">
            {<Show when={isSelectColumn(cellCtx.column.id)} fallback={<Show when={isEditing(wr.vi.index, colIndexOf(wr.row, cellCtx))} fallback={<span class={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {(_props.cellSlot ?? _props.slots?.['cell'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }) ?? rozieDisplay(cellCtx.getValue())}
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={hasEditorSlot(cellCtx.column.id)} fallback={<Show when={editorTypeOf(cellCtx.column.id) === 'number'} fallback={<Show when={editorTypeOf(cellCtx.column.id) === 'select'} fallback={<Show when={editorTypeOf(cellCtx.column.id) === 'checkbox'} fallback={<input type="text" data-editing-cell="" class={"rdt-cell-editor"} value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" />}><input type="checkbox" data-editing-cell="" class={"rdt-cell-editor"} checked={editorCheckedFor(cellCtx.column.id)} onChange={($event) => { onCellEditorCheckbox(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /></Show>}><select data-editing-cell="" class={"rdt-cell-editor"} value={editorValueFor(cellCtx.column.id)} onChange={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="">
                <For each={editorOptionsOf(cellCtx.column.id)}>{(opt) => <option value={rozieAttr(opt.value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt.label)}</option>}</For>
              </select></Show>}><input type="number" data-editing-cell="" class={"rdt-cell-editor"} value={editorValueFor(cellCtx.column.id)} onInput={($event) => { onCellEditorInput(cellCtx.column.id, $event); }} onKeyDown={($event) => { onEditorKeyDown($event); }} onBlur={($event) => { onEditorBlur($event); }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {(_props.editorSlot ?? _props.slots?.['editor'])?.({ columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() })}
              </span></Show>}</span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectCellSlot ?? _props.slots?.['selectCell'])?.({ row: wr.row.original, checked: rowIsSelected(wr.row), toggle: e => onToggleRow(wr.row, e) }) ?? <input type="checkbox" aria-label="Select row" class={"rdt-select-row"} checked={rowIsSelected(wr.row)} onChange={($event) => { onToggleRow(wr.row, $event); }} data-rozie-s-d5dcab4c="" />}
            </span></Show>}{<Show when={isFillHandleCell(wr.vi.index, colIndexOf(wr.row, cellCtx))}><span data-fill-handle="" data-testid="fill-handle" aria-hidden="true" class={"rdt-fill-handle"} onPointerDown={($event) => { onFillHandlePointerDown($event); }} data-rozie-s-d5dcab4c="" /></Show>}</td>}</For>
        </tr>}</For>
        
        <tr class={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={rozieAttr(visibleColCount())} style={parseInlineStyle('height:' + padBottom() + 'px;padding:0;border:0')} data-rozie-s-d5dcab4c="" />
        </tr>
      </tbody>
    </table>
    </div></Show>}{<Show when={!local.virtual}><div class={"rdt-pagination"} role="group" aria-label="Pagination" data-rozie-s-d5dcab4c="">
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
    </div></Show>}</div>
    </>
    </__ctx_data_table_columns.Provider>
  );
}
