Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let react = require("react");
let _rozie_runtime_react = require("@rozie/runtime-react");
require("./DataTable.css");
let _rozie_ui_popover_react = require("@rozie-ui/popover-react");
_rozie_ui_popover_react = __toESM(_rozie_ui_popover_react);
let _tanstack_table_core = require("@tanstack/table-core");
let _tanstack_virtual_core = require("@tanstack/virtual-core");
let react_jsx_runtime = require("react/jsx-runtime");
require("./GroupBar.css");
//#region src/helpers/columnDefUtils.ts
const isSafeKey = (k) => k !== "__proto__" && k !== "constructor" && k !== "prototype";
const wrapAggregationFn = (fn) => {
	if (typeof fn === "string") return fn;
	if (typeof fn !== "function") return void 0;
	return (columnId, leafRows, childRows) => {
		try {
			return fn(columnId, leafRows, childRows);
		} catch (err) {
			return;
		}
	};
};
const collectNestedDefs = (list, out) => {
	if (!Array.isArray(list)) return;
	for (const d of list) {
		if (!d || d.id == null) continue;
		const id = String(d.id);
		if (!(id in out)) out[id] = d;
		if (Array.isArray(d.columns)) collectNestedDefs(d.columns, out);
	}
};
const indexDefsById = (defs) => {
	const out = Object.create(null);
	if (!Array.isArray(defs)) return out;
	for (const d of defs) {
		if (!d || d.id == null) continue;
		out[String(d.id)] = d;
	}
	for (const d of defs) if (d && Array.isArray(d.columns)) collectNestedDefs(d.columns, out);
	return out;
};
const collectGroupableLeafDefs = (defs) => {
	const out = [];
	if (!Array.isArray(defs)) return out;
	for (const d of defs) {
		if (!d) continue;
		if (Array.isArray(d.columns)) {
			out.push(...collectGroupableLeafDefs(d.columns));
			continue;
		}
		if (d.groupable === false) continue;
		out.push(d);
	}
	return out;
};
const EDITOR_KINDS = [
	"text",
	"number",
	"select",
	"checkbox",
	"custom"
];
const editorKindWarning = (id, editor) => {
	if (editor == null) return null;
	if (typeof editor === "string" && EDITOR_KINDS.indexOf(editor) !== -1) return null;
	return "[rozie-data-table] column \"" + String(id) + "\": editor=\"" + String(editor) + "\" is not a built-in editor. The built-ins are text | number | select | checkbox; anything else needs editor=\"custom\" plus an #editor slot fill (that is how <EditorDate> is used). Falling back to the text input.";
};
const columnSpecsEquivalent = (a, b, depth) => {
	const d = typeof depth === "number" ? depth : 0;
	if (a === b) return true;
	if (d > 4) return false;
	const ta = typeof a;
	if (ta !== typeof b) return false;
	if (ta === "function") try {
		return String(a) === String(b);
	} catch (err) {
		return false;
	}
	if (ta === "number") return a !== a && b !== b;
	if (a === null || b === null || ta !== "object") return false;
	const aArr = Array.isArray(a);
	if (aArr !== Array.isArray(b)) return false;
	if (aArr) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!columnSpecsEquivalent(a[i], b[i], d + 1)) return false;
		return true;
	}
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	for (let i = 0; i < ka.length; i++) {
		const k = ka[i];
		if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
		if (!columnSpecsEquivalent(a[k], b[k], d + 1)) return false;
	}
	return true;
};
//#endregion
//#region src/helpers/indexMath.ts
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const focusables = (cellEl) => {
	if (!cellEl || !cellEl.querySelectorAll) return [];
	return Array.prototype.slice.call(cellEl.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex=\"-1\"])")).filter((n) => !n.disabled);
};
const applyUpdater = (updater, current) => typeof updater === "function" ? updater(current) : updater;
//#endregion
//#region src/helpers/tsvGrid.ts
const escapeTsvField = (s) => {
	if (s.indexOf("	") >= 0 || s.indexOf("\n") >= 0 || s.indexOf("\r") >= 0 || s.indexOf("\"") >= 0) return "\"" + s.replace(/"/g, "\"\"") + "\"";
	return s;
};
const parseTsv = (text) => {
	const str = text != null ? String(text) : "";
	if (str === "" || str.length > 2e6) return [];
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;
	let i = 0;
	const n = str.length;
	while (i < n) {
		const ch = str[i];
		if (inQuotes) {
			if (ch === "\"") {
				if (i + 1 < n && str[i + 1] === "\"") {
					field = field + "\"";
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
		if (ch === "\"" && field === "") {
			inQuotes = true;
			i = i + 1;
			continue;
		}
		if (ch === "	") {
			row.push(field);
			field = "";
			i = i + 1;
			continue;
		}
		if (ch === "\r") {
			if (i + 1 < n && str[i + 1] === "\n") i = i + 1;
			row.push(field);
			field = "";
			rows.push(row);
			row = [];
			i = i + 1;
			continue;
		}
		if (ch === "\n") {
			row.push(field);
			field = "";
			rows.push(row);
			row = [];
			i = i + 1;
			continue;
		}
		field = field + ch;
		i = i + 1;
	}
	row.push(field);
	rows.push(row);
	if (rows.length > 1) {
		const last = rows[rows.length - 1];
		if (last.length === 1 && last[0] === "") rows.pop();
	}
	return rows;
};
const tileGridToBox = (grid, box) => {
	const srcRows = grid.length;
	let srcCols = 0;
	for (let i = 0; i < srcRows; i++) {
		const w = grid[i] && grid[i].length ? grid[i].length : 0;
		if (w > srcCols) srcCols = w;
	}
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
			line.push(v != null ? v : "");
		}
		out.push(line);
	}
	return out;
};
const tileIndex = (i, lo, hi) => {
	const span = hi - lo + 1;
	if (span <= 1) return lo;
	let k = (i - lo) % span;
	if (k < 0) k = k + span;
	return lo + k;
};
//#endregion
//#region src/helpers/rowValueUtils.ts
const replaceRowValue = (rows, rowIndex, field, value) => {
	const src = rows || [];
	const out = [];
	for (let i = 0; i < src.length; i++) if (i === rowIndex) out.push({
		...src[i] || {},
		[field]: value
	});
	else out.push(src[i]);
	return out;
};
const replaceRowValues = (rows, rowIndex, fieldValues) => {
	const src = rows || [];
	const fv = fieldValues || {};
	const out = [];
	for (let i = 0; i < src.length; i++) if (i === rowIndex) out.push({
		...src[i] || {},
		...fv
	});
	else out.push(src[i]);
	return out;
};
const indexOfRowIn = (rows, rowOriginal, rowId) => {
	const list = rows || [];
	for (let i = 0; i < list.length; i++) {
		const r = list[i];
		if (!r) continue;
		if (rowId != null && r.id === rowId) return i;
		if (rowOriginal != null && r.original === rowOriginal) return i;
	}
	return -1;
};
//#endregion
//#region src/DataTable.tsx
const DataTable = (0, react.forwardRef)(function DataTable(_props, ref) {
	const __ctx_data_table_columns = (0, _rozie_runtime_react.rozieContext)("data-table:columns");
	const __defaultColumns = (0, react.useState)(() => [])[0];
	const props = {
		..._props,
		columns: _props.columns ?? __defaultColumns,
		selectionMode: _props.selectionMode ?? "none",
		manual: _props.manual ?? false,
		rowCount: _props.rowCount ?? null,
		pageCount: _props.pageCount ?? null,
		expandable: _props.expandable ?? false,
		getSubRows: _props.getSubRows ?? null,
		groupable: _props.groupable ?? false,
		stickyHeader: _props.stickyHeader ?? false,
		interactionMode: _props.interactionMode ?? "table",
		singleClickEdit: _props.singleClickEdit ?? false,
		undoable: _props.undoable ?? false,
		undoLimit: _props.undoLimit ?? 100,
		virtual: _props.virtual ?? false,
		estimateRowHeight: _props.estimateRowHeight ?? 40,
		autoMeasure: _props.autoMeasure ?? false,
		maxHeight: _props.maxHeight ?? ""
	};
	const table = (0, react.useRef)(null);
	const refreshRowModel = (0, react.useRef)(null);
	const virtualizer = (0, react.useRef)(null);
	const pendingEditFollow = (0, react.useRef)(null);
	const gridRoot = (0, react.useRef)(null);
	const docPointerDown = (0, react.useRef)(null);
	const outsidePointerDown = (0, react.useRef)(false);
	const gridScrollEl = (0, react.useRef)(null);
	const virtualizerCleanup = (0, react.useRef)(null);
	const colVirtualizer = (0, react.useRef)(null);
	const colVirtualizerCleanup = (0, react.useRef)(null);
	const pinSeedApplied = (0, react.useRef)(false);
	const columnDefsCache = (0, react.useRef)(null);
	const columnDefsCacheColumnsRef = (0, react.useRef)(void 0);
	const columnDefsCacheColRegRef = (0, react.useRef)(void 0);
	const columnDefsIndexCache = (0, react.useRef)(null);
	const expandedTouched = (0, react.useRef)(false);
	const programmatic = (0, react.useRef)(0);
	const columnSizingInfoSync = (0, react.useRef)(null);
	const measuredRowCount = (0, react.useRef)(0);
	const measuredRowTotal = (0, react.useRef)(0);
	const windowVerBumpPending = (0, react.useRef)(false);
	const remeasureDisposed = (0, react.useRef)(false);
	const remeasurePending = (0, react.useRef)(false);
	const remeasureRaf = (0, react.useRef)(null);
	const afterRowRemeasure = (0, react.useRef)(refineRowEstimate);
	const colRtlObserverEl = (0, react.useRef)(null);
	const colRtlObserver = (0, react.useRef)(null);
	const lastColSizeSig = (0, react.useRef)(0);
	const gridEmptyFallback = (0, react.useRef)(false);
	const rangeActive = (0, react.useRef)(false);
	const selectAllBox = (0, react.useRef)(null);
	const fillDragMove = (0, react.useRef)(null);
	const fillDragUp = (0, react.useRef)(null);
	const fillDragging = (0, react.useRef)(false);
	const fillEdgeScrollRaf = (0, react.useRef)(null);
	const rangeDragMove = (0, react.useRef)(null);
	const rangeDragUp = (0, react.useRef)(null);
	const rangeDragging = (0, react.useRef)(false);
	const lastData = (0, react.useRef)(null);
	const lastDataLen = (0, react.useRef)(-1);
	const lastPropsData = (0, react.useRef)(null);
	const undoStack = (0, react.useRef)([]);
	const redoStack = (0, react.useRef)([]);
	const focusIntentEpoch = (0, react.useRef)(0);
	const committedThisSession = (0, react.useRef)(false);
	const editTransition = (0, react.useRef)(false);
	const restoringHistory = (0, react.useRef)(false);
	const groupRowDescriptorCache = (0, react.useRef)(null);
	const groupRowDescriptorCacheVer = (0, react.useRef)(void 0);
	const rangeTransition = (0, react.useRef)(false);
	const rangeClickPending = (0, react.useRef)(null);
	const rangeDragMoved = (0, react.useRef)(false);
	const [data, setData] = (0, _rozie_runtime_react.useControllableState)({
		value: props.data,
		defaultValue: props.defaultData ?? [],
		onValueChange: props.onDataChange
	});
	const [sorting, setSorting] = (0, _rozie_runtime_react.useControllableState)({
		value: props.sorting,
		defaultValue: props.defaultSorting ?? [],
		onValueChange: props.onSortingChange
	});
	const [globalFilter, setGlobalFilter] = (0, _rozie_runtime_react.useControllableState)({
		value: props.globalFilter,
		defaultValue: props.defaultGlobalFilter ?? "",
		onValueChange: props.onGlobalFilterChange
	});
	const [columnFilters, setColumnFilters] = (0, _rozie_runtime_react.useControllableState)({
		value: props.columnFilters,
		defaultValue: props.defaultColumnFilters ?? [],
		onValueChange: props.onColumnFiltersChange
	});
	const [pagination, setPagination] = (0, _rozie_runtime_react.useControllableState)({
		value: props.pagination,
		defaultValue: props.defaultPagination ?? {
			pageIndex: 0,
			pageSize: 10
		},
		onValueChange: props.onPaginationChange
	});
	const [expanded, setExpanded] = (0, _rozie_runtime_react.useControllableState)({
		value: props.expanded,
		defaultValue: props.defaultExpanded ?? null,
		onValueChange: props.onExpandedChange
	});
	const [grouping, setGrouping] = (0, _rozie_runtime_react.useControllableState)({
		value: props.grouping,
		defaultValue: props.defaultGrouping ?? null,
		onValueChange: props.onGroupingChange
	});
	const [rowSelection, setRowSelection] = (0, _rozie_runtime_react.useControllableState)({
		value: props.rowSelection,
		defaultValue: props.defaultRowSelection ?? {},
		onValueChange: props.onRowSelectionChange
	});
	const [columnVisibility, setColumnVisibility] = (0, _rozie_runtime_react.useControllableState)({
		value: props.columnVisibility,
		defaultValue: props.defaultColumnVisibility ?? {},
		onValueChange: props.onColumnVisibilityChange
	});
	const [columnSizing, setColumnSizing] = (0, _rozie_runtime_react.useControllableState)({
		value: props.columnSizing,
		defaultValue: props.defaultColumnSizing ?? {},
		onValueChange: props.onColumnSizingChange
	});
	const [columnOrder, setColumnOrder] = (0, _rozie_runtime_react.useControllableState)({
		value: props.columnOrder,
		defaultValue: props.defaultColumnOrder ?? [],
		onValueChange: props.onColumnOrderChange
	});
	const [columnPinning, setColumnPinning] = (0, _rozie_runtime_react.useControllableState)({
		value: props.columnPinning,
		defaultValue: props.defaultColumnPinning ?? {
			left: [],
			right: []
		},
		onValueChange: props.onColumnPinningChange
	});
	const _expandableRef = (0, react.useRef)(props.expandable);
	_expandableRef.current = props.expandable;
	const _getSubRowsRef = (0, react.useRef)(props.getSubRows);
	_getSubRowsRef.current = props.getSubRows;
	const _manualRef = (0, react.useRef)(props.manual);
	_manualRef.current = props.manual;
	const _pageCountRef = (0, react.useRef)(props.pageCount);
	_pageCountRef.current = props.pageCount;
	const _rowCountRef = (0, react.useRef)(props.rowCount);
	_rowCountRef.current = props.rowCount;
	const _selectionModeRef = (0, react.useRef)(props.selectionMode);
	_selectionModeRef.current = props.selectionMode;
	const _dataRef = (0, react.useRef)(data);
	_dataRef.current = data;
	const _paginationRef = (0, react.useRef)(pagination);
	_paginationRef.current = pagination;
	const [dataDefault, setDataDefault] = (0, react.useState)([]);
	const [sortingDefault, setSortingDefault] = (0, react.useState)([]);
	const [globalFilterDefault, setGlobalFilterDefault] = (0, react.useState)("");
	const [columnFiltersDefault, setColumnFiltersDefault] = (0, react.useState)([]);
	const [paginationDefault, setPaginationDefault] = (0, react.useState)({
		pageIndex: 0,
		pageSize: 10
	});
	const [rowSelectionDefault, setRowSelectionDefault] = (0, react.useState)({});
	const [expandedDefault, setExpandedDefault] = (0, react.useState)({});
	const [groupingDefault, setGroupingDefault] = (0, react.useState)([]);
	const [columnVisibilityDefault, setColumnVisibilityDefault] = (0, react.useState)({});
	const [columnSizingDefault, setColumnSizingDefault] = (0, react.useState)({});
	const [columnOrderDefault, setColumnOrderDefault] = (0, react.useState)([]);
	const [columnPinningDefault, setColumnPinningDefault] = (0, react.useState)({
		left: [],
		right: []
	});
	const [columnSizingInfo, setColumnSizingInfo] = (0, react.useState)({
		startOffset: null,
		startSize: null,
		deltaOffset: null,
		deltaPercentage: null,
		isResizingColumn: false,
		columnSizingStart: []
	});
	const [colReg, setColReg] = (0, react.useState)({});
	const [rows, setRows] = (0, react.useState)([]);
	const [headerGroups, setHeaderGroups] = (0, react.useState)([]);
	const [rowModelVer, setRowModelVer] = (0, react.useState)(0);
	const [windowVer, setWindowVer] = (0, react.useState)(0);
	const [activeRow, setActiveRow] = (0, react.useState)(0);
	const [activeColIndex, setActiveColIndex] = (0, react.useState)(0);
	const [activeIsHeader, setActiveIsHeader] = (0, react.useState)(false);
	const [activeHeaderLevel, setActiveHeaderLevel] = (0, react.useState)(0);
	const [activeInControl, setActiveInControl] = (0, react.useState)(false);
	const [editingRow, setEditingRow] = (0, react.useState)(-1);
	const [editingCol, setEditingCol] = (0, react.useState)(-1);
	const [draftValue, setDraftValue] = (0, react.useState)(null);
	const [invalidMsg, setInvalidMsg] = (0, react.useState)("");
	const [editVer, setEditVer] = (0, react.useState)(0);
	const [editFocusColId, setEditFocusColId] = (0, react.useState)(null);
	const [editingRowIndex, setEditingRowIndex] = (0, react.useState)(null);
	const [rowDraft, setRowDraft] = (0, react.useState)({});
	const [rangeAnchor, setRangeAnchor] = (0, react.useState)(null);
	const [rangeFocus, setRangeFocus] = (0, react.useState)(null);
	const [pasteAnnounce, setPasteAnnounce] = (0, react.useState)("");
	const [rangeAnnounce, setRangeAnnounce] = (0, react.useState)("");
	const [liveAnnounce, setLiveAnnounce] = (0, react.useState)("");
	const __rozieRoot = (0, react.useRef)(null);
	const _watch0First = (0, react.useRef)(true);
	const _watch1First = (0, react.useRef)(true);
	const GRID_PAGE_STEP = (0, react.useMemo)(() => 10, []);
	const DATA_WRITE_TOKEN_KEY = (0, react.useMemo)(() => "__rozieDataWriteToken", []);
	function groupingActiveDefault() {
		return ((grouping != null ? grouping : groupingDefault) || []).length > 0;
	}
	function effectiveColumnPinning() {
		const base = columnPinning != null ? columnPinning : columnPinningDefault;
		const rail = [];
		if (selectionEnabled()) rail.push(SELECT_COL_ID);
		if (props.expandable === true) rail.push(EXPANDER_COL_ID);
		if (rail.length === 0) return base;
		const deduped = (base && base.left ? base.left : []).filter((id) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID);
		return {
			...base,
			left: rail.concat(deduped)
		};
	}
	const seedColumnPinning = (0, react.useCallback)(() => {
		if (pinSeedApplied.current) return;
		const live = columnPinning != null ? columnPinning : columnPinningDefault;
		const isRealPin = (id) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID;
		if ((live && live.left ? live.left : []).filter(isRealPin).length > 0 || (live && live.right ? live.right : []).filter(isRealPin).length > 0) {
			pinSeedApplied.current = true;
			return;
		}
		const defs = columnDefs();
		if (!defs.length) return;
		const left = [];
		const right = [];
		for (let i = 0; i < defs.length; i++) {
			const def = defs[i];
			if (!def) continue;
			if (def.pinned === "left") left.push(def.id);
			else if (def.pinned === "right") right.push(def.id);
		}
		if (!left.length && !right.length) return;
		pinSeedApplied.current = true;
		const seeded = {
			left,
			right
		};
		setColumnPinningDefault(seeded);
		setColumnPinning(seeded);
	}, [
		columnDefs,
		columnPinning,
		columnPinningDefault,
		setColumnPinning
	]);
	const currentState = (0, react.useCallback)(() => ({
		sorting: sorting != null ? sorting : sortingDefault,
		globalFilter: globalFilter != null ? globalFilter : globalFilterDefault,
		columnFilters: columnFilters != null ? columnFilters : columnFiltersDefault,
		pagination: pagination != null ? pagination : paginationDefault,
		rowSelection: rowSelection != null ? rowSelection : rowSelectionDefault,
		expanded: expanded != null ? expanded : groupingActiveDefault() && !expandedTouched.current ? true : expandedDefault,
		grouping: grouping != null ? grouping : groupingDefault,
		columnVisibility: columnVisibility != null ? columnVisibility : columnVisibilityDefault,
		columnSizing: columnSizing != null ? columnSizing : columnSizingDefault,
		columnOrder: columnOrder != null ? columnOrder : columnOrderDefault,
		columnPinning: effectiveColumnPinning(),
		columnSizingInfo
	}), [
		columnFilters,
		columnFiltersDefault,
		columnOrder,
		columnOrderDefault,
		columnSizing,
		columnSizingDefault,
		columnSizingInfo,
		columnVisibility,
		columnVisibilityDefault,
		effectiveColumnPinning,
		expanded,
		expandedDefault,
		globalFilter,
		globalFilterDefault,
		grouping,
		groupingActiveDefault,
		groupingDefault,
		pagination,
		paginationDefault,
		rowSelection,
		rowSelectionDefault,
		sorting,
		sortingDefault
	]);
	const currentData = (0, react.useCallback)(() => data != null ? data : dataDefault, [data, dataDefault]);
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
	function parseWidthToSize(w) {
		if (typeof w === "number") return Number.isFinite(w) && w > 0 ? w : null;
		if (typeof w !== "string") return null;
		const t = w.trim();
		if (t === "") return null;
		const m = /^(\d+(?:\.\d+)?)(px)?$/i.exec(t);
		if (!m) return null;
		const n = Number.parseFloat(m[1]);
		return Number.isFinite(n) && n > 0 ? n : null;
	}
	const editorWarned = (0, react.useMemo)(() => Object.create(null), []);
	function checkEditorKind(id, editor) {
		const msg = editorKindWarning(id, editor);
		if (!msg) return editor;
		const key = id + "\0" + String(editor);
		if (editorWarned[key]) return editor;
		editorWarned[key] = true;
		console.warn(msg);
		return editor;
	}
	function buildConfigDef(c) {
		if (!c) return null;
		if (Array.isArray(c.columns)) {
			const kids = [];
			for (const child of c.columns) {
				const cd = buildConfigDef(child);
				if (cd) kids.push(cd);
			}
			if (!kids.length) return null;
			let gid = c.id;
			if (gid == null) gid = c.header != null ? "__grp_" + kids.map((k) => k.id).join("_") : null;
			if (gid == null) return null;
			const id = String(gid);
			if (!isSafeKey(id)) return null;
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
			enableColumnFilter: c.filterable === true,
			filterable: c.filterable === true,
			expandable: c.expandable === true,
			groupable: c.groupable !== false,
			aggregationFn: wrapAggregationFn(c.aggregationFn),
			pinned: c.pinned != null ? c.pinned : "",
			width: c.width != null ? c.width : "",
			...parseWidthToSize(c.width) != null ? { size: parseWidthToSize(c.width) } : {},
			meta: {
				editable: c.editable === true,
				editor: c.editor != null ? checkEditorKind(id, c.editor) : "text",
				editorOptions: c.editorOptions != null ? c.editorOptions : [],
				validate: typeof c.validate === "function" ? c.validate : null
			}
		};
	}
	function columnDefs() {
		const cfg = props.columns || [];
		const reg = colReg || {};
		if (columnDefsCache.current && props.columns === columnDefsCacheColumnsRef.current && colReg === columnDefsCacheColRegRef.current) return columnDefsCache.current;
		const byId = Object.create(null);
		const order = [];
		for (const c of cfg) {
			const def = buildConfigDef(c);
			if (!def) continue;
			const id = def.id;
			if (!(id in byId)) order.push(id);
			byId[id] = def;
		}
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
				expandable: spec.expandable === true,
				groupable: spec.groupable !== false,
				aggregationFn: wrapAggregationFn(spec.aggregationFn),
				pinned: spec.pinned != null ? spec.pinned : "",
				width: spec.width != null ? spec.width : "",
				...parseWidthToSize(spec.width) != null ? { size: parseWidthToSize(spec.width) } : {},
				meta: {
					editable: spec.editable === true,
					editor: spec.editor != null ? checkEditorKind(id, spec.editor) : "text",
					editorOptions: spec.editorOptions != null ? spec.editorOptions : [],
					validate: typeof spec.validate === "function" ? spec.validate : null
				}
			};
		}
		const out = [];
		for (const id of order) if (byId[id]) out.push(byId[id]);
		columnDefsCache.current = out;
		columnDefsCacheColumnsRef.current = props.columns;
		columnDefsCacheColRegRef.current = colReg;
		columnDefsIndexCache.current = indexDefsById(out);
		return out;
	}
	function defIndex() {
		columnDefs();
		return columnDefsIndexCache.current || Object.create(null);
	}
	const SELECT_COL_ID = (0, react.useMemo)(() => "__rdt_select", []);
	const EXPANDER_COL_ID = (0, react.useMemo)(() => "__rdt_expander", []);
	function selectionEnabled() {
		return props.selectionMode === "single" || props.selectionMode === "multiple";
	}
	const tableColumns = (0, react.useCallback)(() => {
		const cols = columnDefs();
		let withExpander = cols;
		if (props.expandable === true) withExpander = [{
			id: EXPANDER_COL_ID,
			enableSorting: false,
			enableColumnFilter: false,
			filterable: false,
			isExpanderColumn: true,
			pinned: "",
			width: "",
			size: 40
		}].concat(cols);
		if (selectionEnabled()) return [{
			id: SELECT_COL_ID,
			enableSorting: false,
			enableColumnFilter: false,
			filterable: false,
			isSelectColumn: true,
			pinned: "",
			width: "",
			size: 44
		}].concat(withExpander);
		return withExpander;
	}, [
		columnDefs,
		props.expandable,
		selectionEnabled
	]);
	function writeSorting(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setSortingDefault(next);
		setSorting(next);
		props.onSortChange && props.onSortChange(next);
		programmatic.current--;
	}
	function writeExpanded(next) {
		if (programmatic.current) return;
		programmatic.current++;
		expandedTouched.current = true;
		setExpandedDefault(next);
		setExpanded(next);
		props.onExpandChange && props.onExpandChange(next);
		programmatic.current--;
	}
	function writeGrouping(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setGroupingDefault(next);
		setGrouping(next);
		props.onGroupChange && props.onGroupChange(next);
		programmatic.current--;
	}
	function writeGlobalFilter(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setGlobalFilterDefault(next);
		setGlobalFilter(next);
		props.onFilterChange && props.onFilterChange({ globalFilter: next });
		programmatic.current--;
	}
	function writeColumnFilters(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setColumnFiltersDefault(next);
		setColumnFilters(next);
		props.onFilterChange && props.onFilterChange({ columnFilters: next });
		programmatic.current--;
	}
	const { onPageChange: _rozieProp_onPageChange } = props;
	const writePagination = (0, react.useCallback)((next) => {
		if (programmatic.current) return;
		programmatic.current++;
		setPaginationDefault(next);
		setPagination(next);
		_rozieProp_onPageChange && _rozieProp_onPageChange(next);
		programmatic.current--;
	}, [_rozieProp_onPageChange, setPagination]);
	function writeRowSelection(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setRowSelectionDefault(next);
		setRowSelection(next);
		props.onSelectionChange && props.onSelectionChange(next);
		programmatic.current--;
	}
	function writeColumnVisibility(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setColumnVisibilityDefault(next);
		setColumnVisibility(next);
		props.onVisibilityChange && props.onVisibilityChange(next);
		programmatic.current--;
	}
	function writeColumnSizing(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setColumnSizingDefault(next);
		setColumnSizing(next);
		props.onResizeChange && props.onResizeChange(next);
		programmatic.current--;
	}
	function writeColumnOrder(next) {
		if (programmatic.current) return;
		programmatic.current++;
		setColumnOrderDefault(next);
		setColumnOrder(next);
		props.onReorderChange && props.onReorderChange(next);
		programmatic.current--;
	}
	function writeColumnPinning(next) {
		if (programmatic.current) return;
		const strip = (ids) => (ids || []).filter((id) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID);
		const clean = {
			...next,
			left: strip(next && next.left),
			right: strip(next && next.right)
		};
		programmatic.current++;
		setColumnPinningDefault(clean);
		setColumnPinning(clean);
		props.onPinChange && props.onPinChange(clean);
		programmatic.current--;
	}
	function writeData(next) {
		if (programmatic.current) return;
		if (props.undoable && !restoringHistory.current) {
			const prevU = canUndo();
			const prevR = canRedo();
			recordSnapshot(currentData());
			emitHistoryChangeIfEdged(prevU, prevR);
		}
		const fresh = Array.isArray(next) ? next.slice() : next;
		try {
			Object.defineProperty(fresh, DATA_WRITE_TOKEN_KEY, {
				value: true,
				enumerable: false,
				configurable: true,
				writable: true
			});
		} catch (_e) {}
		programmatic.current++;
		setDataDefault(fresh);
		setData(fresh);
		programmatic.current--;
	}
	function columnFilterValue(colId) {
		const cf = currentState().columnFilters || [];
		for (const f of cf) if (f && f.id === colId) return f.value != null ? f.value : "";
		return "";
	}
	function setColumnFilter(colId, value) {
		const prev = currentState().columnFilters || [];
		const next = [];
		for (const f of prev) if (f && f.id !== colId) next.push(f);
		if (value != null && value !== "") next.push({
			id: colId,
			value
		});
		writeColumnFilters(next);
	}
	function recordSnapshot(current) {
		undoStack.current.push(current);
		const limit = props.undoLimit != null ? props.undoLimit : 100;
		while (undoStack.current.length > limit) undoStack.current.shift();
		redoStack.current = [];
	}
	function canUndo() {
		return undoStack.current.length > 0;
	}
	function canRedo() {
		return redoStack.current.length > 0;
	}
	function clearHistory() {
		undoStack.current = [];
		redoStack.current = [];
	}
	function emitHistoryChange() {
		props.onHistoryChange && props.onHistoryChange({
			canUndo: canUndo(),
			canRedo: canRedo()
		});
	}
	function emitHistoryChangeIfEdged(prevU, prevR) {
		const nextU = canUndo();
		const nextR = canRedo();
		if (nextU !== prevU || nextR !== prevR) emitHistoryChange();
	}
	function undo() {
		if (!canUndo()) return;
		const prev = undoStack.current.pop();
		redoStack.current.push(currentData());
		restoringHistory.current = true;
		writeData(prev);
		restoringHistory.current = false;
		emitHistoryChange();
	}
	function redo() {
		if (!canRedo()) return;
		const next = redoStack.current.pop();
		undoStack.current.push(currentData());
		restoringHistory.current = true;
		writeData(next);
		restoringHistory.current = false;
		emitHistoryChange();
	}
	const onSortingChangeCb = (0, react.useCallback)((updater) => {
		writeSorting(applyUpdater(updater, currentState().sorting));
	}, [currentState, writeSorting]);
	const onExpandedChangeCb = (0, react.useCallback)((updater) => {
		writeExpanded(applyUpdater(updater, currentState().expanded));
	}, [currentState, writeExpanded]);
	const onGroupingChangeCb = (0, react.useCallback)((updater) => {
		writeGrouping(applyUpdater(updater, currentState().grouping));
	}, [currentState, writeGrouping]);
	const onGlobalFilterChangeCb = (0, react.useCallback)((updater) => {
		writeGlobalFilter(applyUpdater(updater, currentState().globalFilter));
	}, [currentState, writeGlobalFilter]);
	const onColumnFiltersChangeCb = (0, react.useCallback)((updater) => {
		writeColumnFilters(applyUpdater(updater, currentState().columnFilters));
	}, [currentState, writeColumnFilters]);
	const onPaginationChangeCb = (0, react.useCallback)((updater) => {
		writePagination(applyUpdater(updater, currentState().pagination));
	}, [currentState, writePagination]);
	const onRowSelectionChangeCb = (0, react.useCallback)((updater) => {
		writeRowSelection(applyUpdater(updater, currentState().rowSelection));
	}, [currentState, writeRowSelection]);
	const onColumnVisibilityChangeCb = (0, react.useCallback)((updater) => {
		writeColumnVisibility(applyUpdater(updater, currentState().columnVisibility));
	}, [currentState, writeColumnVisibility]);
	const onColumnSizingChangeCb = (0, react.useCallback)((updater) => {
		writeColumnSizing(applyUpdater(updater, currentState().columnSizing));
	}, [currentState, writeColumnSizing]);
	const onColumnOrderChangeCb = (0, react.useCallback)((updater) => {
		writeColumnOrder(applyUpdater(updater, currentState().columnOrder));
	}, [currentState, writeColumnOrder]);
	const onColumnPinningChangeCb = (0, react.useCallback)((updater) => {
		writeColumnPinning(applyUpdater(updater, currentState().columnPinning));
	}, [currentState, writeColumnPinning]);
	const onColumnSizingInfoChangeCb = (0, react.useCallback)((updater) => {
		const next = applyUpdater(updater, columnSizingInfoSync.current != null ? columnSizingInfoSync.current : columnSizingInfo);
		if (next == null) return;
		columnSizingInfoSync.current = next;
		setColumnSizingInfo(next);
	}, [columnSizingInfo]);
	function resolveVirtual() {
		const v = props.virtual;
		if (typeof v === "string") {
			if (v === "rows") return "rows";
			if (v === "columns") return "columns";
			if (v === "both") return "both";
			return "off";
		}
		return v === true ? "rows" : "off";
	}
	const rowsWindowed = (0, react.useCallback)(() => {
		const s = resolveVirtual();
		return s === "rows" || s === "both";
	}, [resolveVirtual]);
	const colsWindowed = (0, react.useCallback)(() => {
		const s = resolveVirtual();
		return s === "columns" || s === "both";
	}, [resolveVirtual]);
	const isWindowed = (0, react.useCallback)(() => rowsWindowed() || colsWindowed(), [colsWindowed, rowsWindowed]);
	function autoMeasureOn() {
		return props.autoMeasure === true;
	}
	function columnCount() {
		return visibleColCount();
	}
	function columnSize(i) {
		if (!table.current || !table.current.getVisibleLeafColumns) return 150;
		const c = table.current.getVisibleLeafColumns()[i];
		return c && typeof c.getSize === "function" ? c.getSize() : 150;
	}
	function forcedColumns() {
		if (!colsWindowed()) return [];
		const out = [];
		if (table.current && table.current.getVisibleLeafColumns) {
			const cols = table.current.getVisibleLeafColumns();
			for (let i = 0; i < cols.length; i++) {
				const c = cols[i];
				if (c && c.getIsPinned && c.getIsPinned()) out.push(i);
			}
		}
		if (!activeIsHeader && activeColIndex >= 0 && out.indexOf(activeColIndex) === -1) out.push(activeColIndex);
		if (editingRow >= 0 && editingCol >= 0 && out.indexOf(editingCol) === -1) out.push(editingCol);
		return out;
	}
	function windowedCells(row) {
		const cells = visibleCellsFor(row);
		if (!colsWindowed()) return cells;
		const idx = windowedColIndices();
		const out = [];
		for (let i = 0; i < idx.length; i++) {
			const cell = cells[idx[i]];
			if (cell) out.push(cell);
		}
		return out;
	}
	const windowSource = (0, react.useCallback)(() => {
		if (!table.current) return [];
		if (rowsWindowed()) return table.current.getPrePaginationRowModel().rows;
		return table.current.getRowModel().rows;
	}, [rowsWindowed]);
	function scheduleRemeasure() {
		if (remeasureDisposed.current) return;
		if (remeasurePending.current) return;
		remeasurePending.current = true;
		let ranMicro = false;
		const microPass = () => {
			remeasureWindow();
		};
		const rafPass = () => {
			remeasureRaf.current = null;
			remeasurePending.current = false;
			remeasureWindow();
		};
		if (typeof queueMicrotask !== "undefined") {
			ranMicro = true;
			queueMicrotask(microPass);
		}
		if (typeof requestAnimationFrame === "function") remeasureRaf.current = requestAnimationFrame(rafPass);
		else if (ranMicro) remeasurePending.current = false;
		else remeasureRaf.current = setTimeout(rafPass, 0);
	}
	const teardownRemeasure = (0, react.useCallback)(() => {
		remeasureDisposed.current = true;
		if (remeasureRaf.current != null) {
			if (typeof requestAnimationFrame === "function") cancelAnimationFrame(remeasureRaf.current);
			else clearTimeout(remeasureRaf.current);
			remeasureRaf.current = null;
		}
		remeasurePending.current = false;
	}, []);
	function pinnedEditIndex() {
		if (editingRow >= 0) return editingRow;
		if (editingRowIndex != null) return editingRowIndex;
		return -1;
	}
	function pinnedMeasurement(pin) {
		if (!virtualizer.current || pin < 0) return null;
		const ms = virtualizer.current.getMeasurements();
		return ms && ms[pin] ? ms[pin] : null;
	}
	const remeasureWindow = (0, react.useCallback)(() => {
		if (remeasureDisposed.current) return;
		if (!virtualizer.current || !gridRoot.current) return;
		if (virtualizer.current.scrollState) return;
		const trs = gridRoot.current.querySelectorAll("tbody.rdt-tbody > tr[data-index]");
		for (const tr of trs) virtualizer.current.measureElement(tr);
		if (afterRowRemeasure.current) afterRowRemeasure.current();
	}, []);
	function virtualItemKey(i) {
		const src = windowSource();
		return src && src[i] ? src[i].id : void 0;
	}
	const COL_OVERSCAN = (0, react.useMemo)(() => 3, []);
	function isColRtl() {
		if (!gridScrollEl.current || typeof getComputedStyle !== "function") return false;
		return getComputedStyle(gridScrollEl.current).direction === "rtl";
	}
	function ensureColRtlWatch() {
		if (!gridScrollEl.current || colRtlObserverEl.current === gridScrollEl.current || typeof MutationObserver !== "function") return;
		if (colRtlObserver.current) colRtlObserver.current.disconnect();
		colRtlObserver.current = new MutationObserver(() => {
			if (colVirtualizer.current) colVirtualizer.current.setOptions({
				...colVirtualizer.current.options,
				isRtl: isColRtl()
			});
		});
		colRtlObserver.current.observe(gridScrollEl.current, {
			attributes: true,
			attributeFilter: ["dir"]
		});
		colRtlObserverEl.current = gridScrollEl.current;
	}
	const teardownColRtlWatch = (0, react.useCallback)(() => {
		if (colRtlObserver.current) colRtlObserver.current.disconnect();
		colRtlObserver.current = null;
		colRtlObserverEl.current = null;
	}, []);
	const columnVirtualizerOptions = (0, react.useCallback)(() => {
		ensureColRtlWatch();
		return {
			count: columnCount(),
			getScrollElement: () => gridScrollEl.current,
			estimateSize: (i) => columnSize(i),
			horizontal: true,
			isRtl: isColRtl(),
			observeElementRect: _tanstack_virtual_core.observeElementRect,
			observeElementOffset: _tanstack_virtual_core.observeElementOffset,
			scrollToFn: _tanstack_virtual_core.elementScroll,
			measureElement: _tanstack_virtual_core.measureElement,
			overscan: COL_OVERSCAN,
			onChange: () => {
				setWindowVer((prev) => prev + 1);
			}
		};
	}, [
		columnCount,
		columnSize,
		ensureColRtlWatch,
		isColRtl
	]);
	let lastFedRowEstimate = 0;
	const foldedRowHeights = (0, react.useMemo)(() => ({}), []);
	const bumpWindowVer = (0, react.useCallback)(() => {
		if (windowVerBumpPending.current) return;
		windowVerBumpPending.current = true;
		const flush = () => {
			windowVerBumpPending.current = false;
			setWindowVer((prev) => prev + 1);
		};
		if (typeof queueMicrotask !== "undefined") queueMicrotask(flush);
		else setTimeout(flush, 0);
	}, []);
	const ESTIMATE_REFEED_DELTA_PX = 4;
	function estimateRowSize(i) {
		if (!autoMeasureOn()) return props.estimateRowHeight;
		if (measuredRowCount.current === 0) return props.estimateRowHeight;
		return Math.round(measuredRowTotal.current / measuredRowCount.current);
	}
	function foldMeasuredRow(index, height) {
		const prev = foldedRowHeights[index];
		if (prev === height) return;
		if (prev == null) {
			measuredRowTotal.current = measuredRowTotal.current + height;
			measuredRowCount.current = measuredRowCount.current + 1;
		} else measuredRowTotal.current = measuredRowTotal.current - prev + height;
		foldedRowHeights[index] = height;
	}
	function refineRowEstimate() {
		if (!autoMeasureOn() || !virtualizer.current) return;
		const items = virtualizer.current.getVirtualItems();
		const measurements = virtualizer.current.getMeasurements();
		for (let i = 0; i < items.length; i++) {
			const idx = items[i].index;
			const m = measurements && measurements[idx];
			if (m) foldMeasuredRow(idx, m.size);
		}
		if (virtualizer.current.scrollState) return;
		const est = estimateRowSize(0);
		if (Math.abs(est - lastFedRowEstimate) < ESTIMATE_REFEED_DELTA_PX) return;
		const anchorIndex = items.length ? items[0].index : -1;
		const anchorStart = items.length ? items[0].start : 0;
		virtualizer.current.setOptions(virtualizerOptions());
		virtualizer.current._willUpdate();
		lastFedRowEstimate = est;
		if (anchorIndex >= 0 && gridScrollEl.current) {
			const freshMeasurements = virtualizer.current.getMeasurements();
			const fresh = freshMeasurements && freshMeasurements[anchorIndex];
			if (fresh) {
				const delta = fresh.start - anchorStart;
				if (delta !== 0) gridScrollEl.current.scrollTop = gridScrollEl.current.scrollTop + delta;
			}
		}
		bumpWindowVer();
	}
	const virtualizerOptions = (0, react.useCallback)(() => ({
		count: windowSource().length,
		getScrollElement: () => gridScrollEl.current,
		estimateSize: (i) => estimateRowSize(i),
		observeElementRect: _tanstack_virtual_core.observeElementRect,
		observeElementOffset: _tanstack_virtual_core.observeElementOffset,
		scrollToFn: _tanstack_virtual_core.elementScroll,
		measureElement: _tanstack_virtual_core.measureElement,
		overscan: 8,
		getItemKey: virtualItemKey,
		onChange: () => {
			bumpWindowVer();
			scheduleRemeasure();
		}
	}), [
		bumpWindowVer,
		estimateRowSize,
		scheduleRemeasure,
		virtualItemKey,
		windowSource
	]);
	function pinMeasurement(pin) {
		return pinnedMeasurement(pin);
	}
	function windowedRows() {
		if (!virtualizer.current) {
			if (!rowsWindowed()) return (rows || []).map((r, i) => ({
				vi: { index: i },
				row: r
			}));
			return [];
		}
		const items = virtualizer.current.getVirtualItems();
		const rowList = rows || [];
		const out = items.map((vi) => ({
			vi,
			row: rowList[vi.index]
		})).filter((wr) => wr.row);
		const pin = pinnedEditIndex();
		if (pin >= 0 && rowList[pin]) {
			let inWindow = false;
			for (let i = 0; i < items.length; i++) if (items[i].index === pin) {
				inWindow = true;
				break;
			}
			if (!inWindow) {
				const pm = pinMeasurement(pin);
				const firstStart = items.length ? items[0].start : 0;
				const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
				const pinnedEntry = {
					vi: pm != null ? pm : { index: pin },
					row: rowList[pin],
					pinned: true
				};
				if (above) out.unshift(pinnedEntry);
				else out.push(pinnedEntry);
			}
		}
		return out;
	}
	function padTop() {
		if (!rowsWindowed() || !virtualizer.current) return 0;
		const items = virtualizer.current.getVirtualItems();
		let pad = items.length ? items[0].start : 0;
		const pin = pinnedEditIndex();
		if (pin >= 0) {
			const pm = pinMeasurement(pin);
			const inWindow = pmIndexInWindow(items, pin);
			if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
		}
		return pad < 0 ? 0 : pad;
	}
	function padBottom() {
		if (!rowsWindowed() || !virtualizer.current) return 0;
		const items = virtualizer.current.getVirtualItems();
		if (!items.length) return 0;
		let pad = virtualizer.current.getTotalSize() - items[items.length - 1].end;
		const pin = pinnedEditIndex();
		if (pin >= 0) {
			const pm = pinMeasurement(pin);
			const inWindow = pmIndexInWindow(items, pin);
			const lastItemIdx = items[items.length - 1].index;
			const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
			if (pm && !inWindow && below) {
				if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
			}
		}
		return pad < 0 ? 0 : pad;
	}
	function pmIndexInWindow(items, idx) {
		for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
		return false;
	}
	function rowIsOutsideWindow(r) {
		if (!rowsWindowed() || !virtualizer.current) return false;
		const items = virtualizer.current.getVirtualItems();
		for (const it of items) if (it.index === r) return false;
		return true;
	}
	function windowedColIndices() {
		if (!colsWindowed()) {
			const n = columnCount();
			const out = [];
			for (let i = 0; i < n; i++) out.push(i);
			return out;
		}
		if (!colVirtualizer.current) return [];
		const idx = colVirtualizer.current.getVirtualItems().map((it) => it.index);
		const forced = forcedColumns();
		for (let i = 0; i < forced.length; i++) if (idx.indexOf(forced[i]) === -1) idx.push(forced[i]);
		idx.sort((a, b) => a - b);
		return idx;
	}
	function colPadLeft() {
		if (!colsWindowed() || !colVirtualizer.current) return 0;
		const items = colVirtualizer.current.getVirtualItems();
		let pad = items.length ? items[0].start : 0;
		if (items.length) {
			const firstIdx = items[0].index;
			const forced = forcedColumns();
			for (let i = 0; i < forced.length; i++) if (forced[i] < firstIdx) pad = pad - columnSize(forced[i]);
		}
		return pad < 0 ? 0 : pad;
	}
	function colPadRight() {
		if (!colsWindowed() || !colVirtualizer.current) return 0;
		const items = colVirtualizer.current.getVirtualItems();
		if (!items.length) return 0;
		let pad = colVirtualizer.current.getTotalSize() - items[items.length - 1].end;
		const lastIdx = items[items.length - 1].index;
		const forced = forcedColumns();
		for (let i = 0; i < forced.length; i++) if (forced[i] > lastIdx) pad = pad - columnSize(forced[i]);
		return pad < 0 ? 0 : pad;
	}
	function colIsOutsideWindow(c) {
		if (!colsWindowed() || !colVirtualizer.current) return false;
		const items = colVirtualizer.current.getVirtualItems();
		for (const it of items) if (it.index === c) return false;
		return true;
	}
	const announceState = (0, react.useMemo)(() => ({
		sorting: null,
		columnFilters: null,
		globalFilter: null
	}), []);
	const effectiveSorting = (0, react.useCallback)(() => sorting != null ? sorting : sortingDefault, [sorting, sortingDefault]);
	const effectiveColumnFilters = (0, react.useCallback)(() => columnFilters != null ? columnFilters : columnFiltersDefault, [columnFilters, columnFiltersDefault]);
	const effectiveGlobalFilter = (0, react.useCallback)(() => globalFilter != null ? globalFilter : globalFilterDefault, [globalFilter, globalFilterDefault]);
	function buildSortFilterAnnounce() {
		const nextSorting = effectiveSorting();
		const nextColumnFilters = effectiveColumnFilters();
		const nextGlobalFilter = effectiveGlobalFilter();
		const sortChanged = nextSorting !== announceState.sorting;
		const filterChanged = nextColumnFilters !== announceState.columnFilters || nextGlobalFilter !== announceState.globalFilter;
		announceState.sorting = nextSorting;
		announceState.columnFilters = nextColumnFilters;
		announceState.globalFilter = nextGlobalFilter;
		if (sortChanged) {
			const active = nextSorting && nextSorting.length ? nextSorting[0] : null;
			if (!active) return "Sorting cleared";
			const rawLabel = headerLabel(active.id);
			return "Sorted by " + (typeof rawLabel === "string" && rawLabel ? rawLabel : active.id) + ", " + (active.desc ? "descending" : "ascending");
		}
		if (filterChanged) return totalRowCount() + " results";
		return "";
	}
	const reFeed = (0, react.useCallback)(() => {
		if (!table.current) return;
		table.current.setOptions((prev) => ({
			...prev,
			data: currentData(),
			columns: tableColumns(),
			state: currentState(),
			enableRowSelection: props.selectionMode !== "none",
			enableMultiRowSelection: props.selectionMode === "multiple",
			rowCount: props.rowCount ?? void 0,
			pageCount: props.pageCount ?? void 0,
			getExpandedRowModel: (0, _tanstack_table_core.getExpandedRowModel)(),
			getSubRows: props.getSubRows || void 0,
			getRowCanExpand: props.expandable === true && props.getSubRows == null ? () => true : void 0,
			onExpandedChange: onExpandedChangeCb,
			autoResetExpanded: false,
			getGroupedRowModel: (0, _tanstack_table_core.getGroupedRowModel)(),
			onGroupingChange: onGroupingChangeCb,
			getFacetedRowModel: (0, _tanstack_table_core.getFacetedRowModel)(),
			getFacetedUniqueValues: (0, _tanstack_table_core.getFacetedUniqueValues)(),
			getFacetedMinMaxValues: (0, _tanstack_table_core.getFacetedMinMaxValues)(),
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
		if (refreshRowModel.current) refreshRowModel.current();
	}, [
		currentData,
		currentState,
		onColumnFiltersChangeCb,
		onColumnOrderChangeCb,
		onColumnPinningChangeCb,
		onColumnSizingChangeCb,
		onColumnSizingInfoChangeCb,
		onColumnVisibilityChangeCb,
		onExpandedChangeCb,
		onGlobalFilterChangeCb,
		onGroupingChangeCb,
		onPaginationChangeCb,
		onRowSelectionChangeCb,
		onSortingChangeCb,
		props.expandable,
		props.getSubRows,
		props.pageCount,
		props.rowCount,
		props.selectionMode,
		tableColumns
	]);
	const maybeClearHistoryOnExternalSwap = (0, react.useCallback)(() => {
		const pd = data;
		if (pd === lastPropsData.current) return;
		lastPropsData.current = pd;
		if (!props.undoable) return;
		if (pd != null && pd[DATA_WRITE_TOKEN_KEY] != null) return;
		clearHistory();
	}, [
		clearHistory,
		data,
		props.undoable
	]);
	const onHeaderSort = (0, react.useCallback)((colId, evt) => {
		if (!table.current) return;
		const col = table.current.getColumn(colId);
		if (!col || !col.getCanSort()) return;
		const multi = !!(evt && evt.shiftKey);
		col.toggleSorting(void 0, multi);
	}, []);
	function tick() {
		return rowModelVer;
	}
	function ariaSortFor(colId) {
		if (tick() < 0 || !table.current) return "none";
		const col = table.current.getColumn(colId);
		if (!col) return "none";
		const dir = col.getIsSorted();
		if (dir === "asc") return "ascending";
		if (dir === "desc") return "descending";
		return "none";
	}
	function sortIndicator(colId) {
		if (tick() < 0 || !table.current) return "";
		const col = table.current.getColumn(colId);
		if (!col) return "";
		const dir = col.getIsSorted();
		if (dir === "asc") return "▲";
		if (dir === "desc") return "▼";
		return "";
	}
	function defFor(colId) {
		if (colId == null) return null;
		const d = defIndex()[String(colId)];
		return d != null ? d : null;
	}
	function visibleCellsFor(row) {
		return rowModelVer >= 0 ? row.getVisibleCells() : [];
	}
	function editMetaOf(colId) {
		const d = defFor(colId);
		return d && d.meta ? d.meta : null;
	}
	function columnEditable(colId) {
		const m = editMetaOf(colId);
		return !!(m && m.editable === true);
	}
	function editorTypeOf(colId) {
		const m = editMetaOf(colId);
		return m && m.editor != null ? m.editor : "text";
	}
	function editorOptionsOf(colId) {
		const m = editMetaOf(colId);
		return m && m.editorOptions != null ? m.editorOptions : [];
	}
	function columnIsFilterable(colId) {
		const d = defFor(colId);
		return !!(d && d.filterable);
	}
	function headerLabel(colId) {
		const d = defFor(colId);
		return d ? d.header : colId;
	}
	function headerWidth(header) {
		if (tick() < 0 || !header || typeof header.getSize !== "function") return null;
		const w = header.getSize();
		return w != null && w > 0 ? w + "px" : null;
	}
	const onResizeStart = (0, react.useCallback)((colId, evt) => {
		if (evt && evt.stopPropagation) evt.stopPropagation();
		if (!table.current) return;
		const header = findHeader(colId);
		if (!header || !header.getResizeHandler) return;
		const handler = header.getResizeHandler();
		if (handler) handler(evt);
	}, [findHeader]);
	function findHeader(colId) {
		const groups = headerGroups || [];
		for (const hg of groups) {
			const hs = hg.headers || [];
			for (const h of hs) if (h && h.column && h.column.id === colId) return h;
		}
		return null;
	}
	function columnIsResizing(colId) {
		if (tick() < 0 || !table.current) return false;
		const header = findHeader(colId);
		return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
	}
	const onToggleVisibility = (0, react.useCallback)((colId) => {
		if (!table.current) return;
		const col = table.current.getColumn(colId);
		if (col && col.toggleVisibility) col.toggleVisibility();
	}, []);
	function allLeafColumns() {
		if (tick() < 0 || !table.current) return [];
		const cols = table.current.getAllLeafColumns ? table.current.getAllLeafColumns() : [];
		const out = [];
		for (const c of cols) {
			if (!c || c.id === SELECT_COL_ID || c.id === EXPANDER_COL_ID) continue;
			out.push({
				id: c.id,
				label: headerLabel(c.id),
				visible: !!(c.getIsVisible && c.getIsVisible())
			});
		}
		return out;
	}
	function columnPinSide(colId) {
		if (tick() < 0 || !table.current) return false;
		const col = table.current.getColumn(colId);
		if (!col || !col.getIsPinned) return false;
		return col.getIsPinned();
	}
	const onPinColumn = (0, react.useCallback)((colId, side, evt) => {
		if (evt && evt.stopPropagation) evt.stopPropagation();
		if (!table.current) return;
		const col = table.current.getColumn(colId);
		if (col && col.pin) col.pin(side);
	}, []);
	function pinStyle(colId, zIndex = 1) {
		if (tick() < 0 || !table.current) return "";
		const col = table.current.getColumn(colId);
		if (!col || !col.getIsPinned) return "";
		const side = col.getIsPinned();
		if (side === "left") return "position:sticky;left:" + (col.getStart ? col.getStart("left") : 0) + "px;z-index:" + zIndex + ";";
		if (side === "right") return "position:sticky;right:" + (col.getAfter ? col.getAfter("right") : 0) + "px;z-index:" + zIndex + ";";
		return "";
	}
	function thStyle(header, widthPx = null) {
		let s = "";
		const w = widthPx != null && widthPx > 0 ? widthPx + "px" : headerWidth(header);
		if (w) s += "width:" + w + ";";
		s += pinStyle(header && header.column ? header.column.id : null, 2);
		return s;
	}
	const onGlobalFilterInput = (0, react.useCallback)((evt) => {
		const value = evt && evt.target ? evt.target.value : "";
		if (table.current) {
			table.current.setGlobalFilter(value);
			return;
		}
		writeGlobalFilter(value);
	}, [writeGlobalFilter]);
	const onColumnFilterInput = (0, react.useCallback)((colId, evt) => {
		setColumnFilter(colId, evt && evt.target ? evt.target.value : "");
	}, [setColumnFilter]);
	function globalFilterValue() {
		const v = currentState().globalFilter;
		return v != null ? v : "";
	}
	function pageIndex() {
		if (tick() >= 0 && table.current) return table.current.getState().pagination.pageIndex;
		const p = currentState().pagination;
		return p && p.pageIndex != null ? p.pageIndex : 0;
	}
	function pageSize() {
		if (tick() >= 0 && table.current) return table.current.getState().pagination.pageSize;
		const p = currentState().pagination;
		return p && p.pageSize != null ? p.pageSize : 10;
	}
	function displayPageCount() {
		if (tick() < 0 || !table.current) return 1;
		const c = table.current.getPageCount();
		return c != null && c > 0 ? c : 1;
	}
	function canPrevPage() {
		return !!(tick() >= 0 && table.current && table.current.getCanPreviousPage());
	}
	function canNextPage() {
		return !!(tick() >= 0 && table.current && table.current.getCanNextPage());
	}
	const onPrevPage = (0, react.useCallback)(() => {
		if (table.current) table.current.previousPage();
	}, []);
	const onNextPage = (0, react.useCallback)(() => {
		if (table.current) table.current.nextPage();
	}, []);
	const onPageSizeChange = (0, react.useCallback)((evt) => {
		if (!table.current) return;
		const v = evt && evt.target ? evt.target.value : "";
		const n = parseInt(v, 10);
		table.current.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
	}, []);
	function isSelectColumn(colId) {
		return colId === SELECT_COL_ID;
	}
	function isExpanderColumn(colId) {
		return colId === EXPANDER_COL_ID;
	}
	function rowCanExpand(row) {
		return !!(tick() >= 0 && row && row.getCanExpand && row.getCanExpand() && !(row.getIsGrouped && row.getIsGrouped()));
	}
	function rowIsExpanded(row) {
		return !!(tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());
	}
	function rowShowsDetail(row) {
		return props.getSubRows == null && !rowIsGrouped(row) && rowIsExpanded(row);
	}
	const onToggleExpand = (0, react.useCallback)((row, evt) => {
		if (!row || !row.toggleExpanded) return;
		const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest("tr") : null;
		row.toggleExpanded();
		if (ownerRow && typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
			const btn = ownerRow.querySelector("[data-expander]");
			if (btn) btn.focus();
		});
	}, []);
	function bodyCellStyle(row, colId) {
		const base = pinStyle(colId);
		if (isExpanderColumn(colId) && row && row.depth) {
			const pad = "padding-left:" + (.5 + row.depth * 1.25) + "rem";
			return base ? base + pad : pad;
		}
		return base;
	}
	function rowIsGrouped(row) {
		return !!(tick() >= 0 && row && row.getIsGrouped && row.getIsGrouped());
	}
	function rowIndexIsGrouped(rowIndex) {
		return rowIsGrouped((rows || [])[rowIndex]);
	}
	function groupingActive() {
		return tick() >= 0 && (currentState().grouping || []).length > 0;
	}
	function cellIsGrouped(cellCtx) {
		return !!(tick() >= 0 && cellCtx && cellCtx.getIsGrouped && cellCtx.getIsGrouped());
	}
	function cellIsAggregated(cellCtx) {
		return !!(tick() >= 0 && cellCtx && cellCtx.getIsAggregated && cellCtx.getIsAggregated());
	}
	function cellIsPlaceholder(cellCtx) {
		return !!(tick() >= 0 && cellCtx && cellCtx.getIsPlaceholder && cellCtx.getIsPlaceholder());
	}
	function groupSubRowCount(row) {
		if (row && row.getLeafRows) {
			const leaves = row.getLeafRows();
			let n = 0;
			for (let i = 0; i < leaves.length; i++) {
				const r = leaves[i];
				if (!(r && r.getIsGrouped && r.getIsGrouped())) n = n + 1;
			}
			return n;
		}
		return row && row.subRows ? row.subRows.length : 0;
	}
	function groupRowDescriptor(row) {
		const ver = rowModelVer;
		if (!groupRowDescriptorCache.current || groupRowDescriptorCacheVer.current !== ver) {
			groupRowDescriptorCache.current = Object.create(null);
			groupRowDescriptorCacheVer.current = ver;
		}
		const key = String(row.id);
		let d = groupRowDescriptorCache.current[key];
		if (!d) {
			const groupingColumnId = row.groupingColumnId != null ? row.groupingColumnId : "";
			const groupingValue = row.getGroupingValue ? row.getGroupingValue(groupingColumnId) : row.groupingValue;
			d = {
				isGroupRow: true,
				groupId: row.id,
				groupingColumnId,
				groupingValue,
				leafCount: groupSubRowCount(row)
			};
			groupRowDescriptorCache.current[key] = d;
		}
		return d;
	}
	function cellSlotRow(row) {
		return rowIsGrouped(row) ? groupRowDescriptor(row) : row ? row.original : null;
	}
	function groupingKeys() {
		return currentState().grouping || [];
	}
	function groupableColumns() {
		const out = [];
		const defs = collectGroupableLeafDefs(columnDefs());
		for (const d of defs) out.push({
			id: d.id,
			label: d.header != null ? d.header : d.id
		});
		return out;
	}
	const stopEvent = (0, react.useCallback)((evt) => {
		if (evt && evt.stopPropagation) evt.stopPropagation();
	}, []);
	function isAllRowsSelected() {
		return !!(tick() >= 0 && table.current && table.current.getIsAllRowsSelected());
	}
	function isSomeRowsSelected() {
		return !!(tick() >= 0 && table.current && table.current.getIsSomeRowsSelected());
	}
	const onToggleAllRows = (0, react.useCallback)((evt) => {
		if (!table.current) return;
		table.current.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
	}, []);
	function rowIsSelected(row) {
		if (!row) return false;
		const id = row.id;
		const sel = currentState().rowSelection || {};
		if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
		return !!(row.getIsSelected && row.getIsSelected());
	}
	const onToggleRow = (0, react.useCallback)((row, evt) => {
		if (!row || !row.toggleSelected) return;
		row.toggleSelected(!!(evt && evt.target && evt.target.checked));
	}, []);
	const onHideColumn = (0, react.useCallback)((colId, evt) => {
		if (evt && evt.stopPropagation) evt.stopPropagation();
		if (!table.current) return;
		const col = table.current.getColumn(colId);
		if (col && col.toggleVisibility) col.toggleVisibility(false);
	}, []);
	function hasAnyFilterableColumn() {
		const cols = allLeafColumns();
		for (const c of cols) if (c && columnIsFilterable(c.id)) return true;
		return false;
	}
	const syncIndeterminate = (0, react.useCallback)(() => {
		if (!__rozieRoot.current || !__rozieRoot.current.querySelector) return;
		selectAllBox.current = __rozieRoot.current.querySelector(".rdt-select-all");
		if (selectAllBox.current) selectAllBox.current.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
	}, [isAllRowsSelected, isSomeRowsSelected]);
	function sortColumn(colId, desc) {
		if (table.current) table.current.getColumn(colId) && table.current.getColumn(colId).toggleSorting(desc, false);
	}
	function clearSorting() {
		if (table.current) table.current.resetSorting(true);
	}
	function getColumnDefs() {
		return columnDefs();
	}
	function toggleAllRows(value) {
		if (table.current) table.current.toggleAllRowsSelected(value);
	}
	function clearSelection() {
		if (table.current) table.current.resetRowSelection(true);
	}
	function getSelectedRows() {
		return table.current ? table.current.getSelectedRowModel().rows.map((r) => r.original) : [];
	}
	function setPage(idx) {
		if (table.current) table.current.setPageIndex(idx);
	}
	function setRowsPerPage(size) {
		if (table.current) table.current.setPageSize(size);
	}
	function toggleColumnVisibility(colId) {
		if (table.current) {
			const c = table.current.getColumn(colId);
			if (c && c.toggleVisibility) c.toggleVisibility();
		}
	}
	function applyColumnOrder(order) {
		if (table.current) table.current.setColumnOrder(order);
	}
	function resetColumnSizing() {
		if (table.current) table.current.resetColumnSizing(true);
	}
	function pinColumn(colId, side) {
		if (table.current) {
			const c = table.current.getColumn(colId);
			if (c && c.pin) c.pin(side);
		}
	}
	function getRowIndexRelativeToPage(absRow) {
		const abs = absRow == null ? toAbsRow(activeRow) : Math.trunc(Number(absRow)) || 0;
		if (rowsWindowed()) return abs;
		return abs - pageRowOffset();
	}
	function cut() {
		return cutRange();
	}
	const isGrid = (0, react.useCallback)(() => props.interactionMode === "grid", [props.interactionMode]);
	function tableRole() {
		return isGrid() ? "grid" : "table";
	}
	function cellRole() {
		return isGrid() ? "gridcell" : "cell";
	}
	function rowIndexOf(row) {
		return tick() >= 0 ? (rows || []).indexOf(row) : -1;
	}
	function colIndexOf(row, cellCtx) {
		return tick() >= 0 ? visibleCellsFor(row).indexOf(cellCtx) : -1;
	}
	function headerColIndexOf(hg, header) {
		return (hg && hg.headers ? hg.headers : []).indexOf(header);
	}
	function headerLeafStart(hg, header) {
		const list = hg && hg.headers ? hg.headers : [];
		let leaf = 0;
		for (let i = 0; i < list.length; i++) {
			if (list[i] === header) return leaf;
			const h = list[i];
			leaf = leaf + (h && h.colSpan > 1 ? h.colSpan : 1);
		}
		return -1;
	}
	function pageRowOffset() {
		if (!isGrid() || rowsWindowed()) return 0;
		return pageIndex() * pageSize();
	}
	function toAbsRow(localRow) {
		return localRow + pageRowOffset();
	}
	function prePaginationRowCount() {
		if (!table.current || rowsWindowed()) return bodyRowCount();
		const pm = table.current.getPrePaginationRowModel();
		return pm && pm.rows ? pm.rows.length : bodyRowCount();
	}
	function cellTabindex(rowKey, colIndex, level = null) {
		if (!isGrid()) return null;
		if (bodyRowCount() === 0) return rowKey === "__header" && colIndex === 0 && level === headerLeafLevel() ? 0 : -1;
		if (activeIsHeader) {
			if (rowKey !== "__header") return -1;
			return colIndex === activeColIndex && level === activeHeaderLevel ? 0 : -1;
		}
		return rowKey === String(activeRow) && colIndex === activeColIndex ? 0 : -1;
	}
	function isActiveCell(rowKey, colIndex, level = null) {
		if (!isGrid()) return false;
		if (activeIsHeader) {
			if (rowKey !== "__header") return false;
			return colIndex === activeColIndex && level === activeHeaderLevel;
		}
		if (rowKey === "__header") return false;
		return rowKey === String(activeRow) && colIndex === activeColIndex;
	}
	function resolveCellEl(rowKey, colIndex, level = null) {
		if (!gridRoot.current) return null;
		let sel = "[data-grid-cell][data-row=\"" + rowKey + "\"][data-col-index=\"" + colIndex + "\"]";
		if (rowKey === "__header" && level != null) sel = sel + "[data-header-level=\"" + level + "\"]";
		return gridRoot.current.querySelector(sel);
	}
	function focusActiveCell(nextRow = null, nextCol = null, nextIsHeader = null, nextLevel = null) {
		if (!isGrid() || !gridRoot.current) return;
		focusIntentEpoch.current = focusIntentEpoch.current + 1;
		const r = nextRow == null ? activeRow : nextRow;
		const c = nextCol == null ? activeColIndex : nextCol;
		const lvl = nextLevel == null ? activeHeaderLevel : nextLevel;
		const header = nextIsHeader == null ? activeIsHeader : nextIsHeader;
		const rowOut = rowsWindowed() && virtualizer.current && rowIsOutsideWindow(r);
		const colOut = colsWindowed() && colVirtualizer.current && colIsOutsideWindow(c);
		if (!header && (rowOut || colOut)) {
			if (rowOut) virtualizer.current.scrollToIndex(r, { align: "center" });
			if (colOut) colVirtualizer.current.scrollToIndex(c, { align: "center" });
			let focusAttempts = 0;
			const myEpoch = focusIntentEpoch.current;
			const focusWhenReady = () => {
				if (focusIntentEpoch.current !== myEpoch) return;
				const el = resolveCellEl(String(r), c);
				if (el) {
					el.focus();
					return;
				}
				focusAttempts = focusAttempts + 1;
				if (focusAttempts >= 30) return;
				if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusWhenReady);
				else setTimeout(focusWhenReady, 16);
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusWhenReady);
			else setTimeout(focusWhenReady, 0);
			return;
		}
		const el = resolveCellEl(header ? "__header" : String(r), c, header ? lvl : null);
		if (el) el.focus();
	}
	function totalRowCount() {
		if (!table.current) return (rows || []).length;
		if (props.manual === true) {
			if (props.rowCount != null) return props.rowCount;
			if (props.pageCount != null) return props.pageCount * pageSize();
		}
		const fm = table.current.getFilteredRowModel();
		return fm && fm.rows ? fm.rows.length : (rows || []).length;
	}
	function headerRowCount() {
		return (headerGroups || []).length;
	}
	function gridAriaRowCount() {
		return headerRowCount() + totalRowCount();
	}
	function ariaPageOffset() {
		return table.current ? pageIndex() * pageSize() : 0;
	}
	function bodyAriaRowIndex(row) {
		return headerRowCount() + rowIndexOf(row) + ariaPageOffset() + 1;
	}
	function gridAriaColCount() {
		return visibleColCount();
	}
	function visibleColCount() {
		const rowList = rows || [];
		if (rowList.length) return rowList[0].getVisibleCells().length;
		const hg = headerGroups || [];
		return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
	}
	function bodyRowCount() {
		return (rows || []).length;
	}
	function headerLeafLevel() {
		const hg = headerGroups || [];
		return hg.length ? hg.length - 1 : 0;
	}
	function headerCountAtLevel(level) {
		const hg = headerGroups || [];
		if (!hg.length) return visibleColCount();
		const grp = level >= 0 && level < hg.length ? hg[level] : null;
		if (!grp || !grp.headers) return visibleColCount();
		return grp.headers.length;
	}
	function headerAt(level, colIndex) {
		const grp = (headerGroups || [])[level];
		if (!grp || !grp.headers) return null;
		return grp.headers[colIndex] || null;
	}
	function parentHeaderColIndex(level, colIndex) {
		if (level <= 0) return -1;
		const h = headerAt(level, colIndex);
		if (!h || !h.column || !h.column.parent) return -1;
		const parentId = h.column.parent.id;
		const pg = (headerGroups || [])[level - 1];
		if (!pg || !pg.headers) return -1;
		for (let i = 0; i < pg.headers.length; i++) {
			const ph = pg.headers[i];
			if (ph && ph.column && ph.column.id === parentId) return i;
		}
		return -1;
	}
	function firstChildHeaderColIndex(level, colIndex) {
		const h = headerAt(level, colIndex);
		if (!h || !h.column) return -1;
		const kids = h.column.columns || [];
		if (!kids.length) return -1;
		const childId = kids[0].id;
		const cg = (headerGroups || [])[level + 1];
		if (!cg || !cg.headers) return -1;
		for (let i = 0; i < cg.headers.length; i++) {
			const ch = cg.headers[i];
			if (ch && ch.column && ch.column.id === childId) return i;
		}
		return -1;
	}
	function moveCol(delta) {
		const max = (activeIsHeader ? headerCountAtLevel(activeHeaderLevel) : visibleColCount()) - 1;
		const nextCol = clamp(activeColIndex + delta, 0, max < 0 ? 0 : max);
		setActiveColIndex(nextCol);
		return nextCol;
	}
	function moveRow(delta) {
		const lastRow = bodyRowCount() - 1;
		const maxRow = lastRow < 0 ? 0 : lastRow;
		const leafLevel = headerLeafLevel();
		if (activeIsHeader) {
			if (delta > 0) {
				if (activeHeaderLevel < leafLevel) {
					const childCol = firstChildHeaderColIndex(activeHeaderLevel, activeColIndex);
					if (childCol >= 0) {
						const nextLevel = activeHeaderLevel + 1;
						setActiveHeaderLevel(nextLevel);
						setActiveColIndex(childCol);
						return {
							row: activeRow,
							col: childCol,
							isHeader: true,
							level: nextLevel
						};
					}
				}
				if (bodyRowCount() === 0) return {
					row: activeRow,
					col: activeColIndex,
					isHeader: true,
					level: activeHeaderLevel
				};
				const landRow = clamp(delta - 1, 0, maxRow);
				setActiveIsHeader(false);
				setActiveRow(landRow);
				return {
					row: landRow,
					col: activeColIndex,
					isHeader: false,
					level: 0
				};
			}
			const parentCol = parentHeaderColIndex(activeHeaderLevel, activeColIndex);
			if (parentCol >= 0) {
				const nextLevel = activeHeaderLevel - 1;
				setActiveHeaderLevel(nextLevel);
				setActiveColIndex(parentCol);
				return {
					row: activeRow,
					col: parentCol,
					isHeader: true,
					level: nextLevel
				};
			}
			return {
				row: activeRow,
				col: activeColIndex,
				isHeader: true,
				level: activeHeaderLevel
			};
		}
		if (delta < 0 && activeRow === 0) {
			setActiveIsHeader(true);
			setActiveHeaderLevel(leafLevel);
			return {
				row: activeRow,
				col: activeColIndex,
				isHeader: true,
				level: leafLevel
			};
		}
		const nextRow = clamp(activeRow + delta, 0, maxRow);
		setActiveRow(nextRow);
		setActiveIsHeader(false);
		return {
			row: nextRow,
			col: activeColIndex,
			isHeader: false,
			level: 0
		};
	}
	function gotoColEdge(toEnd) {
		const max = (activeIsHeader ? headerCountAtLevel(activeHeaderLevel) : visibleColCount()) - 1;
		const nextCol = toEnd ? max < 0 ? 0 : max : 0;
		setActiveColIndex(nextCol);
		return nextCol;
	}
	function gotoRowEdge(toEnd) {
		const lastRow = bodyRowCount() - 1;
		const nextRow = toEnd ? lastRow < 0 ? 0 : lastRow : 0;
		setActiveRow(nextRow);
		setActiveIsHeader(false);
		return nextRow;
	}
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
	function currentCellEl() {
		return resolveCellEl(activeIsHeader ? "__header" : String(activeRow), activeColIndex, activeIsHeader ? activeHeaderLevel : null);
	}
	function enterControl() {
		const list = focusables(currentCellEl());
		if (!list.length) return;
		setActiveInControl(true);
		list[0].focus();
	}
	function cycleWithinCell(cellEl, forward) {
		const list = focusables(cellEl);
		if (!list.length) return;
		const active = gridRoot.current ? gridRoot.current.getRootNode().activeElement : null;
		const cur = list.indexOf(active);
		let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
		if (i >= list.length) i = 0;
		if (i < 0) i = list.length - 1;
		list[i].focus();
	}
	const { onActivecellChange: _rozieProp_onActivecellChange } = props;
	const onGridKeyDown = (0, react.useCallback)((e) => {
		if (!isGrid() || !e) return;
		const key = e.key;
		if (editingRow >= 0) return;
		if (editingRowIndex != null) return;
		if (activeInControl) {
			if (key === "Escape") {
				e.preventDefault();
				setActiveInControl(false);
				focusActiveCell(activeRow, activeColIndex);
			} else if (key === "Tab") {
				e.preventDefault();
				cycleWithinCell(currentCellEl(), !e.shiftKey);
			}
			return;
		}
		const tgt = e.target;
		if (!tgt || !tgt.hasAttribute || !tgt.hasAttribute("data-grid-cell")) return;
		const prevRow = activeRow;
		const prevCol = activeColIndex;
		const prevIsHeader = activeIsHeader;
		const prevLevel = activeHeaderLevel;
		let nextRow = prevRow;
		let nextCol = prevCol;
		let nextIsHeader = prevIsHeader;
		let nextLevel = prevLevel;
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && !activeIsHeader && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
			e.preventDefault();
			if (key === "ArrowUp") extendRange(-activeRow, 0);
			else if (key === "ArrowDown") extendRange(bodyRowCount() - 1 - activeRow, 0);
			else if (key === "ArrowLeft") extendRange(0, -activeColIndex);
			else extendRange(0, visibleColCount() - 1 - activeColIndex);
			return;
		} else if ((e.ctrlKey || e.metaKey) && !activeIsHeader && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
			e.preventDefault();
			clearRange();
			if (key === "ArrowUp") {
				nextRow = gotoRowEdge(false);
				nextIsHeader = false;
			} else if (key === "ArrowDown") {
				nextRow = gotoRowEdge(true);
				nextIsHeader = false;
			} else if (key === "ArrowLeft") nextCol = gotoColEdge(false);
			else nextCol = gotoColEdge(true);
		} else if (key === "ArrowRight" && e.shiftKey && !activeIsHeader) {
			e.preventDefault();
			extendRange(0, 1);
			return;
		} else if (key === "ArrowLeft" && e.shiftKey && !activeIsHeader) {
			e.preventDefault();
			extendRange(0, -1);
			return;
		} else if (key === "ArrowDown" && e.shiftKey && !activeIsHeader) {
			e.preventDefault();
			extendRange(1, 0);
			return;
		} else if (key === "ArrowUp" && e.shiftKey && !activeIsHeader) {
			e.preventDefault();
			extendRange(-1, 0);
			return;
		} else if (key === "ArrowRight") {
			e.preventDefault();
			clearRange();
			nextCol = moveCol(1);
		} else if (key === "ArrowLeft") {
			e.preventDefault();
			clearRange();
			nextCol = moveCol(-1);
		} else if (key === "ArrowDown") {
			e.preventDefault();
			clearRange();
			const m = moveRow(1);
			nextRow = m.row;
			nextCol = m.col;
			nextIsHeader = m.isHeader;
			nextLevel = m.level;
		} else if (key === "ArrowUp") {
			e.preventDefault();
			clearRange();
			const m = moveRow(-1);
			nextRow = m.row;
			nextCol = m.col;
			nextIsHeader = m.isHeader;
			nextLevel = m.level;
		} else if (key === "PageDown") {
			e.preventDefault();
			const m = moveRow(GRID_PAGE_STEP);
			nextRow = m.row;
			nextCol = m.col;
			nextIsHeader = m.isHeader;
			nextLevel = m.level;
		} else if (key === "PageUp") {
			e.preventDefault();
			const m = moveRow(-GRID_PAGE_STEP);
			nextRow = m.row;
			nextCol = m.col;
			nextIsHeader = m.isHeader;
			nextLevel = m.level;
		} else if (key === "Home") {
			e.preventDefault();
			if (e.ctrlKey || e.metaKey) {
				const s = gotoStart();
				nextRow = s.row;
				nextCol = s.col;
				nextIsHeader = false;
			} else nextCol = gotoColEdge(false);
		} else if (key === "End") {
			e.preventDefault();
			if (e.ctrlKey || e.metaKey) {
				const en = gotoEnd();
				nextRow = en.row;
				nextCol = en.col;
				nextIsHeader = false;
			} else nextCol = gotoColEdge(true);
		} else if ((key === "c" || key === "C") && (e.ctrlKey || e.metaKey) && clipboardActiveAllowed() && clipboardWriteAvailable()) {
			e.preventDefault();
			copyRange();
			return;
		} else if ((key === "v" || key === "V") && (e.ctrlKey || e.metaKey) && clipboardActiveAllowed() && clipboardReadAvailable()) {
			e.preventDefault();
			pasteRange();
			return;
		} else if ((key === "x" || key === "X") && (e.ctrlKey || e.metaKey) && clipboardActiveAllowed() && clipboardWriteAvailable()) {
			e.preventDefault();
			cutRange();
			return;
		} else if ((key === "z" || key === "Z") && (e.ctrlKey || e.metaKey) && e.shiftKey) {
			if (props.undoable) {
				e.preventDefault();
				redo();
				return;
			}
		} else if ((key === "y" || key === "Y") && (e.ctrlKey || e.metaKey)) {
			if (props.undoable) {
				e.preventDefault();
				redo();
				return;
			}
		} else if ((key === "z" || key === "Z") && (e.ctrlKey || e.metaKey)) {
			if (props.undoable) {
				e.preventDefault();
				undo();
				return;
			}
		} else if ((key === "Delete" || key === "Backspace") && clipboardActiveAllowed()) {
			e.preventDefault();
			clearActiveRange();
			return;
		} else if ((key === "a" || key === "A") && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			if (!activeIsHeader) selectAllBody();
			return;
		} else if (key === "F2" && e.shiftKey && isActiveCellEditable()) {
			e.preventDefault();
			beginRowEdit((rows || [])[activeRow]);
			return;
		} else if ((key === "Enter" || key === "F2" || key === " ") && isActiveCellEditable() && editorTypeOf(activeCellColumnId()) === "checkbox") {
			e.preventDefault();
			toggleActiveBooleanCell();
			return;
		} else if ((key === "Enter" || key === "F2") && isActiveCellEditable()) {
			e.preventDefault();
			beginEdit(activeRow, activeColIndex, null);
			return;
		} else if (isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && editorTypeOf(activeCellColumnId()) !== "checkbox") {
			e.preventDefault();
			const editType = editorTypeOf(activeCellColumnId());
			beginEdit(activeRow, activeColIndex, editType === "text" || editType === "number" ? key : null);
			return;
		} else if (key === "Enter" && !activeIsHeader && rowIsGrouped((rows || [])[activeRow])) {
			e.preventDefault();
			const grpRow = activeRow;
			const grpCol = activeColIndex;
			onToggleExpand((rows || [])[activeRow], e);
			recoverGridFocus(String(grpRow), grpCol, null, true);
			return;
		} else if (key === "Enter" || key === "F2") {
			e.preventDefault();
			enterControl();
			return;
		} else return;
		focusActiveCell(nextRow, nextCol, nextIsHeader, nextLevel);
		if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader || nextLevel !== prevLevel) _rozieProp_onActivecellChange && _rozieProp_onActivecellChange(nextIsHeader ? {
			rowIndex: null,
			colIndex: nextCol,
			isHeader: true
		} : {
			rowIndex: toAbsRow(nextRow),
			colIndex: nextCol,
			isHeader: false
		});
	}, [
		_rozieProp_onActivecellChange,
		activeCellColumnId,
		activeColIndex,
		activeHeaderLevel,
		activeInControl,
		activeIsHeader,
		activeRow,
		beginEdit,
		beginRowEdit,
		bodyRowCount,
		clearActiveRange,
		clearRange,
		clipboardActiveAllowed,
		clipboardReadAvailable,
		clipboardWriteAvailable,
		copyRange,
		currentCellEl,
		cutRange,
		cycleWithinCell,
		editingRow,
		editingRowIndex,
		editorTypeOf,
		enterControl,
		extendRange,
		focusActiveCell,
		gotoColEdge,
		gotoEnd,
		gotoRowEdge,
		gotoStart,
		isActiveCellEditable,
		isGrid,
		moveCol,
		moveRow,
		onToggleExpand,
		pasteRange,
		props.undoable,
		recoverGridFocus,
		redo,
		rowIsGrouped,
		rows,
		selectAllBody,
		toAbsRow,
		toggleActiveBooleanCell,
		undo,
		visibleColCount
	]);
	const syncActiveFromEvent = (0, react.useCallback)((e) => {
		if (!isGrid() || !e) return;
		const tgt = e.target;
		if (!tgt || !tgt.closest) return;
		const cellEl = tgt.closest("[data-grid-cell]");
		if (!cellEl) return;
		const rowAttr = cellEl.getAttribute("data-row");
		const colAttr = cellEl.getAttribute("data-col-index");
		if (rowAttr == null || colAttr == null) return;
		const col = parseInt(colAttr, 10);
		if (!Number.isFinite(col)) return;
		const prevIsHeader = activeIsHeader;
		const prevRow = activeRow;
		const prevCol = activeColIndex;
		const prevLevel = activeHeaderLevel;
		const isHeader = rowAttr === "__header";
		setActiveIsHeader(isHeader);
		let movedRow = prevRow;
		let movedLevel = prevLevel;
		if (isHeader) {
			const lvlAttr = cellEl.getAttribute("data-header-level");
			const lvl = lvlAttr != null ? parseInt(lvlAttr, 10) : headerLeafLevel();
			movedLevel = Number.isFinite(lvl) ? lvl : headerLeafLevel();
			setActiveHeaderLevel(movedLevel);
		} else {
			const row = parseInt(rowAttr, 10);
			if (Number.isFinite(row)) {
				movedRow = row;
				setActiveRow(row);
			}
		}
		setActiveColIndex(col);
		if (isHeader !== prevIsHeader || col !== prevCol || (isHeader ? movedLevel !== prevLevel : movedRow !== prevRow)) focusIntentEpoch.current = focusIntentEpoch.current + 1;
		if (rangeTransition.current) rangeTransition.current = false;
		else if (rangeClickPending.current && rangeClickPending.current.isHeader === isHeader && rangeClickPending.current.r === movedRow && rangeClickPending.current.c === col) rangeClickPending.current = null;
		else {
			rangeClickPending.current = null;
			clearRange();
		}
		if (tgt === cellEl) setActiveInControl(false);
	}, [
		activeColIndex,
		activeHeaderLevel,
		activeIsHeader,
		activeRow,
		clearRange,
		headerLeafLevel,
		isGrid
	]);
	const onGridMouseDown = (0, react.useCallback)((e) => {
		if (!isGrid() || !e) return;
		const tgt = e.target;
		if (!tgt || !tgt.closest) return;
		if (!e.shiftKey && tgt.closest("[data-fill-handle]")) return;
		const cellEl = tgt.closest("[data-grid-cell]");
		if (!cellEl) return;
		const rowAttr = cellEl.getAttribute("data-row");
		const colAttr = cellEl.getAttribute("data-col-index");
		if (rowAttr == null || colAttr == null || rowAttr === "__header") return;
		const row = parseInt(rowAttr, 10);
		const col = parseInt(colAttr, 10);
		if (!Number.isFinite(row) || !Number.isFinite(col)) return;
		if (e.shiftKey) {
			setRangeFocus$local(row, col);
			setActiveIsHeader(false);
			setActiveRow(row);
			setActiveColIndex(col);
			rangeClickPending.current = {
				isHeader: false,
				r: row,
				c: col
			};
			return;
		}
		if (isEditing(row, col)) return;
		beginRangeDrag(row, col);
	}, [
		beginRangeDrag,
		isEditing,
		isGrid,
		setRangeFocus$local
	]);
	const onGridDblClick = (0, react.useCallback)((e) => {
		if (!isGrid() || !e) return;
		const tgt = e.target;
		if (!tgt || !tgt.closest) return;
		const cellEl = tgt.closest("[data-grid-cell]");
		if (!cellEl) return;
		const rowAttr = cellEl.getAttribute("data-row");
		const colAttr = cellEl.getAttribute("data-col-index");
		if (rowAttr == null || colAttr == null || rowAttr === "__header") return;
		const row = parseInt(rowAttr, 10);
		const col = parseInt(colAttr, 10);
		if (!Number.isFinite(row) || !Number.isFinite(col)) return;
		const rowObj = (rows || [])[row];
		if (rowIsGrouped(rowObj)) {
			e.preventDefault();
			onToggleExpand(rowObj, e);
			recoverGridFocus(String(row), col, null, true);
			return;
		}
		const colId = columnIdAt(row, col);
		if (colId != null && columnEditable(colId)) {
			e.preventDefault();
			beginEdit(row, col, null);
		}
	}, [
		beginEdit,
		columnEditable,
		columnIdAt,
		isGrid,
		onToggleExpand,
		recoverGridFocus,
		rowIsGrouped,
		rows
	]);
	const onGridClick = (0, react.useCallback)((e) => {
		if (!isGrid() || !e) return;
		if (!props.singleClickEdit) return;
		if (e.shiftKey) return;
		if (rangeDragMoved.current) {
			rangeDragMoved.current = false;
			return;
		}
		const tgt = e.target;
		if (!tgt || !tgt.closest) return;
		const cellEl = tgt.closest("[data-grid-cell]");
		if (!cellEl) return;
		const rowAttr = cellEl.getAttribute("data-row");
		const colAttr = cellEl.getAttribute("data-col-index");
		if (rowAttr == null || colAttr == null || rowAttr === "__header") return;
		const row = parseInt(rowAttr, 10);
		const col = parseInt(colAttr, 10);
		if (!Number.isFinite(row) || !Number.isFinite(col)) return;
		if (editingRow === row && editingCol === col) return;
		const colId = columnIdAt(row, col);
		if (colId != null && columnEditable(colId)) beginEdit(row, col, null);
	}, [
		beginEdit,
		columnEditable,
		columnIdAt,
		editingCol,
		editingRow,
		isGrid,
		props.singleClickEdit
	]);
	const onGridFocusOut = (0, react.useCallback)((e) => {
		if (!isGrid() || !activeInControl) return;
		const next = e ? e.relatedTarget : null;
		const cellEl = currentCellEl();
		if (!cellEl || !next || !cellEl.contains(next)) setActiveInControl(false);
	}, [
		activeInControl,
		currentCellEl,
		isGrid
	]);
	function recoverGridFocus(rowKey, col, level, guardMoved = false) {
		if (!gridRoot.current) return;
		let attempts = 0;
		const tryFocus = () => {
			if (guardMoved) {
				const ae = gridRoot.current && gridRoot.current.getRootNode ? gridRoot.current.getRootNode().activeElement : null;
				const aeCell = ae && ae.closest ? ae.closest("[data-grid-cell]") : null;
				if (aeCell && gridRoot.current.contains(aeCell)) {
					const aeRow = aeCell.getAttribute("data-row");
					if (aeRow != null && aeRow !== rowKey) return;
				}
			}
			const el = resolveCellEl(rowKey, col, level);
			if (el) {
				el.focus();
				return;
			}
			attempts = attempts + 1;
			if (attempts >= 30) return;
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
			else setTimeout(tryFocus, 16);
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
		else setTimeout(tryFocus, 0);
	}
	const clampActiveCell = (0, react.useCallback)((rowCount, colCount) => {
		if (!isGrid()) return;
		const colN = colCount != null ? colCount : visibleColCount();
		const rowN = rowCount != null ? rowCount : bodyRowCount();
		let recoverFocus = false;
		let doomedRow = -1;
		let doomedCol = 0;
		if (gridRoot.current) {
			const rootNode = gridRoot.current.getRootNode ? gridRoot.current.getRootNode() : null;
			const focusedEl = rootNode ? rootNode.activeElement : null;
			const focusedCell = focusedEl && focusedEl.closest ? focusedEl.closest("[data-grid-cell]") : null;
			if (focusedCell && gridRoot.current.contains(focusedCell)) {
				const fRowAttr = focusedCell.getAttribute("data-row");
				const fColAttr = focusedCell.getAttribute("data-col-index");
				if (fRowAttr != null && fRowAttr !== "__header") {
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
		const col = clamp(activeColIndex, 0, maxCol < 0 ? 0 : maxCol);
		if (col !== activeColIndex) setActiveColIndex(col);
		if (rowN <= 0) {
			setActiveIsHeader(true);
			setActiveHeaderLevel(headerLeafLevel());
			setActiveColIndex(0);
			gridEmptyFallback.current = true;
			clampRange(rowN - 1, colN - 1);
			return;
		}
		if (gridEmptyFallback.current) {
			gridEmptyFallback.current = false;
			setActiveIsHeader(false);
			setActiveRow(0);
		}
		if (!activeIsHeader) {
			const lastRow = rowN - 1;
			const row = clamp(activeRow, 0, lastRow < 0 ? 0 : lastRow);
			if (row !== activeRow) setActiveRow(row);
		}
		clampRange(rowN - 1, colN - 1);
		if (recoverFocus) {
			const recRow = clamp(doomedRow, 0, rowN - 1);
			const recCol = clamp(doomedCol, 0, maxCol < 0 ? 0 : maxCol);
			recoverGridFocus(String(recRow), recCol, null);
		}
	}, [
		activeColIndex,
		activeIsHeader,
		activeRow,
		bodyRowCount,
		clampRange,
		headerLeafLevel,
		isGrid,
		recoverGridFocus,
		visibleColCount
	]);
	function windowedHeadersFor(hg, hgLevel) {
		const headers = hg && hg.headers || [];
		if (!colsWindowed()) return headers.map((h) => ({
			header: h,
			span: h && h.colSpan > 1 ? h.colSpan : 1,
			width: null
		}));
		const idx = windowedColIndices();
		const idxSet = {};
		for (let i = 0; i < idx.length; i++) idxSet[idx[i]] = true;
		let cursor = 0;
		const out = [];
		for (let i = 0; i < headers.length; i++) {
			const h = headers[i];
			const leafCount = h && h.colSpan ? h.colSpan : 1;
			const start = cursor;
			const end = cursor + leafCount;
			cursor = end;
			let span = 0;
			let width = 0;
			for (let c = start; c < end; c++) if (idxSet[c]) {
				span = span + 1;
				width = width + columnSize(c);
			}
			if (span > 0) out.push({
				header: h,
				span,
				width
			});
		}
		return out;
	}
	function windowedColSpan() {
		return colsWindowed() ? windowedColIndices().length + 2 : visibleColCount();
	}
	const remeasureColumnSizes = (0, react.useCallback)(() => {
		if (!colsWindowed() || !colVirtualizer.current || !colVirtualizer.current.measure) return;
		const n = columnCount();
		let sig = n;
		for (let i = 0; i < n; i++) sig = Math.imul(sig, 31) + columnSize(i) | 0;
		if (sig === lastColSizeSig.current) return;
		lastColSizeSig.current = sig;
		colVirtualizer.current.measure();
	}, [
		colsWindowed,
		columnCount,
		columnSize
	]);
	const remeasureColumnWindow = (0, react.useCallback)(() => {
		if (!colsWindowed() || !colVirtualizer.current) return;
		colVirtualizer.current.setOptions(columnVirtualizerOptions());
		remeasureColumnSizes();
		colVirtualizer.current._willUpdate();
	}, [
		colsWindowed,
		columnVirtualizerOptions,
		remeasureColumnSizes
	]);
	function inRange(rIdx, cIdx) {
		const a = rangeAnchor;
		const f = rangeFocus;
		if (!a || !f) return false;
		const r0 = a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex;
		const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
		const c0 = a.colIndex < f.colIndex ? a.colIndex : f.colIndex;
		const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
		return rIdx >= r0 && rIdx <= r1 && cIdx >= c0 && cIdx <= c1;
	}
	function getSelectedRange() {
		const a = rangeAnchor;
		const f = rangeFocus;
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
		const clampCorner = (c) => c == null ? null : {
			rowIndex: clamp(c.rowIndex, 0, maxRow),
			colIndex: clamp(c.colIndex, 0, maxCol)
		};
		return {
			anchor: clampCorner(a),
			focus: clampCorner(f)
		};
	}
	function isFillHandleCell(rIdx, cIdx) {
		const a = rangeAnchor;
		const f = rangeFocus;
		if (!a || !f) return false;
		const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
		const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
		return rIdx === r1 && cIdx === c1;
	}
	function rangeSummary(anchor, focus) {
		if (!anchor || !focus) return "";
		const rows = Math.abs(focus.rowIndex - anchor.rowIndex) + 1;
		const cols = Math.abs(focus.colIndex - anchor.colIndex) + 1;
		if (rows === 1 && cols === 1) return "1 cell selected";
		const rowPart = rows + (rows === 1 ? " row" : " rows");
		const colPart = cols + (cols === 1 ? " column" : " columns");
		return rowPart + " by " + colPart + " selected, " + rows * cols + " cells";
	}
	function emitRangeChange(anchor, focus) {
		setRangeAnnounce(rangeSummary(anchor, focus));
		props.onRangeChange && props.onRangeChange({
			anchor,
			focus
		});
	}
	function extendRange(dRow, dCol) {
		if (activeIsHeader) return;
		const maxRow = bodyRowCount() - 1;
		const maxCol = visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) return;
		let anchor = rangeAnchor;
		let focus = rangeFocus;
		const hadRange = !!(anchor && focus);
		if (!anchor || !focus) {
			anchor = {
				rowIndex: activeRow,
				colIndex: activeColIndex
			};
			focus = {
				rowIndex: activeRow,
				colIndex: activeColIndex
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
		rangeActive.current = true;
		setActiveRow(nextRow);
		setActiveColIndex(nextCol);
		rangeTransition.current = true;
		focusActiveCell(nextRow, nextCol, false);
		if (!hadRange || nextRow !== focus.rowIndex || nextCol !== focus.colIndex) emitRangeChange(anchor, nextFocus);
	}
	function setRangeFocus$local(rIdx, cIdx, anchorR = null, anchorC = null) {
		const maxRow = bodyRowCount() - 1;
		const maxCol = visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) return;
		let anchor = rangeAnchor;
		if (!anchor && anchorR != null && anchorC != null) anchor = {
			rowIndex: clamp(Math.trunc(Number(anchorR)) || 0, 0, maxRow),
			colIndex: clamp(Math.trunc(Number(anchorC)) || 0, 0, maxCol)
		};
		if (!anchor) anchor = {
			rowIndex: activeRow,
			colIndex: activeColIndex
		};
		const nextFocus = {
			rowIndex: clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow),
			colIndex: clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol)
		};
		setRangeAnchor(anchor);
		setRangeFocus(nextFocus);
		rangeActive.current = true;
		emitRangeChange(anchor, nextFocus);
	}
	function selectAllBody() {
		const maxRow = bodyRowCount() - 1;
		const maxCol = visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) return;
		const anchor = {
			rowIndex: 0,
			colIndex: 0
		};
		const focus = {
			rowIndex: maxRow,
			colIndex: maxCol
		};
		setRangeAnchor(anchor);
		setRangeFocus(focus);
		rangeActive.current = true;
		emitRangeChange(anchor, focus);
	}
	function clearRange() {
		if (!rangeActive.current) return;
		rangeActive.current = false;
		setRangeAnchor(null);
		setRangeFocus(null);
		emitRangeChange(null, null);
	}
	function clampRange(maxRowArg, maxColArg) {
		const a = rangeAnchor;
		const f = rangeFocus;
		if (!a && !f) return;
		const maxRow = maxRowArg != null ? maxRowArg : bodyRowCount() - 1;
		const maxCol = maxColArg != null ? maxColArg : visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) {
			setRangeAnchor(null);
			setRangeFocus(null);
			rangeActive.current = false;
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
	function announce(msg) {
		setPasteAnnounce(msg != null ? msg : "");
	}
	function clipboardActiveAllowed() {
		return !activeIsHeader;
	}
	function fieldOfColId(colId) {
		const d = defFor(colId);
		return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
	}
	function normalizedRange() {
		const a = rangeAnchor;
		const f = rangeFocus;
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
	function rangeToTsv() {
		const box = normalizedRange();
		const r0 = box ? box.r0 : activeRow;
		const r1 = box ? box.r1 : activeRow;
		const c0 = box ? box.c0 : activeColIndex;
		const c1 = box ? box.c1 : activeColIndex;
		const lines = [];
		for (let r = r0; r <= r1; r++) {
			const cells = [];
			for (let c = c0; c <= c1; c++) {
				const v = cellValueAt(r, c);
				cells.push(escapeTsvField(v == null ? "" : String(v)));
			}
			lines.push(cells.join("	"));
		}
		return lines.join("\n");
	}
	function clipboardWriteAvailable() {
		return typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.writeText === "function";
	}
	function clipboardReadAvailable() {
		return typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.readText === "function";
	}
	function copyRange() {
		if (!clipboardActiveAllowed()) return;
		if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.writeText) return;
		try {
			const p = navigator.clipboard.writeText(rangeToTsv());
			if (p && p.catch) p.catch(() => {});
		} catch (err) {}
	}
	function applyGridToRange(grid, originRow, originCol, verb) {
		const opVerb = typeof verb === "string" && verb !== "" ? verb : "pasted";
		const maxRow = bodyRowCount() - 1;
		const maxCol = visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) return {
			wrote: 0,
			changed: 0,
			total: 0
		};
		let total = 0;
		let applied = 0;
		const committed = [];
		let next = currentData();
		for (let gr = 0; gr < grid.length; gr++) {
			const r = originRow + gr;
			if (r > maxRow) break;
			const rowGrouped = rowIndexIsGrouped(r);
			const cols = grid[gr] || [];
			for (let gc = 0; gc < cols.length; gc++) {
				const c = originCol + gc;
				if (c > maxCol) break;
				total = total + 1;
				if (rowGrouped) continue;
				const colId = columnIdAt(r, c);
				if (colId == null || !columnEditable(colId)) continue;
				const rowObj = rowOriginalAt(r);
				const value = coerceCellValue(colId, cols[gc]);
				if (runValidator(colId, value, rowObj) !== true) continue;
				const field = fieldOfColId(colId);
				const srcIndex = sourceIndexOfRow(r);
				const oldValue = rowObj ? rowObj[field] : null;
				applied = applied + 1;
				if (oldValue === value) continue;
				next = replaceRowValue(next, srcIndex, field, value);
				committed.push({
					rowId: rowIdAt(r),
					columnId: colId,
					oldValue,
					newValue: value
				});
			}
		}
		if (committed.length > 0) {
			editTransition.current = true;
			writeData(next);
			editTransition.current = false;
			for (let i = 0; i < committed.length; i++) try {
				props.onCellEditCommit && props.onCellEditCommit(committed[i]);
			} catch (err) {
				console.error("[rozie-data-table] paste failed partway: a cell-edit-commit listener threw. The model was already written; the remaining cells still notify.", err);
			}
		}
		if (applied > 0) announce(applied + " of " + total + " cells " + opVerb);
		else if (total > 0) announce("No cells " + opVerb + " — " + total + " cells were invalid or read-only");
		return {
			wrote: applied,
			changed: committed.length,
			total
		};
	}
	function rowOriginalAt(rowIndex) {
		const row = (rows || [])[rowIndex];
		return row ? row.original : null;
	}
	function rowIdAt(rowIndex) {
		const row = (rows || [])[rowIndex];
		return row ? row.id : null;
	}
	function pasteRange() {
		if (!clipboardActiveAllowed()) return;
		if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.readText) return;
		const box = normalizedRange();
		const anchorRow = box ? box.r0 : activeRow;
		const anchorCol = box ? box.c0 : activeColIndex;
		const destBox = box || {
			r0: anchorRow,
			r1: anchorRow,
			c0: anchorCol,
			c1: anchorCol
		};
		let p = null;
		try {
			p = navigator.clipboard.readText();
		} catch (err) {
			return;
		}
		if (!p || !p.then) return;
		p.then((text) => {
			try {
				const grid = parseTsv(text);
				if (!grid.length) return;
				applyGridToRange(tileGridToBox(grid, destBox), anchorRow, anchorCol, "pasted");
			} catch (err) {
				console.error("[rozie-data-table] paste failed: a row accessor, the data model setter or other consumer code threw. The paste was abandoned.", err);
			}
		}, () => {});
	}
	function cutRange() {
		if (!clipboardActiveAllowed()) return;
		const box = normalizedRange();
		const r0 = box ? box.r0 : activeRow;
		const r1 = box ? box.r1 : activeRow;
		const c0 = box ? box.c0 : activeColIndex;
		const c1 = box ? box.c1 : activeColIndex;
		if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) try {
			const cp = navigator.clipboard.writeText(rangeToTsv());
			if (cp && cp.catch) cp.catch(() => {});
		} catch (err) {}
		const grid = [];
		for (let r = r0; r <= r1; r++) {
			const cols = [];
			for (let c = c0; c <= c1; c++) cols.push("");
			grid.push(cols);
		}
		applyGridToRange(grid, r0, c0, "cut");
	}
	function clearActiveRange() {
		if (!clipboardActiveAllowed()) return;
		const box = normalizedRange();
		const r0 = box ? box.r0 : activeRow;
		const r1 = box ? box.r1 : activeRow;
		const c0 = box ? box.c0 : activeColIndex;
		const c1 = box ? box.c1 : activeColIndex;
		const grid = [];
		for (let r = r0; r <= r1; r++) {
			const cols = [];
			for (let c = c0; c <= c1; c++) cols.push("");
			grid.push(cols);
		}
		applyGridToRange(grid, r0, c0, "cleared");
	}
	function fillRange(sourceBox, endCell) {
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
		} else box = normalizedRange();
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
				const v = cellValueAt(tileIndex(r, src.r0, src.r1), tileIndex(c, src.c0, src.c1));
				cols.push(v == null ? "" : String(v));
			}
			grid.push(cols);
		}
		applyGridToRange(grid, box.r0, box.c0, "filled");
	}
	const FILL_EDGE_SCROLL_PX = (0, react.useMemo)(() => 24, []);
	const FILL_EDGE_SCROLL_STEP = (0, react.useMemo)(() => 16, []);
	function edgeDelta(clientX, clientY) {
		if (!gridScrollEl.current) return {
			dx: 0,
			dy: 0
		};
		const rect = gridScrollEl.current.getBoundingClientRect();
		let dx = 0;
		let dy = 0;
		if (colsWindowed()) {
			if (clientX - rect.left < FILL_EDGE_SCROLL_PX) dx = -FILL_EDGE_SCROLL_STEP;
			else if (rect.right - clientX < FILL_EDGE_SCROLL_PX) dx = FILL_EDGE_SCROLL_STEP;
		}
		if (rowsWindowed()) {
			if (clientY - rect.top < FILL_EDGE_SCROLL_PX) dy = -FILL_EDGE_SCROLL_STEP;
			else if (rect.bottom - clientY < FILL_EDGE_SCROLL_PX) dy = FILL_EDGE_SCROLL_STEP;
		}
		return {
			dx,
			dy
		};
	}
	const teardownFillDrag = (0, react.useCallback)(() => {
		if (typeof document !== "undefined") {
			if (fillDragMove.current) document.removeEventListener("pointermove", fillDragMove.current);
			if (fillDragUp.current) document.removeEventListener("pointerup", fillDragUp.current);
		}
		fillDragMove.current = null;
		fillDragUp.current = null;
		fillDragging.current = false;
		if (fillEdgeScrollRaf.current != null) {
			if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(fillEdgeScrollRaf.current);
			fillEdgeScrollRaf.current = null;
		}
	}, []);
	const FILL_HITTEST_PROBE_RADIUS_PX = (0, react.useMemo)(() => 8, []);
	const FILL_HITTEST_PROBE_STEP_PX = (0, react.useMemo)(() => 2, []);
	function resolveCellAt(clientX, clientY) {
		let el = document.elementFromPoint(clientX, clientY);
		while (el && el.shadowRoot && el.shadowRoot.elementFromPoint) {
			const inner = el.shadowRoot.elementFromPoint(clientX, clientY);
			if (!inner || inner === el) break;
			el = inner;
		}
		if (!el || !el.closest) return null;
		const cellEl = el.closest("[data-grid-cell]");
		if (!cellEl) return null;
		const rowAttr = cellEl.getAttribute("data-row");
		const colAttr = cellEl.getAttribute("data-col-index");
		if (rowAttr == null || colAttr == null || rowAttr === "__header") return null;
		const r = parseInt(rowAttr, 10);
		const c = parseInt(colAttr, 10);
		if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
		return {
			r,
			c
		};
	}
	function cellIndexFromPoint(clientX, clientY) {
		if (typeof document === "undefined" || !document.elementFromPoint) return null;
		const direct = resolveCellAt(clientX, clientY);
		if (direct) return direct;
		for (let d = FILL_HITTEST_PROBE_STEP_PX; d <= FILL_HITTEST_PROBE_RADIUS_PX; d += FILL_HITTEST_PROBE_STEP_PX) {
			const right = resolveCellAt(clientX + d, clientY);
			if (right) return right;
			const left = resolveCellAt(clientX - d, clientY);
			if (left) return left;
		}
		return null;
	}
	const onFillHandlePointerDown = (0, react.useCallback)((e) => {
		if (!e) return;
		if (e.preventDefault) e.preventDefault();
		if (e.stopPropagation) e.stopPropagation();
		teardownFillDrag();
		fillDragging.current = true;
		const sourceBox = normalizedRange();
		let lastCell = sourceBox ? {
			r: sourceBox.r1,
			c: sourceBox.c1
		} : null;
		let lastClientX = 0;
		let lastClientY = 0;
		const applyPointAt = (clientX, clientY) => {
			const cell = cellIndexFromPoint(clientX, clientY);
			if (cell && (!lastCell || cell.r !== lastCell.r || cell.c !== lastCell.c)) {
				lastCell = cell;
				setRangeFocus$local(cell.r, cell.c);
			}
		};
		const scrollStep = () => {
			if (!fillDragging.current) {
				fillEdgeScrollRaf.current = null;
				return;
			}
			const d = edgeDelta(lastClientX, lastClientY);
			if (d.dx === 0 && d.dy === 0) {
				fillEdgeScrollRaf.current = null;
				return;
			}
			if (gridScrollEl.current) {
				if (d.dx !== 0) gridScrollEl.current.scrollLeft = gridScrollEl.current.scrollLeft + d.dx;
				if (d.dy !== 0) gridScrollEl.current.scrollTop = gridScrollEl.current.scrollTop + d.dy;
			}
			applyPointAt(lastClientX, lastClientY);
			fillEdgeScrollRaf.current = requestAnimationFrame(scrollStep);
		};
		const move = (ev) => {
			if (!fillDragging.current) return;
			lastClientX = ev.clientX;
			lastClientY = ev.clientY;
			applyPointAt(ev.clientX, ev.clientY);
			if (fillEdgeScrollRaf.current == null && typeof requestAnimationFrame === "function") {
				const d = edgeDelta(ev.clientX, ev.clientY);
				if (d.dx !== 0 || d.dy !== 0) fillEdgeScrollRaf.current = requestAnimationFrame(scrollStep);
			}
		};
		const up = () => {
			teardownFillDrag();
			if (lastCell && sourceBox && (lastCell.r !== sourceBox.r1 || lastCell.c !== sourceBox.c1)) fillRange(sourceBox, lastCell);
		};
		fillDragMove.current = move;
		fillDragUp.current = up;
		if (typeof document !== "undefined") {
			document.addEventListener("pointermove", move);
			document.addEventListener("pointerup", up);
		}
	}, [
		cellIndexFromPoint,
		edgeDelta,
		fillRange,
		normalizedRange,
		setRangeFocus$local,
		teardownFillDrag
	]);
	const teardownRangeDrag = (0, react.useCallback)(() => {
		if (typeof document !== "undefined") {
			if (rangeDragMove.current) document.removeEventListener("pointermove", rangeDragMove.current);
			if (rangeDragUp.current) document.removeEventListener("pointerup", rangeDragUp.current);
		}
		rangeDragMove.current = null;
		rangeDragUp.current = null;
		rangeDragging.current = false;
	}, []);
	function beginRangeDrag(anchorR, anchorC) {
		teardownRangeDrag();
		rangeDragging.current = true;
		rangeDragMoved.current = false;
		let lastCell = {
			r: anchorR,
			c: anchorC
		};
		const move = (ev) => {
			if (!rangeDragging.current) return;
			const cell = cellIndexFromPoint(ev.clientX, ev.clientY);
			if (cell && (cell.r !== lastCell.r || cell.c !== lastCell.c)) {
				lastCell = cell;
				rangeDragMoved.current = true;
				setRangeFocus$local(cell.r, cell.c, anchorR, anchorC);
			}
		};
		const up = () => {
			teardownRangeDrag();
		};
		rangeDragMove.current = move;
		rangeDragUp.current = up;
		if (typeof document !== "undefined") {
			document.addEventListener("pointermove", move);
			document.addEventListener("pointerup", up);
		}
	}
	function activeCellColumnId() {
		if (activeIsHeader) return null;
		const row = (rows || [])[activeRow];
		if (!row) return null;
		const cell = visibleCellsFor(row)[activeColIndex];
		return cell && cell.column ? cell.column.id : null;
	}
	function isActiveCellEditable() {
		if (rowIndexIsGrouped(activeRow)) return false;
		const colId = activeCellColumnId();
		return colId != null && columnEditable(colId);
	}
	function isEditing(rowIndex, colIndex) {
		if (editVer < 0) return false;
		if (rowIndexIsGrouped(rowIndex)) return false;
		if (editingRowIndex != null && editingRowIndex === rowIndex) {
			const colId = columnIdAt(rowIndex, colIndex);
			return colId != null && columnEditable(colId);
		}
		return editingRow === rowIndex && editingCol === colIndex;
	}
	function cellAriaInvalid(rowIndex, colIndex) {
		return isEditing(rowIndex, colIndex) && !!invalidMsg ? "true" : null;
	}
	function runValidator(colId, value, row) {
		const m = editMetaOf(colId);
		const v = m ? m.validate : null;
		if (typeof v !== "function") return true;
		let r = null;
		try {
			r = v(value, row);
		} catch (err) {
			return "Invalid value";
		}
		if (r === true) return true;
		if (typeof r === "string") return r;
		return "Invalid value";
	}
	function setInvalid(msg) {
		setInvalidMsg(msg != null ? msg : "");
	}
	function sourceIndexOfRow(visibleRowIndex) {
		const row = (rows || [])[visibleRowIndex];
		if (!row) return visibleRowIndex;
		const orig = row.original;
		const idx = (currentData() || []).indexOf(orig);
		return idx >= 0 ? idx : visibleRowIndex;
	}
	function editingColumnId() {
		const row = (rows || [])[editingRow];
		if (!row) return null;
		const cell = visibleCellsFor(row)[editingCol];
		return cell && cell.column ? cell.column.id : null;
	}
	function editingColumnField() {
		const colId = editingColumnId();
		if (colId == null) return null;
		const d = defFor(colId);
		return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
	}
	function editingCellValue() {
		const row = (rows || [])[editingRow];
		if (!row) return null;
		const cell = visibleCellsFor(row)[editingCol];
		return cell ? cell.getValue() : null;
	}
	function editingRowOriginal() {
		const row = (rows || [])[editingRow];
		return row ? row.original : null;
	}
	function editingRowId() {
		const row = (rows || [])[editingRow];
		return row ? row.id : null;
	}
	function resolveEditFocusCellEl(rowIndex, colIndex) {
		if (rowIndex == null || colIndex == null || rowIndex < 0 || colIndex < 0) return null;
		return resolveCellEl(String(rowIndex), colIndex);
	}
	function focusEditorWhenReady(rowIndex, colIndex, selectAll = true) {
		if (!gridRoot.current) return;
		let attempts = 0;
		const tryFocus = () => {
			const cellEl = resolveEditFocusCellEl(rowIndex, colIndex);
			const el = cellEl && cellEl.querySelector ? cellEl.querySelector("[data-editing-cell][data-builtin-editor]") : null;
			if (!el) {
				if (cellEl && cellEl.querySelector ? cellEl.querySelector("[data-editing-cell]") : null) return;
				attempts = attempts + 1;
				if (attempts >= 30) return;
				if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
				else setTimeout(tryFocus, 16);
				return;
			}
			const ae = gridRoot.current && gridRoot.current.getRootNode ? gridRoot.current.getRootNode().activeElement : null;
			if (ae && el && ae !== el && ae.closest && gridRoot.current.contains(ae) && ae.hasAttribute && ae.hasAttribute("data-editing-cell")) {
				const aeCell = ae.closest("[data-grid-cell]");
				const elCell = el.closest ? el.closest("[data-grid-cell]") : null;
				const aeCol = aeCell ? aeCell.getAttribute("data-col-index") : null;
				const elCol = elCell ? elCell.getAttribute("data-col-index") : null;
				if (aeCol != null && aeCol !== elCol) return;
			}
			el.focus();
			if (selectAll && el.select) try {
				el.select();
			} catch (e) {}
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
		else setTimeout(tryFocus, 0);
	}
	function columnIdAt(rowIndex, colIndex) {
		const row = (rows || [])[rowIndex];
		if (!row) return null;
		const cell = visibleCellsFor(row)[colIndex];
		return cell && cell.column ? cell.column.id : null;
	}
	function cellValueAt(rowIndex, colIndex) {
		const row = (rows || [])[rowIndex];
		if (!row) return null;
		const cell = visibleCellsFor(row)[colIndex];
		return cell ? cell.getValue() : null;
	}
	function beginEdit(rowIndex, colIndex, seed) {
		if (rowIndexIsGrouped(rowIndex)) return;
		const colId = columnIdAt(rowIndex, colIndex);
		if (colId == null || !columnEditable(colId)) return;
		committedThisSession.current = false;
		setInvalid("");
		setEditingRowIndex(null);
		setRowDraft({});
		setEditingRow(rowIndex);
		setEditingCol(colIndex);
		setDraftValue(seed != null ? seed : cellValueAt(rowIndex, colIndex));
		setActiveInControl(true);
		setEditVer((prev) => prev + 1);
		setEditFocusColId(colId);
		focusEditorWhenReady(rowIndex, colIndex, seed == null);
	}
	const focusCellWhenReady = (0, react.useCallback)((row, col) => {
		if (!gridRoot.current) return;
		let attempts = 0;
		const tryFocus = () => {
			const el = resolveCellEl(String(row), col);
			if (el) {
				const ae = gridRoot.current && gridRoot.current.getRootNode ? gridRoot.current.getRootNode().activeElement : null;
				if (ae && ae !== el && gridRoot.current.contains && gridRoot.current.contains(ae) && ae.closest) {
					const aeCell = ae.closest("[data-grid-cell]");
					if (aeCell && aeCell !== el) return;
				}
				el.focus();
				return;
			}
			attempts = attempts + 1;
			if (attempts >= 30) return;
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
			else setTimeout(tryFocus, 16);
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
		else setTimeout(tryFocus, 0);
	}, [resolveCellEl]);
	function endEdit() {
		setEditingRow(-1);
		setEditingCol(-1);
		setDraftValue(null);
		setInvalidMsg("");
		setActiveInControl(false);
		setEditVer((prev) => prev + 1);
		setEditFocusColId(null);
	}
	function endRowEdit() {
		setEditingRowIndex(null);
		setRowDraft({});
		setInvalidMsg("");
		setActiveInControl(false);
		setEditVer((prev) => prev + 1);
		setEditFocusColId(null);
	}
	function editorAutofocusFor(colId, rowIndex) {
		if (editVer < 0) return false;
		if (editingRowIndex != null) {
			if (editingRowIndex !== rowIndex) return false;
		} else if (editingRow !== rowIndex) return false;
		return editFocusColId != null && editFocusColId === colId;
	}
	function coerceCellValue(colId, raw) {
		const kind = editorTypeOf(colId);
		if (kind === "checkbox") {
			if (typeof raw === "boolean") return raw;
			if (raw == null) return false;
			if (typeof raw === "number") return raw !== 0;
			return /^\s*(true|1|yes|y|on)\s*$/i.test(String(raw));
		}
		if (kind !== "number") return raw;
		if (raw == null) return null;
		if (typeof raw === "number") return Number.isNaN(raw) ? null : raw;
		const s = String(raw).trim();
		if (s === "") return null;
		const n = Number(s);
		return Number.isNaN(n) ? null : n;
	}
	function commitEdit(overrideValue = void 0, skipFocusReturn = false) {
		if (editingRow < 0) return false;
		if (committedThisSession.current) return false;
		const colId = editingColumnId();
		if (colId == null) {
			endEdit();
			return false;
		}
		const field = editingColumnField();
		const oldValue = editingCellValue();
		const rowOriginal = editingRowOriginal();
		const rowId = editingRowId();
		const newValue = coerceCellValue(colId, overrideValue !== void 0 ? overrideValue : draftValue);
		const err = runValidator(colId, newValue, rowOriginal);
		if (err !== true) {
			setInvalid(err);
			focusEditorWhenReady(editingRow, editingCol);
			return false;
		}
		setInvalid("");
		const changed = !Object.is(newValue, oldValue);
		const focusRow = editingRow;
		const focusCol = editingCol;
		editTransition.current = true;
		committedThisSession.current = true;
		if (changed) {
			const srcIndex = sourceIndexOfRow(editingRow);
			writeData(replaceRowValue(currentData(), srcIndex, field, newValue));
			props.onCellEditCommit && props.onCellEditCommit({
				rowId,
				columnId: colId,
				oldValue,
				newValue
			});
		}
		endEdit();
		editTransition.current = false;
		if (changed) {
			if (skipFocusReturn !== true) pendingEditFollow.current = {
				rowOriginal,
				rowId,
				col: focusCol
			};
		} else if (skipFocusReturn !== true) focusCellWhenReady(focusRow, focusCol);
		return true;
	}
	function toggleActiveBooleanCell() {
		if (rowIndexIsGrouped(activeRow)) return;
		const colId = columnIdAt(activeRow, activeColIndex);
		if (colId == null || !columnEditable(colId)) return;
		const row = (rows || [])[activeRow];
		if (!row) return;
		const rowOriginal = row.original;
		const rowId = row.id;
		const oldValue = cellValueAt(activeRow, activeColIndex);
		const newValue = !oldValue;
		const err = runValidator(colId, newValue, rowOriginal);
		if (err !== true) {
			setInvalid(err);
			return;
		}
		setInvalid("");
		const def = defFor(colId);
		const field = def && def.accessorKey != null ? def.accessorKey : colId;
		const srcIndex = sourceIndexOfRow(activeRow);
		committedThisSession.current = true;
		writeData(replaceRowValue(currentData(), srcIndex, field, newValue));
		props.onCellEditCommit && props.onCellEditCommit({
			rowId,
			columnId: colId,
			oldValue,
			newValue
		});
		pendingEditFollow.current = {
			rowOriginal,
			rowId,
			col: activeColIndex
		};
	}
	function cancelEdit() {
		if (editingRow < 0) return;
		const focusRow = editingRow;
		const focusCol = editingCol;
		editTransition.current = true;
		endEdit();
		editTransition.current = false;
		focusCellWhenReady(focusRow, focusCol);
	}
	function editableColumnsForRow(rowIndex) {
		const row = (rows || [])[rowIndex];
		if (!row) return [];
		const cells = visibleCellsFor(row);
		const out = [];
		for (let c = 0; c < cells.length; c++) {
			const cell = cells[c];
			const colId = cell && cell.column ? cell.column.id : null;
			if (colId == null || !columnEditable(colId)) continue;
			const d = defFor(colId);
			const field = d ? d.accessorKey != null ? d.accessorKey : colId : colId;
			out.push({
				colId,
				field,
				colIndex: c
			});
		}
		return out;
	}
	function focusRowEditorAt(rowIndex, colIndex) {
		if (!gridRoot.current) return;
		let attempts = 0;
		const tryFocus = () => {
			const cellEl = resolveCellEl(String(rowIndex), colIndex);
			const ed = cellEl && cellEl.querySelector ? cellEl.querySelector("[data-editing-cell][data-builtin-editor]") : null;
			if (ed) {
				ed.focus();
				if (ed.select) try {
					ed.select();
				} catch (e) {}
				return;
			}
			if (cellEl && cellEl.querySelector ? cellEl.querySelector("[data-editing-cell]") : null) return;
			attempts = attempts + 1;
			if (attempts >= 30) return;
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
			else setTimeout(tryFocus, 16);
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
		else setTimeout(tryFocus, 0);
	}
	function beginRowEdit(row) {
		const rowIndex = rowIndexOf(row);
		if (rowIndex < 0) return;
		if (rowIndexIsGrouped(rowIndex)) return;
		const editable = editableColumnsForRow(rowIndex);
		if (editable.length === 0) return;
		committedThisSession.current = false;
		setEditingRow(-1);
		setEditingCol(-1);
		setDraftValue(null);
		setInvalid("");
		const draft = {};
		const r = (rows || [])[rowIndex];
		const orig = r ? r.original : null;
		for (let i = 0; i < editable.length; i++) {
			const ec = editable[i];
			draft[ec.colId] = orig ? orig[ec.field] : null;
		}
		setRowDraft(draft);
		setEditingRowIndex(rowIndex);
		setActiveInControl(true);
		setEditVer((prev) => prev + 1);
		setEditFocusColId(editable[0].colId);
		focusEditorWhenReady(rowIndex, editable[0].colIndex);
	}
	function commitRow() {
		if (editingRowIndex == null) return false;
		const rowIndex = editingRowIndex;
		const editable = editableColumnsForRow(rowIndex);
		if (editable.length === 0) {
			endRowEdit();
			return false;
		}
		const r = (rows || [])[rowIndex];
		const rowOriginal = r ? r.original : null;
		const rowId = r ? r.id : null;
		const draft = rowDraft || {};
		for (let i = 0; i < editable.length; i++) {
			const ec = editable[i];
			const err = runValidator(ec.colId, coerceCellValue(ec.colId, draft[ec.colId]), rowOriginal);
			if (err !== true) {
				setInvalid(err);
				setEditFocusColId(ec.colId);
				setEditVer((prev) => prev + 1);
				focusRowEditorAt(rowIndex, ec.colIndex);
				return false;
			}
		}
		setInvalid("");
		const changes = [];
		const fieldValues = {};
		for (let i = 0; i < editable.length; i++) {
			const ec = editable[i];
			const newValue = coerceCellValue(ec.colId, draft[ec.colId]);
			const oldValue = rowOriginal ? rowOriginal[ec.field] : null;
			fieldValues[ec.field] = newValue;
			if (oldValue !== newValue) changes.push({
				columnId: ec.colId,
				oldValue,
				newValue
			});
		}
		const focusRow = activeRow;
		const focusCol = activeColIndex;
		const changed = changes.length > 0;
		editTransition.current = true;
		if (changed) {
			const srcIndex = sourceIndexOfRow(rowIndex);
			writeData(replaceRowValues(currentData(), srcIndex, fieldValues));
			props.onRowEditCommit && props.onRowEditCommit({
				rowId,
				changes
			});
		}
		endRowEdit();
		editTransition.current = false;
		if (changed) pendingEditFollow.current = {
			rowOriginal,
			rowId,
			col: focusCol
		};
		else focusCellWhenReady(focusRow, focusCol);
		return true;
	}
	function cancelRow() {
		if (editingRowIndex == null) return;
		const focusRow = activeRow;
		const focusCol = activeColIndex;
		editTransition.current = true;
		endRowEdit();
		editTransition.current = false;
		focusCellWhenReady(focusRow, focusCol);
	}
	function nextEditableCell(fromRow, fromCol) {
		const rowList = rows || [];
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
	function prevEditableCell(fromRow, fromCol) {
		const rowList = rows || [];
		if (rowList.length === 0) return null;
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
				c = (prow ? visibleCellsFor(prow) : []).length - 1;
			}
		}
		return null;
	}
	function inRowEdit() {
		return editingRowIndex != null;
	}
	function editorValueFor(colId) {
		return inRowEdit() ? rowDraft ? rowDraft[colId] : null : draftValue;
	}
	function editorCheckedFor(colId) {
		return !!(inRowEdit() ? rowDraft ? rowDraft[colId] : null : draftValue);
	}
	function editorCommitFor(colId) {
		return (value) => {
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
	const onCellEditorInput = (0, react.useCallback)((colId, evt) => {
		const v = evt && evt.target ? evt.target.value : "";
		if (inRowEdit()) {
			setRowDraft$local(colId, v);
			return;
		}
		setDraftValue(v);
	}, [inRowEdit, setRowDraft$local]);
	const onCellEditorCheckbox = (0, react.useCallback)((colId, evt) => {
		const v = !!(evt && evt.target && evt.target.checked);
		if (inRowEdit()) {
			setRowDraft$local(colId, v);
			return;
		}
		setDraftValue(v);
	}, [inRowEdit, setRowDraft$local]);
	function setRowDraft$local(colId, value) {
		const src = rowDraft || {};
		const next = {};
		for (const k in src) next[k] = src[k];
		next[colId] = value;
		setRowDraft(next);
	}
	function rowEditTab(target, backward) {
		const rowIndex = editingRowIndex;
		if (rowIndex == null) return;
		const editable = editableColumnsForRow(rowIndex);
		if (editable.length === 0) return;
		const cols = editable.map((ec) => ec.colIndex);
		const cell = target && target.closest ? target.closest("[data-grid-cell]") : null;
		const curAttr = cell ? cell.getAttribute("data-col-index") : null;
		const cur = curAttr != null ? parseInt(curAttr, 10) : -1;
		let pos = cols.indexOf(cur);
		if (pos < 0) pos = 0;
		const len = cols.length;
		const nextPos = backward ? (pos - 1 + len) % len : (pos + 1) % len;
		setEditFocusColId(editable[nextPos].colId);
		setEditVer((prev) => prev + 1);
		focusRowEditorAt(rowIndex, cols[nextPos]);
	}
	const onEditorKeyDown = (0, react.useCallback)((e) => {
		if (!e) return;
		const key = e.key;
		if (inRowEdit()) {
			if (key === "Enter") {
				e.preventDefault();
				commitRow();
			} else if (key === "Escape") {
				e.preventDefault();
				cancelRow();
			} else if (key === "Tab") {
				e.preventDefault();
				rowEditTab(e.target, e.shiftKey);
			}
			return;
		}
		if (key === "Enter") {
			e.preventDefault();
			commitEdit(void 0);
		} else if (key === "Tab") {
			e.preventDefault();
			const fromRow = editingRow;
			const fromCol = editingCol;
			const target = e.shiftKey ? prevEditableCell(fromRow, fromCol) : nextEditableCell(fromRow, fromCol);
			const committed = commitEdit(void 0, true);
			if (committed && target) {
				setActiveRow(target.row);
				setActiveColIndex(target.col);
				beginEdit(target.row, target.col, null);
			} else if (committed) focusCellWhenReady(fromRow, fromCol);
		} else if (key === "Escape") {
			e.preventDefault();
			cancelEdit();
		}
	}, [
		beginEdit,
		cancelEdit,
		cancelRow,
		commitEdit,
		commitRow,
		editingCol,
		editingRow,
		focusCellWhenReady,
		inRowEdit,
		nextEditableCell,
		prevEditableCell,
		rowEditTab
	]);
	const onEditorBlur = (0, react.useCallback)((e) => {
		if (inRowEdit()) {
			if (editTransition.current) return;
			const rowNext = e ? e.relatedTarget : null;
			const rowNextCell = rowNext && rowNext.closest ? rowNext.closest("[data-grid-cell]") : null;
			const rowNextRow = rowNextCell ? rowNextCell.getAttribute("data-row") : null;
			if (rowNextRow != null && rowNextRow === String(editingRowIndex)) return;
			commitRow();
			return;
		}
		if (editingRow < 0 || editTransition.current) return;
		const next = e ? e.relatedTarget : null;
		const fromCell = e && e.target && e.target.closest ? e.target.closest("[data-grid-cell]") : null;
		if (next == null) {
			if (!outsidePointerDown.current) return;
			outsidePointerDown.current = false;
			if (!fromCell) return;
			if (fromCell.getAttribute("data-row") !== String(editingRow) || fromCell.getAttribute("data-col-index") !== String(editingCol)) return;
			commitEdit(void 0, true);
			return;
		}
		if (!(gridRoot.current && gridRoot.current.contains && gridRoot.current.contains(next))) {
			commitEdit(void 0);
			return;
		}
		const nextCell = next.closest ? next.closest("[data-grid-cell]") : null;
		if (!nextCell || !fromCell || nextCell === fromCell) return;
		const fromRow = fromCell.getAttribute("data-row");
		const fromCol = fromCell.getAttribute("data-col-index");
		if (fromRow !== String(editingRow) || fromCol !== String(editingCol)) return;
		const destRow = nextCell.getAttribute("data-row");
		const destCol = nextCell.getAttribute("data-col-index");
		commitEdit(void 0, true);
		const reseatDestFocus = () => {
			if (!gridRoot.current || destRow == null || destCol == null || destRow === "__header") return;
			const root = gridRoot.current.getRootNode ? gridRoot.current.getRootNode() : null;
			const act = root && root.activeElement ? root.activeElement : null;
			if (act && gridRoot.current.contains && gridRoot.current.contains(act)) return;
			const el = resolveCellEl(destRow, parseInt(destCol, 10));
			if (el) el.focus();
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(reseatDestFocus);
		else setTimeout(reseatDestFocus, 0);
	}, [
		commitEdit,
		commitRow,
		editingCol,
		editingRow,
		editingRowIndex,
		inRowEdit,
		resolveCellEl
	]);
	function editCell(rowIndex, colIndex) {
		const lastRow = bodyRowCount() - 1;
		const maxRow = lastRow < 0 ? 0 : lastRow;
		const maxCol = visibleColCount() - 1;
		const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
		const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
		committedThisSession.current = false;
		setActiveIsHeader(false);
		setActiveRow(r);
		setActiveColIndex(c);
		beginEdit(r, c, null);
	}
	function commitEditing() {
		if (inRowEdit()) {
			commitRow();
			return;
		}
		if (editingRow >= 0) commitEdit(void 0);
	}
	function editRow(rowIndex) {
		const lastRow = bodyRowCount() - 1;
		const maxRow = lastRow < 0 ? 0 : lastRow;
		const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
		const row = (rows || [])[r];
		if (!row) return;
		setActiveIsHeader(false);
		setActiveRow(r);
		beginRowEdit(row);
	}
	function focusAbsCellWhenReady(absRow, localRow, col) {
		if (!gridRoot.current) return;
		let attempts = 0;
		const want = String(headerRowCount() + absRow + 1);
		const myEpoch = focusIntentEpoch.current;
		const tryFocus = () => {
			if (focusIntentEpoch.current !== myEpoch) return;
			const el = resolveCellEl(String(localRow), col);
			if (el) {
				const rowEl = el.closest ? el.closest("[role=\"row\"]") : null;
				if ((rowEl ? rowEl.getAttribute("aria-rowindex") : null) === want) {
					el.focus();
					return;
				}
			}
			attempts = attempts + 1;
			if (attempts >= 60) return;
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
			else setTimeout(tryFocus, 16);
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
		else setTimeout(tryFocus, 0);
	}
	function focusCell(rowIndex, colIndex) {
		if (!isGrid()) return;
		focusIntentEpoch.current = focusIntentEpoch.current + 1;
		const maxCol = visibleColCount() - 1;
		const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
		const absLast = prePaginationRowCount() - 1;
		const absRow = clamp(Math.trunc(Number(rowIndex)) || 0, 0, absLast < 0 ? 0 : absLast);
		const prevAbs = toAbsRow(activeRow);
		const prevCol = activeColIndex;
		const prevIsHeader = activeIsHeader;
		if (rowsWindowed()) {
			setActiveIsHeader(false);
			setActiveInControl(false);
			setActiveRow(absRow);
			setActiveColIndex(c);
			focusActiveCell(absRow, c, false);
		} else {
			const size = pageSize();
			const targetPage = size > 0 ? Math.floor(absRow / size) : 0;
			const localRow = absRow - targetPage * size;
			const switched = targetPage !== pageIndex();
			if (switched) setPage(targetPage);
			setActiveIsHeader(false);
			setActiveInControl(false);
			setActiveRow(localRow);
			setActiveColIndex(c);
			if (switched) focusAbsCellWhenReady(absRow, localRow, c);
			else focusActiveCell(localRow, c, false);
		}
		if (absRow !== prevAbs || c !== prevCol || prevIsHeader) props.onActivecellChange && props.onActivecellChange({
			rowIndex: absRow,
			colIndex: c
		});
	}
	function getActiveCell() {
		return activeIsHeader ? {
			rowIndex: null,
			colIndex: activeColIndex,
			isHeader: true
		} : {
			rowIndex: toAbsRow(activeRow),
			colIndex: activeColIndex,
			isHeader: false
		};
	}
	function clearActiveCell() {
		if (!isGrid()) return;
		setActiveIsHeader(false);
		setActiveInControl(false);
		setActiveRow(0);
		setActiveColIndex(0);
	}
	function toggleRowExpanded(rowId) {
		if (!table.current) return;
		const target = String(rowId);
		const flat = table.current.getCoreRowModel().flatRows;
		for (const r of flat) if (r.id === target || r.original && String(r.original.id) === target) {
			r.toggleExpanded();
			return;
		}
	}
	function expandAll() {
		if (!table.current) return;
		table.current.toggleAllRowsExpanded(true);
	}
	function collapseAll() {
		if (!table.current) return;
		table.current.resetExpanded(true);
	}
	function getExpandedRows() {
		if (!table.current) return [];
		const out = [];
		const flat = table.current.getCoreRowModel().flatRows;
		for (const r of flat) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
		return out;
	}
	function applyGrouping(cols) {
		if (table.current) table.current.setGrouping(cols);
	}
	function clearGrouping() {
		if (table.current) table.current.setGrouping([]);
	}
	function getFacetedUniqueValues(colId) {
		if (tick() < 0 || !table.current) return [];
		const col = table.current.getColumn(colId);
		if (!col || !col.getFacetedUniqueValues) return [];
		const map = col.getFacetedUniqueValues();
		return map ? Array.from(map.keys()) : [];
	}
	function getFacetedMinMaxValues(colId) {
		if (tick() < 0 || !table.current) return null;
		const col = table.current.getColumn(colId);
		if (!col || !col.getFacetedMinMaxValues) return null;
		return col.getFacetedMinMaxValues() || null;
	}
	const _clampActiveCellRef = (0, react.useRef)(clampActiveCell);
	_clampActiveCellRef.current = clampActiveCell;
	const _colsWindowedRef = (0, react.useRef)(colsWindowed);
	_colsWindowedRef.current = colsWindowed;
	const _columnVirtualizerOptionsRef = (0, react.useRef)(columnVirtualizerOptions);
	_columnVirtualizerOptionsRef.current = columnVirtualizerOptions;
	const _currentDataRef = (0, react.useRef)(currentData);
	_currentDataRef.current = currentData;
	const _currentStateRef = (0, react.useRef)(currentState);
	_currentStateRef.current = currentState;
	const _effectiveColumnFiltersRef = (0, react.useRef)(effectiveColumnFilters);
	_effectiveColumnFiltersRef.current = effectiveColumnFilters;
	const _effectiveGlobalFilterRef = (0, react.useRef)(effectiveGlobalFilter);
	_effectiveGlobalFilterRef.current = effectiveGlobalFilter;
	const _effectiveSortingRef = (0, react.useRef)(effectiveSorting);
	_effectiveSortingRef.current = effectiveSorting;
	const _focusCellWhenReadyRef = (0, react.useRef)(focusCellWhenReady);
	_focusCellWhenReadyRef.current = focusCellWhenReady;
	const _isGridRef = (0, react.useRef)(isGrid);
	_isGridRef.current = isGrid;
	const _isWindowedRef = (0, react.useRef)(isWindowed);
	_isWindowedRef.current = isWindowed;
	const _onColumnFiltersChangeCbRef = (0, react.useRef)(onColumnFiltersChangeCb);
	_onColumnFiltersChangeCbRef.current = onColumnFiltersChangeCb;
	const _onColumnOrderChangeCbRef = (0, react.useRef)(onColumnOrderChangeCb);
	_onColumnOrderChangeCbRef.current = onColumnOrderChangeCb;
	const _onColumnPinningChangeCbRef = (0, react.useRef)(onColumnPinningChangeCb);
	_onColumnPinningChangeCbRef.current = onColumnPinningChangeCb;
	const _onColumnSizingChangeCbRef = (0, react.useRef)(onColumnSizingChangeCb);
	_onColumnSizingChangeCbRef.current = onColumnSizingChangeCb;
	const _onColumnSizingInfoChangeCbRef = (0, react.useRef)(onColumnSizingInfoChangeCb);
	_onColumnSizingInfoChangeCbRef.current = onColumnSizingInfoChangeCb;
	const _onColumnVisibilityChangeCbRef = (0, react.useRef)(onColumnVisibilityChangeCb);
	_onColumnVisibilityChangeCbRef.current = onColumnVisibilityChangeCb;
	const _onExpandedChangeCbRef = (0, react.useRef)(onExpandedChangeCb);
	_onExpandedChangeCbRef.current = onExpandedChangeCb;
	const _onGlobalFilterChangeCbRef = (0, react.useRef)(onGlobalFilterChangeCb);
	_onGlobalFilterChangeCbRef.current = onGlobalFilterChangeCb;
	const _onGroupingChangeCbRef = (0, react.useRef)(onGroupingChangeCb);
	_onGroupingChangeCbRef.current = onGroupingChangeCb;
	const _onPaginationChangeCbRef = (0, react.useRef)(onPaginationChangeCb);
	_onPaginationChangeCbRef.current = onPaginationChangeCb;
	const _onRowSelectionChangeCbRef = (0, react.useRef)(onRowSelectionChangeCb);
	_onRowSelectionChangeCbRef.current = onRowSelectionChangeCb;
	const _onSortingChangeCbRef = (0, react.useRef)(onSortingChangeCb);
	_onSortingChangeCbRef.current = onSortingChangeCb;
	const _remeasureColumnWindowRef = (0, react.useRef)(remeasureColumnWindow);
	_remeasureColumnWindowRef.current = remeasureColumnWindow;
	const _rowsWindowedRef = (0, react.useRef)(rowsWindowed);
	_rowsWindowedRef.current = rowsWindowed;
	const _seedColumnPinningRef = (0, react.useRef)(seedColumnPinning);
	_seedColumnPinningRef.current = seedColumnPinning;
	const _syncIndeterminateRef = (0, react.useRef)(syncIndeterminate);
	_syncIndeterminateRef.current = syncIndeterminate;
	const _tableColumnsRef = (0, react.useRef)(tableColumns);
	_tableColumnsRef.current = tableColumns;
	const _virtualizerOptionsRef = (0, react.useRef)(virtualizerOptions);
	_virtualizerOptionsRef.current = virtualizerOptions;
	const _windowSourceRef = (0, react.useRef)(windowSource);
	_windowSourceRef.current = windowSource;
	const _writePaginationRef = (0, react.useRef)(writePagination);
	_writePaginationRef.current = writePagination;
	(0, react.useEffect)(() => {
		const _onColumnFiltersChangeCbStable = (...args) => _onColumnFiltersChangeCbRef.current(...args);
		const _onColumnOrderChangeCbStable = (...args) => _onColumnOrderChangeCbRef.current(...args);
		const _onColumnPinningChangeCbStable = (...args) => _onColumnPinningChangeCbRef.current(...args);
		const _onColumnSizingChangeCbStable = (...args) => _onColumnSizingChangeCbRef.current(...args);
		const _onColumnSizingInfoChangeCbStable = (...args) => _onColumnSizingInfoChangeCbRef.current(...args);
		const _onColumnVisibilityChangeCbStable = (...args) => _onColumnVisibilityChangeCbRef.current(...args);
		const _onExpandedChangeCbStable = (...args) => _onExpandedChangeCbRef.current(...args);
		const _onGlobalFilterChangeCbStable = (...args) => _onGlobalFilterChangeCbRef.current(...args);
		const _onGroupingChangeCbStable = (...args) => _onGroupingChangeCbRef.current(...args);
		const _onPaginationChangeCbStable = (...args) => _onPaginationChangeCbRef.current(...args);
		const _onRowSelectionChangeCbStable = (...args) => _onRowSelectionChangeCbRef.current(...args);
		const _onSortingChangeCbStable = (...args) => _onSortingChangeCbRef.current(...args);
		const _syncIndeterminateStable = (...args) => _syncIndeterminateRef.current(...args);
		setDataDefault(_dataRef.current || []);
		_seedColumnPinningRef.current();
		table.current = (0, _tanstack_table_core.createTable)({
			data: _currentDataRef.current(),
			columns: _tableColumnsRef.current(),
			state: _currentStateRef.current(),
			getCoreRowModel: (0, _tanstack_table_core.getCoreRowModel)(),
			getSortedRowModel: (0, _tanstack_table_core.getSortedRowModel)(),
			getFilteredRowModel: (0, _tanstack_table_core.getFilteredRowModel)(),
			getPaginationRowModel: (0, _tanstack_table_core.getPaginationRowModel)(),
			getExpandedRowModel: (0, _tanstack_table_core.getExpandedRowModel)(),
			getSubRows: _getSubRowsRef.current || void 0,
			getRowCanExpand: _expandableRef.current === true && _getSubRowsRef.current == null ? () => true : void 0,
			onExpandedChange: _onExpandedChangeCbStable,
			autoResetExpanded: false,
			getGroupedRowModel: (0, _tanstack_table_core.getGroupedRowModel)(),
			onGroupingChange: _onGroupingChangeCbStable,
			getFacetedRowModel: (0, _tanstack_table_core.getFacetedRowModel)(),
			getFacetedUniqueValues: (0, _tanstack_table_core.getFacetedUniqueValues)(),
			getFacetedMinMaxValues: (0, _tanstack_table_core.getFacetedMinMaxValues)(),
			manualPagination: _manualRef.current === true,
			manualFiltering: _manualRef.current === true,
			manualSorting: _manualRef.current === true,
			rowCount: _rowCountRef.current ?? void 0,
			pageCount: _pageCountRef.current ?? void 0,
			enableRowSelection: _selectionModeRef.current !== "none",
			enableMultiRowSelection: _selectionModeRef.current === "multiple",
			onSortingChange: _onSortingChangeCbStable,
			onGlobalFilterChange: _onGlobalFilterChangeCbStable,
			onColumnFiltersChange: _onColumnFiltersChangeCbStable,
			onPaginationChange: _onPaginationChangeCbStable,
			onRowSelectionChange: _onRowSelectionChangeCbStable,
			onColumnVisibilityChange: _onColumnVisibilityChangeCbStable,
			onColumnSizingChange: _onColumnSizingChangeCbStable,
			onColumnOrderChange: _onColumnOrderChangeCbStable,
			onColumnPinningChange: _onColumnPinningChangeCbStable,
			onColumnSizingInfoChange: _onColumnSizingInfoChangeCbStable,
			columnResizeMode: "onChange",
			enableColumnResizing: true,
			renderFallbackValue: null,
			onStateChange: () => {}
		});
		refreshRowModel.current = () => {
			if (!table.current) return;
			const nextRows = _windowSourceRef.current().slice();
			const nextGroups = table.current.getHeaderGroups().slice();
			setRows(nextRows);
			setHeaderGroups(nextGroups);
			setRowModelVer((prev) => prev + 1);
			if (_rowsWindowedRef.current() && virtualizer.current) {
				virtualizer.current.setOptions(_virtualizerOptionsRef.current());
				virtualizer.current._willUpdate();
			}
			_remeasureColumnWindowRef.current();
			const nextRowCount = nextRows.length;
			const nextColCount = nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0;
			_clampActiveCellRef.current(nextRowCount, nextColCount);
			const pgState = table.current.getState().pagination;
			const pc = table.current.getPageCount();
			if (pc > 0 && pgState.pageIndex > pc - 1) _writePaginationRef.current({
				pageIndex: pc - 1,
				pageSize: pgState.pageSize
			});
			if (pendingEditFollow.current && _isGridRef.current()) {
				const follow = pendingEditFollow.current;
				pendingEditFollow.current = null;
				const followIdx = indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
				if (followIdx >= 0) _focusCellWhenReadyRef.current(followIdx, follow.col);
			}
			_syncIndeterminateRef.current();
			if (typeof queueMicrotask !== "undefined") queueMicrotask(_syncIndeterminateStable);
			else Promise.resolve().then(_syncIndeterminateStable);
		};
		refreshRowModel.current();
		gridRoot.current = __rozieRoot.current ? __rozieRoot.current.querySelector(".rozie-data-table") : null;
		if (typeof document !== "undefined") {
			docPointerDown.current = (ev) => {
				if (!gridRoot.current) {
					outsidePointerDown.current = false;
					return;
				}
				const path = ev && typeof ev.composedPath === "function" ? ev.composedPath() : null;
				outsidePointerDown.current = !(path ? path.indexOf(gridRoot.current) !== -1 : !!(ev && ev.target && gridRoot.current.contains && gridRoot.current.contains(ev.target)));
			};
			document.addEventListener("pointerdown", docPointerDown.current, true);
		}
		if (_isWindowedRef.current()) gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current.querySelector(".rdt-scroll") : null;
		if (_rowsWindowedRef.current()) {
			virtualizer.current = new _tanstack_virtual_core.Virtualizer(_virtualizerOptionsRef.current());
			virtualizerCleanup.current = virtualizer.current._didMount();
		}
		if (_colsWindowedRef.current()) {
			colVirtualizer.current = new _tanstack_virtual_core.Virtualizer(_columnVirtualizerOptionsRef.current());
			colVirtualizerCleanup.current = colVirtualizer.current._didMount();
		}
		if (_isWindowedRef.current()) setWindowVer((prev) => prev + 1);
		if (_isWindowedRef.current()) {
			const afterFirstFrame = () => {
				if (_rowsWindowedRef.current()) {
					remeasureWindow();
					if (!(gridScrollEl.current ? gridScrollEl.current.clientHeight : 0)) console.warn("[rozie-data-table] virtual is on but the scroll container has no bounded height; set maxHeight or --rozie-data-table-max-height");
					const pg = _paginationRef.current;
					const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
					if (_manualRef.current !== true && pgConfigured) console.warn("[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.");
				}
				if (_colsWindowedRef.current()) {
					if (!(gridScrollEl.current ? gridScrollEl.current.clientWidth : 0)) console.warn("[rozie-data-table] virtual is on for columns but the scroll container has no bounded width; set a CSS width on an ancestor so the column window can be measured");
					bumpWindowVer();
				}
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));
			else setTimeout(afterFirstFrame, 0);
		}
		announceState.sorting = _effectiveSortingRef.current();
		announceState.columnFilters = _effectiveColumnFiltersRef.current();
		announceState.globalFilter = _effectiveGlobalFilterRef.current();
	}, []);
	(0, react.useEffect)(() => {
		return () => {
			if (docPointerDown.current && typeof document !== "undefined") {
				document.removeEventListener("pointerdown", docPointerDown.current, true);
				docPointerDown.current = null;
			}
			if (virtualizerCleanup.current) virtualizerCleanup.current();
			if (colVirtualizerCleanup.current) colVirtualizerCleanup.current();
			teardownColRtlWatch();
			teardownRemeasure();
			teardownFillDrag();
			teardownRangeDrag();
		};
	}, []);
	(0, react.useEffect)(() => {
		maybeClearHistoryOnExternalSwap();
		remeasureColumnSizes();
		if (!table.current) return;
		const d = currentData() || [];
		if (d === lastData.current && d.length === lastDataLen.current) return;
		lastData.current = d;
		lastDataLen.current = d.length;
		reFeed();
	}, [
		currentData,
		lastData,
		lastDataLen,
		maybeClearHistoryOnExternalSwap,
		reFeed,
		remeasureColumnSizes,
		table
	]);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		seedColumnPinning();
		reFeed();
		maybeClearHistoryOnExternalSwap();
	}, [
		colReg,
		columnFilters,
		columnOrder,
		columnPinning,
		columnSizing,
		columnVisibility,
		data,
		dataDefault,
		expanded,
		globalFilter,
		grouping,
		pagination,
		props.columns,
		props.expandable,
		props.groupable,
		props.pageCount,
		props.rowCount,
		props.selectionMode,
		rowSelection,
		sorting
	]);
	(0, react.useEffect)(() => {
		if (_watch1First.current) {
			_watch1First.current = false;
			return;
		}
		const msg = buildSortFilterAnnounce();
		if (msg) setLiveAnnounce(msg);
	}, [
		columnFilters,
		columnFiltersDefault,
		globalFilter,
		globalFilterDefault,
		sorting,
		sortingDefault
	]);
	const _rozieExposeRef = (0, react.useRef)({
		sortColumn,
		clearSorting,
		toggleRowExpanded,
		expandAll,
		collapseAll,
		getExpandedRows,
		applyGrouping,
		clearGrouping,
		getFacetedUniqueValues,
		getFacetedMinMaxValues,
		getColumnDefs,
		toggleAllRows,
		clearSelection,
		getSelectedRows,
		setPage,
		setRowsPerPage,
		toggleColumnVisibility,
		applyColumnOrder,
		resetColumnSizing,
		pinColumn,
		focusCell,
		getActiveCell,
		clearActiveCell,
		getRowIndexRelativeToPage,
		editCell,
		commitEditing,
		editRow,
		getSelectedRange,
		cut,
		undo,
		redo,
		canUndo,
		canRedo,
		clearHistory
	});
	_rozieExposeRef.current = {
		sortColumn,
		clearSorting,
		toggleRowExpanded,
		expandAll,
		collapseAll,
		getExpandedRows,
		applyGrouping,
		clearGrouping,
		getFacetedUniqueValues,
		getFacetedMinMaxValues,
		getColumnDefs,
		toggleAllRows,
		clearSelection,
		getSelectedRows,
		setPage,
		setRowsPerPage,
		toggleColumnVisibility,
		applyColumnOrder,
		resetColumnSizing,
		pinColumn,
		focusCell,
		getActiveCell,
		clearActiveCell,
		getRowIndexRelativeToPage,
		editCell,
		commitEditing,
		editRow,
		getSelectedRange,
		cut,
		undo,
		redo,
		canUndo,
		canRedo,
		clearHistory
	};
	(0, react.useImperativeHandle)(ref, () => ({
		sortColumn: (...args) => _rozieExposeRef.current.sortColumn(...args),
		clearSorting: (...args) => _rozieExposeRef.current.clearSorting(...args),
		toggleRowExpanded: (...args) => _rozieExposeRef.current.toggleRowExpanded(...args),
		expandAll: (...args) => _rozieExposeRef.current.expandAll(...args),
		collapseAll: (...args) => _rozieExposeRef.current.collapseAll(...args),
		getExpandedRows: (...args) => _rozieExposeRef.current.getExpandedRows(...args),
		applyGrouping: (...args) => _rozieExposeRef.current.applyGrouping(...args),
		clearGrouping: (...args) => _rozieExposeRef.current.clearGrouping(...args),
		getFacetedUniqueValues: (...args) => _rozieExposeRef.current.getFacetedUniqueValues(...args),
		getFacetedMinMaxValues: (...args) => _rozieExposeRef.current.getFacetedMinMaxValues(...args),
		getColumnDefs: (...args) => _rozieExposeRef.current.getColumnDefs(...args),
		toggleAllRows: (...args) => _rozieExposeRef.current.toggleAllRows(...args),
		clearSelection: (...args) => _rozieExposeRef.current.clearSelection(...args),
		getSelectedRows: (...args) => _rozieExposeRef.current.getSelectedRows(...args),
		setPage: (...args) => _rozieExposeRef.current.setPage(...args),
		setRowsPerPage: (...args) => _rozieExposeRef.current.setRowsPerPage(...args),
		toggleColumnVisibility: (...args) => _rozieExposeRef.current.toggleColumnVisibility(...args),
		applyColumnOrder: (...args) => _rozieExposeRef.current.applyColumnOrder(...args),
		resetColumnSizing: (...args) => _rozieExposeRef.current.resetColumnSizing(...args),
		pinColumn: (...args) => _rozieExposeRef.current.pinColumn(...args),
		focusCell: (...args) => _rozieExposeRef.current.focusCell(...args),
		getActiveCell: (...args) => _rozieExposeRef.current.getActiveCell(...args),
		clearActiveCell: (...args) => _rozieExposeRef.current.clearActiveCell(...args),
		getRowIndexRelativeToPage: (...args) => _rozieExposeRef.current.getRowIndexRelativeToPage(...args),
		editCell: (...args) => _rozieExposeRef.current.editCell(...args),
		commitEditing: (...args) => _rozieExposeRef.current.commitEditing(...args),
		editRow: (...args) => _rozieExposeRef.current.editRow(...args),
		getSelectedRange: (...args) => _rozieExposeRef.current.getSelectedRange(...args),
		cut: (...args) => _rozieExposeRef.current.cut(...args),
		undo: (...args) => _rozieExposeRef.current.undo(...args),
		redo: (...args) => _rozieExposeRef.current.redo(...args),
		canUndo: (...args) => _rozieExposeRef.current.canUndo(...args),
		canRedo: (...args) => _rozieExposeRef.current.canRedo(...args),
		clearHistory: (...args) => _rozieExposeRef.current.clearHistory(...args)
	}), []);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__ctx_data_table_columns.Provider, {
		value: {
			registerColumn: (id, spec) => {
				if (id == null) return;
				const key = String(id);
				if (key === "__proto__" || key === "constructor" || key === "prototype") return;
				const prev = colReg ? colReg[key] : void 0;
				if (prev !== void 0 && columnSpecsEquivalent(prev, spec)) return;
				setColReg((prev) => ({
					...prev,
					[key]: spec
				}));
			},
			unregisterColumn: (id) => {
				if (id == null) return;
				const r = { ...colReg };
				delete r[String(id)];
				setColReg(r);
			}
		},
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "rozie-data-table-wrap",
			ref: __rozieRoot,
			"data-rozie-s-d5dcab4c": "",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-column-defs",
					style: { display: "none" },
					"aria-hidden": "true",
					"data-rozie-s-d5dcab4c": "",
					children: typeof (props.children ?? props.slots?.[""]) === "function" ? (props.children ?? props.slots?.[""])() : props.children ?? props.slots?.[""]
				}),
				!!!!invalidMsg && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-sr-live",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					"data-rozie-s-d5dcab4c": "",
					children: invalidMsg
				}),
				!!!!pasteAnnounce && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-sr-live rdt-sr-paste",
					"data-testid": "paste-announce",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					"data-rozie-s-d5dcab4c": "",
					children: pasteAnnounce
				}),
				!!!!rangeAnnounce && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-sr-live rdt-sr-range",
					"data-testid": "range-announce",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					"data-rozie-s-d5dcab4c": "",
					children: rangeAnnounce
				}),
				!!!!liveAnnounce && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-sr-live rdt-sr-sortfilter",
					"data-testid": "sortfilter-announce",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					"data-rozie-s-d5dcab4c": "",
					children: liveAnnounce
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rdt-toolbar",
					"data-rozie-s-d5dcab4c": "",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "rdt-global-filter",
						type: "text",
						role: "searchbox",
						"aria-label": "Search table",
						value: globalFilterValue(),
						onInput: ($event) => {
							onGlobalFilterInput($event);
						},
						"data-rozie-s-d5dcab4c": ""
					}), !!allLeafColumns().length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "rdt-colvis",
						"data-rozie-s-d5dcab4c": "",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
							className: "rdt-colvis-summary",
							"data-rozie-s-d5dcab4c": "",
							children: "Columns"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "rdt-colvis-menu",
							role: "group",
							"aria-label": "Toggle columns",
							"data-rozie-s-d5dcab4c": "",
							children: allLeafColumns().map((lc) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "rdt-colvis-item",
								"data-rozie-s-d5dcab4c": "",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									className: "rdt-colvis-checkbox",
									checked: lc.visible,
									onChange: ($event) => {
										onToggleVisibility(lc.id);
									},
									"data-rozie-s-d5dcab4c": ""
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "rdt-colvis-label",
									"data-rozie-s-d5dcab4c": "",
									children: (0, _rozie_runtime_react.rozieDisplay)(lc.label)
								})]
							}, lc.id))
						})]
					})]
				}),
				!!props.groupable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-group-bar-host",
					"data-rozie-s-d5dcab4c": "",
					children: props.renderGroupBar ?? props.slots?.["groupBar"] ? (props.renderGroupBar ?? props.slots?.["groupBar"])({
						grouping: groupingKeys(),
						groupableColumns: groupableColumns(),
						applyGrouping,
						clearGrouping
					}) : groupingKeys().map((gk) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rdt-group-token",
						"data-group-token": "",
						"data-rozie-s-d5dcab4c": "",
						children: (0, _rozie_runtime_react.rozieDisplay)(gk)
					}, gk))
				}),
				isWindowed() ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rdt-scroll",
					style: (0, _rozie_runtime_react.parseInlineStyle)(rowsWindowed() && props.maxHeight ? "max-height:" + props.maxHeight + ";overflow:auto;--rozie-data-table-max-height:" + props.maxHeight : "overflow:auto"),
					"data-rozie-s-d5dcab4c": "",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: (0, _rozie_runtime_react.clsx)("rozie-data-table", {
							"rdt-sticky": props.stickyHeader,
							"rdt-col-windowed": colsWindowed()
						}),
						role: (0, _rozie_runtime_react.rozieAttr)(tableRole()),
						"aria-rowcount": gridAriaRowCount(),
						"aria-colcount": gridAriaColCount(),
						onKeyDown: ($event) => {
							onGridKeyDown($event);
						},
						onFocus: ($event) => {
							syncActiveFromEvent($event);
						},
						onBlur: ($event) => {
							onGridFocusOut($event);
						},
						onMouseDown: ($event) => {
							onGridMouseDown($event);
						},
						onDoubleClick: ($event) => {
							onGridDblClick($event);
						},
						onClick: ($event) => {
							onGridClick($event);
						},
						"data-rozie-s-d5dcab4c": "",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("thead", {
							className: "rdt-thead",
							role: "rowgroup",
							"data-rozie-s-d5dcab4c": "",
							children: [headerGroups.map((hg, hgLevel) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: "rdt-tr",
								role: "row",
								"aria-rowindex": hgLevel + 1,
								"data-rozie-s-d5dcab4c": "",
								children: [
									!!colsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: "rdt-col-spacer",
										"aria-hidden": "true",
										style: (0, _rozie_runtime_react.parseInlineStyle)("width:" + colPadLeft() + "px;padding:0;border:0"),
										"data-rozie-s-d5dcab4c": ""
									}),
									windowedHeadersFor(hg, hgLevel).map((wh) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: (0, _rozie_runtime_react.clsx)("rdt-th", {
											"rdt-select-th": isSelectColumn(wh.header.column.id),
											"rdt-expander-th": isExpanderColumn(wh.header.column.id),
											"rdt-th-resizing": columnIsResizing(wh.header.column.id),
											"rdt-cell-active": isActiveCell("__header", headerColIndexOf(hg, wh.header), hgLevel)
										}),
										role: "columnheader",
										"data-col": (0, _rozie_runtime_react.rozieAttr)(wh.header.column.id),
										"data-grid-cell": "",
										"data-row": "__header",
										"data-header-level": (0, _rozie_runtime_react.rozieAttr)(hgLevel),
										colSpan: (wh.span > 1 ? wh.span : void 0) ?? void 0,
										"data-col-index": (0, _rozie_runtime_react.rozieAttr)(headerColIndexOf(hg, wh.header)),
										"aria-colindex": headerLeafStart(hg, wh.header) + 1,
										tabIndex: cellTabindex("__header", headerColIndexOf(hg, wh.header), hgLevel),
										"aria-sort": (0, _rozie_runtime_react.rozieAttr)(ariaSortFor(wh.header.column.id)),
										style: (0, _rozie_runtime_react.parseInlineStyle)(thStyle(wh.header, wh.width)),
										"data-rozie-s-d5dcab4c": "",
										children: isSelectColumn(wh.header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": "",
											children: props.renderSelectAll ?? props.slots?.["selectAll"] ? (props.renderSelectAll ?? props.slots?.["selectAll"])({
												checked: isAllRowsSelected(),
												indeterminate: isSomeRowsSelected(),
												toggle: onToggleAllRows
											}) : !!(props.selectionMode === "multiple") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "rdt-select-all",
												type: "checkbox",
												"aria-label": "Select all rows",
												checked: isAllRowsSelected(),
												onChange: ($event) => {
													onToggleAllRows($event);
												},
												"data-rozie-s-d5dcab4c": ""
											})
										}) : isExpanderColumn(wh.header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": ""
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": "",
											children: [
												wh.header.column.getCanSort && wh.header.column.getCanSort() ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: "rdt-sort-btn",
													onClick: ($event) => {
														onHeaderSort(wh.header.column.id, $event);
													},
													"data-rozie-s-d5dcab4c": "",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "rdt-header-label",
														"data-rozie-s-d5dcab4c": "",
														children: typeof props.slots?.[`colHeader-${wh.header.column.id}`] === "function" ? (props.slots?.[`colHeader-${wh.header.column.id}`])({
															columnId: wh.header.column.id,
															column: wh.header.column,
															label: headerLabel(wh.header.column.id)
														}) : props.slots?.[`colHeader-${wh.header.column.id}`] ?? (props.renderColHeader ?? props.slots?.["colHeader"] ? (props.renderColHeader ?? props.slots?.["colHeader"])({
															columnId: wh.header.column.id,
															column: wh.header.column,
															label: headerLabel(wh.header.column.id)
														}) : (0, _rozie_runtime_react.rozieDisplay)(headerLabel(wh.header.column.id)))
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "rdt-sort-ind",
														"aria-hidden": "true",
														"data-rozie-s-d5dcab4c": "",
														children: (0, _rozie_runtime_react.rozieDisplay)(sortIndicator(wh.header.column.id))
													})]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: { display: "contents" },
													"data-rozie-s-d5dcab4c": "",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "rdt-header-label",
														"data-rozie-s-d5dcab4c": "",
														children: typeof props.slots?.[`colHeader-${wh.header.column.id}`] === "function" ? (props.slots?.[`colHeader-${wh.header.column.id}`])({
															columnId: wh.header.column.id,
															column: wh.header.column,
															label: headerLabel(wh.header.column.id)
														}) : props.slots?.[`colHeader-${wh.header.column.id}`] ?? (props.renderColHeader ?? props.slots?.["colHeader"] ? (props.renderColHeader ?? props.slots?.["colHeader"])({
															columnId: wh.header.column.id,
															column: wh.header.column,
															label: headerLabel(wh.header.column.id)
														}) : (0, _rozie_runtime_react.rozieDisplay)(headerLabel(wh.header.column.id)))
													})
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_rozie_ui_popover_react.default, {
													trigger: "click",
													placement: "bottom-end",
													strategy: "fixed",
													offset: 4,
													"data-rozie-s-d5dcab4c": "",
													renderAnchor: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "rdt-col-menu-trigger",
														"aria-label": (0, _rozie_runtime_react.rozieAttr)("Column options for " + headerLabel(wh.header.column.id)),
														"data-rozie-s-d5dcab4c": "",
														children: "⋯"
													}) }),
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "rdt-col-menu",
														role: "menu",
														"data-rozie-s-d5dcab4c": "",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																role: "menuitem",
																className: "rdt-col-menu-item",
																"aria-pressed": columnPinSide(wh.header.column.id) === "left",
																onClick: ($event) => {
																	onPinColumn(wh.header.column.id, "left", $event);
																},
																"data-rozie-s-d5dcab4c": "",
																children: "Pin left"
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																role: "menuitem",
																className: "rdt-col-menu-item",
																"aria-pressed": columnPinSide(wh.header.column.id) === "right",
																onClick: ($event) => {
																	onPinColumn(wh.header.column.id, "right", $event);
																},
																"data-rozie-s-d5dcab4c": "",
																children: "Pin right"
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																role: "menuitem",
																className: "rdt-col-menu-item",
																"aria-pressed": !columnPinSide(wh.header.column.id),
																onClick: ($event) => {
																	onPinColumn(wh.header.column.id, false, $event);
																},
																"data-rozie-s-d5dcab4c": "",
																children: "Unpin"
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", {
																className: "rdt-col-menu-sep",
																"data-rozie-s-d5dcab4c": ""
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																role: "menuitem",
																className: "rdt-col-menu-item",
																onClick: ($event) => {
																	onHideColumn(wh.header.column.id, $event);
																},
																"data-rozie-s-d5dcab4c": "",
																children: "Hide column"
															})
														]
													}) })
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "rdt-resize-handle",
													"aria-label": (0, _rozie_runtime_react.rozieAttr)("Resize " + headerLabel(wh.header.column.id)),
													onPointerDown: ($event) => {
														onResizeStart(wh.header.column.id, $event);
													},
													onTouchStart: ($event) => {
														onResizeStart(wh.header.column.id, $event);
													},
													"data-rozie-s-d5dcab4c": "",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "rdt-resize-grip",
														"aria-hidden": "true",
														"data-rozie-s-d5dcab4c": ""
													})
												})
											]
										})
									}, wh.header.id)),
									!!colsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: "rdt-col-spacer",
										"aria-hidden": "true",
										style: (0, _rozie_runtime_react.parseInlineStyle)("width:" + colPadRight() + "px;padding:0;border:0"),
										"data-rozie-s-d5dcab4c": ""
									})
								]
							}, hg.id)), !!hasAnyFilterableColumn() && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: "rdt-filter-row",
								"data-rozie-s-d5dcab4c": "",
								children: [
									!!colsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: "rdt-col-spacer",
										"aria-hidden": "true",
										style: (0, _rozie_runtime_react.parseInlineStyle)("width:" + colPadLeft() + "px;padding:0;border:0"),
										"data-rozie-s-d5dcab4c": ""
									}),
									windowedHeadersFor(headerGroups[headerGroups.length - 1], headerGroups.length - 1).map((wh) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: "rdt-filter-cell",
										role: "presentation",
										"data-col": (0, _rozie_runtime_react.rozieAttr)(wh.header.column.id),
										style: (0, _rozie_runtime_react.parseInlineStyle)(pinStyle(wh.header.column.id)),
										"data-rozie-s-d5dcab4c": "",
										children: isSelectColumn(wh.header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": ""
										}) : isExpanderColumn(wh.header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": ""
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": "",
											children: !!columnIsFilterable(wh.header.column.id) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { display: "contents" },
												"data-rozie-s-d5dcab4c": "",
												children: typeof props.slots?.[`filter-${wh.header.column.id}`] === "function" ? (props.slots?.[`filter-${wh.header.column.id}`])({
													columnId: wh.header.column.id,
													value: columnFilterValue(wh.header.column.id),
													uniqueValues: getFacetedUniqueValues(wh.header.column.id),
													minMax: getFacetedMinMaxValues(wh.header.column.id),
													columnLabel: headerLabel(wh.header.column.id),
													setFilter: setColumnFilter
												}) : props.slots?.[`filter-${wh.header.column.id}`] ?? (props.renderFilter ?? props.slots?.["filter"] ? (props.renderFilter ?? props.slots?.["filter"])({
													columnId: wh.header.column.id,
													value: columnFilterValue(wh.header.column.id),
													uniqueValues: getFacetedUniqueValues(wh.header.column.id),
													minMax: getFacetedMinMaxValues(wh.header.column.id),
													columnLabel: headerLabel(wh.header.column.id),
													setFilter: setColumnFilter
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "rdt-col-filter",
													type: "text",
													"aria-label": (0, _rozie_runtime_react.rozieAttr)("Filter " + headerLabel(wh.header.column.id)),
													value: columnFilterValue(wh.header.column.id),
													onInput: ($event) => {
														onColumnFilterInput(wh.header.column.id, $event);
													},
													onClick: ($event) => {
														stopEvent($event);
													},
													"data-rozie-s-d5dcab4c": ""
												}))
											})
										})
									}, wh.header.id)),
									!!colsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: "rdt-col-spacer",
										"aria-hidden": "true",
										style: (0, _rozie_runtime_react.parseInlineStyle)("width:" + colPadRight() + "px;padding:0;border:0"),
										"data-rozie-s-d5dcab4c": ""
									})
								]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tbody", {
							className: "rdt-tbody",
							role: "rowgroup",
							"data-rozie-s-d5dcab4c": "",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
									className: "rdt-spacer",
									"aria-hidden": "true",
									"data-rozie-s-d5dcab4c": "",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										colSpan: windowedColSpan(),
										style: (0, _rozie_runtime_react.parseInlineStyle)("height:" + padTop() + "px;padding:0;border:0"),
										"data-rozie-s-d5dcab4c": ""
									})
								}),
								windowedRows().map((wr) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									className: (0, _rozie_runtime_react.clsx)("rdt-tr", {
										"rdt-group-header": rowIsGrouped(wr.row),
										"rdt-row-pinned": wr.pinned
									}),
									role: "row",
									"data-row": (0, _rozie_runtime_react.rozieAttr)(wr.vi.index),
									"aria-rowindex": headerRowCount() + wr.vi.index + 1,
									"data-index": (0, _rozie_runtime_react.rozieAttr)(wr.vi.index),
									"data-pinned": (0, _rozie_runtime_react.rozieAttr)(wr.pinned ? "true" : void 0),
									"data-depth": (0, _rozie_runtime_react.rozieAttr)(wr.row.depth),
									"data-group-header": (0, _rozie_runtime_react.rozieAttr)(rowIsGrouped(wr.row) ? wr.row.id : void 0),
									"data-group-leaf": (0, _rozie_runtime_react.rozieAttr)(groupingActive() && !rowIsGrouped(wr.row) ? wr.row.id : void 0),
									"aria-expanded": (rowIsGrouped(wr.row) ? !!rowIsExpanded(wr.row) : void 0) ?? void 0,
									"aria-selected": (props.selectionMode !== "none" ? !!rowIsSelected(wr.row) : void 0) ?? void 0,
									"aria-level": (groupingActive() ? wr.row.depth + 1 : void 0) ?? void 0,
									"data-rozie-s-d5dcab4c": "",
									children: [
										!!colsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "rdt-col-spacer",
											"aria-hidden": "true",
											style: (0, _rozie_runtime_react.parseInlineStyle)("width:" + colPadLeft() + "px;padding:0;border:0"),
											"data-rozie-s-d5dcab4c": ""
										}),
										windowedCells(wr.row).map((cell) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
											className: (0, _rozie_runtime_react.clsx)("rdt-td", {
												"rdt-select-td": isSelectColumn(cell.column.id),
												"rdt-expander-td": isExpanderColumn(cell.column.id),
												"rdt-in-range": inRange(wr.vi.index, colIndexOf(wr.row, cell)),
												"rdt-cell-active": isActiveCell(String(wr.vi.index), colIndexOf(wr.row, cell))
											}),
											role: (0, _rozie_runtime_react.rozieAttr)(cellRole()),
											"data-col": (0, _rozie_runtime_react.rozieAttr)(cell.column.id),
											"data-grid-cell": "",
											"data-row": (0, _rozie_runtime_react.rozieAttr)(wr.vi.index),
											"data-col-index": (0, _rozie_runtime_react.rozieAttr)(colIndexOf(wr.row, cell)),
											tabIndex: cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cell)),
											style: (0, _rozie_runtime_react.parseInlineStyle)(bodyCellStyle(wr.row, cell.column.id)),
											"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cell))),
											"aria-colindex": colIndexOf(wr.row, cell) + 1,
											"aria-selected": (inRange(wr.vi.index, colIndexOf(wr.row, cell)) ? "true" : void 0) ?? void 0,
											"data-in-range": (0, _rozie_runtime_react.rozieAttr)(inRange(wr.vi.index, colIndexOf(wr.row, cell)) ? "true" : void 0),
											"data-agg-cell": (0, _rozie_runtime_react.rozieAttr)(cellIsAggregated(cell) ? cell.column.id : void 0),
											"data-rozie-s-d5dcab4c": "",
											children: [isExpanderColumn(cell.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { display: "contents" },
												"data-rozie-s-d5dcab4c": "",
												children: !!rowCanExpand(wr.row) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "rdt-expander",
													"data-expander": "",
													"aria-expanded": !!rowIsExpanded(wr.row),
													"aria-label": (0, _rozie_runtime_react.rozieAttr)(rowIsExpanded(wr.row) ? "Collapse row" : "Expand row"),
													onClick: ($event) => {
														onToggleExpand(wr.row, $event);
													},
													"data-rozie-s-d5dcab4c": "",
													children: (0, _rozie_runtime_react.rozieDisplay)(rowIsExpanded(wr.row) ? "▾" : "▸")
												})
											}) : isSelectColumn(cell.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { display: "contents" },
												"data-rozie-s-d5dcab4c": "",
												children: props.renderSelectCell ?? props.slots?.["selectCell"] ? (props.renderSelectCell ?? props.slots?.["selectCell"])({
													row: cellSlotRow(wr.row),
													checked: rowIsSelected(wr.row),
													toggle: (e) => onToggleRow(wr.row, e)
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "rdt-select-row",
													type: "checkbox",
													"aria-label": "Select row",
													checked: rowIsSelected(wr.row),
													onChange: ($event) => {
														onToggleRow(wr.row, $event);
													},
													"data-rozie-s-d5dcab4c": ""
												})
											}) : cellIsGrouped(cell) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: { display: "contents" },
												"data-rozie-s-d5dcab4c": "",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "rdt-expander rdt-group-toggle",
														"data-expander": "",
														"aria-expanded": !!rowIsExpanded(wr.row),
														"aria-label": (0, _rozie_runtime_react.rozieAttr)(rowIsExpanded(wr.row) ? "Collapse group" : "Expand group"),
														onClick: ($event) => {
															onToggleExpand(wr.row, $event);
														},
														"data-rozie-s-d5dcab4c": "",
														children: (0, _rozie_runtime_react.rozieDisplay)(rowIsExpanded(wr.row) ? "▾" : "▸")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "rdt-group-value",
														"data-rozie-s-d5dcab4c": "",
														children: typeof props.slots?.[`cell-${cell.column.id}`] === "function" ? (props.slots?.[`cell-${cell.column.id}`])({
															columnId: cell.column.id,
															column: cell.column,
															row: cellSlotRow(wr.row),
															value: cell.getValue()
														}) : props.slots?.[`cell-${cell.column.id}`] ?? (props.renderCell ?? props.slots?.["cell"] ? (props.renderCell ?? props.slots?.["cell"])({
															columnId: cell.column.id,
															column: cell.column,
															row: cellSlotRow(wr.row),
															value: cell.getValue()
														}) : (0, _rozie_runtime_react.rozieDisplay)(cell.getValue()))
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "rdt-group-count",
														"data-rozie-s-d5dcab4c": "",
														children: (0, _rozie_runtime_react.rozieDisplay)("(" + groupSubRowCount(wr.row) + ")")
													})
												]
											}) : isEditing(wr.vi.index, colIndexOf(wr.row, cell)) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { display: "contents" },
												"data-rozie-s-d5dcab4c": "",
												children: editorTypeOf(cell.column.id) === "number" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "rdt-cell-editor",
													type: "number",
													"data-editing-cell": "",
													"data-builtin-editor": "",
													"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
													value: editorValueFor(cell.column.id),
													onInput: ($event) => {
														onCellEditorInput(cell.column.id, $event);
													},
													onKeyDown: ($event) => {
														onEditorKeyDown($event);
													},
													onBlur: ($event) => {
														onEditorBlur($event);
													},
													"data-rozie-s-d5dcab4c": ""
												}) : editorTypeOf(cell.column.id) === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
													className: "rdt-cell-editor",
													"data-editing-cell": "",
													"data-builtin-editor": "",
													"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
													value: editorValueFor(cell.column.id),
													onChange: ($event) => {
														onCellEditorInput(cell.column.id, $event);
													},
													onKeyDown: ($event) => {
														onEditorKeyDown($event);
													},
													onBlur: ($event) => {
														onEditorBlur($event);
													},
													"data-rozie-s-d5dcab4c": "",
													children: editorOptionsOf(cell.column.id).map((opt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: (0, _rozie_runtime_react.rozieAttr)(opt.value),
														"data-rozie-s-d5dcab4c": "",
														children: (0, _rozie_runtime_react.rozieDisplay)(opt.label)
													}, opt.value))
												}) : editorTypeOf(cell.column.id) === "checkbox" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "rdt-cell-editor",
													type: "checkbox",
													"data-editing-cell": "",
													"data-builtin-editor": "",
													"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
													checked: editorCheckedFor(cell.column.id),
													onChange: ($event) => {
														onCellEditorCheckbox(cell.column.id, $event);
													},
													onKeyDown: ($event) => {
														onEditorKeyDown($event);
													},
													onBlur: ($event) => {
														onEditorBlur($event);
													},
													"data-rozie-s-d5dcab4c": ""
												}) : editorTypeOf(cell.column.id) === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: { display: "contents" },
													"data-rozie-s-d5dcab4c": "",
													children: typeof props.slots?.[`editor-${cell.column.id}`] === "function" ? (props.slots?.[`editor-${cell.column.id}`])({
														columnId: cell.column.id,
														column: cell.column,
														row: cellSlotRow(wr.row),
														value: editorValueFor(cell.column.id),
														commit: editorCommitFor(cell.column.id),
														cancel: editorCancelFor(),
														columnLabel: headerLabel(cell.column.id),
														autofocus: editorAutofocusFor(cell.column.id, wr.vi.index)
													}) : props.slots?.[`editor-${cell.column.id}`] ?? (props.renderEditor ?? props.slots?.["editor"] ? (props.renderEditor ?? props.slots?.["editor"])({
														columnId: cell.column.id,
														column: cell.column,
														row: cellSlotRow(wr.row),
														value: editorValueFor(cell.column.id),
														commit: editorCommitFor(cell.column.id),
														cancel: editorCancelFor(),
														columnLabel: headerLabel(cell.column.id),
														autofocus: editorAutofocusFor(cell.column.id, wr.vi.index)
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														className: "rdt-cell-editor",
														type: "text",
														"data-editing-cell": "",
														"data-builtin-editor": "",
														"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
														value: editorValueFor(cell.column.id),
														onInput: ($event) => {
															onCellEditorInput(cell.column.id, $event);
														},
														onKeyDown: ($event) => {
															onEditorKeyDown($event);
														},
														onBlur: ($event) => {
															onEditorBlur($event);
														},
														"data-rozie-s-d5dcab4c": ""
													}))
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "rdt-cell-editor",
													type: "text",
													"data-editing-cell": "",
													"data-builtin-editor": "",
													"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
													value: editorValueFor(cell.column.id),
													onInput: ($event) => {
														onCellEditorInput(cell.column.id, $event);
													},
													onKeyDown: ($event) => {
														onEditorKeyDown($event);
													},
													onBlur: ($event) => {
														onEditorBlur($event);
													},
													"data-rozie-s-d5dcab4c": ""
												})
											}) : cellIsPlaceholder(cell) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { display: "contents" },
												"data-rozie-s-d5dcab4c": ""
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "rdt-cell-value",
												"data-rozie-s-d5dcab4c": "",
												children: typeof props.slots?.[`cell-${cell.column.id}`] === "function" ? (props.slots?.[`cell-${cell.column.id}`])({
													columnId: cell.column.id,
													column: cell.column,
													row: cellSlotRow(wr.row),
													value: cell.getValue()
												}) : props.slots?.[`cell-${cell.column.id}`] ?? (props.renderCell ?? props.slots?.["cell"] ? (props.renderCell ?? props.slots?.["cell"])({
													columnId: cell.column.id,
													column: cell.column,
													row: cellSlotRow(wr.row),
													value: cell.getValue()
												}) : (0, _rozie_runtime_react.rozieDisplay)(cell.getValue()))
											}), !!isFillHandleCell(wr.vi.index, colIndexOf(wr.row, cell)) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "rdt-fill-handle",
												"data-fill-handle": "",
												"data-testid": "fill-handle",
												"aria-hidden": "true",
												onPointerDown: ($event) => {
													onFillHandlePointerDown($event);
												},
												"data-rozie-s-d5dcab4c": ""
											})]
										}, cell.id)),
										!!colsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "rdt-col-spacer",
											"aria-hidden": "true",
											style: (0, _rozie_runtime_react.parseInlineStyle)("width:" + colPadRight() + "px;padding:0;border:0"),
											"data-rozie-s-d5dcab4c": ""
										})
									]
								}, wr.row.id), !!rowShowsDetail(wr.row) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
									className: "rdt-detail-row",
									role: "row",
									"data-detail-row": (0, _rozie_runtime_react.rozieAttr)(wr.row.id),
									"data-rozie-s-d5dcab4c": "",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "rdt-detail-cell",
										colSpan: windowedColSpan(),
										"data-rozie-s-d5dcab4c": "",
										children: (props.renderDetail ?? props.slots?.["detail"])?.({ row: wr.row.original })
									})
								}, wr.row.id)] }, wr.row.id)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
									className: "rdt-spacer",
									"aria-hidden": "true",
									"data-rozie-s-d5dcab4c": "",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										colSpan: windowedColSpan(),
										style: (0, _rozie_runtime_react.parseInlineStyle)("height:" + padBottom() + "px;padding:0;border:0"),
										"data-rozie-s-d5dcab4c": ""
									})
								})
							]
						})]
					})
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
					className: (0, _rozie_runtime_react.clsx)("rozie-data-table", { "rdt-sticky": props.stickyHeader }),
					role: (0, _rozie_runtime_react.rozieAttr)(tableRole()),
					"aria-rowcount": gridAriaRowCount(),
					"aria-colcount": gridAriaColCount(),
					onKeyDown: ($event) => {
						onGridKeyDown($event);
					},
					onFocus: ($event) => {
						syncActiveFromEvent($event);
					},
					onBlur: ($event) => {
						onGridFocusOut($event);
					},
					onMouseDown: ($event) => {
						onGridMouseDown($event);
					},
					onDoubleClick: ($event) => {
						onGridDblClick($event);
					},
					onClick: ($event) => {
						onGridClick($event);
					},
					"data-rozie-s-d5dcab4c": "",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("thead", {
						className: "rdt-thead",
						role: "rowgroup",
						"data-rozie-s-d5dcab4c": "",
						children: [headerGroups.map((hg, hgLevel) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
							className: "rdt-tr",
							role: "row",
							"aria-rowindex": hgLevel + 1,
							"data-rozie-s-d5dcab4c": "",
							children: hg.headers.map((header) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								className: (0, _rozie_runtime_react.clsx)("rdt-th", {
									"rdt-select-th": isSelectColumn(header.column.id),
									"rdt-expander-th": isExpanderColumn(header.column.id),
									"rdt-th-resizing": columnIsResizing(header.column.id),
									"rdt-cell-active": isActiveCell("__header", headerColIndexOf(hg, header), hgLevel)
								}),
								role: "columnheader",
								"data-col": (0, _rozie_runtime_react.rozieAttr)(header.column.id),
								"data-grid-cell": "",
								"data-row": "__header",
								"data-header-level": (0, _rozie_runtime_react.rozieAttr)(hgLevel),
								colSpan: (header.colSpan > 1 ? header.colSpan : void 0) ?? void 0,
								"data-col-index": (0, _rozie_runtime_react.rozieAttr)(headerColIndexOf(hg, header)),
								"aria-colindex": headerLeafStart(hg, header) + 1,
								tabIndex: cellTabindex("__header", headerColIndexOf(hg, header), hgLevel),
								"aria-sort": (0, _rozie_runtime_react.rozieAttr)(ariaSortFor(header.column.id)),
								style: (0, _rozie_runtime_react.parseInlineStyle)(thStyle(header)),
								"data-rozie-s-d5dcab4c": "",
								children: isSelectColumn(header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: props.renderSelectAll ?? props.slots?.["selectAll"] ? (props.renderSelectAll ?? props.slots?.["selectAll"])({
										checked: isAllRowsSelected(),
										indeterminate: isSomeRowsSelected(),
										toggle: onToggleAllRows
									}) : !!(props.selectionMode === "multiple") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "rdt-select-all",
										type: "checkbox",
										"aria-label": "Select all rows",
										checked: isAllRowsSelected(),
										onChange: ($event) => {
											onToggleAllRows($event);
										},
										"data-rozie-s-d5dcab4c": ""
									})
								}) : isExpanderColumn(header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": ""
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: [
										header.column.getCanSort && header.column.getCanSort() ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "rdt-sort-btn",
											onClick: ($event) => {
												onHeaderSort(header.column.id, $event);
											},
											"data-rozie-s-d5dcab4c": "",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "rdt-header-label",
												"data-rozie-s-d5dcab4c": "",
												children: typeof props.slots?.[`colHeader-${header.column.id}`] === "function" ? (props.slots?.[`colHeader-${header.column.id}`])({
													columnId: header.column.id,
													column: header.column,
													label: headerLabel(header.column.id)
												}) : props.slots?.[`colHeader-${header.column.id}`] ?? (props.renderColHeader ?? props.slots?.["colHeader"] ? (props.renderColHeader ?? props.slots?.["colHeader"])({
													columnId: header.column.id,
													column: header.column,
													label: headerLabel(header.column.id)
												}) : (0, _rozie_runtime_react.rozieDisplay)(headerLabel(header.column.id)))
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "rdt-sort-ind",
												"aria-hidden": "true",
												"data-rozie-s-d5dcab4c": "",
												children: (0, _rozie_runtime_react.rozieDisplay)(sortIndicator(header.column.id))
											})]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { display: "contents" },
											"data-rozie-s-d5dcab4c": "",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "rdt-header-label",
												"data-rozie-s-d5dcab4c": "",
												children: typeof props.slots?.[`colHeader-${header.column.id}`] === "function" ? (props.slots?.[`colHeader-${header.column.id}`])({
													columnId: header.column.id,
													column: header.column,
													label: headerLabel(header.column.id)
												}) : props.slots?.[`colHeader-${header.column.id}`] ?? (props.renderColHeader ?? props.slots?.["colHeader"] ? (props.renderColHeader ?? props.slots?.["colHeader"])({
													columnId: header.column.id,
													column: header.column,
													label: headerLabel(header.column.id)
												}) : (0, _rozie_runtime_react.rozieDisplay)(headerLabel(header.column.id)))
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_rozie_ui_popover_react.default, {
											trigger: "click",
											placement: "bottom-end",
											strategy: "fixed",
											offset: 4,
											"data-rozie-s-d5dcab4c": "",
											renderAnchor: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "rdt-col-menu-trigger",
												"aria-label": (0, _rozie_runtime_react.rozieAttr)("Column options for " + headerLabel(header.column.id)),
												"data-rozie-s-d5dcab4c": "",
												children: "⋯"
											}) }),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "rdt-col-menu",
												role: "menu",
												"data-rozie-s-d5dcab4c": "",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														role: "menuitem",
														className: "rdt-col-menu-item",
														"aria-pressed": columnPinSide(header.column.id) === "left",
														onClick: ($event) => {
															onPinColumn(header.column.id, "left", $event);
														},
														"data-rozie-s-d5dcab4c": "",
														children: "Pin left"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														role: "menuitem",
														className: "rdt-col-menu-item",
														"aria-pressed": columnPinSide(header.column.id) === "right",
														onClick: ($event) => {
															onPinColumn(header.column.id, "right", $event);
														},
														"data-rozie-s-d5dcab4c": "",
														children: "Pin right"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														role: "menuitem",
														className: "rdt-col-menu-item",
														"aria-pressed": !columnPinSide(header.column.id),
														onClick: ($event) => {
															onPinColumn(header.column.id, false, $event);
														},
														"data-rozie-s-d5dcab4c": "",
														children: "Unpin"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", {
														className: "rdt-col-menu-sep",
														"data-rozie-s-d5dcab4c": ""
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														role: "menuitem",
														className: "rdt-col-menu-item",
														onClick: ($event) => {
															onHideColumn(header.column.id, $event);
														},
														"data-rozie-s-d5dcab4c": "",
														children: "Hide column"
													})
												]
											}) })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "rdt-resize-handle",
											"aria-label": (0, _rozie_runtime_react.rozieAttr)("Resize " + headerLabel(header.column.id)),
											onPointerDown: ($event) => {
												onResizeStart(header.column.id, $event);
											},
											onTouchStart: ($event) => {
												onResizeStart(header.column.id, $event);
											},
											"data-rozie-s-d5dcab4c": "",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "rdt-resize-grip",
												"aria-hidden": "true",
												"data-rozie-s-d5dcab4c": ""
											})
										})
									]
								})
							}, header.id))
						}, hg.id)), !!hasAnyFilterableColumn() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
							className: "rdt-filter-row",
							"data-rozie-s-d5dcab4c": "",
							children: headerGroups[headerGroups.length - 1].headers.map((header) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								className: "rdt-filter-cell",
								role: "presentation",
								style: (0, _rozie_runtime_react.parseInlineStyle)(pinStyle(header.column.id)),
								"data-rozie-s-d5dcab4c": "",
								children: isSelectColumn(header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": ""
								}) : isExpanderColumn(header.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": ""
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: !!columnIsFilterable(header.column.id) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { display: "contents" },
										"data-rozie-s-d5dcab4c": "",
										children: typeof props.slots?.[`filter-${header.column.id}`] === "function" ? (props.slots?.[`filter-${header.column.id}`])({
											columnId: header.column.id,
											value: columnFilterValue(header.column.id),
											uniqueValues: getFacetedUniqueValues(header.column.id),
											minMax: getFacetedMinMaxValues(header.column.id),
											columnLabel: headerLabel(header.column.id),
											setFilter: setColumnFilter
										}) : props.slots?.[`filter-${header.column.id}`] ?? (props.renderFilter ?? props.slots?.["filter"] ? (props.renderFilter ?? props.slots?.["filter"])({
											columnId: header.column.id,
											value: columnFilterValue(header.column.id),
											uniqueValues: getFacetedUniqueValues(header.column.id),
											minMax: getFacetedMinMaxValues(header.column.id),
											columnLabel: headerLabel(header.column.id),
											setFilter: setColumnFilter
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "rdt-col-filter",
											type: "text",
											"aria-label": (0, _rozie_runtime_react.rozieAttr)("Filter " + headerLabel(header.column.id)),
											value: columnFilterValue(header.column.id),
											onInput: ($event) => {
												onColumnFilterInput(header.column.id, $event);
											},
											onClick: ($event) => {
												stopEvent($event);
											},
											"data-rozie-s-d5dcab4c": ""
										}))
									})
								})
							}, header.id))
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", {
						className: "rdt-tbody",
						role: "rowgroup",
						"data-rozie-s-d5dcab4c": "",
						children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
							className: (0, _rozie_runtime_react.clsx)("rdt-tr", { "rdt-group-header": rowIsGrouped(row) }),
							role: "row",
							"data-depth": (0, _rozie_runtime_react.rozieAttr)(row.depth),
							"aria-rowindex": bodyAriaRowIndex(row),
							"data-group-header": (0, _rozie_runtime_react.rozieAttr)(rowIsGrouped(row) ? row.id : void 0),
							"data-group-leaf": (0, _rozie_runtime_react.rozieAttr)(groupingActive() && !rowIsGrouped(row) ? row.id : void 0),
							"aria-expanded": (rowIsGrouped(row) ? !!rowIsExpanded(row) : void 0) ?? void 0,
							"aria-selected": (props.selectionMode !== "none" ? !!rowIsSelected(row) : void 0) ?? void 0,
							"aria-level": (groupingActive() ? row.depth + 1 : void 0) ?? void 0,
							"data-rozie-s-d5dcab4c": "",
							children: visibleCellsFor(row).map((cell) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
								className: (0, _rozie_runtime_react.clsx)("rdt-td", {
									"rdt-select-td": isSelectColumn(cell.column.id),
									"rdt-expander-td": isExpanderColumn(cell.column.id),
									"rdt-in-range": inRange(rowIndexOf(row), colIndexOf(row, cell)),
									"rdt-cell-active": isActiveCell(String(rowIndexOf(row)), colIndexOf(row, cell))
								}),
								role: (0, _rozie_runtime_react.rozieAttr)(cellRole()),
								"data-col": (0, _rozie_runtime_react.rozieAttr)(cell.column.id),
								"data-grid-cell": "",
								"data-row": (0, _rozie_runtime_react.rozieAttr)(rowIndexOf(row)),
								"data-col-index": (0, _rozie_runtime_react.rozieAttr)(colIndexOf(row, cell)),
								tabIndex: cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cell)),
								style: (0, _rozie_runtime_react.parseInlineStyle)(bodyCellStyle(row, cell.column.id)),
								"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cell))),
								"aria-colindex": colIndexOf(row, cell) + 1,
								"aria-selected": (inRange(rowIndexOf(row), colIndexOf(row, cell)) ? "true" : void 0) ?? void 0,
								"data-in-range": (0, _rozie_runtime_react.rozieAttr)(inRange(rowIndexOf(row), colIndexOf(row, cell)) ? "true" : void 0),
								"data-agg-cell": (0, _rozie_runtime_react.rozieAttr)(cellIsAggregated(cell) ? cell.column.id : void 0),
								"data-rozie-s-d5dcab4c": "",
								children: [isExpanderColumn(cell.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: !!rowCanExpand(row) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "rdt-expander",
										"data-expander": "",
										"aria-expanded": !!rowIsExpanded(row),
										"aria-label": (0, _rozie_runtime_react.rozieAttr)(rowIsExpanded(row) ? "Collapse row" : "Expand row"),
										onClick: ($event) => {
											onToggleExpand(row, $event);
										},
										"data-rozie-s-d5dcab4c": "",
										children: (0, _rozie_runtime_react.rozieDisplay)(rowIsExpanded(row) ? "▾" : "▸")
									})
								}) : isSelectColumn(cell.column.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: props.renderSelectCell ?? props.slots?.["selectCell"] ? (props.renderSelectCell ?? props.slots?.["selectCell"])({
										row: cellSlotRow(row),
										checked: rowIsSelected(row),
										toggle: (e) => onToggleRow(row, e)
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "rdt-select-row",
										type: "checkbox",
										"aria-label": "Select row",
										checked: rowIsSelected(row),
										onChange: ($event) => {
											onToggleRow(row, $event);
										},
										"data-rozie-s-d5dcab4c": ""
									})
								}) : cellIsGrouped(cell) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "rdt-expander rdt-group-toggle",
											"data-expander": "",
											"aria-expanded": !!rowIsExpanded(row),
											"aria-label": (0, _rozie_runtime_react.rozieAttr)(rowIsExpanded(row) ? "Collapse group" : "Expand group"),
											onClick: ($event) => {
												onToggleExpand(row, $event);
											},
											"data-rozie-s-d5dcab4c": "",
											children: (0, _rozie_runtime_react.rozieDisplay)(rowIsExpanded(row) ? "▾" : "▸")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "rdt-group-value",
											"data-rozie-s-d5dcab4c": "",
											children: typeof props.slots?.[`cell-${cell.column.id}`] === "function" ? (props.slots?.[`cell-${cell.column.id}`])({
												columnId: cell.column.id,
												column: cell.column,
												row: cellSlotRow(row),
												value: cell.getValue()
											}) : props.slots?.[`cell-${cell.column.id}`] ?? (props.renderCell ?? props.slots?.["cell"] ? (props.renderCell ?? props.slots?.["cell"])({
												columnId: cell.column.id,
												column: cell.column,
												row: cellSlotRow(row),
												value: cell.getValue()
											}) : (0, _rozie_runtime_react.rozieDisplay)(cell.getValue()))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "rdt-group-count",
											"data-rozie-s-d5dcab4c": "",
											children: (0, _rozie_runtime_react.rozieDisplay)("(" + groupSubRowCount(row) + ")")
										})
									]
								}) : isEditing(rowIndexOf(row), colIndexOf(row, cell)) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": "",
									children: editorTypeOf(cell.column.id) === "number" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "rdt-cell-editor",
										type: "number",
										"data-editing-cell": "",
										"data-builtin-editor": "",
										"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
										value: editorValueFor(cell.column.id),
										onInput: ($event) => {
											onCellEditorInput(cell.column.id, $event);
										},
										onKeyDown: ($event) => {
											onEditorKeyDown($event);
										},
										onBlur: ($event) => {
											onEditorBlur($event);
										},
										"data-rozie-s-d5dcab4c": ""
									}) : editorTypeOf(cell.column.id) === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "rdt-cell-editor",
										"data-editing-cell": "",
										"data-builtin-editor": "",
										"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
										value: editorValueFor(cell.column.id),
										onChange: ($event) => {
											onCellEditorInput(cell.column.id, $event);
										},
										onKeyDown: ($event) => {
											onEditorKeyDown($event);
										},
										onBlur: ($event) => {
											onEditorBlur($event);
										},
										"data-rozie-s-d5dcab4c": "",
										children: editorOptionsOf(cell.column.id).map((opt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: (0, _rozie_runtime_react.rozieAttr)(opt.value),
											"data-rozie-s-d5dcab4c": "",
											children: (0, _rozie_runtime_react.rozieDisplay)(opt.label)
										}, opt.value))
									}) : editorTypeOf(cell.column.id) === "checkbox" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "rdt-cell-editor",
										type: "checkbox",
										"data-editing-cell": "",
										"data-builtin-editor": "",
										"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
										checked: editorCheckedFor(cell.column.id),
										onChange: ($event) => {
											onCellEditorCheckbox(cell.column.id, $event);
										},
										onKeyDown: ($event) => {
											onEditorKeyDown($event);
										},
										onBlur: ($event) => {
											onEditorBlur($event);
										},
										"data-rozie-s-d5dcab4c": ""
									}) : editorTypeOf(cell.column.id) === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { display: "contents" },
										"data-rozie-s-d5dcab4c": "",
										children: typeof props.slots?.[`editor-${cell.column.id}`] === "function" ? (props.slots?.[`editor-${cell.column.id}`])({
											columnId: cell.column.id,
											column: cell.column,
											row: cellSlotRow(row),
											value: editorValueFor(cell.column.id),
											commit: editorCommitFor(cell.column.id),
											cancel: editorCancelFor(),
											columnLabel: headerLabel(cell.column.id),
											autofocus: editorAutofocusFor(cell.column.id, rowIndexOf(row))
										}) : props.slots?.[`editor-${cell.column.id}`] ?? (props.renderEditor ?? props.slots?.["editor"] ? (props.renderEditor ?? props.slots?.["editor"])({
											columnId: cell.column.id,
											column: cell.column,
											row: cellSlotRow(row),
											value: editorValueFor(cell.column.id),
											commit: editorCommitFor(cell.column.id),
											cancel: editorCancelFor(),
											columnLabel: headerLabel(cell.column.id),
											autofocus: editorAutofocusFor(cell.column.id, rowIndexOf(row))
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "rdt-cell-editor",
											type: "text",
											"data-editing-cell": "",
											"data-builtin-editor": "",
											"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
											value: editorValueFor(cell.column.id),
											onInput: ($event) => {
												onCellEditorInput(cell.column.id, $event);
											},
											onKeyDown: ($event) => {
												onEditorKeyDown($event);
											},
											onBlur: ($event) => {
												onEditorBlur($event);
											},
											"data-rozie-s-d5dcab4c": ""
										}))
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "rdt-cell-editor",
										type: "text",
										"data-editing-cell": "",
										"data-builtin-editor": "",
										"aria-invalid": (0, _rozie_runtime_react.rozieAttr)(invalidMsg ? "true" : void 0),
										value: editorValueFor(cell.column.id),
										onInput: ($event) => {
											onCellEditorInput(cell.column.id, $event);
										},
										onKeyDown: ($event) => {
											onEditorKeyDown($event);
										},
										onBlur: ($event) => {
											onEditorBlur($event);
										},
										"data-rozie-s-d5dcab4c": ""
									})
								}) : cellIsPlaceholder(cell) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { display: "contents" },
									"data-rozie-s-d5dcab4c": ""
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "rdt-cell-value",
									"data-rozie-s-d5dcab4c": "",
									children: typeof props.slots?.[`cell-${cell.column.id}`] === "function" ? (props.slots?.[`cell-${cell.column.id}`])({
										columnId: cell.column.id,
										column: cell.column,
										row: cellSlotRow(row),
										value: cell.getValue()
									}) : props.slots?.[`cell-${cell.column.id}`] ?? (props.renderCell ?? props.slots?.["cell"] ? (props.renderCell ?? props.slots?.["cell"])({
										columnId: cell.column.id,
										column: cell.column,
										row: cellSlotRow(row),
										value: cell.getValue()
									}) : (0, _rozie_runtime_react.rozieDisplay)(cell.getValue()))
								}), !!isFillHandleCell(rowIndexOf(row), colIndexOf(row, cell)) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "rdt-fill-handle",
									"data-fill-handle": "",
									"data-testid": "fill-handle",
									"aria-hidden": "true",
									onPointerDown: ($event) => {
										onFillHandlePointerDown($event);
									},
									"data-rozie-s-d5dcab4c": ""
								})]
							}, cell.id))
						}, row.id), !!rowShowsDetail(row) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
							className: "rdt-detail-row",
							role: "row",
							"data-detail-row": (0, _rozie_runtime_react.rozieAttr)(row.id),
							"data-rozie-s-d5dcab4c": "",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
								className: "rdt-detail-cell",
								colSpan: visibleColCount(),
								"data-rozie-s-d5dcab4c": "",
								children: (props.renderDetail ?? props.slots?.["detail"])?.({ row: row.original })
							})
						}, row.id)] }, row.id))
					})]
				}),
				!!!rowsWindowed() && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rdt-pagination",
					role: "group",
					"aria-label": "Pagination",
					"data-rozie-s-d5dcab4c": "",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "rdt-page-btn rdt-page-prev",
							disabled: !canPrevPage(),
							onClick: ($event) => {
								onPrevPage();
							},
							"data-rozie-s-d5dcab4c": "",
							children: "Prev"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "rdt-page-status",
							"aria-live": "polite",
							"data-rozie-s-d5dcab4c": "",
							children: (0, _rozie_runtime_react.rozieDisplay)("Page " + (pageIndex() + 1) + " of " + displayPageCount())
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "rdt-page-btn rdt-page-next",
							disabled: !canNextPage(),
							onClick: ($event) => {
								onNextPage();
							},
							"data-rozie-s-d5dcab4c": "",
							children: "Next"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: "rdt-page-size",
							"aria-label": "Rows per page",
							value: pageSize(),
							onChange: ($event) => {
								onPageSizeChange($event);
							},
							"data-rozie-s-d5dcab4c": "",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: 10,
									"data-rozie-s-d5dcab4c": "",
									children: "10"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: 25,
									"data-rozie-s-d5dcab4c": "",
									children: "25"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: 50,
									"data-rozie-s-d5dcab4c": "",
									children: "50"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: 100,
									"data-rozie-s-d5dcab4c": "",
									children: "100"
								})
							]
						})
					]
				})
			]
		}) })
	});
});
//#endregion
//#region src/Column.tsx
function Column(_props) {
	const registry = (0, react.useContext)((0, _rozie_runtime_react.rozieContext)("data-table:columns"));
	const __defaultEditorOptions = (0, react.useState)(() => [])[0];
	const props = {
		..._props,
		id: _props.id ?? "",
		field: _props.field ?? "",
		header: _props.header ?? "",
		sortable: _props.sortable ?? false,
		filterable: _props.filterable ?? false,
		pinned: _props.pinned ?? "",
		width: _props.width ?? "",
		expandable: _props.expandable ?? false,
		groupable: _props.groupable ?? true,
		aggregationFn: _props.aggregationFn ?? null,
		editable: _props.editable ?? false,
		editor: _props.editor ?? "text",
		editorOptions: _props.editorOptions ?? __defaultEditorOptions,
		validate: _props.validate ?? null
	};
	const reg = (0, react.useRef)(null);
	const registered = (0, react.useRef)(false);
	const _watch0First = (0, react.useRef)(true);
	reg.current = registry;
	const colId = (0, react.useCallback)(() => props.id !== "" ? props.id : props.field, [props.field, props.id]);
	const buildSpec = (0, react.useCallback)(() => ({
		id: colId(),
		field: props.field !== "" ? props.field : colId(),
		header: props.header,
		sortable: props.sortable,
		filterable: props.filterable,
		pinned: props.pinned,
		width: props.width,
		expandable: props.expandable,
		groupable: props.groupable,
		aggregationFn: props.aggregationFn,
		editable: props.editable,
		editor: props.editor,
		editorOptions: props.editorOptions,
		validate: props.validate
	}), [
		colId,
		props.aggregationFn,
		props.editable,
		props.editor,
		props.editorOptions,
		props.expandable,
		props.field,
		props.filterable,
		props.groupable,
		props.header,
		props.pinned,
		props.sortable,
		props.validate,
		props.width
	]);
	const _buildSpecRef = (0, react.useRef)(buildSpec);
	_buildSpecRef.current = buildSpec;
	const _colIdRef = (0, react.useRef)(colId);
	_colIdRef.current = colId;
	(0, react.useEffect)(() => {
		if (reg.current && !registered.current) {
			registered.current = true;
			reg.current.registerColumn(_colIdRef.current(), _buildSpecRef.current());
		}
		return () => {
			if (reg.current) reg.current.unregisterColumn(_colIdRef.current());
		};
	}, []);
	(0, react.useEffect)(() => {
		if (registered.current) return;
		const live = registry;
		if (live == null) return;
		reg.current = live;
		registered.current = true;
		reg.current.registerColumn(colId(), buildSpec());
	}, [
		buildSpec,
		colId,
		reg,
		registered,
		registry
	]);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		if (reg.current) reg.current.registerColumn(colId(), buildSpec());
	}, [
		props.aggregationFn,
		props.editable,
		props.editor,
		props.editorOptions,
		props.expandable,
		props.field,
		props.filterable,
		props.groupable,
		props.header,
		props.id,
		props.pinned,
		props.sortable,
		props.validate,
		props.width
	]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "rozie-data-table-column",
		style: { display: "none" },
		"data-rozie-s-289f2d72": ""
	}) });
}
//#endregion
//#region src/EditorText.tsx
function EditorText(_props) {
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		row: _props.row ?? null,
		value: _props.value ?? null,
		commit: _props.commit ?? null,
		cancel: _props.cancel ?? null,
		autofocus: _props.autofocus ?? false,
		columnLabel: _props.columnLabel ?? ""
	};
	const _autofocusRef = (0, react.useRef)(props.autofocus);
	_autofocusRef.current = props.autofocus;
	const [draft, setDraft] = (0, react.useState)("");
	const [touched, setTouched] = (0, react.useState)(false);
	const inputEl = (0, react.useRef)(null);
	const _watch0First = (0, react.useRef)(true);
	function draftValue() {
		return touched ? draft : props.value != null ? String(props.value) : "";
	}
	const onInput = (0, react.useCallback)((e) => {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	function doCommit() {
		props.commit && props.commit(draftValue());
	}
	function doCancel() {
		props.cancel && props.cancel();
	}
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}, [doCancel, doCommit]);
	const onBlur = (0, react.useCallback)(() => {
		doCommit();
	}, [doCommit]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_autofocusRef.current) inputEl.current?.focus();
	}, []);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		if (props.autofocus) inputEl.current?.focus();
	}, [props.autofocus]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		ref: inputEl,
		className: "rdt-cell-editor",
		type: "text",
		"data-editing-cell": "",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		value: draftValue(),
		onInput: ($event) => {
			onInput($event);
		},
		onKeyDown: ($event) => {
			onKeydown($event);
		},
		onBlur: ($event) => {
			onBlur();
		},
		"data-rozie-s-0d17f43a": ""
	}) });
}
//#endregion
//#region src/EditorNumber.tsx
function EditorNumber(_props) {
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		row: _props.row ?? null,
		value: _props.value ?? null,
		commit: _props.commit ?? null,
		cancel: _props.cancel ?? null,
		autofocus: _props.autofocus ?? false,
		columnLabel: _props.columnLabel ?? ""
	};
	const _autofocusRef = (0, react.useRef)(props.autofocus);
	_autofocusRef.current = props.autofocus;
	const [draft, setDraft] = (0, react.useState)("");
	const [touched, setTouched] = (0, react.useState)(false);
	const inputEl = (0, react.useRef)(null);
	const _watch0First = (0, react.useRef)(true);
	function draftValue() {
		return touched ? draft : props.value != null ? String(props.value) : "";
	}
	const onInput = (0, react.useCallback)((e) => {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	function doCommit() {
		if (!props.commit) return;
		const raw = draftValue();
		if (raw == null || String(raw).trim() === "") {
			props.commit(null);
			return;
		}
		const n = Number(raw);
		props.commit(Number.isNaN(n) ? null : n);
	}
	function doCancel() {
		props.cancel && props.cancel();
	}
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}, [doCancel, doCommit]);
	const onBlur = (0, react.useCallback)(() => {
		doCommit();
	}, [doCommit]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_autofocusRef.current) inputEl.current?.focus();
	}, []);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		if (props.autofocus) inputEl.current?.focus();
	}, [props.autofocus]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		ref: inputEl,
		className: "rdt-cell-editor",
		type: "number",
		"data-editing-cell": "",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		value: draftValue(),
		onInput: ($event) => {
			onInput($event);
		},
		onKeyDown: ($event) => {
			onKeydown($event);
		},
		onBlur: ($event) => {
			onBlur();
		},
		"data-rozie-s-b2792b32": ""
	}) });
}
//#endregion
//#region src/EditorSelect.tsx
function EditorSelect(_props) {
	const __defaultOptions = (0, react.useState)(() => [])[0];
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		row: _props.row ?? null,
		value: _props.value ?? null,
		commit: _props.commit ?? null,
		cancel: _props.cancel ?? null,
		options: _props.options ?? __defaultOptions,
		autofocus: _props.autofocus ?? false,
		columnLabel: _props.columnLabel ?? ""
	};
	const _autofocusRef = (0, react.useRef)(props.autofocus);
	_autofocusRef.current = props.autofocus;
	const [draft, setDraft] = (0, react.useState)("");
	const [touched, setTouched] = (0, react.useState)(false);
	const selectEl = (0, react.useRef)(null);
	const _watch0First = (0, react.useRef)(true);
	function draftValue() {
		return touched ? draft : props.value != null ? String(props.value) : "";
	}
	const onChange = (0, react.useCallback)((e) => {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	function doCommit() {
		props.commit && props.commit(draftValue());
	}
	function doCancel() {
		props.cancel && props.cancel();
	}
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}, [doCancel, doCommit]);
	const onBlur = (0, react.useCallback)(() => {
		doCommit();
	}, [doCommit]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_autofocusRef.current) selectEl.current?.focus();
	}, []);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		if (props.autofocus) selectEl.current?.focus();
	}, [props.autofocus]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
		ref: selectEl,
		className: "rdt-cell-editor",
		"data-editing-cell": "",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		value: draftValue(),
		onChange: ($event) => {
			onChange($event);
		},
		onKeyDown: ($event) => {
			onKeydown($event);
		},
		onBlur: ($event) => {
			onBlur();
		},
		"data-rozie-s-117f1a16": "",
		children: props.options.map((opt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: (0, _rozie_runtime_react.rozieAttr)(opt.value),
			"data-rozie-s-117f1a16": "",
			children: (0, _rozie_runtime_react.rozieDisplay)(opt.label)
		}, opt.value))
	}) });
}
//#endregion
//#region src/EditorCheckbox.tsx
function EditorCheckbox(_props) {
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		row: _props.row ?? null,
		value: _props.value ?? null,
		commit: _props.commit ?? null,
		cancel: _props.cancel ?? null,
		autofocus: _props.autofocus ?? false,
		columnLabel: _props.columnLabel ?? ""
	};
	const _autofocusRef = (0, react.useRef)(props.autofocus);
	_autofocusRef.current = props.autofocus;
	const inputEl = (0, react.useRef)(null);
	const _watch0First = (0, react.useRef)(true);
	const { commit: _rozieProp_commit } = props;
	const onChange = (0, react.useCallback)((e) => {
		_rozieProp_commit && _rozieProp_commit(!!(e && e.target ? e.target.checked : false));
	}, [_rozieProp_commit]);
	const { cancel: _rozieProp_cancel } = props;
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Escape") {
			e.preventDefault();
			_rozieProp_cancel && _rozieProp_cancel();
		}
	}, [_rozieProp_cancel]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_autofocusRef.current) inputEl.current?.focus();
	}, []);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		if (props.autofocus) inputEl.current?.focus();
	}, [props.autofocus]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		ref: inputEl,
		className: "rdt-cell-editor",
		type: "checkbox",
		"data-editing-cell": "",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		checked: !!props.value,
		onChange: ($event) => {
			onChange($event);
		},
		onKeyDown: ($event) => {
			onKeydown($event);
		},
		"data-rozie-s-3d792482": ""
	}) });
}
//#endregion
//#region src/helpers/dateValue.ts
/**
* Coerce an arbitrary cell value to the `YYYY-MM-DD` string a native date input accepts.
* Returns `''` for anything that cannot be read as a date — which is what the input shows for
* "no date", so an unparseable value degrades to empty rather than to a broken control.
*/
const toIsoDateString = (v) => {
	if (v == null || v === "") return "";
	if (typeof v === "string") {
		const s = v.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
		const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(s);
		if (iso) return iso[1];
		return fromDate(new Date(s));
	}
	if (typeof v === "number") return Number.isFinite(v) ? fromDate(new Date(v)) : "";
	if (typeof v === "object" && typeof v.getTime === "function") return fromDate(v);
	return "";
};
/**
* Format a Date as `YYYY-MM-DD` from its LOCAL parts. Local, not UTC: the input renders a
* calendar day, and `toISOString()` would show the previous day for anyone west of UTC on a
* midnight-local value.
*/
const fromDate = (d) => {
	const t = d.getTime();
	if (!Number.isFinite(t)) return "";
	const y = d.getFullYear();
	const m = d.getMonth() + 1;
	const day = d.getDate();
	return String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(day).padStart(2, "0");
};
//#endregion
//#region src/EditorDate.tsx
function EditorDate(_props) {
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		row: _props.row ?? null,
		value: _props.value ?? null,
		commit: _props.commit ?? null,
		cancel: _props.cancel ?? null,
		autofocus: _props.autofocus ?? false,
		columnLabel: _props.columnLabel ?? ""
	};
	const _autofocusRef = (0, react.useRef)(props.autofocus);
	_autofocusRef.current = props.autofocus;
	const [draft, setDraft] = (0, react.useState)("");
	const [touched, setTouched] = (0, react.useState)(false);
	const inputEl = (0, react.useRef)(null);
	const _watch0First = (0, react.useRef)(true);
	function draftValue() {
		return touched ? draft : toIsoDateString(props.value);
	}
	const onInput = (0, react.useCallback)((e) => {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	function doCommit() {
		props.commit && props.commit(draftValue());
	}
	function doCancel() {
		props.cancel && props.cancel();
	}
	const onChange = (0, react.useCallback)((e) => {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}, [doCancel, doCommit]);
	const onBlur = (0, react.useCallback)(() => {
		doCommit();
	}, [doCommit]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_autofocusRef.current) inputEl.current?.focus();
	}, []);
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		if (props.autofocus) inputEl.current?.focus();
	}, [props.autofocus]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		ref: inputEl,
		className: "rdt-cell-editor",
		type: "date",
		"data-editing-cell": "",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		value: draftValue(),
		onInput: ($event) => {
			onInput($event);
		},
		onChange: ($event) => {
			onChange($event);
		},
		onKeyDown: ($event) => {
			onKeydown($event);
		},
		onBlur: ($event) => {
			onBlur();
		},
		"data-rozie-s-7abe1a56": ""
	}) });
}
//#endregion
//#region src/FilterText.tsx
function FilterText(_props) {
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		value: _props.value ?? null,
		setFilter: _props.setFilter ?? null,
		columnLabel: _props.columnLabel ?? ""
	};
	const [draft, setDraft] = (0, react.useState)("");
	const [touched, setTouched] = (0, react.useState)(false);
	const _watch0First = (0, react.useRef)(true);
	function draftValue() {
		return touched ? draft : props.value != null ? String(props.value) : "";
	}
	const onInput = (0, react.useCallback)((e) => {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	function applyFilter() {
		props.setFilter && props.setFilter(props.columnId, draftValue());
	}
	function clearFilter() {
		setDraft("");
		setTouched(false);
		props.setFilter && props.setFilter(props.columnId, "");
	}
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Enter") {
			e.preventDefault();
			applyFilter();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			clearFilter();
		}
	}, [applyFilter, clearFilter]);
	const onBlur = (0, react.useCallback)(() => {
		applyFilter();
	}, [applyFilter]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		setTouched(false);
	}, [props.value]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		className: "rdt-col-filter",
		part: "col-filter",
		type: "text",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		value: draftValue(),
		onInput: ($event) => {
			onInput($event);
		},
		onKeyDown: ($event) => {
			onKeydown($event);
		},
		onBlur: ($event) => {
			onBlur();
		},
		"data-rozie-s-18cbb44e": ""
	}) });
}
//#endregion
//#region src/FilterNumberRange.tsx
function FilterNumberRange(_props) {
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		value: _props.value ?? null,
		setFilter: _props.setFilter ?? null,
		minMax: _props.minMax ?? null,
		columnLabel: _props.columnLabel ?? ""
	};
	const [minDraft, setMinDraft] = (0, react.useState)("");
	const [maxDraft, setMaxDraft] = (0, react.useState)("");
	const [touched, setTouched] = (0, react.useState)(false);
	const _watch0First = (0, react.useRef)(true);
	function minDraftValue() {
		return touched ? minDraft : Array.isArray(props.value) && props.value[0] != null ? String(props.value[0]) : "";
	}
	function maxDraftValue() {
		return touched ? maxDraft : Array.isArray(props.value) && props.value[1] != null ? String(props.value[1]) : "";
	}
	const onMinInput = (0, react.useCallback)((e) => {
		setMinDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	const onMaxInput = (0, react.useCallback)((e) => {
		setMaxDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}, []);
	const onKeydown = (0, react.useCallback)((e) => {
		if (e && e.key === "Enter") applyRange(minDraftValue(), maxDraftValue());
	}, [
		applyRange,
		maxDraftValue,
		minDraftValue
	]);
	const onBlur = (0, react.useCallback)(() => {
		applyRange(minDraftValue(), maxDraftValue());
	}, [
		applyRange,
		maxDraftValue,
		minDraftValue
	]);
	function minPlaceholder() {
		return Array.isArray(props.minMax) && props.minMax[0] != null ? String(props.minMax[0]) : "";
	}
	function maxPlaceholder() {
		return Array.isArray(props.minMax) && props.minMax[1] != null ? String(props.minMax[1]) : "";
	}
	function applyRange(minDraft, maxDraft) {
		const minNum = minDraft === "" ? void 0 : Number(minDraft);
		const maxNum = maxDraft === "" ? void 0 : Number(maxDraft);
		if (minNum === void 0 && maxNum === void 0) props.setFilter && props.setFilter(props.columnId, "");
		else props.setFilter && props.setFilter(props.columnId, [minNum, maxNum]);
	}
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	(0, react.useEffect)(() => {
		if (_watch0First.current) {
			_watch0First.current = false;
			return;
		}
		setTouched(false);
	}, [
		Array,
		String,
		props.value
	]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		style: {
			display: "flex",
			alignItems: "center"
		},
		"data-rozie-s-97b2c090": "",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: "rdt-col-filter",
				part: "col-filter",
				type: "number",
				"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel() + " min"),
				placeholder: (0, _rozie_runtime_react.rozieAttr)(minPlaceholder()),
				value: minDraftValue(),
				onInput: ($event) => {
					onMinInput($event);
				},
				onKeyDown: ($event) => {
					onKeydown($event);
				},
				onBlur: ($event) => {
					onBlur();
				},
				"data-rozie-s-97b2c090": ""
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"data-rozie-s-97b2c090": "",
				children: " - "
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: "rdt-col-filter",
				part: "col-filter",
				type: "number",
				"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel() + " max"),
				placeholder: (0, _rozie_runtime_react.rozieAttr)(maxPlaceholder()),
				value: maxDraftValue(),
				onInput: ($event) => {
					onMaxInput($event);
				},
				onKeyDown: ($event) => {
					onKeydown($event);
				},
				onBlur: ($event) => {
					onBlur();
				},
				"data-rozie-s-97b2c090": ""
			})
		]
	}) });
}
//#endregion
//#region src/FilterSelect.tsx
function FilterSelect(_props) {
	const __defaultUniqueValues = (0, react.useState)(() => [])[0];
	const props = {
		..._props,
		columnId: _props.columnId ?? "",
		column: _props.column ?? null,
		value: _props.value ?? null,
		setFilter: _props.setFilter ?? null,
		uniqueValues: _props.uniqueValues ?? __defaultUniqueValues,
		columnLabel: _props.columnLabel ?? ""
	};
	function selectValue() {
		return props.value != null ? String(props.value) : "";
	}
	const { setFilter: _rozieProp_setFilter } = props;
	const onChange = (0, react.useCallback)((e) => {
		const v = e && e.target ? e.target.value : "";
		if (v === "") _rozieProp_setFilter && _rozieProp_setFilter(props.columnId, "");
		else _rozieProp_setFilter && _rozieProp_setFilter(props.columnId, v);
	}, [_rozieProp_setFilter, props.columnId]);
	function a11yLabel() {
		if (typeof props.columnLabel === "string" && props.columnLabel !== "") return props.columnLabel;
		return props.columnId;
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
		className: "rdt-col-filter",
		part: "col-filter",
		"aria-label": (0, _rozie_runtime_react.rozieAttr)(a11yLabel()),
		value: selectValue(),
		onChange: ($event) => {
			onChange($event);
		},
		"data-rozie-s-d75b42b2": "",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "",
			"data-rozie-s-d75b42b2": "",
			children: "All"
		}), props.uniqueValues.map((opt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: (0, _rozie_runtime_react.rozieAttr)(opt),
			"data-rozie-s-d75b42b2": "",
			children: (0, _rozie_runtime_react.rozieDisplay)(opt)
		}, opt))]
	}) });
}
//#endregion
//#region src/GroupBar.tsx
function GroupBar(_props) {
	const __defaultGrouping = (0, react.useState)(() => [])[0];
	const __defaultGroupableColumns = (0, react.useState)(() => [])[0];
	const props = {
		..._props,
		grouping: _props.grouping ?? __defaultGrouping,
		groupableColumns: _props.groupableColumns ?? __defaultGroupableColumns,
		applyGrouping: _props.applyGrouping ?? null,
		clearGrouping: _props.clearGrouping ?? null
	};
	const [draggingId, setDraggingId] = (0, react.useState)("");
	const [isOver, setIsOver] = (0, react.useState)(false);
	const [dragKind, setDragKind] = (0, react.useState)("");
	const [dropKey, setDropKey] = (0, react.useState)("");
	const { applyGrouping: _rozieProp_applyGrouping } = props;
	const onChipDragStart = (0, react.useCallback)((e, id) => {
		setDraggingId(id);
		setDragKind("chip");
		if (e && e.dataTransfer) e.dataTransfer.setData("text/plain", id);
	}, []);
	const onTokenDragStart = (0, react.useCallback)((e, gk) => {
		setDraggingId(gk);
		setDragKind("token");
		if (e && e.dataTransfer) e.dataTransfer.setData("text/plain", gk);
	}, []);
	const onDragOver = (0, react.useCallback)((e) => {
		if (e) e.preventDefault();
		setIsOver(true);
	}, []);
	const onTokenDragOver = (0, react.useCallback)((e, gk) => {
		if (e) e.preventDefault();
		if (dragKind === "token") setDropKey(gk);
	}, [dragKind]);
	const onDragLeave = (0, react.useCallback)((e) => {
		if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
		setIsOver(false);
		setDropKey("");
	}, []);
	function resetDrag() {
		setDraggingId("");
		setDragKind("");
		setDropKey("");
		setIsOver(false);
	}
	const onDragEnd = (0, react.useCallback)(() => {
		resetDrag();
	}, [resetDrag]);
	const onDrop = (0, react.useCallback)((e) => {
		if (e) e.preventDefault();
		const kind = dragKind;
		const anchor = dropKey;
		const id = e && e.dataTransfer && e.dataTransfer.getData("text/plain") || draggingId;
		resetDrag();
		if (!id) return;
		if (kind === "token") {
			if (props.grouping.indexOf(id) === -1) return;
			const without = props.grouping.filter((k) => k !== id);
			let to = without.length;
			if (anchor && anchor !== id) {
				const j = without.indexOf(anchor);
				if (j !== -1) to = j;
			}
			const next = without.slice(0, to).concat([id]).concat(without.slice(to));
			_rozieProp_applyGrouping && _rozieProp_applyGrouping(next);
			return;
		}
		if (props.grouping.indexOf(id) !== -1) return;
		const next = props.grouping.concat([id]);
		_rozieProp_applyGrouping && _rozieProp_applyGrouping(next);
	}, [
		_rozieProp_applyGrouping,
		dragKind,
		draggingId,
		dropKey,
		props.grouping,
		resetDrag
	]);
	const removeKey = (0, react.useCallback)((key) => {
		_rozieProp_applyGrouping && _rozieProp_applyGrouping(props.grouping.filter((k) => k !== key));
	}, [_rozieProp_applyGrouping, props.grouping]);
	const { clearGrouping: _rozieProp_clearGrouping } = props;
	const clearAll = (0, react.useCallback)(() => {
		_rozieProp_clearGrouping && _rozieProp_clearGrouping();
	}, [_rozieProp_clearGrouping]);
	function labelFor(key) {
		const col = props.groupableColumns.find((c) => c.id === key);
		return col && col.label || key;
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "rdt-group-bar",
		"data-rozie-s-546c469a": "",
		children: [
			props.groupableColumns.map((col) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "rdt-group-token",
				part: "group-token",
				draggable: "true",
				onDragStart: ($event) => {
					onChipDragStart($event, col.id);
				},
				onDragEnd: ($event) => {
					onDragEnd();
				},
				"data-rozie-s-546c469a": "",
				children: (0, _rozie_runtime_react.rozieDisplay)(col.label)
			}, col.id)),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: (0, _rozie_runtime_react.clsx)("rdt-group-drop-zone", { "is-over": isOver }),
				"data-group-drop-zone": "",
				onDragOver: ($event) => {
					onDragOver($event);
				},
				onDragLeave: ($event) => {
					onDragLeave($event);
				},
				onDrop: ($event) => {
					onDrop($event);
				},
				"data-rozie-s-546c469a": "",
				children: [!!!props.grouping.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "rdt-group-drop-hint",
					"data-rozie-s-546c469a": "",
					children: "Drag columns here to group"
				}), props.grouping.map((gk) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: (0, _rozie_runtime_react.clsx)("rdt-group-token", { "is-drop-target": dragKind === "token" && dropKey === gk && draggingId !== gk }),
					part: "group-token",
					"data-group-token": "",
					draggable: "true",
					onDragStart: ($event) => {
						onTokenDragStart($event, gk);
					},
					onDragOver: ($event) => {
						onTokenDragOver($event, gk);
					},
					onDragEnd: ($event) => {
						onDragEnd();
					},
					"data-rozie-s-546c469a": "",
					children: [(0, _rozie_runtime_react.rozieDisplay)(labelFor(gk)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rdt-group-token-remove",
						"aria-label": (0, _rozie_runtime_react.rozieAttr)("Remove " + labelFor(gk) + " grouping"),
						onClick: ($event) => {
							removeKey(gk);
						},
						"data-rozie-s-546c469a": "",
						children: "×"
					})]
				}, gk))]
			}),
			!!props.grouping.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "rdt-group-clear",
				onClick: ($event) => {
					clearAll();
				},
				"data-rozie-s-546c469a": "",
				children: "Clear"
			})
		]
	}) });
}
//#endregion
//#region src/DetailPanel.tsx
function DetailPanel(_props) {
	const props = {
		..._props,
		row: _props.row ?? null
	};
	function entries() {
		const r = props.row;
		if (!r) return [];
		return Object.keys(r).map((key) => ({
			key,
			value: r[key] == null ? "" : String(r[key])
		}));
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
		className: "rdt-detail-panel",
		"data-rozie-s-8f65bdaa": "",
		children: entries().map((pair) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "rdt-detail-entry",
			"data-rozie-s-8f65bdaa": "",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
				className: "rdt-detail-key",
				"data-rozie-s-8f65bdaa": "",
				children: (0, _rozie_runtime_react.rozieDisplay)(pair.key)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
				className: "rdt-detail-value",
				"data-rozie-s-8f65bdaa": "",
				children: (0, _rozie_runtime_react.rozieDisplay)(pair.value)
			})]
		}, pair.key))
	}) });
}
//#endregion
exports.Column = Column;
exports.DataTable = DataTable;
exports.DetailPanel = DetailPanel;
exports.EditorCheckbox = EditorCheckbox;
exports.EditorDate = EditorDate;
exports.EditorNumber = EditorNumber;
exports.EditorSelect = EditorSelect;
exports.EditorText = EditorText;
exports.FilterNumberRange = FilterNumberRange;
exports.FilterSelect = FilterSelect;
exports.FilterText = FilterText;
exports.GroupBar = GroupBar;
exports.default = DataTable;
