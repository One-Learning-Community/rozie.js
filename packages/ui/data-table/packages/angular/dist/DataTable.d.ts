import { ElementRef, TemplateRef } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';
import * as i0 from "@angular/core";
interface DefaultCtx {
}
interface GroupBarCtx {
    $implicit: {
        grouping: any;
        groupableColumns: any;
        applyGrouping: any;
        clearGrouping: any;
    };
    grouping: any;
    groupableColumns: any;
    applyGrouping: any;
    clearGrouping: any;
}
interface SelectAllCtx {
    $implicit: {
        checked: any;
        indeterminate: any;
        toggle: any;
    };
    checked: any;
    indeterminate: any;
    toggle: any;
}
interface SelectCellCtx {
    $implicit: {
        row: any;
        checked: any;
        toggle: any;
    };
    row: any;
    checked: any;
    toggle: any;
}
interface DetailCtx {
    $implicit: {
        row: any;
    };
    row: any;
}
interface ColHeaderCtx {
    $implicit: {
        columnId: any;
        column: any;
        label: any;
    };
    columnId: any;
    column: any;
    label: any;
}
interface FilterCtx {
    $implicit: {
        columnId: any;
        value: any;
        uniqueValues: any;
        minMax: any;
        columnLabel: any;
        setFilter: any;
    };
    columnId: any;
    value: any;
    uniqueValues: any;
    minMax: any;
    columnLabel: any;
    setFilter: any;
}
interface CellCtx {
    $implicit: {
        columnId: any;
        column: any;
        row: any;
        value: any;
    };
    columnId: any;
    column: any;
    row: any;
    value: any;
}
interface EditorCtx {
    $implicit: {
        columnId: any;
        column: any;
        row: any;
        value: any;
        commit: any;
        cancel: any;
        columnLabel: any;
        autofocus: any;
    };
    columnId: any;
    column: any;
    row: any;
    value: any;
    commit: any;
    cancel: any;
    columnLabel: any;
    autofocus: any;
}
interface ColHeaderCtx {
    $implicit: {
        columnId: any;
        column: any;
        label: any;
    };
    columnId: any;
    column: any;
    label: any;
}
interface FilterCtx {
    $implicit: {
        columnId: any;
        value: any;
        uniqueValues: any;
        minMax: any;
        columnLabel: any;
        setFilter: any;
    };
    columnId: any;
    value: any;
    uniqueValues: any;
    minMax: any;
    columnLabel: any;
    setFilter: any;
}
interface CellCtx {
    $implicit: {
        columnId: any;
        column: any;
        row: any;
        value: any;
    };
    columnId: any;
    column: any;
    row: any;
    value: any;
}
interface EditorCtx {
    $implicit: {
        columnId: any;
        column: any;
        row: any;
        value: any;
        commit: any;
        cancel: any;
        columnLabel: any;
        autofocus: any;
    };
    columnId: any;
    column: any;
    row: any;
    value: any;
    commit: any;
    cancel: any;
    columnLabel: any;
    autofocus: any;
}
export declare class DataTable {
    /**
     * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through the two-way `data` binding (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
     * @example
     * <rozie-data-table [(data)]="rows" [columns]="cols" />
     */
    data: import("@angular/core").ModelSignal<any[]>;
    /**
     * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union). A `pinned` value of `'left'` or `'right'` is applied once as the table's initial `columnPinning` state — identical to `<Column pinned>` — which also REORDERS that column, since table-core orders visible cells `[left-pinned, center, right-pinned]`. A consumer who has already expressed a pin (an initial two-way `columnPinning` model value or an interactive pin) owns the slice and this declaration is ignored.
     */
    columns: import("@angular/core").InputSignal<any[]>;
    /**
     * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
     */
    selectionMode: import("@angular/core").InputSignal<string>;
    /**
     * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
     */
    sorting: import("@angular/core").ModelSignal<any[]>;
    /**
     * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
     */
    globalFilter: import("@angular/core").ModelSignal<string>;
    /**
     * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
     */
    columnFilters: import("@angular/core").ModelSignal<any[]>;
    /**
     * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
     */
    pagination: import("@angular/core").ModelSignal<Record<string, any>>;
    /**
     * Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page).
     */
    manual: import("@angular/core").InputSignal<boolean>;
    /**
     * Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset.
     */
    rowCount: import("@angular/core").InputSignal<number>;
    /**
     * Explicit total page count for `manual` pagination; overrides rowCount-derived count.
     */
    pageCount: import("@angular/core").InputSignal<number>;
    /**
     * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Pass `expandable` as a real boolean — a valueless attribute only coerces to `true` on Vue and Lit.
     */
    expandable: import("@angular/core").InputSignal<boolean>;
    /**
     * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
     */
    expanded: import("@angular/core").ModelSignal<boolean | Record<string, any>>;
    /**
     * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
     */
    getSubRows: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
     */
    groupable: import("@angular/core").InputSignal<boolean>;
    /**
     * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding the two-way `grouping` model (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
     */
    grouping: import("@angular/core").ModelSignal<any[]>;
    /**
     * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
     */
    rowSelection: import("@angular/core").ModelSignal<Record<string, any>>;
    /**
     * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
     */
    columnVisibility: import("@angular/core").ModelSignal<Record<string, any>>;
    /**
     * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
     */
    columnSizing: import("@angular/core").ModelSignal<Record<string, any>>;
    /**
     * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
     */
    columnOrder: import("@angular/core").ModelSignal<any[]>;
    /**
     * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
     */
    columnPinning: import("@angular/core").ModelSignal<Record<string, any>>;
    /**
     * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
     */
    stickyHeader: import("@angular/core").InputSignal<boolean>;
    /**
     * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
     */
    interactionMode: import("@angular/core").InputSignal<string>;
    /**
     * Grid mode only. When `true`, a plain click on an **editable** cell opens its editor immediately (single-click-to-edit) instead of just activating the cell. Default `false` keeps click-to-activate (double-click opens the editor). Shift+click (range selection) and clicks on non-editable cells are unaffected.
     */
    singleClickEdit: import("@angular/core").InputSignal<boolean>;
    /**
     * Grid mode. When `true`, every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Default `false` records no history and Ctrl+Z/Y are inert.
     */
    undoable: import("@angular/core").InputSignal<boolean>;
    /**
     * The maximum number of undo steps retained (oldest evicted past this depth). Only consulted when `undoable` is `true`.
     */
    undoLimit: import("@angular/core").InputSignal<number>;
    /**
     * Opt-in windowing grammar: `false` (default, off — byte-identical to a non-virtual table) | `true` or `'rows'` (vertical row windowing; `true` is byte-behavior-identical to every existing consumer, zero churn) | `'columns'` (horizontal column windowing) | `'both'` (both axes windowed). Row windowing renders only the visible slice of rows inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Column windowing renders only the visible slice of leaf columns inside the same `rdt-scroll` container. An unrecognised string behaves as `false`.
     */
    virtual: import("@angular/core").InputSignal<string | boolean>;
    /**
     * Estimated row height (px) — the first-paint seed for the windowing engine before any row has been measured. Only consulted when rows are windowed. When `autoMeasure` is `true`, later renders progressively refine the estimate from measured content; when `autoMeasure` is `false` this remains the explicit override for every render.
     */
    estimateRowHeight: import("@angular/core").InputSignal<number>;
    /**
     * Opt-in content-driven row-size estimation. When `true`, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` converges to the true content total on a large table with variable-height rows. Falls back to `estimateRowHeight` before any row has been measured. Default `false` keeps the estimate fixed at `estimateRowHeight` for every render (today's behavior).
     */
    autoMeasure: import("@angular/core").InputSignal<boolean>;
    /**
     * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
     */
    maxHeight: import("@angular/core").InputSignal<string>;
    dataDefault: import("@angular/core").WritableSignal<any[]>;
    sortingDefault: import("@angular/core").WritableSignal<any[]>;
    globalFilterDefault: import("@angular/core").WritableSignal<string>;
    columnFiltersDefault: import("@angular/core").WritableSignal<any[]>;
    paginationDefault: import("@angular/core").WritableSignal<{
        pageIndex: number;
        pageSize: number;
    }>;
    rowSelectionDefault: import("@angular/core").WritableSignal<{}>;
    expandedDefault: import("@angular/core").WritableSignal<{}>;
    groupingDefault: import("@angular/core").WritableSignal<any[]>;
    columnVisibilityDefault: import("@angular/core").WritableSignal<{}>;
    columnSizingDefault: import("@angular/core").WritableSignal<{}>;
    columnOrderDefault: import("@angular/core").WritableSignal<any[]>;
    columnPinningDefault: import("@angular/core").WritableSignal<{
        left: any[];
        right: any[];
    }>;
    columnSizingInfo: import("@angular/core").WritableSignal<{
        startOffset: any;
        startSize: any;
        deltaOffset: any;
        deltaPercentage: any;
        isResizingColumn: boolean;
        columnSizingStart: any[];
    }>;
    colReg: import("@angular/core").WritableSignal<{}>;
    rows: import("@angular/core").WritableSignal<any[]>;
    headerGroups: import("@angular/core").WritableSignal<any[]>;
    rowModelVer: import("@angular/core").WritableSignal<number>;
    windowVer: import("@angular/core").WritableSignal<number>;
    activeRow: import("@angular/core").WritableSignal<number>;
    activeColIndex: import("@angular/core").WritableSignal<number>;
    activeIsHeader: import("@angular/core").WritableSignal<boolean>;
    activeHeaderLevel: import("@angular/core").WritableSignal<number>;
    activeInControl: import("@angular/core").WritableSignal<boolean>;
    editingRow: import("@angular/core").WritableSignal<number>;
    editingCol: import("@angular/core").WritableSignal<number>;
    draftValue: import("@angular/core").WritableSignal<any>;
    invalidMsg: import("@angular/core").WritableSignal<string>;
    editVer: import("@angular/core").WritableSignal<number>;
    editFocusColId: import("@angular/core").WritableSignal<any>;
    editingRowIndex: import("@angular/core").WritableSignal<any>;
    rowDraft: import("@angular/core").WritableSignal<{}>;
    rangeAnchor: import("@angular/core").WritableSignal<any>;
    rangeFocus: import("@angular/core").WritableSignal<any>;
    pasteAnnounce: import("@angular/core").WritableSignal<string>;
    rangeAnnounce: import("@angular/core").WritableSignal<string>;
    liveAnnounce: import("@angular/core").WritableSignal<string>;
    __rozieRoot: import("@angular/core").Signal<ElementRef<HTMLDivElement>>;
    sortChange: import("@angular/core").OutputEmitterRef<unknown>;
    expandChange: import("@angular/core").OutputEmitterRef<unknown>;
    groupChange: import("@angular/core").OutputEmitterRef<unknown>;
    filterChange: import("@angular/core").OutputEmitterRef<unknown>;
    pageChange: import("@angular/core").OutputEmitterRef<unknown>;
    selectionChange: import("@angular/core").OutputEmitterRef<unknown>;
    visibilityChange: import("@angular/core").OutputEmitterRef<unknown>;
    resizeChange: import("@angular/core").OutputEmitterRef<unknown>;
    reorderChange: import("@angular/core").OutputEmitterRef<unknown>;
    pinChange: import("@angular/core").OutputEmitterRef<unknown>;
    historyChange: import("@angular/core").OutputEmitterRef<unknown>;
    activecellChange: import("@angular/core").OutputEmitterRef<unknown>;
    rangeChange: import("@angular/core").OutputEmitterRef<unknown>;
    cellEditCommit: import("@angular/core").OutputEmitterRef<unknown>;
    rowEditCommit: import("@angular/core").OutputEmitterRef<unknown>;
    defaultTpl?: TemplateRef<DefaultCtx>;
    groupBarTpl?: TemplateRef<GroupBarCtx>;
    selectAllTpl?: TemplateRef<SelectAllCtx>;
    selectCellTpl?: TemplateRef<SelectCellCtx>;
    detailTpl?: TemplateRef<DetailCtx>;
    colHeaderTpl?: TemplateRef<ColHeaderCtx>;
    filterTpl?: TemplateRef<FilterCtx>;
    cellTpl?: TemplateRef<CellCtx>;
    editorTpl?: TemplateRef<EditorCtx>;
    templates: import("@angular/core").InputSignal<Record<string, TemplateRef<unknown>>>;
    __rozieFills: import("@angular/core").Signal<readonly RozieSlot[]>;
    __rozieFillMap: import("@angular/core").Signal<Record<string, TemplateRef<unknown>>>;
    __rozieProjectedTpls: import("@angular/core").Signal<readonly TemplateRef<any>[]>;
    __rozieSlotWarned: boolean;
    private __rozieWatchInitial_0;
    private __rozieWatchInitial_1;
    constructor();
    ngAfterContentInit(): void;
    ngAfterViewInit(): void;
    table: any;
    virtualizer: any;
    virtualizerCleanup: any;
    gridScrollEl: any;
    colVirtualizer: any;
    colVirtualizerCleanup: any;
    remeasurePending: boolean;
    remeasureRaf: any;
    remeasureDisposed: boolean;
    GRID_PAGE_STEP: number;
    gridRoot: any;
    outsidePointerDown: boolean;
    docPointerDown: any;
    programmatic: number;
    focusIntentEpoch: number;
    DATA_WRITE_TOKEN_KEY: string;
    undoStack: unknown[];
    redoStack: unknown[];
    restoringHistory: boolean;
    expandedTouched: boolean;
    groupingActiveDefault: () => boolean;
    effectiveColumnPinning: () => any;
    pinSeedApplied: boolean;
    seedColumnPinning: () => void;
    currentState: () => any;
    currentData: () => any;
    /**
     * A-01 — translate the public per-column `width` into table-core's `size`.
     *
     * `width` was written onto the ColumnDef in both build branches and read by NOTHING:
     * table-core resolves column width from `size` (a NUMBER of px), which only the two
     * chrome columns ever set. So the documented API was completely inert — the exact
     * sibling of the inert `pinned` that 0.5.0 closed.
     *
     * `size` is numeric px by construction, so only a number or a px string can map onto
     * it; any other CSS length (`12rem`, `20%`, `auto`) has no numeric px value at build
     * time and is deliberately NOT guessed — it returns null and the column keeps
     * table-core's default. The `width` prop's docs say exactly this.
     *
     * Returns null (not undefined) for "no usable width" so callers can test `!= null`
     * without tripping over a legitimate 0.
     */
    parseWidthToSize: (w: any) => number;
    editorWarned: any;
    checkEditorKind: (id: any, editor: any) => any;
    buildConfigDef: (c: any) => {
        id: string;
        header: any;
        columns: any[];
    } | {
        meta: {
            editable: boolean;
            editor: any;
            editorOptions: any;
            validate: any;
        };
        size?: number;
        id: string;
        accessorKey: any;
        header: any;
        enableSorting: boolean;
        enableColumnFilter: boolean;
        filterable: boolean;
        expandable: boolean;
        groupable: boolean;
        aggregationFn: string | ((columnId: any, leafRows: any, childRows: any) => any);
        pinned: any;
        width: any;
        columns?: undefined;
    };
    columnDefsCache: any[] | null;
    columnDefsCacheColumnsRef: any;
    columnDefsCacheColRegRef: any;
    columnDefsIndexCache: any;
    columnDefs: () => any[];
    defIndex: () => any;
    SELECT_COL_ID: string;
    EXPANDER_COL_ID: string;
    selectionEnabled: () => boolean;
    tableColumns: () => any[];
    writeSorting: (next: any) => void;
    writeExpanded: (next: any) => void;
    writeGrouping: (next: any) => void;
    writeGlobalFilter: (next: any) => void;
    writeColumnFilters: (next: any) => void;
    writePagination: (next: any) => void;
    writeRowSelection: (next: any) => void;
    writeColumnVisibility: (next: any) => void;
    writeColumnSizing: (next: any) => void;
    writeColumnOrder: (next: any) => void;
    writeColumnPinning: (next: any) => void;
    writeData: (next: any) => void;
    columnFilterValue: (colId: any) => any;
    setColumnFilter: (colId: any, value: any) => void;
    recordSnapshot: (current: any) => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    clearHistory: () => void;
    emitHistoryChange: () => void;
    emitHistoryChangeIfEdged: (prevU: any, prevR: any) => void;
    undo: () => void;
    redo: () => void;
    refreshRowModel: any;
    onSortingChangeCb: (updater: any) => void;
    onExpandedChangeCb: (updater: any) => void;
    onGroupingChangeCb: (updater: any) => void;
    onGlobalFilterChangeCb: (updater: any) => void;
    onColumnFiltersChangeCb: (updater: any) => void;
    onPaginationChangeCb: (updater: any) => void;
    onRowSelectionChangeCb: (updater: any) => void;
    onColumnVisibilityChangeCb: (updater: any) => void;
    onColumnSizingChangeCb: (updater: any) => void;
    onColumnOrderChangeCb: (updater: any) => void;
    onColumnPinningChangeCb: (updater: any) => void;
    columnSizingInfoSync: any;
    onColumnSizingInfoChangeCb: (updater: any) => void;
    resolveVirtual: () => "rows" | "columns" | "both" | "off";
    rowsWindowed: () => boolean;
    colsWindowed: () => boolean;
    isWindowed: () => boolean;
    autoMeasureOn: () => boolean;
    columnCount: () => number;
    columnSize: (i: number) => number;
    forcedColumns: () => number[];
    windowedCells: (row: any) => any;
    windowSource: () => any;
    scheduleRemeasure: () => void;
    teardownRemeasure: () => void;
    pinnedEditIndex: () => any;
    pinnedMeasurement: (pin: any) => any;
    remeasureWindow: () => void;
    virtualItemKey: (i: any) => any;
    COL_OVERSCAN: number;
    colRtlObserver: any;
    colRtlObserverEl: any;
    isColRtl: () => boolean;
    ensureColRtlWatch: () => void;
    teardownColRtlWatch: () => void;
    columnVirtualizerOptions: () => any;
    measuredRowTotal: number;
    measuredRowCount: number;
    lastFedRowEstimate: number;
    foldedRowHeights: Record<number, number>;
    windowVerBumpPending: boolean;
    bumpWindowVer: () => void;
    ESTIMATE_REFEED_DELTA_PX: number;
    estimateRowSize: (i: number) => number;
    foldMeasuredRow: (index: number, height: number) => void;
    refineRowEstimate: () => void;
    virtualizerOptions: () => any;
    pinMeasurement: (pin: number) => {
        start: number;
        size: number;
        index: number;
        end: number;
    } | null;
    windowedRows: () => any;
    padTop: () => any;
    padBottom: () => number;
    pmIndexInWindow: (items: any, idx: any) => boolean;
    rowIsOutsideWindow: (r: any) => boolean;
    windowedColIndices: () => any;
    colPadLeft: () => any;
    colPadRight: () => number;
    colIsOutsideWindow: (c: any) => boolean;
    afterRowRemeasure: () => void;
    announceState: {
        sorting: unknown;
        columnFilters: unknown;
        globalFilter: unknown;
    };
    effectiveSorting: () => any[];
    effectiveColumnFilters: () => any[];
    effectiveGlobalFilter: () => string;
    buildSortFilterAnnounce: () => string;
    reFeed: () => void;
    lastPropsData: unknown;
    maybeClearHistoryOnExternalSwap: () => void;
    lastData: any;
    lastDataLen: number;
    onHeaderSort: (colId: any, evt: any) => void;
    tick: () => number;
    ariaSortFor: (colId: any) => "none" | "descending" | "ascending";
    sortIndicator: (colId: any) => "" | "▲" | "▼";
    defFor: (colId: any) => any;
    visibleCellsFor: (row: any) => any;
    editMetaOf: (colId: any) => any;
    columnEditable: (colId: any) => boolean;
    editorTypeOf: (colId: any) => any;
    editorOptionsOf: (colId: any) => any;
    columnIsFilterable: (colId: any) => boolean;
    headerLabel: (colId: any) => any;
    headerWidth: (header: any) => string;
    onResizeStart: (colId: any, evt: any) => void;
    findHeader: (colId: any) => any;
    columnIsResizing: (colId: any) => boolean;
    columnIsVisible: (colId: any) => boolean;
    onToggleVisibility: (colId: any) => void;
    allLeafColumns: () => any[];
    columnPinSide: (colId: any) => any;
    onPinColumn: (colId: any, side: any, evt: any) => void;
    pinStyle: (colId: any, zIndex?: any) => string;
    thStyle: (header: any, widthPx?: any) => string;
    onGlobalFilterInput: (evt: any) => void;
    onColumnFilterInput: (colId: any, evt: any) => void;
    globalFilterValue: () => any;
    pageIndex: () => any;
    pageSize: () => any;
    displayPageCount: () => any;
    canPrevPage: () => boolean;
    canNextPage: () => boolean;
    onPrevPage: () => void;
    onNextPage: () => void;
    onPageSizeChange: (evt: any) => void;
    isSelectColumn: (colId: any) => boolean;
    isExpanderColumn: (colId: any) => boolean;
    rowCanExpand: (row: any) => boolean;
    rowIsExpanded: (row: any) => boolean;
    rowShowsDetail: (row: any) => boolean;
    onToggleExpand: (row: any, evt: any) => void;
    bodyCellStyle: (row: any, colId: any) => string;
    rowIsGrouped: (row: any) => boolean;
    rowIndexIsGrouped: (rowIndex: any) => boolean;
    groupingActive: () => boolean;
    cellIsGrouped: (cellCtx: any) => boolean;
    cellIsAggregated: (cellCtx: any) => boolean;
    cellIsPlaceholder: (cellCtx: any) => boolean;
    groupSubRowCount: (row: any) => any;
    groupRowDescriptorCache: any;
    groupRowDescriptorCacheVer: any;
    groupRowDescriptor: (row: any) => any;
    cellSlotRow: (row: any) => any;
    groupingKeys: () => any;
    groupableColumns: () => any[];
    stopEvent: (evt: any) => void;
    isAllRowsSelected: () => boolean;
    isSomeRowsSelected: () => boolean;
    onToggleAllRows: (evt: any) => void;
    rowIsSelected: (row: any) => boolean;
    onToggleRow: (row: any, evt: any) => void;
    onHideColumn: (colId: any, evt: any) => void;
    hasAnyFilterableColumn: () => boolean;
    selectAllBox: any;
    syncIndeterminate: () => void;
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
    isGrid: () => boolean;
    tableRole: () => "table" | "grid";
    cellRole: () => "gridcell" | "cell";
    rowIndexOf: (row: any) => number;
    colIndexOf: (row: any, cellCtx: any) => any;
    headerColIndexOf: (hg: any, header: any) => any;
    headerLeafStart: (hg: any, header: any) => number;
    pageRowOffset: () => number;
    toAbsRow: (localRow: any) => any;
    prePaginationRowCount: () => any;
    cellTabindex: (rowKey: any, colIndex: any, level?: any) => 0 | -1;
    isActiveCell: (rowKey: any, colIndex: any, level?: any) => boolean;
    resolveCellEl: (rowKey: any, colIndex: any, level?: any) => any;
    focusActiveCell: (nextRow?: any, nextCol?: any, nextIsHeader?: any, nextLevel?: any) => void;
    totalRowCount: () => any;
    headerRowCount: () => number;
    gridAriaRowCount: () => any;
    ariaPageOffset: () => number;
    bodyAriaRowIndex: (row: any) => number;
    gridAriaColCount: () => any;
    visibleColCount: () => any;
    bodyRowCount: () => number;
    headerLeafLevel: () => number;
    headerCountAtLevel: (level: any) => any;
    headerAt: (level: any, colIndex: any) => any;
    parentHeaderColIndex: (level: any, colIndex: any) => number;
    firstChildHeaderColIndex: (level: any, colIndex: any) => number;
    moveCol: (delta: any) => any;
    moveRow: (delta: any) => {
        row: any;
        col: number;
        isHeader: boolean;
        level: number;
    };
    gotoColEdge: (toEnd: any) => number;
    gotoRowEdge: (toEnd: any) => number;
    gotoStart: () => {
        row: number;
        col: number;
    };
    gotoEnd: () => {
        row: number;
        col: number;
    };
    currentCellEl: () => any;
    enterControl: () => void;
    cycleWithinCell: (cellEl: any, forward: any) => void;
    onGridKeyDown: (e: any) => void;
    syncActiveFromEvent: (e: any) => void;
    onGridMouseDown: (e: any) => void;
    onGridDblClick: (e: any) => void;
    onGridClick: (e: any) => void;
    onGridFocusOut: (e: any) => void;
    recoverGridFocus: (rowKey: any, col: any, level: any, guardMoved?: any) => void;
    clampActiveCell: (rowCount: any, colCount: any) => void;
    windowedHeadersFor: (hg: any, hgLevel: any) => any;
    windowedColSpan: () => any;
    lastColSizeSig: number;
    remeasureColumnSizes: () => void;
    remeasureColumnWindow: () => void;
    gridEmptyFallback: boolean;
    rangeTransition: boolean;
    rangeClickPending: any;
    rangeActive: boolean;
    inRange: (rIdx: any, cIdx: any) => boolean;
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
    isFillHandleCell: (rIdx: any, cIdx: any) => boolean;
    rangeSummary: (anchor: any, focus: any) => string;
    emitRangeChange: (anchor: any, focus: any) => void;
    extendRange: (dRow: any, dCol: any) => void;
    setRangeFocus: (rIdx: any, cIdx: any, anchorR?: any, anchorC?: any) => void;
    selectAllBody: () => void;
    clearRange: () => void;
    clampRange: (maxRowArg: any, maxColArg: any) => void;
    announce: (msg: any) => void;
    clipboardActiveAllowed: () => boolean;
    fieldOfColId: (colId: any) => any;
    normalizedRange: () => {
        r0: any;
        r1: any;
        c0: any;
        c1: any;
    };
    rangeToTsv: () => string;
    clipboardWriteAvailable: () => boolean;
    clipboardReadAvailable: () => boolean;
    copyRange: () => void;
    applyGridToRange: (grid: any, originRow: any, originCol: any, verb: any) => {
        wrote: number;
        changed: number;
        total: number;
    };
    rowOriginalAt: (rowIndex: any) => any;
    rowIdAt: (rowIndex: any) => any;
    pasteRange: () => void;
    cutRange: () => void;
    clearActiveRange: () => void;
    fillRange: (sourceBox: any, endCell: any) => void;
    fillDragging: boolean;
    fillDragMove: any;
    fillDragUp: any;
    fillEdgeScrollRaf: any;
    FILL_EDGE_SCROLL_PX: number;
    FILL_EDGE_SCROLL_STEP: number;
    edgeDelta: (clientX: any, clientY: any) => {
        dx: number;
        dy: number;
    };
    teardownFillDrag: () => void;
    FILL_HITTEST_PROBE_RADIUS_PX: number;
    FILL_HITTEST_PROBE_STEP_PX: number;
    resolveCellAt: (clientX: any, clientY: any) => {
        r: number;
        c: number;
    };
    cellIndexFromPoint: (clientX: any, clientY: any) => {
        r: number;
        c: number;
    };
    onFillHandlePointerDown: (e: any) => void;
    rangeDragging: boolean;
    rangeDragMove: any;
    rangeDragUp: any;
    rangeDragMoved: boolean;
    teardownRangeDrag: () => void;
    beginRangeDrag: (anchorR: any, anchorC: any) => void;
    activeCellColumnId: () => any;
    isActiveCellEditable: () => boolean;
    isEditing: (rowIndex: any, colIndex: any) => boolean;
    cellAriaInvalid: (rowIndex: any, colIndex: any) => "true" | null;
    runValidator: (colId: any, value: any, row: any) => string | true;
    setInvalid: (msg: any) => void;
    sourceIndexOfRow: (visibleRowIndex: any) => any;
    editingColumnId: () => any;
    editingColumnField: () => any;
    editingCellValue: () => any;
    editingRowOriginal: () => any;
    editingRowId: () => any;
    resolveEditFocusCellEl: (rowIndex: any, colIndex: any) => any;
    focusEditorWhenReady: (rowIndex: any, colIndex: any, selectAll?: any) => void;
    columnIdAt: (rowIndex: any, colIndex: any) => any;
    cellValueAt: (rowIndex: any, colIndex: any) => any;
    beginEdit: (rowIndex: any, colIndex: any, seed: any) => void;
    focusCellWhenReady: (row: any, col: any) => void;
    endEdit: () => void;
    endRowEdit: () => void;
    editorAutofocusFor: (colId: any, rowIndex: any) => boolean;
    coerceCellValue: (colId: any, raw: any) => any;
    commitEdit: (overrideValue?: any, skipFocusReturn?: any) => boolean;
    toggleActiveBooleanCell: () => void;
    cancelEdit: () => void;
    editableColumnsForRow: (rowIndex: any) => any[];
    focusRowEditorAt: (rowIndex: any, colIndex: any) => void;
    beginRowEdit: (row: any) => void;
    commitRow: () => boolean;
    cancelRow: () => void;
    nextEditableCell: (fromRow: any, fromCol: any) => {
        row: any;
        col: any;
    };
    prevEditableCell: (fromRow: any, fromCol: any) => {
        row: any;
        col: number;
    };
    editTransition: boolean;
    pendingEditFollow: any;
    committedThisSession: boolean;
    inRowEdit: () => boolean;
    editorValueFor: (colId: any) => any;
    editorCheckedFor: (colId: any) => boolean;
    editorCommitFor: (colId: any) => (value: any) => void;
    editorCancelFor: () => () => void;
    onCellEditorInput: (colId: any, evt: any) => void;
    onCellEditorCheckbox: (colId: any, evt: any) => void;
    setRowDraft: (colId: any, value: any) => void;
    rowEditTab: (target: any, backward: any) => void;
    onEditorKeyDown: (e: any) => void;
    onEditorBlur: (e: any) => void;
    editCell: (rowIndex: any, colIndex: any) => void;
    commitEditing: () => void;
    editRow: (rowIndex: any) => void;
    focusAbsCellWhenReady: (absRow: any, localRow: any, col: any) => void;
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
    static ngTemplateContextGuard(_dir: DataTable, _ctx: unknown): _ctx is DefaultCtx | GroupBarCtx | SelectAllCtx | SelectCellCtx | DetailCtx | ColHeaderCtx | FilterCtx | CellCtx | EditorCtx;
    protected get __style(): string;
    private _selectCell_ctx;
    private _selectCell_ctx_1;
    protected readonly String: StringConstructor;
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<DataTable, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<DataTable, "rozie-data-table", never, { "data": { "alias": "data"; "required": true; "isSignal": true; }; "columns": { "alias": "columns"; "required": false; "isSignal": true; }; "selectionMode": { "alias": "selectionMode"; "required": false; "isSignal": true; }; "sorting": { "alias": "sorting"; "required": false; "isSignal": true; }; "globalFilter": { "alias": "globalFilter"; "required": false; "isSignal": true; }; "columnFilters": { "alias": "columnFilters"; "required": false; "isSignal": true; }; "pagination": { "alias": "pagination"; "required": false; "isSignal": true; }; "manual": { "alias": "manual"; "required": false; "isSignal": true; }; "rowCount": { "alias": "rowCount"; "required": false; "isSignal": true; }; "pageCount": { "alias": "pageCount"; "required": false; "isSignal": true; }; "expandable": { "alias": "expandable"; "required": false; "isSignal": true; }; "expanded": { "alias": "expanded"; "required": false; "isSignal": true; }; "getSubRows": { "alias": "getSubRows"; "required": false; "isSignal": true; }; "groupable": { "alias": "groupable"; "required": false; "isSignal": true; }; "grouping": { "alias": "grouping"; "required": false; "isSignal": true; }; "rowSelection": { "alias": "rowSelection"; "required": false; "isSignal": true; }; "columnVisibility": { "alias": "columnVisibility"; "required": false; "isSignal": true; }; "columnSizing": { "alias": "columnSizing"; "required": false; "isSignal": true; }; "columnOrder": { "alias": "columnOrder"; "required": false; "isSignal": true; }; "columnPinning": { "alias": "columnPinning"; "required": false; "isSignal": true; }; "stickyHeader": { "alias": "stickyHeader"; "required": false; "isSignal": true; }; "interactionMode": { "alias": "interactionMode"; "required": false; "isSignal": true; }; "singleClickEdit": { "alias": "singleClickEdit"; "required": false; "isSignal": true; }; "undoable": { "alias": "undoable"; "required": false; "isSignal": true; }; "undoLimit": { "alias": "undoLimit"; "required": false; "isSignal": true; }; "virtual": { "alias": "virtual"; "required": false; "isSignal": true; }; "estimateRowHeight": { "alias": "estimateRowHeight"; "required": false; "isSignal": true; }; "autoMeasure": { "alias": "autoMeasure"; "required": false; "isSignal": true; }; "maxHeight": { "alias": "maxHeight"; "required": false; "isSignal": true; }; "templates": { "alias": "templates"; "required": false; "isSignal": true; }; }, { "data": "dataChange"; "sorting": "sortingChange"; "globalFilter": "globalFilterChange"; "columnFilters": "columnFiltersChange"; "pagination": "paginationChange"; "expanded": "expandedChange"; "grouping": "groupingChange"; "rowSelection": "rowSelectionChange"; "columnVisibility": "columnVisibilityChange"; "columnSizing": "columnSizingChange"; "columnOrder": "columnOrderChange"; "columnPinning": "columnPinningChange"; "sortChange": "sort-change"; "expandChange": "expand-change"; "groupChange": "group-change"; "filterChange": "filter-change"; "pageChange": "page-change"; "selectionChange": "selection-change"; "visibilityChange": "visibility-change"; "resizeChange": "resize-change"; "reorderChange": "reorder-change"; "pinChange": "pin-change"; "historyChange": "history-change"; "activecellChange": "activecell-change"; "rangeChange": "range-change"; "cellEditCommit": "cell-edit-commit"; "rowEditCommit": "row-edit-commit"; }, ["__rozieFills", "__rozieProjectedTpls", "defaultTpl", "groupBarTpl", "selectAllTpl", "selectCellTpl", "detailTpl", "colHeaderTpl", "filterTpl", "cellTpl", "editorTpl"], never, true, never>;
}
export default DataTable;
//# sourceMappingURL=DataTable.d.ts.map