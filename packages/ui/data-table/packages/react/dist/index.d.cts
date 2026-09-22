import * as React from "react";
import { ReactNode } from "react";

//#region src/DataTable.d.ts
interface DataTableProps {
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through the two-way `data` binding (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable data={rows} onDataChange={setRows} columns={cols} />
   */
  data?: unknown[];
  defaultData?: unknown[];
  onDataChange?: (next: unknown[]) => void;
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union). A `pinned` value of `'left'` or `'right'` is applied once as the table's initial `columnPinning` state — identical to `<Column pinned>` — which also REORDERS that column, since table-core orders visible cells `[left-pinned, center, right-pinned]`. A consumer who has already expressed a pin (an initial two-way `columnPinning` model value or an interactive pin) owns the slice and this declaration is ignored.
   */
  columns?: unknown[];
  /**
   * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
   */
  selectionMode?: string;
  /**
   * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
   */
  sorting?: unknown[];
  defaultSorting?: unknown[];
  onSortingChange?: (next: unknown[]) => void;
  /**
   * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
   */
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (next: string) => void;
  /**
   * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
   */
  columnFilters?: unknown[];
  defaultColumnFilters?: unknown[];
  onColumnFiltersChange?: (next: unknown[]) => void;
  /**
   * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
   */
  pagination?: Record<string, unknown>;
  defaultPagination?: Record<string, unknown>;
  onPaginationChange?: (next: Record<string, unknown>) => void;
  /**
   * Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page).
   */
  manual?: boolean;
  /**
   * Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset.
   */
  rowCount?: (number) | null;
  /**
   * Explicit total page count for `manual` pagination; overrides rowCount-derived count.
   */
  pageCount?: (number) | null;
  /**
   * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Pass `expandable` as a real boolean — a valueless attribute only coerces to `true` on Vue and Lit.
   */
  expandable?: boolean;
  /**
   * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
   */
  expanded?: (Record<string, unknown> | boolean) | null;
  defaultExpanded?: (Record<string, unknown> | boolean) | null;
  onExpandedChange?: (next: (Record<string, unknown> | boolean) | null) => void;
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  getSubRows?: ((...args: any[]) => any) | null;
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  groupable?: boolean;
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding the two-way `grouping` model (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
   */
  grouping?: (unknown[]) | null;
  defaultGrouping?: (unknown[]) | null;
  onGroupingChange?: (next: (unknown[]) | null) => void;
  /**
   * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
   */
  rowSelection?: Record<string, unknown>;
  defaultRowSelection?: Record<string, unknown>;
  onRowSelectionChange?: (next: Record<string, unknown>) => void;
  /**
   * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
   */
  columnVisibility?: Record<string, unknown>;
  defaultColumnVisibility?: Record<string, unknown>;
  onColumnVisibilityChange?: (next: Record<string, unknown>) => void;
  /**
   * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
   */
  columnSizing?: Record<string, unknown>;
  defaultColumnSizing?: Record<string, unknown>;
  onColumnSizingChange?: (next: Record<string, unknown>) => void;
  /**
   * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
   */
  columnOrder?: unknown[];
  defaultColumnOrder?: unknown[];
  onColumnOrderChange?: (next: unknown[]) => void;
  /**
   * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
   */
  columnPinning?: Record<string, unknown>;
  defaultColumnPinning?: Record<string, unknown>;
  onColumnPinningChange?: (next: Record<string, unknown>) => void;
  /**
   * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
   */
  stickyHeader?: boolean;
  /**
   * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
   */
  interactionMode?: string;
  /**
   * Grid mode only. When `true`, a plain click on an **editable** cell opens its editor immediately (single-click-to-edit) instead of just activating the cell. Default `false` keeps click-to-activate (double-click opens the editor). Shift+click (range selection) and clicks on non-editable cells are unaffected.
   */
  singleClickEdit?: boolean;
  /**
   * Grid mode. When `true`, every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Default `false` records no history and Ctrl+Z/Y are inert.
   */
  undoable?: boolean;
  /**
   * The maximum number of undo steps retained (oldest evicted past this depth). Only consulted when `undoable` is `true`.
   */
  undoLimit?: number;
  /**
   * Opt-in windowing grammar: `false` (default, off — byte-identical to a non-virtual table) | `true` or `'rows'` (vertical row windowing; `true` is byte-behavior-identical to every existing consumer, zero churn) | `'columns'` (horizontal column windowing) | `'both'` (both axes windowed). Row windowing renders only the visible slice of rows inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Column windowing renders only the visible slice of leaf columns inside the same `rdt-scroll` container. An unrecognised string behaves as `false`.
   */
  virtual?: boolean | string;
  /**
   * Estimated row height (px) — the first-paint seed for the windowing engine before any row has been measured. Only consulted when rows are windowed. When `autoMeasure` is `true`, later renders progressively refine the estimate from measured content; when `autoMeasure` is `false` this remains the explicit override for every render.
   */
  estimateRowHeight?: number;
  /**
   * Opt-in content-driven row-size estimation. When `true`, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` converges to the true content total on a large table with variable-height rows. Falls back to `estimateRowHeight` before any row has been measured. Default `false` keeps the estimate fixed at `estimateRowHeight` for every render (today's behavior).
   */
  autoMeasure?: boolean;
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
  onHistoryChange?: (...args: unknown[]) => void;
  onActivecellChange?: (...args: unknown[]) => void;
  onRangeChange?: (...args: unknown[]) => void;
  onCellEditCommit?: (...args: unknown[]) => void;
  onRowEditCommit?: (...args: unknown[]) => void;
  children?: ReactNode;
  renderGroupBar?: (params: {
    grouping: unknown;
    groupableColumns: unknown;
    applyGrouping: (...args: any[]) => any;
    clearGrouping: (...args: any[]) => any;
  }) => ReactNode;
  renderSelectAll?: (params: {
    checked: unknown;
    indeterminate: unknown;
    toggle: (...args: any[]) => any;
  }) => ReactNode;
  renderSelectCell?: (params: {
    row: unknown;
    checked: unknown;
    toggle: unknown;
  }) => ReactNode;
  renderDetail?: (params: {
    row: unknown;
  }) => ReactNode;
  renderColHeader?: (params: {
    columnId: unknown;
    column: unknown;
    label: unknown;
  }) => ReactNode;
  renderFilter?: (params: {
    columnId: unknown;
    value: unknown;
    uniqueValues: unknown;
    minMax: unknown;
    columnLabel: unknown;
    setFilter: (...args: any[]) => any;
  }) => ReactNode;
  renderCell?: (params: {
    columnId: unknown;
    column: unknown;
    row: unknown;
    value: unknown;
  }) => ReactNode;
  renderEditor?: (params: {
    columnId: unknown;
    column: unknown;
    row: unknown;
    value: unknown;
    commit: unknown;
    cancel: unknown;
    columnLabel: unknown;
    autofocus: unknown;
  }) => ReactNode;
  slots?: {
    [key: `colHeader-${string}`]: ((params: {
      columnId: any;
      column: any;
      label: any;
    }) => ReactNode) | undefined;
    [key: `filter-${string}`]: ((params: {
      columnId: any;
      value: any;
      uniqueValues: any;
      minMax: any;
      columnLabel: any;
      setFilter: any;
    }) => ReactNode) | undefined;
    [key: `cell-${string}`]: ((params: {
      columnId: any;
      column: any;
      row: any;
      value: any;
    }) => ReactNode) | undefined;
    [key: `editor-${string}`]: ((params: {
      columnId: any;
      column: any;
      row: any;
      value: any;
      commit: any;
      cancel: any;
      columnLabel: any;
      autofocus: any;
    }) => ReactNode) | undefined;
    [key: string]: ((...args: any[]) => ReactNode) | undefined;
  };
}
interface DataTableHandle {
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
  cut: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  canUndo: (...args: any[]) => any;
  canRedo: (...args: any[]) => any;
  clearHistory: (...args: any[]) => any;
}
declare const DataTable: React.ForwardRefExoticComponent<DataTableProps & React.RefAttributes<DataTableHandle>>;
//#endregion
//#region src/Column.d.ts
interface ColumnProps {
  /**
   * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
   */
  id?: string;
  /**
   * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
   * @example
   * <Column field="email" header="Email" />
   */
  field?: string;
  /**
   * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
   */
  header?: string;
  /**
   * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
   */
  sortable?: boolean;
  /**
   * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
   */
  filterable?: boolean;
  /**
   * Initial pin side: `''` (unpinned) | `'left'` | `'right'`. Applied once as the table's starting `columnPinning` state, so `getIsPinned()` reports it and the column joins the matching sticky rail — which also reorders it, since visible cells are ordered `[left-pinned, center, right-pinned]`. Ignored if the consumer has already pinned something; an interactive unpin is never re-applied.
   */
  pinned?: string;
  /**
   * Optional fixed/initial column width, applied as the column's starting size — a px number (`120`) or a px string (`'120px'`). Column sizing is numeric px, so other CSS lengths (`'12rem'`, `'20%'`, `'auto'`) have no px value to apply and are ignored; the column keeps the default width. An interactive resize overrides this.
   */
  width?: string | number;
  /**
   * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
   */
  expandable?: boolean;
  /**
   * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
   */
  groupable?: boolean;
  /**
   * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
   */
  aggregationFn?: (string | ((...args: any[]) => any)) | null;
  /**
   * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
   */
  editable?: boolean;
  /**
   * Editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'` (built-in inputs), or `'custom'` to hand rendering to the `#editor` scoped slot (or a per-column `editor-<columnId>` fill). Default `'text'`. **`'custom'` is the gate:** a column left on a built-in type ignores any `#editor` fill and renders the built-in input. Requires `editable: true` — and, for any pointer or keyboard edit entry, `interactionMode="grid"` on the table.
   */
  editor?: string;
  /**
   * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
   */
  editorOptions?: unknown[];
  /**
   * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
   */
  validate?: ((...args: any[]) => any) | null;
}
declare function Column(props: ColumnProps): JSX.Element;
//#endregion
//#region src/EditorText.d.ts
interface EditorTextProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value the editor seeds its local draft from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function EditorText(props: EditorTextProps): JSX.Element;
//#endregion
//#region src/EditorNumber.d.ts
interface EditorNumberProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value the local draft string seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function EditorNumber(props: EditorNumberProps): JSX.Element;
//#endregion
//#region src/EditorSelect.d.ts
interface EditorSelectProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  options?: unknown[];
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function EditorSelect(props: EditorSelectProps): JSX.Element;
//#endregion
//#region src/EditorCheckbox.d.ts
interface EditorCheckboxProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value — coerced to a real boolean via `!!` to seed the checkbox `checked` state.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the boolean checked state on `@change`. Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function EditorCheckbox(props: EditorCheckboxProps): JSX.Element;
//#endregion
//#region src/EditorDate.d.ts
interface EditorDateProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function EditorDate(props: EditorDateProps): JSX.Element;
//#endregion
//#region src/FilterText.d.ts
interface FilterTextProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  setFilter?: ((...args: any[]) => any) | null;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function FilterText(props: FilterTextProps): JSX.Element;
//#endregion
//#region src/FilterNumberRange.d.ts
interface FilterNumberRangeProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  setFilter?: ((...args: any[]) => any) | null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  minMax?: (unknown) | null;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function FilterNumberRange(props: FilterNumberRangeProps): JSX.Element;
//#endregion
//#region src/FilterSelect.d.ts
interface FilterSelectProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the select seeds from (String-coerced).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
   */
  setFilter?: ((...args: any[]) => any) | null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues?: unknown[];
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}
declare function FilterSelect(props: FilterSelectProps): JSX.Element;
//#endregion
//#region src/GroupBar.d.ts
interface GroupBarProps {
  /**
   * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
   */
  grouping?: unknown[];
  /**
   * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
   */
  groupableColumns?: unknown[];
  /**
   * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
   */
  applyGrouping?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  clearGrouping?: ((...args: any[]) => any) | null;
}
declare function GroupBar(props: GroupBarProps): JSX.Element;
//#endregion
//#region src/DetailPanel.d.ts
interface DetailPanelProps {
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  row?: (unknown) | null;
}
declare function DetailPanel(props: DetailPanelProps): JSX.Element;
//#endregion
export { Column, DataTable, DataTable as default, type DataTableHandle, DetailPanel, EditorCheckbox, EditorDate, EditorNumber, EditorSelect, EditorText, FilterNumberRange, FilterSelect, FilterText, GroupBar };