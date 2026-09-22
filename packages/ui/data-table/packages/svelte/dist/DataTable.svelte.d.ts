import type { Snippet } from 'svelte';
interface Props {
    /**
     * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through the two-way `data` binding (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
     * @example
     * <DataTable bind:data={rows} columns={cols} />
     */
    data: any[];
    /**
     * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union). A `pinned` value of `'left'` or `'right'` is applied once as the table's initial `columnPinning` state — identical to `<Column pinned>` — which also REORDERS that column, since table-core orders visible cells `[left-pinned, center, right-pinned]`. A consumer who has already expressed a pin (an initial two-way `columnPinning` model value or an interactive pin) owns the slice and this declaration is ignored.
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
    /**
     * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
     */
    globalFilter?: string;
    /**
     * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
     */
    columnFilters?: any[];
    /**
     * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
     */
    pagination?: any;
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
    expanded?: (any | boolean) | null;
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
    grouping?: (any[]) | null;
    /**
     * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
     */
    rowSelection?: any;
    /**
     * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
     */
    columnVisibility?: any;
    /**
     * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
     */
    columnSizing?: any;
    /**
     * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
     */
    columnOrder?: any[];
    /**
     * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
     */
    columnPinning?: any;
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
    children?: Snippet;
    groupBar?: Snippet<[{
        grouping: any;
        groupableColumns: any;
        applyGrouping: any;
        clearGrouping: any;
    }]>;
    selectAll?: Snippet<[{
        checked: any;
        indeterminate: any;
        toggle: any;
    }]>;
    selectCell?: Snippet<[{
        row: any;
        checked: any;
        toggle: any;
    }]>;
    detail?: Snippet<[{
        row: any;
    }]>;
    colHeader?: Snippet<[{
        columnId: any;
        column: any;
        label: any;
    }]>;
    filter?: Snippet<[{
        columnId: any;
        value: any;
        uniqueValues: any;
        minMax: any;
        columnLabel: any;
        setFilter: any;
    }]>;
    cell?: Snippet<[{
        columnId: any;
        column: any;
        row: any;
        value: any;
    }]>;
    editor?: Snippet<[{
        columnId: any;
        column: any;
        row: any;
        value: any;
        commit: any;
        cancel: any;
        columnLabel: any;
        autofocus: any;
    }]>;
    snippets?: {
        [key: `colHeader-${string}`]: Snippet<[{
            columnId: any;
            column: any;
            label: any;
        }]>;
        [key: `filter-${string}`]: Snippet<[{
            columnId: any;
            value: any;
            uniqueValues: any;
            minMax: any;
            columnLabel: any;
            setFilter: any;
        }]>;
        [key: `cell-${string}`]: Snippet<[{
            columnId: any;
            column: any;
            row: any;
            value: any;
        }]>;
        [key: `editor-${string}`]: Snippet<[{
            columnId: any;
            column: any;
            row: any;
            value: any;
            commit: any;
            cancel: any;
            columnLabel: any;
            autofocus: any;
        }]>;
    } & Record<string, any>;
    onsortchange?: (...args: unknown[]) => void;
    onexpandchange?: (...args: unknown[]) => void;
    ongroupchange?: (...args: unknown[]) => void;
    onfilterchange?: (...args: unknown[]) => void;
    onpagechange?: (...args: unknown[]) => void;
    onselectionchange?: (...args: unknown[]) => void;
    onvisibilitychange?: (...args: unknown[]) => void;
    onresizechange?: (...args: unknown[]) => void;
    onreorderchange?: (...args: unknown[]) => void;
    onpinchange?: (...args: unknown[]) => void;
    onhistorychange?: (...args: unknown[]) => void;
    onactivecellchange?: (...args: unknown[]) => void;
    onrangechange?: (...args: unknown[]) => void;
    oncelleditcommit?: (...args: unknown[]) => void;
    onroweditcommit?: (...args: unknown[]) => void;
}
declare const DataTable: import("svelte").Component<Props, {
    canUndo: () => boolean;
    canRedo: () => boolean;
    clearHistory: () => void;
    undo: () => void;
    redo: () => void;
    sortColumn: (colId: any, desc: any) => void;
    clearSorting: () => void;
    getColumnDefs: () => any[];
    toggleAllRows: (value: any) => void;
    clearSelection: () => void;
    getSelectedRows: () => any;
    setPage: (idx: any) => void;
    setRowsPerPage: (size: any) => void;
    toggleColumnVisibility: (colId: any) => void;
    applyColumnOrder: (order: any) => void;
    resetColumnSizing: () => void;
    pinColumn: (colId: any, side: any) => void;
    getRowIndexRelativeToPage: (absRow: any) => any;
    cut: () => void;
    getSelectedRange: () => {
        anchor: {
            rowIndex: any;
            colIndex: any;
        };
        focus: {
            rowIndex: any;
            colIndex: any;
        };
    };
    editCell: (rowIndex: any, colIndex: any) => void;
    commitEditing: () => void;
    editRow: (rowIndex: any) => void;
    focusCell: (rowIndex: any, colIndex: any) => void;
    getActiveCell: () => {
        rowIndex: any;
        colIndex: number;
        isHeader: boolean;
    };
    clearActiveCell: () => void;
    toggleRowExpanded: (rowId: any) => void;
    expandAll: () => void;
    collapseAll: () => void;
    getExpandedRows: () => any[];
    applyGrouping: (cols: any) => void;
    clearGrouping: () => void;
    getFacetedUniqueValues: (colId: any) => unknown[];
    getFacetedMinMaxValues: (colId: any) => any;
}, "data" | "sorting" | "globalFilter" | "columnFilters" | "pagination" | "expanded" | "grouping" | "rowSelection" | "columnVisibility" | "columnSizing" | "columnOrder" | "columnPinning">;
type DataTable = ReturnType<typeof DataTable>;
export default DataTable;
