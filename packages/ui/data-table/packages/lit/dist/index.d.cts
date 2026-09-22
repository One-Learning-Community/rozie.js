import * as _$lit from "lit";
import { LitElement } from "lit";
//#region src/DataTable.d.ts
declare const DataTable_base: typeof LitElement;
declare class DataTable extends DataTable_base {
  static shadowRootOptions: ShadowRootInit;
  static styles: _$lit.CSSResult;
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through the two-way `data` binding (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <rozie-data-table .data=${rows} @data-change=${…} .columns=${cols}></rozie-data-table>
   */
  _data_attr: any[];
  private _dataControllable;
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union). A `pinned` value of `'left'` or `'right'` is applied once as the table's initial `columnPinning` state — identical to `<Column pinned>` — which also REORDERS that column, since table-core orders visible cells `[left-pinned, center, right-pinned]`. A consumer who has already expressed a pin (an initial two-way `columnPinning` model value or an interactive pin) owns the slice and this declaration is ignored.
   */
  columns: any[];
  /**
   * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
   */
  selectionMode: string;
  /**
   * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
   */
  _sorting_attr: any[];
  private _sortingControllable;
  /**
   * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
   */
  _globalFilter_attr: string;
  private _globalFilterControllable;
  /**
   * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
   */
  _columnFilters_attr: any[];
  private _columnFiltersControllable;
  /**
   * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
   */
  _pagination_attr: any;
  private _paginationControllable;
  /**
   * Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page).
   */
  manual: boolean;
  /**
   * Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset.
   */
  rowCount: number | null;
  /**
   * Explicit total page count for `manual` pagination; overrides rowCount-derived count.
   */
  pageCount: number | null;
  /**
   * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Pass `expandable` as a real boolean — a valueless attribute only coerces to `true` on Vue and Lit.
   */
  expandable: boolean;
  /**
   * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
   */
  _expanded_attr: any | boolean;
  private _expandedControllable;
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  getSubRows: ((...args: any[]) => any) | null;
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  groupable: boolean;
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding the two-way `grouping` model (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
   */
  _grouping_attr: any[] | null;
  private _groupingControllable;
  /**
   * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
   */
  _rowSelection_attr: any;
  private _rowSelectionControllable;
  /**
   * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
   */
  _columnVisibility_attr: any;
  private _columnVisibilityControllable;
  /**
   * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
   */
  _columnSizing_attr: any;
  private _columnSizingControllable;
  /**
   * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
   */
  _columnOrder_attr: any[];
  private _columnOrderControllable;
  /**
   * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
   */
  _columnPinning_attr: any;
  private _columnPinningControllable;
  /**
   * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
   */
  stickyHeader: boolean;
  /**
   * `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) | `'grid'` — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support.
   */
  interactionMode: string;
  /**
   * Grid mode only. When `true`, a plain click on an **editable** cell opens its editor immediately (single-click-to-edit) instead of just activating the cell. Default `false` keeps click-to-activate (double-click opens the editor). Shift+click (range selection) and clicks on non-editable cells are unaffected.
   */
  singleClickEdit: boolean;
  /**
   * Grid mode. When `true`, every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Default `false` records no history and Ctrl+Z/Y are inert.
   */
  undoable: boolean;
  /**
   * The maximum number of undo steps retained (oldest evicted past this depth). Only consulted when `undoable` is `true`.
   */
  undoLimit: number;
  /**
   * Opt-in windowing grammar: `false` (default, off — byte-identical to a non-virtual table) | `true` or `'rows'` (vertical row windowing; `true` is byte-behavior-identical to every existing consumer, zero churn) | `'columns'` (horizontal column windowing) | `'both'` (both axes windowed). Row windowing renders only the visible slice of rows inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Column windowing renders only the visible slice of leaf columns inside the same `rdt-scroll` container. An unrecognised string behaves as `false`.
   */
  virtual: boolean | string;
  /**
   * Estimated row height (px) — the first-paint seed for the windowing engine before any row has been measured. Only consulted when rows are windowed. When `autoMeasure` is `true`, later renders progressively refine the estimate from measured content; when `autoMeasure` is `false` this remains the explicit override for every render.
   */
  estimateRowHeight: number;
  /**
   * Opt-in content-driven row-size estimation. When `true`, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` converges to the true content total on a large table with variable-height rows. Falls back to `estimateRowHeight` before any row has been measured. Default `false` keeps the estimate fixed at `estimateRowHeight` for every render (today's behavior).
   */
  autoMeasure: boolean;
  /**
   * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
   */
  maxHeight: string;
  private _dataDefault;
  private _sortingDefault;
  private _globalFilterDefault;
  private _columnFiltersDefault;
  private _paginationDefault;
  private _rowSelectionDefault;
  private _expandedDefault;
  private _groupingDefault;
  private _columnVisibilityDefault;
  private _columnSizingDefault;
  private _columnOrderDefault;
  private _columnPinningDefault;
  private _columnSizingInfo;
  private _colReg;
  private _rows;
  private _headerGroups;
  private _rowModelVer;
  private _windowVer;
  private _activeRow;
  private _activeColIndex;
  private _activeIsHeader;
  private _activeHeaderLevel;
  private _activeInControl;
  private _editingRow;
  private _editingCol;
  private _draftValue;
  private _invalidMsg;
  private _editVer;
  private _editFocusColId;
  private _editingRowIndex;
  private _rowDraft;
  private _rangeAnchor;
  private _rangeFocus;
  private _pasteAnnounce;
  private _rangeAnnounce;
  private _liveAnnounce;
  private _ref__rozieRoot;
  private __rozieWatchInitial_0;
  private __rozieWatchInitial_1;
  private __rozieCtxProvider_data_table_columns;
  private _rozieSlotDistributor;
  private _hasSlotDefault;
  private _slotDefaultElements;
  private _hasSlotGroupBar;
  private _slotGroupBarElements;
  groupBar?: (scope: {
    grouping: any;
    groupableColumns: any;
    applyGrouping: any;
    clearGrouping: any;
  }) => unknown;
  private _hasSlotSelectAll;
  private _slotSelectAllElements;
  selectAll?: (scope: {
    checked: any;
    indeterminate: any;
    toggle: any;
  }) => unknown;
  private _hasSlotDynamicColHeader;
  private _slotDynamicColHeaderElements;
  private _hasSlotDynamicFilter;
  private _slotDynamicFilterElements;
  private _hasSlotSelectCell;
  private _slotSelectCellElements;
  selectCell?: (scope: {
    row: any;
    checked: any;
    toggle: any;
  }) => unknown;
  private _hasSlotDynamicCell;
  private _slotDynamicCellElements;
  private _hasSlotDynamicEditor;
  private _slotDynamicEditorElements;
  private _hasSlotDetail;
  private _slotDetailElements;
  detail?: (scope: {
    row: any;
  }) => unknown;
  private _hasSlotColHeader;
  private _slotColHeaderElements;
  colHeader?: (scope: {
    columnId: any;
    column: any;
    label: any;
  }) => unknown;
  private _hasSlotFilter;
  private _slotFilterElements;
  filter?: (scope: {
    columnId: any;
    value: any;
    uniqueValues: any;
    minMax: any;
    columnLabel: any;
    setFilter: any;
  }) => unknown;
  private _hasSlotCell;
  private _slotCellElements;
  cell?: (scope: {
    columnId: any;
    column: any;
    row: any;
    value: any;
  }) => unknown;
  private _hasSlotEditor;
  private _slotEditorElements;
  editor?: (scope: {
    columnId: any;
    column: any;
    row: any;
    value: any;
    commit: any;
    cancel: any;
    columnLabel: any;
    autofocus: any;
  }) => unknown;
  rozieSlots?: {
    [key: `colHeader-${string}`]: (scope: {
      columnId: any;
      column: any;
      label: any;
    }) => unknown;
    [key: `filter-${string}`]: (scope: {
      columnId: any;
      value: any;
      uniqueValues: any;
      minMax: any;
      columnLabel: any;
      setFilter: any;
    }) => unknown;
    [key: `cell-${string}`]: (scope: {
      columnId: any;
      column: any;
      row: any;
      value: any;
    }) => unknown;
    [key: `editor-${string}`]: (scope: {
      columnId: any;
      column: any;
      row: any;
      value: any;
      commit: any;
      cancel: any;
      columnLabel: any;
      autofocus: any;
    }) => unknown;
  } & Record<string, (scope: any) => unknown>;
  private _disconnectCleanups;
  private _rozieTornDown;
  private _armListeners;
  connectedCallback(): void;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, old: string | null, value: string | null): void;
  render(): _$lit.TemplateResult<1>;
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
  ariaSortFor: (colId: any) => "none" | "ascending" | "descending";
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
  pinStyle: (colId: any, zIndex?: number) => string;
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
  tableRole: () => "grid" | "table";
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
  recoverGridFocus: (rowKey: any, col: any, level: any, guardMoved?: boolean) => void;
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
  focusEditorWhenReady: (rowIndex: any, colIndex: any, selectAll?: boolean) => void;
  columnIdAt: (rowIndex: any, colIndex: any) => any;
  cellValueAt: (rowIndex: any, colIndex: any) => any;
  beginEdit: (rowIndex: any, colIndex: any, seed: any) => void;
  focusCellWhenReady: (row: any, col: any) => void;
  endEdit: () => void;
  endRowEdit: () => void;
  editorAutofocusFor: (colId: any, rowIndex: any) => boolean;
  coerceCellValue: (colId: any, raw: any) => any;
  commitEdit: (overrideValue?: any, skipFocusReturn?: boolean) => boolean;
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
  get data(): any[];
  set data(v: any[]);
  get sorting(): any[];
  set sorting(v: any[]);
  get globalFilter(): string;
  set globalFilter(v: string);
  get columnFilters(): any[];
  set columnFilters(v: any[]);
  get pagination(): any;
  set pagination(v: any);
  get expanded(): any | boolean;
  set expanded(v: any | boolean);
  get grouping(): any[];
  set grouping(v: any[]);
  get rowSelection(): any;
  set rowSelection(v: any);
  get columnVisibility(): any;
  set columnVisibility(v: any);
  get columnSizing(): any;
  set columnSizing(v: any);
  get columnOrder(): any[];
  set columnOrder(v: any[]);
  get columnPinning(): any;
  set columnPinning(v: any);
}
//#endregion
//#region src/Column.d.ts
declare const Column_base: typeof LitElement;
declare class Column extends Column_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
   */
  id: string;
  /**
   * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
   * @example
   * <rozie-column field="email" header="Email"></rozie-column>
   */
  field: string;
  /**
   * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
   */
  header: string;
  /**
   * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
   */
  sortable: boolean;
  /**
   * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
   */
  filterable: boolean;
  /**
   * Initial pin side: `''` (unpinned) | `'left'` | `'right'`. Applied once as the table's starting `columnPinning` state, so `getIsPinned()` reports it and the column joins the matching sticky rail — which also reorders it, since visible cells are ordered `[left-pinned, center, right-pinned]`. Ignored if the consumer has already pinned something; an interactive unpin is never re-applied.
   */
  pinned: string;
  /**
   * Optional fixed/initial column width, applied as the column's starting size — a px number (`120`) or a px string (`'120px'`). Column sizing is numeric px, so other CSS lengths (`'12rem'`, `'20%'`, `'auto'`) have no px value to apply and are ignored; the column keeps the default width. An interactive resize overrides this.
   */
  width: string | number;
  /**
   * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
   */
  expandable: boolean;
  /**
   * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
   */
  groupable: boolean;
  /**
   * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
   */
  aggregationFn: string | (((...args: any[]) => any) | null);
  /**
   * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
   */
  editable: boolean;
  /**
   * Editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'` (built-in inputs), or `'custom'` to hand rendering to the `#editor` scoped slot (or a per-column `editor-<columnId>` fill). Default `'text'`. **`'custom'` is the gate:** a column left on a built-in type ignores any `#editor` fill and renders the built-in input. Requires `editable: true` — and, for any pointer or keyboard edit entry, `interactionMode="grid"` on the table.
   */
  editor: string;
  /**
   * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
   */
  editorOptions: any[];
  /**
   * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
   */
  validate: ((...args: any[]) => any) | null;
  private __rozieFirstUpdateDone;
  private __rozieCtxConsumer_data_table_columns;
  private get registry();
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  reg: any;
  registered: boolean;
  colId: () => string;
  buildSpec: () => {
    id: string;
    field: string;
    header: string;
    sortable: boolean;
    filterable: boolean;
    pinned: string;
    width: string | number;
    expandable: boolean;
    groupable: boolean;
    aggregationFn: string | ((...args: any[]) => any);
    editable: boolean;
    editor: string;
    editorOptions: any[];
    validate: (...args: any[]) => any;
  };
}
//#endregion
//#region src/EditorText.d.ts
declare const EditorText_base: typeof LitElement;
declare class EditorText extends EditorText_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column: unknown;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row: unknown;
  /**
   * The current cell value the editor seeds its local draft from (setup-once).
   */
  value: unknown;
  /**
   * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
   */
  commit: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  cancel: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _draft;
  private _touched;
  private _refInputEl;
  private __rozieFirstUpdateDone;
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  draftValue: () => string;
  onInput: (e: any) => void;
  doCommit: () => void;
  doCancel: () => void;
  onKeydown: (e: any) => void;
  onBlur: () => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/EditorNumber.d.ts
declare const EditorNumber_base: typeof LitElement;
declare class EditorNumber extends EditorNumber_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column: unknown;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row: unknown;
  /**
   * The current cell value the local draft string seeds from (setup-once).
   */
  value: unknown;
  /**
   * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
   */
  commit: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _draft;
  private _touched;
  private _refInputEl;
  private __rozieFirstUpdateDone;
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  draftValue: () => string;
  onInput: (e: any) => void;
  doCommit: () => void;
  doCancel: () => void;
  onKeydown: (e: any) => void;
  onBlur: () => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/EditorSelect.d.ts
declare const EditorSelect_base: typeof LitElement;
declare class EditorSelect extends EditorSelect_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column: unknown;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row: unknown;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value: unknown;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  commit: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel: ((...args: any[]) => any) | null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  options: any[];
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _draft;
  private _touched;
  private _refSelectEl;
  private __rozieFirstUpdateDone;
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  draftValue: () => string;
  onChange: (e: any) => void;
  doCommit: () => void;
  doCancel: () => void;
  onKeydown: (e: any) => void;
  onBlur: () => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/EditorCheckbox.d.ts
declare const EditorCheckbox_base: typeof LitElement;
declare class EditorCheckbox extends EditorCheckbox_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column: unknown;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row: unknown;
  /**
   * The current cell value — coerced to a real boolean via `!!` to seed the checkbox `checked` state.
   */
  value: unknown;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the boolean checked state on `@change`. Null-guarded at call sites.
   */
  commit: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _refInputEl;
  private __rozieFirstUpdateDone;
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  onChange: (e: any) => void;
  onKeydown: (e: any) => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/EditorDate.d.ts
declare const EditorDate_base: typeof LitElement;
declare class EditorDate extends EditorDate_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column: unknown;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row: unknown;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  value: unknown;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
   */
  commit: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _draft;
  private _touched;
  private _refInputEl;
  private __rozieFirstUpdateDone;
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  draftValue: () => string;
  onInput: (e: any) => void;
  doCommit: () => void;
  doCancel: () => void;
  onChange: (e: any) => void;
  onKeydown: (e: any) => void;
  onBlur: () => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/FilterText.d.ts
declare const FilterText_base: typeof LitElement;
declare class FilterText extends FilterText_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column: unknown;
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value: unknown;
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  setFilter: ((...args: any[]) => any) | null;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _draft;
  private _touched;
  private __rozieFirstUpdateDone;
  private _disconnectCleanups;
  private _rozieTornDown;
  updated(changedProperties: Map<string, unknown>): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  draftValue: () => string;
  onInput: (e: any) => void;
  applyFilter: () => void;
  clearFilter: () => void;
  onKeydown: (e: any) => void;
  onBlur: () => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/FilterNumberRange.d.ts
declare const FilterNumberRange_base: typeof LitElement;
declare class FilterNumberRange extends FilterNumberRange_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column: unknown;
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  value: unknown;
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  setFilter: ((...args: any[]) => any) | null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  minMax: unknown;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _minDraft;
  private _maxDraft;
  private _touched;
  private __rozieWatchInitial_0;
  private _disconnectCleanups;
  private _rozieTornDown;
  firstUpdated(): void;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  minDraftValue: () => string;
  maxDraftValue: () => string;
  onMinInput: (e: any) => void;
  onMaxInput: (e: any) => void;
  onKeydown: (e: any) => void;
  onBlur: () => void;
  minPlaceholder: () => string;
  maxPlaceholder: () => string;
  applyRange: (minDraft: any, maxDraft: any) => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/FilterSelect.d.ts
declare const FilterSelect_base: typeof LitElement;
declare class FilterSelect extends FilterSelect_base {
  static styles: _$lit.CSSResult;
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
   */
  columnId: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column: unknown;
  /**
   * The current column filter value the select seeds from (String-coerced).
   */
  value: unknown;
  /**
   * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
   */
  setFilter: ((...args: any[]) => any) | null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues: any[];
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel: string;
  private _disconnectCleanups;
  private _rozieTornDown;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  selectValue: () => string;
  onChange: (e: any) => void;
  a11yLabel: () => string;
}
//#endregion
//#region src/GroupBar.d.ts
declare const GroupBar_base: typeof LitElement;
declare class GroupBar extends GroupBar_base {
  static styles: _$lit.CSSResult;
  /**
   * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
   */
  grouping: any[];
  /**
   * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
   */
  groupableColumns: any[];
  /**
   * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
   */
  applyGrouping: ((...args: any[]) => any) | null;
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  clearGrouping: ((...args: any[]) => any) | null;
  private _draggingId;
  private _isOver;
  private _dragKind;
  private _dropKey;
  private _disconnectCleanups;
  private _rozieTornDown;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  onChipDragStart: (e: any, id: any) => void;
  onTokenDragStart: (e: any, gk: any) => void;
  onDragOver: (e: any) => void;
  onTokenDragOver: (e: any, gk: any) => void;
  onDragLeave: (e: any) => void;
  resetDrag: () => void;
  onDragEnd: () => void;
  onDrop: (e: any) => void;
  removeKey: (key: any) => void;
  clearAll: () => void;
  labelFor: (key: any) => any;
}
//#endregion
//#region src/DetailPanel.d.ts
declare const DetailPanel_base: typeof LitElement;
declare class DetailPanel extends DetailPanel_base {
  static styles: _$lit.CSSResult;
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  row: unknown;
  private _disconnectCleanups;
  private _rozieTornDown;
  disconnectedCallback(): void;
  render(): _$lit.TemplateResult<1>;
  entries: () => {
    key: any;
    value: string;
  }[];
}
//#endregion
export { Column, DataTable, DataTable as default, DetailPanel, EditorCheckbox, EditorDate, EditorNumber, EditorSelect, EditorText, FilterNumberRange, FilterSelect, FilterText, GroupBar };