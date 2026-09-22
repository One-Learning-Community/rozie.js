import { LitElement, css, html, nothing } from "lit";
import { customElement, property, query, queryAssignedElements, state } from "lit/decorators.js";
import { SignalWatcher, effect, signal, untracked } from "@lit-labs/preact-signals";
import { RozieSlotDistributor, createLitControllableProperty, rozieAttr, rozieDisplay, rozieStyle } from "@rozie/runtime-lit";
import { ContextConsumer, ContextProvider, createContext } from "@lit/context";
import { repeat } from "lit/directives/repeat.js";
import "@rozie-ui/popover-lit";
import { createTable, getCoreRowModel, getExpandedRowModel, getFacetedMinMaxValues, getFacetedRowModel, getFacetedUniqueValues, getFilteredRowModel, getGroupedRowModel, getPaginationRowModel, getSortedRowModel } from "@tanstack/table-core";
import { Virtualizer, elementScroll, measureElement, observeElementOffset, observeElementRect } from "@tanstack/virtual-core";
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
//#region \0@oxc-project+runtime@0.127.0/helpers/decorate.js
function __decorate(decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
}
//#endregion
//#region src/DataTable.ts
const __rozieCtx_data_table_columns$1 = createContext(Symbol.for("rozie:data-table:columns"));
let DataTable = class DataTable extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this._dataControllable = createLitControllableProperty({
			host: this,
			eventName: "data-change",
			defaultValue: [],
			initialControlledValue: void 0
		});
		this.columns = [];
		this.selectionMode = "none";
		this._sorting_attr = [];
		this._sortingControllable = createLitControllableProperty({
			host: this,
			eventName: "sorting-change",
			defaultValue: [],
			initialControlledValue: void 0
		});
		this._globalFilter_attr = "";
		this._globalFilterControllable = createLitControllableProperty({
			host: this,
			eventName: "global-filter-change",
			defaultValue: "",
			initialControlledValue: void 0
		});
		this._columnFilters_attr = [];
		this._columnFiltersControllable = createLitControllableProperty({
			host: this,
			eventName: "column-filters-change",
			defaultValue: [],
			initialControlledValue: void 0
		});
		this._pagination_attr = {
			pageIndex: 0,
			pageSize: 10
		};
		this._paginationControllable = createLitControllableProperty({
			host: this,
			eventName: "pagination-change",
			defaultValue: {
				pageIndex: 0,
				pageSize: 10
			},
			initialControlledValue: void 0
		});
		this.manual = false;
		this.rowCount = null;
		this.pageCount = null;
		this.expandable = false;
		this._expanded_attr = null;
		this._expandedControllable = createLitControllableProperty({
			host: this,
			eventName: "expanded-change",
			defaultValue: null,
			initialControlledValue: void 0
		});
		this.getSubRows = null;
		this.groupable = false;
		this._grouping_attr = null;
		this._groupingControllable = createLitControllableProperty({
			host: this,
			eventName: "grouping-change",
			defaultValue: null,
			initialControlledValue: void 0
		});
		this._rowSelection_attr = {};
		this._rowSelectionControllable = createLitControllableProperty({
			host: this,
			eventName: "row-selection-change",
			defaultValue: {},
			initialControlledValue: void 0
		});
		this._columnVisibility_attr = {};
		this._columnVisibilityControllable = createLitControllableProperty({
			host: this,
			eventName: "column-visibility-change",
			defaultValue: {},
			initialControlledValue: void 0
		});
		this._columnSizing_attr = {};
		this._columnSizingControllable = createLitControllableProperty({
			host: this,
			eventName: "column-sizing-change",
			defaultValue: {},
			initialControlledValue: void 0
		});
		this._columnOrder_attr = [];
		this._columnOrderControllable = createLitControllableProperty({
			host: this,
			eventName: "column-order-change",
			defaultValue: [],
			initialControlledValue: void 0
		});
		this._columnPinning_attr = {
			left: [],
			right: []
		};
		this._columnPinningControllable = createLitControllableProperty({
			host: this,
			eventName: "column-pinning-change",
			defaultValue: {
				left: [],
				right: []
			},
			initialControlledValue: void 0
		});
		this.stickyHeader = false;
		this.interactionMode = "table";
		this.singleClickEdit = false;
		this.undoable = false;
		this.undoLimit = 100;
		this.virtual = false;
		this.estimateRowHeight = 40;
		this.autoMeasure = false;
		this.maxHeight = "";
		this._dataDefault = signal([]);
		this._sortingDefault = signal([]);
		this._globalFilterDefault = signal("");
		this._columnFiltersDefault = signal([]);
		this._paginationDefault = signal({
			pageIndex: 0,
			pageSize: 10
		});
		this._rowSelectionDefault = signal({});
		this._expandedDefault = signal({});
		this._groupingDefault = signal([]);
		this._columnVisibilityDefault = signal({});
		this._columnSizingDefault = signal({});
		this._columnOrderDefault = signal([]);
		this._columnPinningDefault = signal({
			left: [],
			right: []
		});
		this._columnSizingInfo = signal({
			startOffset: null,
			startSize: null,
			deltaOffset: null,
			deltaPercentage: null,
			isResizingColumn: false,
			columnSizingStart: []
		});
		this._colReg = signal({});
		this._rows = signal([]);
		this._headerGroups = signal([]);
		this._rowModelVer = signal(0);
		this._windowVer = signal(0);
		this._activeRow = signal(0);
		this._activeColIndex = signal(0);
		this._activeIsHeader = signal(false);
		this._activeHeaderLevel = signal(0);
		this._activeInControl = signal(false);
		this._editingRow = signal(-1);
		this._editingCol = signal(-1);
		this._draftValue = signal(null);
		this._invalidMsg = signal("");
		this._editVer = signal(0);
		this._editFocusColId = signal(null);
		this._editingRowIndex = signal(null);
		this._rowDraft = signal({});
		this._rangeAnchor = signal(null);
		this._rangeFocus = signal(null);
		this._pasteAnnounce = signal("");
		this._rangeAnnounce = signal("");
		this._liveAnnounce = signal("");
		this.__rozieWatchInitial_0 = true;
		this.__rozieWatchInitial_1 = true;
		this.__rozieCtxProvider_data_table_columns = new ContextProvider(this, {
			context: __rozieCtx_data_table_columns$1,
			initialValue: ((__rozieCtxHost) => ({
				registerColumn: (id, spec) => {
					if (id == null) return;
					const key = String(id);
					if (key === "__proto__" || key === "constructor" || key === "prototype") return;
					const prev = __rozieCtxHost._colReg.value ? __rozieCtxHost._colReg.value[key] : void 0;
					if (prev !== void 0 && columnSpecsEquivalent(prev, spec)) return;
					__rozieCtxHost._colReg.value = {
						...__rozieCtxHost._colReg.value,
						[key]: spec
					};
				},
				unregisterColumn: (id) => {
					if (id == null) return;
					const r = { ...__rozieCtxHost._colReg.value };
					delete r[String(id)];
					__rozieCtxHost._colReg.value = r;
				}
			}))(this)
		});
		this._rozieSlotDistributor = new RozieSlotDistributor(this);
		this._hasSlotDefault = false;
		this._hasSlotGroupBar = false;
		this._hasSlotSelectAll = false;
		this._hasSlotDynamicColHeader = false;
		this._hasSlotDynamicFilter = false;
		this._hasSlotSelectCell = false;
		this._hasSlotDynamicCell = false;
		this._hasSlotDynamicEditor = false;
		this._hasSlotDetail = false;
		this._hasSlotColHeader = false;
		this._hasSlotFilter = false;
		this._hasSlotCell = false;
		this._hasSlotEditor = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.table = null;
		this.virtualizer = null;
		this.virtualizerCleanup = null;
		this.gridScrollEl = null;
		this.colVirtualizer = null;
		this.colVirtualizerCleanup = null;
		this.remeasurePending = false;
		this.remeasureRaf = null;
		this.remeasureDisposed = false;
		this.GRID_PAGE_STEP = 10;
		this.gridRoot = null;
		this.outsidePointerDown = false;
		this.docPointerDown = null;
		this.programmatic = 0;
		this.focusIntentEpoch = 0;
		this.DATA_WRITE_TOKEN_KEY = "__rozieDataWriteToken";
		this.undoStack = [];
		this.redoStack = [];
		this.restoringHistory = false;
		this.expandedTouched = false;
		this.groupingActiveDefault = () => ((this.grouping != null ? this.grouping : this._groupingDefault.value) || []).length > 0;
		this.effectiveColumnPinning = () => {
			const base = this.columnPinning != null ? this.columnPinning : this._columnPinningDefault.value;
			const rail = [];
			if (this.selectionEnabled()) rail.push(this.SELECT_COL_ID);
			if (this.expandable === true) rail.push(this.EXPANDER_COL_ID);
			if (rail.length === 0) return base;
			const deduped = (base && base.left ? base.left : []).filter((id) => id !== this.SELECT_COL_ID && id !== this.EXPANDER_COL_ID);
			return {
				...base,
				left: rail.concat(deduped)
			};
		};
		this.pinSeedApplied = false;
		this.seedColumnPinning = () => {
			if (this.pinSeedApplied) return;
			const live = this.columnPinning != null ? this.columnPinning : this._columnPinningDefault.value;
			const isRealPin = (id) => id !== this.SELECT_COL_ID && id !== this.EXPANDER_COL_ID;
			if ((live && live.left ? live.left : []).filter(isRealPin).length > 0 || (live && live.right ? live.right : []).filter(isRealPin).length > 0) {
				this.pinSeedApplied = true;
				return;
			}
			const defs = this.columnDefs();
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
			this.pinSeedApplied = true;
			const seeded = {
				left,
				right
			};
			this._columnPinningDefault.value = seeded;
			this._columnPinningControllable.write(seeded);
		};
		this.currentState = () => ({
			sorting: this.sorting != null ? this.sorting : this._sortingDefault.value,
			globalFilter: this.globalFilter != null ? this.globalFilter : this._globalFilterDefault.value,
			columnFilters: this.columnFilters != null ? this.columnFilters : this._columnFiltersDefault.value,
			pagination: this.pagination != null ? this.pagination : this._paginationDefault.value,
			rowSelection: this.rowSelection != null ? this.rowSelection : this._rowSelectionDefault.value,
			expanded: this.expanded != null ? this.expanded : this.groupingActiveDefault() && !this.expandedTouched ? true : this._expandedDefault.value,
			grouping: this.grouping != null ? this.grouping : this._groupingDefault.value,
			columnVisibility: this.columnVisibility != null ? this.columnVisibility : this._columnVisibilityDefault.value,
			columnSizing: this.columnSizing != null ? this.columnSizing : this._columnSizingDefault.value,
			columnOrder: this.columnOrder != null ? this.columnOrder : this._columnOrderDefault.value,
			columnPinning: this.effectiveColumnPinning(),
			columnSizingInfo: this._columnSizingInfo.value
		});
		this.currentData = () => this.data != null ? this.data : this._dataDefault.value;
		this.parseWidthToSize = (w) => {
			if (typeof w === "number") return Number.isFinite(w) && w > 0 ? w : null;
			if (typeof w !== "string") return null;
			const t = w.trim();
			if (t === "") return null;
			const m = /^(\d+(?:\.\d+)?)(px)?$/i.exec(t);
			if (!m) return null;
			const n = Number.parseFloat(m[1]);
			return Number.isFinite(n) && n > 0 ? n : null;
		};
		this.editorWarned = Object.create(null);
		this.checkEditorKind = (id, editor) => {
			const msg = editorKindWarning(id, editor);
			if (!msg) return editor;
			const key = id + "\0" + String(editor);
			if (this.editorWarned[key]) return editor;
			this.editorWarned[key] = true;
			console.warn(msg);
			return editor;
		};
		this.buildConfigDef = (c) => {
			if (!c) return null;
			if (Array.isArray(c.columns)) {
				const kids = [];
				for (const child of c.columns) {
					const cd = this.buildConfigDef(child);
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
				...this.parseWidthToSize(c.width) != null ? { size: this.parseWidthToSize(c.width) } : {},
				meta: {
					editable: c.editable === true,
					editor: c.editor != null ? this.checkEditorKind(id, c.editor) : "text",
					editorOptions: c.editorOptions != null ? c.editorOptions : [],
					validate: typeof c.validate === "function" ? c.validate : null
				}
			};
		};
		this.columnDefsCache = null;
		this.columnDefsCacheColumnsRef = void 0;
		this.columnDefsCacheColRegRef = void 0;
		this.columnDefsIndexCache = null;
		this.columnDefs = () => {
			const cfg = this.columns || [];
			const reg = this._colReg.value || {};
			if (this.columnDefsCache && this.columns === this.columnDefsCacheColumnsRef && this._colReg.value === this.columnDefsCacheColRegRef) return this.columnDefsCache;
			const byId = Object.create(null);
			const order = [];
			for (const c of cfg) {
				const def = this.buildConfigDef(c);
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
					...this.parseWidthToSize(spec.width) != null ? { size: this.parseWidthToSize(spec.width) } : {},
					meta: {
						editable: spec.editable === true,
						editor: spec.editor != null ? this.checkEditorKind(id, spec.editor) : "text",
						editorOptions: spec.editorOptions != null ? spec.editorOptions : [],
						validate: typeof spec.validate === "function" ? spec.validate : null
					}
				};
			}
			const out = [];
			for (const id of order) if (byId[id]) out.push(byId[id]);
			this.columnDefsCache = out;
			this.columnDefsCacheColumnsRef = this.columns;
			this.columnDefsCacheColRegRef = this._colReg.value;
			this.columnDefsIndexCache = indexDefsById(out);
			return out;
		};
		this.defIndex = () => {
			this.columnDefs();
			return this.columnDefsIndexCache || Object.create(null);
		};
		this.SELECT_COL_ID = "__rdt_select";
		this.EXPANDER_COL_ID = "__rdt_expander";
		this.selectionEnabled = () => this.selectionMode === "single" || this.selectionMode === "multiple";
		this.tableColumns = () => {
			const cols = this.columnDefs();
			let withExpander = cols;
			if (this.expandable === true) withExpander = [{
				id: this.EXPANDER_COL_ID,
				enableSorting: false,
				enableColumnFilter: false,
				filterable: false,
				isExpanderColumn: true,
				pinned: "",
				width: "",
				size: 40
			}].concat(cols);
			if (this.selectionEnabled()) return [{
				id: this.SELECT_COL_ID,
				enableSorting: false,
				enableColumnFilter: false,
				filterable: false,
				isSelectColumn: true,
				pinned: "",
				width: "",
				size: 44
			}].concat(withExpander);
			return withExpander;
		};
		this.writeSorting = (next) => {
			if (this.programmatic) return;
			this.programmatic++;
			this._sortingDefault.value = next;
			this._sortingControllable.write(next);
			this.dispatchEvent(new CustomEvent("sort-change", {
				detail: next,
				bubbles: true,
				composed: true
			}));
			this.programmatic--;
		};
		this.writeExpanded = (next) => {
			if (this.programmatic) return;
			this.programmatic++;
			this.expandedTouched = true;
			this._expandedDefault.value = next;
			this._expandedControllable.write(next);
			this.dispatchEvent(new CustomEvent("expand-change", {
				detail: next,
				bubbles: true,
				composed: true
			}));
			this.programmatic--;
		};
		this.writeGrouping = (next) => {
			if (this.programmatic) return;
			this.programmatic++;
			this._groupingDefault.value = next;
			this._groupingControllable.write(next);
			this.dispatchEvent(new CustomEvent("group-change", {
				detail: next,
				bubbles: true,
				composed: true
			}));
			this.programmatic--;
		};
		this.writeGlobalFilter = (next) => {
			if (this.programmatic) return;
			this.programmatic++;
			this._globalFilterDefault.value = next;
			this._globalFilterControllable.write(next);
			this.dispatchEvent(new CustomEvent("filter-change", {
				detail: { globalFilter: next },
				bubbles: true,
				composed: true
			}));
			this.programmatic--;
		};
		this.writeColumnFilters = (next) => {
			if (this.programmatic) return;
			this.programmatic++;
			this._columnFiltersDefault.value = next;
			this._columnFiltersControllable.write(next);
			this.dispatchEvent(new CustomEvent("filter-change", {
				detail: { columnFilters: next },
				bubbles: true,
				composed: true
			}));
			this.programmatic--;
		};
		this.writePagination = (next) => {
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
		this.writeRowSelection = (next) => {
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
		this.writeColumnVisibility = (next) => {
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
		this.writeColumnSizing = (next) => {
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
		this.writeColumnOrder = (next) => {
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
		this.writeColumnPinning = (next) => {
			if (this.programmatic) return;
			const strip = (ids) => (ids || []).filter((id) => id !== this.SELECT_COL_ID && id !== this.EXPANDER_COL_ID);
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
		this.writeData = (next) => {
			if (this.programmatic) return;
			if (this.undoable && !this.restoringHistory) {
				const prevU = this.canUndo();
				const prevR = this.canRedo();
				this.recordSnapshot(this.currentData());
				this.emitHistoryChangeIfEdged(prevU, prevR);
			}
			const fresh = Array.isArray(next) ? next.slice() : next;
			try {
				Object.defineProperty(fresh, this.DATA_WRITE_TOKEN_KEY, {
					value: true,
					enumerable: false,
					configurable: true,
					writable: true
				});
			} catch (_e) {}
			this.programmatic++;
			this._dataDefault.value = fresh;
			this._dataControllable.write(fresh);
			this.programmatic--;
		};
		this.columnFilterValue = (colId) => {
			const cf = this.currentState().columnFilters || [];
			for (const f of cf) if (f && f.id === colId) return f.value != null ? f.value : "";
			return "";
		};
		this.setColumnFilter = (colId, value) => {
			const prev = this.currentState().columnFilters || [];
			const next = [];
			for (const f of prev) if (f && f.id !== colId) next.push(f);
			if (value != null && value !== "") next.push({
				id: colId,
				value
			});
			this.writeColumnFilters(next);
		};
		this.recordSnapshot = (current) => {
			this.undoStack.push(current);
			const limit = this.undoLimit != null ? this.undoLimit : 100;
			while (this.undoStack.length > limit) this.undoStack.shift();
			this.redoStack = [];
		};
		this.canUndo = () => this.undoStack.length > 0;
		this.canRedo = () => this.redoStack.length > 0;
		this.clearHistory = () => {
			this.undoStack = [];
			this.redoStack = [];
		};
		this.emitHistoryChange = () => {
			this.dispatchEvent(new CustomEvent("history-change", {
				detail: {
					canUndo: this.canUndo(),
					canRedo: this.canRedo()
				},
				bubbles: true,
				composed: true
			}));
		};
		this.emitHistoryChangeIfEdged = (prevU, prevR) => {
			const nextU = this.canUndo();
			const nextR = this.canRedo();
			if (nextU !== prevU || nextR !== prevR) this.emitHistoryChange();
		};
		this.undo = () => {
			if (!this.canUndo()) return;
			const prev = this.undoStack.pop();
			this.redoStack.push(this.currentData());
			this.restoringHistory = true;
			this.writeData(prev);
			this.restoringHistory = false;
			this.emitHistoryChange();
		};
		this.redo = () => {
			if (!this.canRedo()) return;
			const next = this.redoStack.pop();
			this.undoStack.push(this.currentData());
			this.restoringHistory = true;
			this.writeData(next);
			this.restoringHistory = false;
			this.emitHistoryChange();
		};
		this.refreshRowModel = null;
		this.onSortingChangeCb = (updater) => {
			this.writeSorting(applyUpdater(updater, this.currentState().sorting));
		};
		this.onExpandedChangeCb = (updater) => {
			this.writeExpanded(applyUpdater(updater, this.currentState().expanded));
		};
		this.onGroupingChangeCb = (updater) => {
			this.writeGrouping(applyUpdater(updater, this.currentState().grouping));
		};
		this.onGlobalFilterChangeCb = (updater) => {
			this.writeGlobalFilter(applyUpdater(updater, this.currentState().globalFilter));
		};
		this.onColumnFiltersChangeCb = (updater) => {
			this.writeColumnFilters(applyUpdater(updater, this.currentState().columnFilters));
		};
		this.onPaginationChangeCb = (updater) => {
			this.writePagination(applyUpdater(updater, this.currentState().pagination));
		};
		this.onRowSelectionChangeCb = (updater) => {
			this.writeRowSelection(applyUpdater(updater, this.currentState().rowSelection));
		};
		this.onColumnVisibilityChangeCb = (updater) => {
			this.writeColumnVisibility(applyUpdater(updater, this.currentState().columnVisibility));
		};
		this.onColumnSizingChangeCb = (updater) => {
			this.writeColumnSizing(applyUpdater(updater, this.currentState().columnSizing));
		};
		this.onColumnOrderChangeCb = (updater) => {
			this.writeColumnOrder(applyUpdater(updater, this.currentState().columnOrder));
		};
		this.onColumnPinningChangeCb = (updater) => {
			this.writeColumnPinning(applyUpdater(updater, this.currentState().columnPinning));
		};
		this.columnSizingInfoSync = null;
		this.onColumnSizingInfoChangeCb = (updater) => {
			const next = applyUpdater(updater, this.columnSizingInfoSync != null ? this.columnSizingInfoSync : this._columnSizingInfo.value);
			if (next == null) return;
			this.columnSizingInfoSync = next;
			this._columnSizingInfo.value = next;
		};
		this.resolveVirtual = () => {
			const v = this.virtual;
			if (typeof v === "string") {
				if (v === "rows") return "rows";
				if (v === "columns") return "columns";
				if (v === "both") return "both";
				return "off";
			}
			return v === true ? "rows" : "off";
		};
		this.rowsWindowed = () => {
			const s = this.resolveVirtual();
			return s === "rows" || s === "both";
		};
		this.colsWindowed = () => {
			const s = this.resolveVirtual();
			return s === "columns" || s === "both";
		};
		this.isWindowed = () => this.rowsWindowed() || this.colsWindowed();
		this.autoMeasureOn = () => this.autoMeasure === true;
		this.columnCount = () => this.visibleColCount();
		this.columnSize = (i) => {
			if (!this.table || !this.table.getVisibleLeafColumns) return 150;
			const c = this.table.getVisibleLeafColumns()[i];
			return c && typeof c.getSize === "function" ? c.getSize() : 150;
		};
		this.forcedColumns = () => {
			if (!this.colsWindowed()) return [];
			const out = [];
			if (this.table && this.table.getVisibleLeafColumns) {
				const cols = this.table.getVisibleLeafColumns();
				for (let i = 0; i < cols.length; i++) {
					const c = cols[i];
					if (c && c.getIsPinned && c.getIsPinned()) out.push(i);
				}
			}
			if (!this._activeIsHeader.value && this._activeColIndex.value >= 0 && out.indexOf(this._activeColIndex.value) === -1) out.push(this._activeColIndex.value);
			if (this._editingRow.value >= 0 && this._editingCol.value >= 0 && out.indexOf(this._editingCol.value) === -1) out.push(this._editingCol.value);
			return out;
		};
		this.windowedCells = (row) => {
			this._windowVer.value;
			const cells = this.visibleCellsFor(row);
			if (!this.colsWindowed()) return cells;
			const idx = this.windowedColIndices();
			const out = [];
			for (let i = 0; i < idx.length; i++) {
				const cell = cells[idx[i]];
				if (cell) out.push(cell);
			}
			return out;
		};
		this.windowSource = () => {
			if (!this.table) return [];
			if (this.rowsWindowed()) return this.table.getPrePaginationRowModel().rows;
			return this.table.getRowModel().rows;
		};
		this.scheduleRemeasure = () => {
			if (this.remeasureDisposed) return;
			if (this.remeasurePending) return;
			this.remeasurePending = true;
			let ranMicro = false;
			const microPass = () => {
				this.remeasureWindow();
			};
			const rafPass = () => {
				this.remeasureRaf = null;
				this.remeasurePending = false;
				this.remeasureWindow();
			};
			if (typeof queueMicrotask !== "undefined") {
				ranMicro = true;
				queueMicrotask(microPass);
			}
			if (typeof requestAnimationFrame === "function") this.remeasureRaf = requestAnimationFrame(rafPass);
			else if (ranMicro) this.remeasurePending = false;
			else this.remeasureRaf = setTimeout(rafPass, 0);
		};
		this.teardownRemeasure = () => {
			this.remeasureDisposed = true;
			if (this.remeasureRaf != null) {
				if (typeof requestAnimationFrame === "function") cancelAnimationFrame(this.remeasureRaf);
				else clearTimeout(this.remeasureRaf);
				this.remeasureRaf = null;
			}
			this.remeasurePending = false;
		};
		this.pinnedEditIndex = () => {
			if (this._editingRow.value >= 0) return this._editingRow.value;
			if (this._editingRowIndex.value != null) return this._editingRowIndex.value;
			return -1;
		};
		this.pinnedMeasurement = (pin) => {
			if (!this.virtualizer || pin < 0) return null;
			const ms = this.virtualizer.getMeasurements();
			return ms && ms[pin] ? ms[pin] : null;
		};
		this.remeasureWindow = () => {
			if (this.remeasureDisposed) return;
			if (!this.virtualizer || !this.gridRoot) return;
			if (this.virtualizer.scrollState) return;
			const trs = this.gridRoot.querySelectorAll("tbody.rdt-tbody > tr[data-index]");
			for (const tr of trs) this.virtualizer.measureElement(tr);
			if (this.afterRowRemeasure) this.afterRowRemeasure();
		};
		this.virtualItemKey = (i) => {
			const src = this.windowSource();
			return src && src[i] ? src[i].id : void 0;
		};
		this.COL_OVERSCAN = 3;
		this.colRtlObserver = null;
		this.colRtlObserverEl = null;
		this.isColRtl = () => {
			if (!this.gridScrollEl || typeof getComputedStyle !== "function") return false;
			return getComputedStyle(this.gridScrollEl).direction === "rtl";
		};
		this.ensureColRtlWatch = () => {
			if (!this.gridScrollEl || this.colRtlObserverEl === this.gridScrollEl || typeof MutationObserver !== "function") return;
			if (this.colRtlObserver) this.colRtlObserver.disconnect();
			this.colRtlObserver = new MutationObserver(() => {
				if (this.colVirtualizer) this.colVirtualizer.setOptions({
					...this.colVirtualizer.options,
					isRtl: this.isColRtl()
				});
			});
			this.colRtlObserver.observe(this.gridScrollEl, {
				attributes: true,
				attributeFilter: ["dir"]
			});
			this.colRtlObserverEl = this.gridScrollEl;
		};
		this.teardownColRtlWatch = () => {
			if (this.colRtlObserver) this.colRtlObserver.disconnect();
			this.colRtlObserver = null;
			this.colRtlObserverEl = null;
		};
		this.columnVirtualizerOptions = () => {
			this.ensureColRtlWatch();
			return {
				count: this.columnCount(),
				getScrollElement: () => this.gridScrollEl,
				estimateSize: (i) => this.columnSize(i),
				horizontal: true,
				isRtl: this.isColRtl(),
				observeElementRect,
				observeElementOffset,
				scrollToFn: elementScroll,
				measureElement,
				overscan: this.COL_OVERSCAN,
				onChange: () => {
					this._windowVer.value = this._windowVer.value + 1;
				}
			};
		};
		this.measuredRowTotal = 0;
		this.measuredRowCount = 0;
		this.lastFedRowEstimate = 0;
		this.foldedRowHeights = {};
		this.windowVerBumpPending = false;
		this.bumpWindowVer = () => {
			if (this.windowVerBumpPending) return;
			this.windowVerBumpPending = true;
			const flush = () => {
				this.windowVerBumpPending = false;
				this._windowVer.value = this._windowVer.value + 1;
			};
			if (typeof queueMicrotask !== "undefined") queueMicrotask(flush);
			else setTimeout(flush, 0);
		};
		this.ESTIMATE_REFEED_DELTA_PX = 4;
		this.estimateRowSize = (i) => {
			if (!this.autoMeasureOn()) return this.estimateRowHeight;
			if (this.measuredRowCount === 0) return this.estimateRowHeight;
			return Math.round(this.measuredRowTotal / this.measuredRowCount);
		};
		this.foldMeasuredRow = (index, height) => {
			const prev = this.foldedRowHeights[index];
			if (prev === height) return;
			if (prev == null) {
				this.measuredRowTotal = this.measuredRowTotal + height;
				this.measuredRowCount = this.measuredRowCount + 1;
			} else this.measuredRowTotal = this.measuredRowTotal - prev + height;
			this.foldedRowHeights[index] = height;
		};
		this.refineRowEstimate = () => {
			if (!this.autoMeasureOn() || !this.virtualizer) return;
			const items = this.virtualizer.getVirtualItems();
			const measurements = this.virtualizer.getMeasurements();
			for (let i = 0; i < items.length; i++) {
				const idx = items[i].index;
				const m = measurements && measurements[idx];
				if (m) this.foldMeasuredRow(idx, m.size);
			}
			if (this.virtualizer.scrollState) return;
			const est = this.estimateRowSize(0);
			if (Math.abs(est - this.lastFedRowEstimate) < this.ESTIMATE_REFEED_DELTA_PX) return;
			const anchorIndex = items.length ? items[0].index : -1;
			const anchorStart = items.length ? items[0].start : 0;
			this.virtualizer.setOptions(this.virtualizerOptions());
			this.virtualizer._willUpdate();
			this.lastFedRowEstimate = est;
			if (anchorIndex >= 0 && this.gridScrollEl) {
				const freshMeasurements = this.virtualizer.getMeasurements();
				const fresh = freshMeasurements && freshMeasurements[anchorIndex];
				if (fresh) {
					const delta = fresh.start - anchorStart;
					if (delta !== 0) this.gridScrollEl.scrollTop = this.gridScrollEl.scrollTop + delta;
				}
			}
			this.bumpWindowVer();
		};
		this.virtualizerOptions = () => ({
			count: this.windowSource().length,
			getScrollElement: () => this.gridScrollEl,
			estimateSize: (i) => this.estimateRowSize(i),
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			measureElement,
			overscan: 8,
			getItemKey: this.virtualItemKey,
			onChange: () => {
				this.bumpWindowVer();
				this.scheduleRemeasure();
			}
		});
		this.pinMeasurement = (pin) => this.pinnedMeasurement(pin);
		this.windowedRows = () => {
			this._windowVer.value;
			this._editVer.value;
			if (!this.virtualizer) {
				if (!this.rowsWindowed()) return (this._rows.value || []).map((r, i) => ({
					vi: { index: i },
					row: r
				}));
				return [];
			}
			const items = this.virtualizer.getVirtualItems();
			const rowList = this._rows.value || [];
			const out = items.map((vi) => ({
				vi,
				row: rowList[vi.index]
			})).filter((wr) => wr.row);
			const pin = this.pinnedEditIndex();
			if (pin >= 0 && rowList[pin]) {
				let inWindow = false;
				for (let i = 0; i < items.length; i++) if (items[i].index === pin) {
					inWindow = true;
					break;
				}
				if (!inWindow) {
					const pm = this.pinMeasurement(pin);
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
		};
		this.padTop = () => {
			this._windowVer.value;
			this._editVer.value;
			if (!this.rowsWindowed() || !this.virtualizer) return 0;
			const items = this.virtualizer.getVirtualItems();
			let pad = items.length ? items[0].start : 0;
			const pin = this.pinnedEditIndex();
			if (pin >= 0) {
				const pm = this.pinMeasurement(pin);
				const inWindow = this.pmIndexInWindow(items, pin);
				if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
			}
			return pad < 0 ? 0 : pad;
		};
		this.padBottom = () => {
			this._windowVer.value;
			this._editVer.value;
			if (!this.rowsWindowed() || !this.virtualizer) return 0;
			const items = this.virtualizer.getVirtualItems();
			if (!items.length) return 0;
			let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
			const pin = this.pinnedEditIndex();
			if (pin >= 0) {
				const pm = this.pinMeasurement(pin);
				const inWindow = this.pmIndexInWindow(items, pin);
				const lastItemIdx = items[items.length - 1].index;
				const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
				if (pm && !inWindow && below) {
					if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
				}
			}
			return pad < 0 ? 0 : pad;
		};
		this.pmIndexInWindow = (items, idx) => {
			for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
			return false;
		};
		this.rowIsOutsideWindow = (r) => {
			if (!this.rowsWindowed() || !this.virtualizer) return false;
			const items = this.virtualizer.getVirtualItems();
			for (const it of items) if (it.index === r) return false;
			return true;
		};
		this.windowedColIndices = () => {
			this._windowVer.value;
			this._editVer.value;
			if (!this.colsWindowed()) {
				const n = this.columnCount();
				const out = [];
				for (let i = 0; i < n; i++) out.push(i);
				return out;
			}
			if (!this.colVirtualizer) return [];
			const idx = this.colVirtualizer.getVirtualItems().map((it) => it.index);
			const forced = this.forcedColumns();
			for (let i = 0; i < forced.length; i++) if (idx.indexOf(forced[i]) === -1) idx.push(forced[i]);
			idx.sort((a, b) => a - b);
			return idx;
		};
		this.colPadLeft = () => {
			this._windowVer.value;
			this._editVer.value;
			if (!this.colsWindowed() || !this.colVirtualizer) return 0;
			const items = this.colVirtualizer.getVirtualItems();
			let pad = items.length ? items[0].start : 0;
			if (items.length) {
				const firstIdx = items[0].index;
				const forced = this.forcedColumns();
				for (let i = 0; i < forced.length; i++) if (forced[i] < firstIdx) pad = pad - this.columnSize(forced[i]);
			}
			return pad < 0 ? 0 : pad;
		};
		this.colPadRight = () => {
			this._windowVer.value;
			this._editVer.value;
			if (!this.colsWindowed() || !this.colVirtualizer) return 0;
			const items = this.colVirtualizer.getVirtualItems();
			if (!items.length) return 0;
			let pad = this.colVirtualizer.getTotalSize() - items[items.length - 1].end;
			const lastIdx = items[items.length - 1].index;
			const forced = this.forcedColumns();
			for (let i = 0; i < forced.length; i++) if (forced[i] > lastIdx) pad = pad - this.columnSize(forced[i]);
			return pad < 0 ? 0 : pad;
		};
		this.colIsOutsideWindow = (c) => {
			if (!this.colsWindowed() || !this.colVirtualizer) return false;
			const items = this.colVirtualizer.getVirtualItems();
			for (const it of items) if (it.index === c) return false;
			return true;
		};
		this.afterRowRemeasure = this.refineRowEstimate;
		this.announceState = {
			sorting: null,
			columnFilters: null,
			globalFilter: null
		};
		this.effectiveSorting = () => this.sorting != null ? this.sorting : this._sortingDefault.value;
		this.effectiveColumnFilters = () => this.columnFilters != null ? this.columnFilters : this._columnFiltersDefault.value;
		this.effectiveGlobalFilter = () => this.globalFilter != null ? this.globalFilter : this._globalFilterDefault.value;
		this.buildSortFilterAnnounce = () => {
			const nextSorting = this.effectiveSorting();
			const nextColumnFilters = this.effectiveColumnFilters();
			const nextGlobalFilter = this.effectiveGlobalFilter();
			const sortChanged = nextSorting !== this.announceState.sorting;
			const filterChanged = nextColumnFilters !== this.announceState.columnFilters || nextGlobalFilter !== this.announceState.globalFilter;
			this.announceState.sorting = nextSorting;
			this.announceState.columnFilters = nextColumnFilters;
			this.announceState.globalFilter = nextGlobalFilter;
			if (sortChanged) {
				const active = nextSorting && nextSorting.length ? nextSorting[0] : null;
				if (!active) return "Sorting cleared";
				const rawLabel = this.headerLabel(active.id);
				return "Sorted by " + (typeof rawLabel === "string" && rawLabel ? rawLabel : active.id) + ", " + (active.desc ? "descending" : "ascending");
			}
			if (filterChanged) return this.totalRowCount() + " results";
			return "";
		};
		this.reFeed = () => {
			if (!this.table) return;
			this.table.setOptions((prev) => ({
				...prev,
				data: this.currentData(),
				columns: this.tableColumns(),
				state: this.currentState(),
				enableRowSelection: this.selectionMode !== "none",
				enableMultiRowSelection: this.selectionMode === "multiple",
				rowCount: this.rowCount ?? void 0,
				pageCount: this.pageCount ?? void 0,
				getExpandedRowModel: getExpandedRowModel(),
				getSubRows: this.getSubRows || void 0,
				getRowCanExpand: this.expandable === true && this.getSubRows == null ? () => true : void 0,
				onExpandedChange: this.onExpandedChangeCb,
				autoResetExpanded: false,
				getGroupedRowModel: getGroupedRowModel(),
				onGroupingChange: this.onGroupingChangeCb,
				getFacetedRowModel: getFacetedRowModel(),
				getFacetedUniqueValues: getFacetedUniqueValues(),
				getFacetedMinMaxValues: getFacetedMinMaxValues(),
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
		this.lastPropsData = null;
		this.maybeClearHistoryOnExternalSwap = () => {
			const pd = this.data;
			if (pd === this.lastPropsData) return;
			this.lastPropsData = pd;
			if (!this.undoable) return;
			if (pd != null && pd[this.DATA_WRITE_TOKEN_KEY] != null) return;
			this.clearHistory();
		};
		this.lastData = null;
		this.lastDataLen = -1;
		this.onHeaderSort = (colId, evt) => {
			if (!this.table) return;
			const col = this.table.getColumn(colId);
			if (!col || !col.getCanSort()) return;
			const multi = !!(evt && evt.shiftKey);
			col.toggleSorting(void 0, multi);
		};
		this.tick = () => this._rowModelVer.value;
		this.ariaSortFor = (colId) => {
			if (this.tick() < 0 || !this.table) return "none";
			const col = this.table.getColumn(colId);
			if (!col) return "none";
			const dir = col.getIsSorted();
			if (dir === "asc") return "ascending";
			if (dir === "desc") return "descending";
			return "none";
		};
		this.sortIndicator = (colId) => {
			if (this.tick() < 0 || !this.table) return "";
			const col = this.table.getColumn(colId);
			if (!col) return "";
			const dir = col.getIsSorted();
			if (dir === "asc") return "▲";
			if (dir === "desc") return "▼";
			return "";
		};
		this.defFor = (colId) => {
			if (colId == null) return null;
			const d = this.defIndex()[String(colId)];
			return d != null ? d : null;
		};
		this.visibleCellsFor = (row) => this._rowModelVer.value >= 0 ? row.getVisibleCells() : [];
		this.editMetaOf = (colId) => {
			const d = this.defFor(colId);
			return d && d.meta ? d.meta : null;
		};
		this.columnEditable = (colId) => {
			const m = this.editMetaOf(colId);
			return !!(m && m.editable === true);
		};
		this.editorTypeOf = (colId) => {
			const m = this.editMetaOf(colId);
			return m && m.editor != null ? m.editor : "text";
		};
		this.editorOptionsOf = (colId) => {
			const m = this.editMetaOf(colId);
			return m && m.editorOptions != null ? m.editorOptions : [];
		};
		this.columnIsFilterable = (colId) => {
			const d = this.defFor(colId);
			return !!(d && d.filterable);
		};
		this.headerLabel = (colId) => {
			const d = this.defFor(colId);
			return d ? d.header : colId;
		};
		this.headerWidth = (header) => {
			if (this.tick() < 0 || !header || typeof header.getSize !== "function") return null;
			const w = header.getSize();
			return w != null && w > 0 ? w + "px" : null;
		};
		this.onResizeStart = (colId, evt) => {
			if (evt && evt.stopPropagation) evt.stopPropagation();
			if (!this.table) return;
			const header = this.findHeader(colId);
			if (!header || !header.getResizeHandler) return;
			const handler = header.getResizeHandler();
			if (handler) handler(evt);
		};
		this.findHeader = (colId) => {
			const groups = this._headerGroups.value || [];
			for (const hg of groups) {
				const hs = hg.headers || [];
				for (const h of hs) if (h && h.column && h.column.id === colId) return h;
			}
			return null;
		};
		this.columnIsResizing = (colId) => {
			if (this.tick() < 0 || !this.table) return false;
			const header = this.findHeader(colId);
			return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
		};
		this.columnIsVisible = (colId) => {
			if (this.tick() < 0 || !this.table) return true;
			const col = this.table.getColumn(colId);
			return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
		};
		this.onToggleVisibility = (colId) => {
			if (!this.table) return;
			const col = this.table.getColumn(colId);
			if (col && col.toggleVisibility) col.toggleVisibility();
		};
		this.allLeafColumns = () => {
			if (this.tick() < 0 || !this.table) return [];
			const cols = this.table.getAllLeafColumns ? this.table.getAllLeafColumns() : [];
			const out = [];
			for (const c of cols) {
				if (!c || c.id === this.SELECT_COL_ID || c.id === this.EXPANDER_COL_ID) continue;
				out.push({
					id: c.id,
					label: this.headerLabel(c.id),
					visible: !!(c.getIsVisible && c.getIsVisible())
				});
			}
			return out;
		};
		this.columnPinSide = (colId) => {
			if (this.tick() < 0 || !this.table) return false;
			const col = this.table.getColumn(colId);
			if (!col || !col.getIsPinned) return false;
			return col.getIsPinned();
		};
		this.onPinColumn = (colId, side, evt) => {
			if (evt && evt.stopPropagation) evt.stopPropagation();
			if (!this.table) return;
			const col = this.table.getColumn(colId);
			if (col && col.pin) col.pin(side);
		};
		this.pinStyle = (colId, zIndex = 1) => {
			if (this.tick() < 0 || !this.table) return "";
			const col = this.table.getColumn(colId);
			if (!col || !col.getIsPinned) return "";
			const side = col.getIsPinned();
			if (side === "left") return "position:sticky;left:" + (col.getStart ? col.getStart("left") : 0) + "px;z-index:" + zIndex + ";";
			if (side === "right") return "position:sticky;right:" + (col.getAfter ? col.getAfter("right") : 0) + "px;z-index:" + zIndex + ";";
			return "";
		};
		this.thStyle = (header, widthPx = null) => {
			let s = "";
			const w = widthPx != null && widthPx > 0 ? widthPx + "px" : this.headerWidth(header);
			if (w) s += "width:" + w + ";";
			s += this.pinStyle(header && header.column ? header.column.id : null, 2);
			return s;
		};
		this.onGlobalFilterInput = (evt) => {
			const value = evt && evt.target ? evt.target.value : "";
			if (this.table) {
				this.table.setGlobalFilter(value);
				return;
			}
			this.writeGlobalFilter(value);
		};
		this.onColumnFilterInput = (colId, evt) => {
			const value = evt && evt.target ? evt.target.value : "";
			this.setColumnFilter(colId, value);
		};
		this.globalFilterValue = () => {
			const v = this.currentState().globalFilter;
			return v != null ? v : "";
		};
		this.pageIndex = () => {
			if (this.tick() >= 0 && this.table) return this.table.getState().pagination.pageIndex;
			const p = this.currentState().pagination;
			return p && p.pageIndex != null ? p.pageIndex : 0;
		};
		this.pageSize = () => {
			if (this.tick() >= 0 && this.table) return this.table.getState().pagination.pageSize;
			const p = this.currentState().pagination;
			return p && p.pageSize != null ? p.pageSize : 10;
		};
		this.displayPageCount = () => {
			if (this.tick() < 0 || !this.table) return 1;
			const c = this.table.getPageCount();
			return c != null && c > 0 ? c : 1;
		};
		this.canPrevPage = () => !!(this.tick() >= 0 && this.table && this.table.getCanPreviousPage());
		this.canNextPage = () => !!(this.tick() >= 0 && this.table && this.table.getCanNextPage());
		this.onPrevPage = () => {
			if (this.table) this.table.previousPage();
		};
		this.onNextPage = () => {
			if (this.table) this.table.nextPage();
		};
		this.onPageSizeChange = (evt) => {
			if (!this.table) return;
			const v = evt && evt.target ? evt.target.value : "";
			const n = parseInt(v, 10);
			this.table.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
		};
		this.isSelectColumn = (colId) => colId === this.SELECT_COL_ID;
		this.isExpanderColumn = (colId) => colId === this.EXPANDER_COL_ID;
		this.rowCanExpand = (row) => !!(this.tick() >= 0 && row && row.getCanExpand && row.getCanExpand() && !(row.getIsGrouped && row.getIsGrouped()));
		this.rowIsExpanded = (row) => !!(this.tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());
		this.rowShowsDetail = (row) => this.getSubRows == null && !this.rowIsGrouped(row) && this.rowIsExpanded(row);
		this.onToggleExpand = (row, evt) => {
			if (!row || !row.toggleExpanded) return;
			const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest("tr") : null;
			row.toggleExpanded();
			if (ownerRow && typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
				const btn = ownerRow.querySelector("[data-expander]");
				if (btn) btn.focus();
			});
		};
		this.bodyCellStyle = (row, colId) => {
			const base = this.pinStyle(colId);
			if (this.isExpanderColumn(colId) && row && row.depth) {
				const pad = "padding-left:" + (.5 + row.depth * 1.25) + "rem";
				return base ? base + pad : pad;
			}
			return base;
		};
		this.rowIsGrouped = (row) => !!(this.tick() >= 0 && row && row.getIsGrouped && row.getIsGrouped());
		this.rowIndexIsGrouped = (rowIndex) => this.rowIsGrouped((this._rows.value || [])[rowIndex]);
		this.groupingActive = () => this.tick() >= 0 && (this.currentState().grouping || []).length > 0;
		this.cellIsGrouped = (cellCtx) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsGrouped && cellCtx.getIsGrouped());
		this.cellIsAggregated = (cellCtx) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsAggregated && cellCtx.getIsAggregated());
		this.cellIsPlaceholder = (cellCtx) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsPlaceholder && cellCtx.getIsPlaceholder());
		this.groupSubRowCount = (row) => {
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
		};
		this.groupRowDescriptorCache = null;
		this.groupRowDescriptorCacheVer = void 0;
		this.groupRowDescriptor = (row) => {
			const ver = this._rowModelVer.value;
			if (!this.groupRowDescriptorCache || this.groupRowDescriptorCacheVer !== ver) {
				this.groupRowDescriptorCache = Object.create(null);
				this.groupRowDescriptorCacheVer = ver;
			}
			const key = String(row.id);
			let d = this.groupRowDescriptorCache[key];
			if (!d) {
				const groupingColumnId = row.groupingColumnId != null ? row.groupingColumnId : "";
				const groupingValue = row.getGroupingValue ? row.getGroupingValue(groupingColumnId) : row.groupingValue;
				d = {
					isGroupRow: true,
					groupId: row.id,
					groupingColumnId,
					groupingValue,
					leafCount: this.groupSubRowCount(row)
				};
				this.groupRowDescriptorCache[key] = d;
			}
			return d;
		};
		this.cellSlotRow = (row) => this.rowIsGrouped(row) ? this.groupRowDescriptor(row) : row ? row.original : null;
		this.groupingKeys = () => this.currentState().grouping || [];
		this.groupableColumns = () => {
			const out = [];
			const defs = collectGroupableLeafDefs(this.columnDefs());
			for (const d of defs) out.push({
				id: d.id,
				label: d.header != null ? d.header : d.id
			});
			return out;
		};
		this.stopEvent = (evt) => {
			if (evt && evt.stopPropagation) evt.stopPropagation();
		};
		this.isAllRowsSelected = () => !!(this.tick() >= 0 && this.table && this.table.getIsAllRowsSelected());
		this.isSomeRowsSelected = () => !!(this.tick() >= 0 && this.table && this.table.getIsSomeRowsSelected());
		this.onToggleAllRows = (evt) => {
			if (!this.table) return;
			this.table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
		};
		this.rowIsSelected = (row) => {
			if (!row) return false;
			const id = row.id;
			const sel = this.currentState().rowSelection || {};
			if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
			return !!(row.getIsSelected && row.getIsSelected());
		};
		this.onToggleRow = (row, evt) => {
			if (!row || !row.toggleSelected) return;
			row.toggleSelected(!!(evt && evt.target && evt.target.checked));
		};
		this.onHideColumn = (colId, evt) => {
			if (evt && evt.stopPropagation) evt.stopPropagation();
			if (!this.table) return;
			const col = this.table.getColumn(colId);
			if (col && col.toggleVisibility) col.toggleVisibility(false);
		};
		this.hasAnyFilterableColumn = () => {
			const cols = this.allLeafColumns();
			for (const c of cols) if (c && this.columnIsFilterable(c.id)) return true;
			return false;
		};
		this.selectAllBox = null;
		this.syncIndeterminate = () => {
			if (!this._ref__rozieRoot || !this._ref__rozieRoot.querySelector) return;
			this.selectAllBox = this._ref__rozieRoot.querySelector(".rdt-select-all");
			if (this.selectAllBox) this.selectAllBox.indeterminate = this.isSomeRowsSelected() && !this.isAllRowsSelected();
		};
		this.sortColumn = (colId, desc) => {
			if (this.table) this.table.getColumn(colId) && this.table.getColumn(colId).toggleSorting(desc, false);
		};
		this.clearSorting = () => {
			if (this.table) this.table.resetSorting(true);
		};
		this.getColumnDefs = () => this.columnDefs();
		this.toggleAllRows = (value) => {
			if (this.table) this.table.toggleAllRowsSelected(value);
		};
		this.clearSelection = () => {
			if (this.table) this.table.resetRowSelection(true);
		};
		this.getSelectedRows = () => this.table ? this.table.getSelectedRowModel().rows.map((r) => r.original) : [];
		this.setPage = (idx) => {
			if (this.table) this.table.setPageIndex(idx);
		};
		this.setRowsPerPage = (size) => {
			if (this.table) this.table.setPageSize(size);
		};
		this.toggleColumnVisibility = (colId) => {
			if (this.table) {
				const c = this.table.getColumn(colId);
				if (c && c.toggleVisibility) c.toggleVisibility();
			}
		};
		this.applyColumnOrder = (order) => {
			if (this.table) this.table.setColumnOrder(order);
		};
		this.resetColumnSizing = () => {
			if (this.table) this.table.resetColumnSizing(true);
		};
		this.pinColumn = (colId, side) => {
			if (this.table) {
				const c = this.table.getColumn(colId);
				if (c && c.pin) c.pin(side);
			}
		};
		this.getRowIndexRelativeToPage = (absRow) => {
			const abs = absRow == null ? this.toAbsRow(this._activeRow.value) : Math.trunc(Number(absRow)) || 0;
			if (this.rowsWindowed()) return abs;
			return abs - this.pageRowOffset();
		};
		this.cut = () => this.cutRange();
		this.isGrid = () => this.interactionMode === "grid";
		this.tableRole = () => this.isGrid() ? "grid" : "table";
		this.cellRole = () => this.isGrid() ? "gridcell" : "cell";
		this.rowIndexOf = (row) => this.tick() >= 0 ? (this._rows.value || []).indexOf(row) : -1;
		this.colIndexOf = (row, cellCtx) => this.tick() >= 0 ? this.visibleCellsFor(row).indexOf(cellCtx) : -1;
		this.headerColIndexOf = (hg, header) => (hg && hg.headers ? hg.headers : []).indexOf(header);
		this.headerLeafStart = (hg, header) => {
			const list = hg && hg.headers ? hg.headers : [];
			let leaf = 0;
			for (let i = 0; i < list.length; i++) {
				if (list[i] === header) return leaf;
				const h = list[i];
				leaf = leaf + (h && h.colSpan > 1 ? h.colSpan : 1);
			}
			return -1;
		};
		this.pageRowOffset = () => {
			if (!this.isGrid() || this.rowsWindowed()) return 0;
			return this.pageIndex() * this.pageSize();
		};
		this.toAbsRow = (localRow) => localRow + this.pageRowOffset();
		this.prePaginationRowCount = () => {
			if (!this.table || this.rowsWindowed()) return this.bodyRowCount();
			const pm = this.table.getPrePaginationRowModel();
			return pm && pm.rows ? pm.rows.length : this.bodyRowCount();
		};
		this.cellTabindex = (rowKey, colIndex, level = null) => {
			if (!this.isGrid()) return null;
			if (this.bodyRowCount() === 0) return rowKey === "__header" && colIndex === 0 && level === this.headerLeafLevel() ? 0 : -1;
			if (this._activeIsHeader.value) {
				if (rowKey !== "__header") return -1;
				return colIndex === this._activeColIndex.value && level === this._activeHeaderLevel.value ? 0 : -1;
			}
			return rowKey === String(this._activeRow.value) && colIndex === this._activeColIndex.value ? 0 : -1;
		};
		this.isActiveCell = (rowKey, colIndex, level = null) => {
			if (!this.isGrid()) return false;
			if (this._activeIsHeader.value) {
				if (rowKey !== "__header") return false;
				return colIndex === this._activeColIndex.value && level === this._activeHeaderLevel.value;
			}
			if (rowKey === "__header") return false;
			return rowKey === String(this._activeRow.value) && colIndex === this._activeColIndex.value;
		};
		this.resolveCellEl = (rowKey, colIndex, level = null) => {
			if (!this.gridRoot) return null;
			let sel = "[data-grid-cell][data-row=\"" + rowKey + "\"][data-col-index=\"" + colIndex + "\"]";
			if (rowKey === "__header" && level != null) sel = sel + "[data-header-level=\"" + level + "\"]";
			return this.gridRoot.querySelector(sel);
		};
		this.focusActiveCell = (nextRow = null, nextCol = null, nextIsHeader = null, nextLevel = null) => {
			if (!this.isGrid() || !this.gridRoot) return;
			this.focusIntentEpoch = this.focusIntentEpoch + 1;
			const r = nextRow == null ? this._activeRow.value : nextRow;
			const c = nextCol == null ? this._activeColIndex.value : nextCol;
			const lvl = nextLevel == null ? this._activeHeaderLevel.value : nextLevel;
			const header = nextIsHeader == null ? this._activeIsHeader.value : nextIsHeader;
			const rowOut = this.rowsWindowed() && this.virtualizer && this.rowIsOutsideWindow(r);
			const colOut = this.colsWindowed() && this.colVirtualizer && this.colIsOutsideWindow(c);
			if (!header && (rowOut || colOut)) {
				if (rowOut) this.virtualizer.scrollToIndex(r, { align: "center" });
				if (colOut) this.colVirtualizer.scrollToIndex(c, { align: "center" });
				let focusAttempts = 0;
				const myEpoch = this.focusIntentEpoch;
				const focusWhenReady = () => {
					if (this.focusIntentEpoch !== myEpoch) return;
					const el = this.resolveCellEl(String(r), c);
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
			const rowKey = header ? "__header" : String(r);
			const el = this.resolveCellEl(rowKey, c, header ? lvl : null);
			if (el) el.focus();
		};
		this.totalRowCount = () => {
			if (!this.table) return (this._rows.value || []).length;
			if (this.manual === true) {
				if (this.rowCount != null) return this.rowCount;
				if (this.pageCount != null) return this.pageCount * this.pageSize();
			}
			const fm = this.table.getFilteredRowModel();
			return fm && fm.rows ? fm.rows.length : (this._rows.value || []).length;
		};
		this.headerRowCount = () => (this._headerGroups.value || []).length;
		this.gridAriaRowCount = () => this.headerRowCount() + this.totalRowCount();
		this.ariaPageOffset = () => this.table ? this.pageIndex() * this.pageSize() : 0;
		this.bodyAriaRowIndex = (row) => this.headerRowCount() + this.rowIndexOf(row) + this.ariaPageOffset() + 1;
		this.gridAriaColCount = () => this.visibleColCount();
		this.visibleColCount = () => {
			const rowList = this._rows.value || [];
			if (rowList.length) return rowList[0].getVisibleCells().length;
			const hg = this._headerGroups.value || [];
			return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
		};
		this.bodyRowCount = () => (this._rows.value || []).length;
		this.headerLeafLevel = () => {
			const hg = this._headerGroups.value || [];
			return hg.length ? hg.length - 1 : 0;
		};
		this.headerCountAtLevel = (level) => {
			const hg = this._headerGroups.value || [];
			if (!hg.length) return this.visibleColCount();
			const grp = level >= 0 && level < hg.length ? hg[level] : null;
			if (!grp || !grp.headers) return this.visibleColCount();
			return grp.headers.length;
		};
		this.headerAt = (level, colIndex) => {
			const grp = (this._headerGroups.value || [])[level];
			if (!grp || !grp.headers) return null;
			return grp.headers[colIndex] || null;
		};
		this.parentHeaderColIndex = (level, colIndex) => {
			if (level <= 0) return -1;
			const h = this.headerAt(level, colIndex);
			if (!h || !h.column || !h.column.parent) return -1;
			const parentId = h.column.parent.id;
			const pg = (this._headerGroups.value || [])[level - 1];
			if (!pg || !pg.headers) return -1;
			for (let i = 0; i < pg.headers.length; i++) {
				const ph = pg.headers[i];
				if (ph && ph.column && ph.column.id === parentId) return i;
			}
			return -1;
		};
		this.firstChildHeaderColIndex = (level, colIndex) => {
			const h = this.headerAt(level, colIndex);
			if (!h || !h.column) return -1;
			const kids = h.column.columns || [];
			if (!kids.length) return -1;
			const childId = kids[0].id;
			const cg = (this._headerGroups.value || [])[level + 1];
			if (!cg || !cg.headers) return -1;
			for (let i = 0; i < cg.headers.length; i++) {
				const ch = cg.headers[i];
				if (ch && ch.column && ch.column.id === childId) return i;
			}
			return -1;
		};
		this.moveCol = (delta) => {
			const max = (this._activeIsHeader.value ? this.headerCountAtLevel(this._activeHeaderLevel.value) : this.visibleColCount()) - 1;
			const nextCol = clamp(this._activeColIndex.value + delta, 0, max < 0 ? 0 : max);
			this._activeColIndex.value = nextCol;
			return nextCol;
		};
		this.moveRow = (delta) => {
			const lastRow = this.bodyRowCount() - 1;
			const maxRow = lastRow < 0 ? 0 : lastRow;
			const leafLevel = this.headerLeafLevel();
			if (this._activeIsHeader.value) {
				if (delta > 0) {
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
					if (this.bodyRowCount() === 0) return {
						row: this._activeRow.value,
						col: this._activeColIndex.value,
						isHeader: true,
						level: this._activeHeaderLevel.value
					};
					const landRow = clamp(delta - 1, 0, maxRow);
					this._activeIsHeader.value = false;
					this._activeRow.value = landRow;
					return {
						row: landRow,
						col: this._activeColIndex.value,
						isHeader: false,
						level: 0
					};
				}
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
			const nextRow = clamp(this._activeRow.value + delta, 0, maxRow);
			this._activeRow.value = nextRow;
			this._activeIsHeader.value = false;
			return {
				row: nextRow,
				col: this._activeColIndex.value,
				isHeader: false,
				level: 0
			};
		};
		this.gotoColEdge = (toEnd) => {
			const max = (this._activeIsHeader.value ? this.headerCountAtLevel(this._activeHeaderLevel.value) : this.visibleColCount()) - 1;
			const nextCol = toEnd ? max < 0 ? 0 : max : 0;
			this._activeColIndex.value = nextCol;
			return nextCol;
		};
		this.gotoRowEdge = (toEnd) => {
			const lastRow = this.bodyRowCount() - 1;
			const nextRow = toEnd ? lastRow < 0 ? 0 : lastRow : 0;
			this._activeRow.value = nextRow;
			this._activeIsHeader.value = false;
			return nextRow;
		};
		this.gotoStart = () => {
			this._activeIsHeader.value = false;
			this._activeRow.value = 0;
			this._activeColIndex.value = 0;
			return {
				row: 0,
				col: 0
			};
		};
		this.gotoEnd = () => {
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
		this.currentCellEl = () => {
			const rowKey = this._activeIsHeader.value ? "__header" : String(this._activeRow.value);
			return this.resolveCellEl(rowKey, this._activeColIndex.value, this._activeIsHeader.value ? this._activeHeaderLevel.value : null);
		};
		this.enterControl = () => {
			const list = focusables(this.currentCellEl());
			if (!list.length) return;
			this._activeInControl.value = true;
			list[0].focus();
		};
		this.cycleWithinCell = (cellEl, forward) => {
			const list = focusables(cellEl);
			if (!list.length) return;
			const active = this.gridRoot ? this.gridRoot.getRootNode().activeElement : null;
			const cur = list.indexOf(active);
			let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
			if (i >= list.length) i = 0;
			if (i < 0) i = list.length - 1;
			list[i].focus();
		};
		this.onGridKeyDown = (e) => {
			if (!this.isGrid() || !e) return;
			const key = e.key;
			if (this._editingRow.value >= 0) return;
			if (this._editingRowIndex.value != null) return;
			if (this._activeInControl.value) {
				if (key === "Escape") {
					e.preventDefault();
					this._activeInControl.value = false;
					this.focusActiveCell(this._activeRow.value, this._activeColIndex.value);
				} else if (key === "Tab") {
					e.preventDefault();
					this.cycleWithinCell(this.currentCellEl(), !e.shiftKey);
				}
				return;
			}
			const tgt = e.target;
			if (!tgt || !tgt.hasAttribute || !tgt.hasAttribute("data-grid-cell")) return;
			const prevRow = this._activeRow.value;
			const prevCol = this._activeColIndex.value;
			const prevIsHeader = this._activeIsHeader.value;
			const prevLevel = this._activeHeaderLevel.value;
			let nextRow = prevRow;
			let nextCol = prevCol;
			let nextIsHeader = prevIsHeader;
			let nextLevel = prevLevel;
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && !this._activeIsHeader.value && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
				e.preventDefault();
				if (key === "ArrowUp") this.extendRange(-this._activeRow.value, 0);
				else if (key === "ArrowDown") this.extendRange(this.bodyRowCount() - 1 - this._activeRow.value, 0);
				else if (key === "ArrowLeft") this.extendRange(0, -this._activeColIndex.value);
				else this.extendRange(0, this.visibleColCount() - 1 - this._activeColIndex.value);
				return;
			} else if ((e.ctrlKey || e.metaKey) && !this._activeIsHeader.value && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
				e.preventDefault();
				this.clearRange();
				if (key === "ArrowUp") {
					nextRow = this.gotoRowEdge(false);
					nextIsHeader = false;
				} else if (key === "ArrowDown") {
					nextRow = this.gotoRowEdge(true);
					nextIsHeader = false;
				} else if (key === "ArrowLeft") nextCol = this.gotoColEdge(false);
				else nextCol = this.gotoColEdge(true);
			} else if (key === "ArrowRight" && e.shiftKey && !this._activeIsHeader.value) {
				e.preventDefault();
				this.extendRange(0, 1);
				return;
			} else if (key === "ArrowLeft" && e.shiftKey && !this._activeIsHeader.value) {
				e.preventDefault();
				this.extendRange(0, -1);
				return;
			} else if (key === "ArrowDown" && e.shiftKey && !this._activeIsHeader.value) {
				e.preventDefault();
				this.extendRange(1, 0);
				return;
			} else if (key === "ArrowUp" && e.shiftKey && !this._activeIsHeader.value) {
				e.preventDefault();
				this.extendRange(-1, 0);
				return;
			} else if (key === "ArrowRight") {
				e.preventDefault();
				this.clearRange();
				nextCol = this.moveCol(1);
			} else if (key === "ArrowLeft") {
				e.preventDefault();
				this.clearRange();
				nextCol = this.moveCol(-1);
			} else if (key === "ArrowDown") {
				e.preventDefault();
				this.clearRange();
				const m = this.moveRow(1);
				nextRow = m.row;
				nextCol = m.col;
				nextIsHeader = m.isHeader;
				nextLevel = m.level;
			} else if (key === "ArrowUp") {
				e.preventDefault();
				this.clearRange();
				const m = this.moveRow(-1);
				nextRow = m.row;
				nextCol = m.col;
				nextIsHeader = m.isHeader;
				nextLevel = m.level;
			} else if (key === "PageDown") {
				e.preventDefault();
				const m = this.moveRow(this.GRID_PAGE_STEP);
				nextRow = m.row;
				nextCol = m.col;
				nextIsHeader = m.isHeader;
				nextLevel = m.level;
			} else if (key === "PageUp") {
				e.preventDefault();
				const m = this.moveRow(-this.GRID_PAGE_STEP);
				nextRow = m.row;
				nextCol = m.col;
				nextIsHeader = m.isHeader;
				nextLevel = m.level;
			} else if (key === "Home") {
				e.preventDefault();
				if (e.ctrlKey || e.metaKey) {
					const s = this.gotoStart();
					nextRow = s.row;
					nextCol = s.col;
					nextIsHeader = false;
				} else nextCol = this.gotoColEdge(false);
			} else if (key === "End") {
				e.preventDefault();
				if (e.ctrlKey || e.metaKey) {
					const en = this.gotoEnd();
					nextRow = en.row;
					nextCol = en.col;
					nextIsHeader = false;
				} else nextCol = this.gotoColEdge(true);
			} else if ((key === "c" || key === "C") && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed() && this.clipboardWriteAvailable()) {
				e.preventDefault();
				this.copyRange();
				return;
			} else if ((key === "v" || key === "V") && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed() && this.clipboardReadAvailable()) {
				e.preventDefault();
				this.pasteRange();
				return;
			} else if ((key === "x" || key === "X") && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed() && this.clipboardWriteAvailable()) {
				e.preventDefault();
				this.cutRange();
				return;
			} else if ((key === "z" || key === "Z") && (e.ctrlKey || e.metaKey) && e.shiftKey) {
				if (this.undoable) {
					e.preventDefault();
					this.redo();
					return;
				}
			} else if ((key === "y" || key === "Y") && (e.ctrlKey || e.metaKey)) {
				if (this.undoable) {
					e.preventDefault();
					this.redo();
					return;
				}
			} else if ((key === "z" || key === "Z") && (e.ctrlKey || e.metaKey)) {
				if (this.undoable) {
					e.preventDefault();
					this.undo();
					return;
				}
			} else if ((key === "Delete" || key === "Backspace") && this.clipboardActiveAllowed()) {
				e.preventDefault();
				this.clearActiveRange();
				return;
			} else if ((key === "a" || key === "A") && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (!this._activeIsHeader.value) this.selectAllBody();
				return;
			} else if (key === "F2" && e.shiftKey && this.isActiveCellEditable()) {
				e.preventDefault();
				this.beginRowEdit((this._rows.value || [])[this._activeRow.value]);
				return;
			} else if ((key === "Enter" || key === "F2" || key === " ") && this.isActiveCellEditable() && this.editorTypeOf(this.activeCellColumnId()) === "checkbox") {
				e.preventDefault();
				this.toggleActiveBooleanCell();
				return;
			} else if ((key === "Enter" || key === "F2") && this.isActiveCellEditable()) {
				e.preventDefault();
				this.beginEdit(this._activeRow.value, this._activeColIndex.value, null);
				return;
			} else if (this.isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && this.editorTypeOf(this.activeCellColumnId()) !== "checkbox") {
				e.preventDefault();
				const editType = this.editorTypeOf(this.activeCellColumnId());
				const seed = editType === "text" || editType === "number" ? key : null;
				this.beginEdit(this._activeRow.value, this._activeColIndex.value, seed);
				return;
			} else if (key === "Enter" && !this._activeIsHeader.value && this.rowIsGrouped((this._rows.value || [])[this._activeRow.value])) {
				e.preventDefault();
				const grpRow = this._activeRow.value;
				const grpCol = this._activeColIndex.value;
				this.onToggleExpand((this._rows.value || [])[this._activeRow.value], e);
				this.recoverGridFocus(String(grpRow), grpCol, null, true);
				return;
			} else if (key === "Enter" || key === "F2") {
				e.preventDefault();
				this.enterControl();
				return;
			} else return;
			this.focusActiveCell(nextRow, nextCol, nextIsHeader, nextLevel);
			if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader || nextLevel !== prevLevel) this.dispatchEvent(new CustomEvent("activecell-change", {
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
		};
		this.syncActiveFromEvent = (e) => {
			if (!this.isGrid() || !e) return;
			const tgt = e.target;
			if (!tgt || !tgt.closest) return;
			const cellEl = tgt.closest("[data-grid-cell]");
			if (!cellEl) return;
			const rowAttr = cellEl.getAttribute("data-row");
			const colAttr = cellEl.getAttribute("data-col-index");
			if (rowAttr == null || colAttr == null) return;
			const col = parseInt(colAttr, 10);
			if (!Number.isFinite(col)) return;
			const prevIsHeader = this._activeIsHeader.value;
			const prevRow = this._activeRow.value;
			const prevCol = this._activeColIndex.value;
			const prevLevel = this._activeHeaderLevel.value;
			const isHeader = rowAttr === "__header";
			this._activeIsHeader.value = isHeader;
			let movedRow = prevRow;
			let movedLevel = prevLevel;
			if (isHeader) {
				const lvlAttr = cellEl.getAttribute("data-header-level");
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
			if (isHeader !== prevIsHeader || col !== prevCol || (isHeader ? movedLevel !== prevLevel : movedRow !== prevRow)) this.focusIntentEpoch = this.focusIntentEpoch + 1;
			if (this.rangeTransition) this.rangeTransition = false;
			else if (this.rangeClickPending && this.rangeClickPending.isHeader === isHeader && this.rangeClickPending.r === movedRow && this.rangeClickPending.c === col) this.rangeClickPending = null;
			else {
				this.rangeClickPending = null;
				this.clearRange();
			}
			if (tgt === cellEl) this._activeInControl.value = false;
		};
		this.onGridMouseDown = (e) => {
			if (!this.isGrid() || !e) return;
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
				this.setRangeFocus(row, col);
				this._activeIsHeader.value = false;
				this._activeRow.value = row;
				this._activeColIndex.value = col;
				this.rangeClickPending = {
					isHeader: false,
					r: row,
					c: col
				};
				return;
			}
			if (this.isEditing(row, col)) return;
			this.beginRangeDrag(row, col);
		};
		this.onGridDblClick = (e) => {
			if (!this.isGrid() || !e) return;
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
			const rowObj = (this._rows.value || [])[row];
			if (this.rowIsGrouped(rowObj)) {
				e.preventDefault();
				this.onToggleExpand(rowObj, e);
				this.recoverGridFocus(String(row), col, null, true);
				return;
			}
			const colId = this.columnIdAt(row, col);
			if (colId != null && this.columnEditable(colId)) {
				e.preventDefault();
				this.beginEdit(row, col, null);
			}
		};
		this.onGridClick = (e) => {
			if (!this.isGrid() || !e) return;
			if (!this.singleClickEdit) return;
			if (e.shiftKey) return;
			if (this.rangeDragMoved) {
				this.rangeDragMoved = false;
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
			if (this._editingRow.value === row && this._editingCol.value === col) return;
			const colId = this.columnIdAt(row, col);
			if (colId != null && this.columnEditable(colId)) this.beginEdit(row, col, null);
		};
		this.onGridFocusOut = (e) => {
			if (!this.isGrid() || !this._activeInControl.value) return;
			const next = e ? e.relatedTarget : null;
			const cellEl = this.currentCellEl();
			if (!cellEl || !next || !cellEl.contains(next)) this._activeInControl.value = false;
		};
		this.recoverGridFocus = (rowKey, col, level, guardMoved = false) => {
			if (!this.gridRoot) return;
			let attempts = 0;
			const tryFocus = () => {
				if (guardMoved) {
					const ae = this.gridRoot && this.gridRoot.getRootNode ? this.gridRoot.getRootNode().activeElement : null;
					const aeCell = ae && ae.closest ? ae.closest("[data-grid-cell]") : null;
					if (aeCell && this.gridRoot.contains(aeCell)) {
						const aeRow = aeCell.getAttribute("data-row");
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
				if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
				else setTimeout(tryFocus, 16);
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
			else setTimeout(tryFocus, 0);
		};
		this.clampActiveCell = (rowCount, colCount) => {
			if (!this.isGrid()) return;
			const colN = colCount != null ? colCount : this.visibleColCount();
			const rowN = rowCount != null ? rowCount : this.bodyRowCount();
			let recoverFocus = false;
			let doomedRow = -1;
			let doomedCol = 0;
			if (this.gridRoot) {
				const rootNode = this.gridRoot.getRootNode ? this.gridRoot.getRootNode() : null;
				const focusedEl = rootNode ? rootNode.activeElement : null;
				const focusedCell = focusedEl && focusedEl.closest ? focusedEl.closest("[data-grid-cell]") : null;
				if (focusedCell && this.gridRoot.contains(focusedCell)) {
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
			const col = clamp(this._activeColIndex.value, 0, maxCol < 0 ? 0 : maxCol);
			if (col !== this._activeColIndex.value) this._activeColIndex.value = col;
			if (rowN <= 0) {
				this._activeIsHeader.value = true;
				this._activeHeaderLevel.value = this.headerLeafLevel();
				this._activeColIndex.value = 0;
				this.gridEmptyFallback = true;
				this.clampRange(rowN - 1, colN - 1);
				return;
			}
			if (this.gridEmptyFallback) {
				this.gridEmptyFallback = false;
				this._activeIsHeader.value = false;
				this._activeRow.value = 0;
			}
			if (!this._activeIsHeader.value) {
				const lastRow = rowN - 1;
				const maxRow = lastRow < 0 ? 0 : lastRow;
				const row = clamp(this._activeRow.value, 0, maxRow);
				if (row !== this._activeRow.value) this._activeRow.value = row;
			}
			this.clampRange(rowN - 1, colN - 1);
			if (recoverFocus) {
				const recRow = clamp(doomedRow, 0, rowN - 1);
				const recCol = clamp(doomedCol, 0, maxCol < 0 ? 0 : maxCol);
				this.recoverGridFocus(String(recRow), recCol, null);
			}
		};
		this.windowedHeadersFor = (hg, hgLevel) => {
			const headers = hg && hg.headers || [];
			if (!this.colsWindowed()) return headers.map((h) => ({
				header: h,
				span: h && h.colSpan > 1 ? h.colSpan : 1,
				width: null
			}));
			const idx = this.windowedColIndices();
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
					width = width + this.columnSize(c);
				}
				if (span > 0) out.push({
					header: h,
					span,
					width
				});
			}
			return out;
		};
		this.windowedColSpan = () => this.colsWindowed() ? this.windowedColIndices().length + 2 : this.visibleColCount();
		this.lastColSizeSig = 0;
		this.remeasureColumnSizes = () => {
			if (!this.colsWindowed() || !this.colVirtualizer || !this.colVirtualizer.measure) return;
			const n = this.columnCount();
			let sig = n;
			for (let i = 0; i < n; i++) sig = Math.imul(sig, 31) + this.columnSize(i) | 0;
			if (sig === this.lastColSizeSig) return;
			this.lastColSizeSig = sig;
			this.colVirtualizer.measure();
		};
		this.remeasureColumnWindow = () => {
			if (!this.colsWindowed() || !this.colVirtualizer) return;
			this.colVirtualizer.setOptions(this.columnVirtualizerOptions());
			this.remeasureColumnSizes();
			this.colVirtualizer._willUpdate();
		};
		this.gridEmptyFallback = false;
		this.rangeTransition = false;
		this.rangeClickPending = null;
		this.rangeActive = false;
		this.inRange = (rIdx, cIdx) => {
			const a = this._rangeAnchor.value;
			const f = this._rangeFocus.value;
			if (!a || !f) return false;
			const r0 = a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex;
			const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
			const c0 = a.colIndex < f.colIndex ? a.colIndex : f.colIndex;
			const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
			return rIdx >= r0 && rIdx <= r1 && cIdx >= c0 && cIdx <= c1;
		};
		this.getSelectedRange = () => {
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
			const clampCorner = (c) => c == null ? null : {
				rowIndex: clamp(c.rowIndex, 0, maxRow),
				colIndex: clamp(c.colIndex, 0, maxCol)
			};
			return {
				anchor: clampCorner(a),
				focus: clampCorner(f)
			};
		};
		this.isFillHandleCell = (rIdx, cIdx) => {
			const a = this._rangeAnchor.value;
			const f = this._rangeFocus.value;
			if (!a || !f) return false;
			const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
			const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
			return rIdx === r1 && cIdx === c1;
		};
		this.rangeSummary = (anchor, focus) => {
			if (!anchor || !focus) return "";
			const rows = Math.abs(focus.rowIndex - anchor.rowIndex) + 1;
			const cols = Math.abs(focus.colIndex - anchor.colIndex) + 1;
			if (rows === 1 && cols === 1) return "1 cell selected";
			const rowPart = rows + (rows === 1 ? " row" : " rows");
			const colPart = cols + (cols === 1 ? " column" : " columns");
			return rowPart + " by " + colPart + " selected, " + rows * cols + " cells";
		};
		this.emitRangeChange = (anchor, focus) => {
			this._rangeAnnounce.value = this.rangeSummary(anchor, focus);
			this.dispatchEvent(new CustomEvent("range-change", {
				detail: {
					anchor,
					focus
				},
				bubbles: true,
				composed: true
			}));
		};
		this.extendRange = (dRow, dCol) => {
			if (this._activeIsHeader.value) return;
			const maxRow = this.bodyRowCount() - 1;
			const maxCol = this.visibleColCount() - 1;
			if (maxRow < 0 || maxCol < 0) return;
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
			const nextRow = clamp(focus.rowIndex + dRow, 0, maxRow);
			const nextCol = clamp(focus.colIndex + dCol, 0, maxCol);
			const nextFocus = {
				rowIndex: nextRow,
				colIndex: nextCol
			};
			this._rangeAnchor.value = anchor;
			this._rangeFocus.value = nextFocus;
			this.rangeActive = true;
			this._activeRow.value = nextRow;
			this._activeColIndex.value = nextCol;
			this.rangeTransition = true;
			this.focusActiveCell(nextRow, nextCol, false);
			if (!hadRange || nextRow !== focus.rowIndex || nextCol !== focus.colIndex) this.emitRangeChange(anchor, nextFocus);
		};
		this.setRangeFocus = (rIdx, cIdx, anchorR = null, anchorC = null) => {
			const maxRow = this.bodyRowCount() - 1;
			const maxCol = this.visibleColCount() - 1;
			if (maxRow < 0 || maxCol < 0) return;
			let anchor = this._rangeAnchor.value;
			if (!anchor && anchorR != null && anchorC != null) anchor = {
				rowIndex: clamp(Math.trunc(Number(anchorR)) || 0, 0, maxRow),
				colIndex: clamp(Math.trunc(Number(anchorC)) || 0, 0, maxCol)
			};
			if (!anchor) anchor = {
				rowIndex: this._activeRow.value,
				colIndex: this._activeColIndex.value
			};
			const nextFocus = {
				rowIndex: clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow),
				colIndex: clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol)
			};
			this._rangeAnchor.value = anchor;
			this._rangeFocus.value = nextFocus;
			this.rangeActive = true;
			this.emitRangeChange(anchor, nextFocus);
		};
		this.selectAllBody = () => {
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
		this.clearRange = () => {
			if (!this.rangeActive) return;
			this.rangeActive = false;
			this._rangeAnchor.value = null;
			this._rangeFocus.value = null;
			this.emitRangeChange(null, null);
		};
		this.clampRange = (maxRowArg, maxColArg) => {
			const a = this._rangeAnchor.value;
			const f = this._rangeFocus.value;
			if (!a && !f) return;
			const maxRow = maxRowArg != null ? maxRowArg : this.bodyRowCount() - 1;
			const maxCol = maxColArg != null ? maxColArg : this.visibleColCount() - 1;
			if (maxRow < 0 || maxCol < 0) {
				this._rangeAnchor.value = null;
				this._rangeFocus.value = null;
				this.rangeActive = false;
				return;
			}
			if (a) {
				const ar = clamp(a.rowIndex, 0, maxRow);
				const ac = clamp(a.colIndex, 0, maxCol);
				if (ar !== a.rowIndex || ac !== a.colIndex) this._rangeAnchor.value = {
					rowIndex: ar,
					colIndex: ac
				};
			}
			if (f) {
				const fr = clamp(f.rowIndex, 0, maxRow);
				const fc = clamp(f.colIndex, 0, maxCol);
				if (fr !== f.rowIndex || fc !== f.colIndex) this._rangeFocus.value = {
					rowIndex: fr,
					colIndex: fc
				};
			}
		};
		this.announce = (msg) => {
			this._pasteAnnounce.value = msg != null ? msg : "";
		};
		this.clipboardActiveAllowed = () => !this._activeIsHeader.value;
		this.fieldOfColId = (colId) => {
			const d = this.defFor(colId);
			return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
		};
		this.normalizedRange = () => {
			const a = this._rangeAnchor.value;
			const f = this._rangeFocus.value;
			if (!a || !f) return null;
			const maxRow = this.bodyRowCount() - 1;
			const maxCol = this.visibleColCount() - 1;
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
		};
		this.rangeToTsv = () => {
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
					cells.push(escapeTsvField(v == null ? "" : String(v)));
				}
				lines.push(cells.join("	"));
			}
			return lines.join("\n");
		};
		this.clipboardWriteAvailable = () => typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.writeText === "function";
		this.clipboardReadAvailable = () => typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.readText === "function";
		this.copyRange = () => {
			if (!this.clipboardActiveAllowed()) return;
			if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.writeText) return;
			try {
				const p = navigator.clipboard.writeText(this.rangeToTsv());
				if (p && p.catch) p.catch(() => {});
			} catch (err) {}
		};
		this.applyGridToRange = (grid, originRow, originCol, verb) => {
			const opVerb = typeof verb === "string" && verb !== "" ? verb : "pasted";
			const maxRow = this.bodyRowCount() - 1;
			const maxCol = this.visibleColCount() - 1;
			if (maxRow < 0 || maxCol < 0) return {
				wrote: 0,
				changed: 0,
				total: 0
			};
			let total = 0;
			let applied = 0;
			const committed = [];
			let next = this.currentData();
			for (let gr = 0; gr < grid.length; gr++) {
				const r = originRow + gr;
				if (r > maxRow) break;
				const rowGrouped = this.rowIndexIsGrouped(r);
				const cols = grid[gr] || [];
				for (let gc = 0; gc < cols.length; gc++) {
					const c = originCol + gc;
					if (c > maxCol) break;
					total = total + 1;
					if (rowGrouped) continue;
					const colId = this.columnIdAt(r, c);
					if (colId == null || !this.columnEditable(colId)) continue;
					const rowObj = this.rowOriginalAt(r);
					const value = this.coerceCellValue(colId, cols[gc]);
					if (this.runValidator(colId, value, rowObj) !== true) continue;
					const field = this.fieldOfColId(colId);
					const srcIndex = this.sourceIndexOfRow(r);
					const oldValue = rowObj ? rowObj[field] : null;
					applied = applied + 1;
					if (oldValue === value) continue;
					next = replaceRowValue(next, srcIndex, field, value);
					committed.push({
						rowId: this.rowIdAt(r),
						columnId: colId,
						oldValue,
						newValue: value
					});
				}
			}
			if (committed.length > 0) {
				this.editTransition = true;
				this.writeData(next);
				this.editTransition = false;
				for (let i = 0; i < committed.length; i++) try {
					this.dispatchEvent(new CustomEvent("cell-edit-commit", {
						detail: committed[i],
						bubbles: true,
						composed: true
					}));
				} catch (err) {
					console.error("[rozie-data-table] paste failed partway: a cell-edit-commit listener threw. The model was already written; the remaining cells still notify.", err);
				}
			}
			if (applied > 0) this.announce(applied + " of " + total + " cells " + opVerb);
			else if (total > 0) this.announce("No cells " + opVerb + " — " + total + " cells were invalid or read-only");
			return {
				wrote: applied,
				changed: committed.length,
				total
			};
		};
		this.rowOriginalAt = (rowIndex) => {
			const row = (this._rows.value || [])[rowIndex];
			return row ? row.original : null;
		};
		this.rowIdAt = (rowIndex) => {
			const row = (this._rows.value || [])[rowIndex];
			return row ? row.id : null;
		};
		this.pasteRange = () => {
			if (!this.clipboardActiveAllowed()) return;
			if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.readText) return;
			const box = this.normalizedRange();
			const anchorRow = box ? box.r0 : this._activeRow.value;
			const anchorCol = box ? box.c0 : this._activeColIndex.value;
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
					const tiled = tileGridToBox(grid, destBox);
					this.applyGridToRange(tiled, anchorRow, anchorCol, "pasted");
				} catch (err) {
					console.error("[rozie-data-table] paste failed: a row accessor, the data model setter or other consumer code threw. The paste was abandoned.", err);
				}
			}, () => {});
		};
		this.cutRange = () => {
			if (!this.clipboardActiveAllowed()) return;
			const box = this.normalizedRange();
			const r0 = box ? box.r0 : this._activeRow.value;
			const r1 = box ? box.r1 : this._activeRow.value;
			const c0 = box ? box.c0 : this._activeColIndex.value;
			const c1 = box ? box.c1 : this._activeColIndex.value;
			if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) try {
				const cp = navigator.clipboard.writeText(this.rangeToTsv());
				if (cp && cp.catch) cp.catch(() => {});
			} catch (err) {}
			const grid = [];
			for (let r = r0; r <= r1; r++) {
				const cols = [];
				for (let c = c0; c <= c1; c++) cols.push("");
				grid.push(cols);
			}
			this.applyGridToRange(grid, r0, c0, "cut");
		};
		this.clearActiveRange = () => {
			if (!this.clipboardActiveAllowed()) return;
			const box = this.normalizedRange();
			const r0 = box ? box.r0 : this._activeRow.value;
			const r1 = box ? box.r1 : this._activeRow.value;
			const c0 = box ? box.c0 : this._activeColIndex.value;
			const c1 = box ? box.c1 : this._activeColIndex.value;
			const grid = [];
			for (let r = r0; r <= r1; r++) {
				const cols = [];
				for (let c = c0; c <= c1; c++) cols.push("");
				grid.push(cols);
			}
			this.applyGridToRange(grid, r0, c0, "cleared");
		};
		this.fillRange = (sourceBox, endCell) => {
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
			} else box = this.normalizedRange();
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
					const v = this.cellValueAt(sr, sc);
					cols.push(v == null ? "" : String(v));
				}
				grid.push(cols);
			}
			this.applyGridToRange(grid, box.r0, box.c0, "filled");
		};
		this.fillDragging = false;
		this.fillDragMove = null;
		this.fillDragUp = null;
		this.fillEdgeScrollRaf = null;
		this.FILL_EDGE_SCROLL_PX = 24;
		this.FILL_EDGE_SCROLL_STEP = 16;
		this.edgeDelta = (clientX, clientY) => {
			if (!this.gridScrollEl) return {
				dx: 0,
				dy: 0
			};
			const rect = this.gridScrollEl.getBoundingClientRect();
			let dx = 0;
			let dy = 0;
			if (this.colsWindowed()) {
				if (clientX - rect.left < this.FILL_EDGE_SCROLL_PX) dx = -this.FILL_EDGE_SCROLL_STEP;
				else if (rect.right - clientX < this.FILL_EDGE_SCROLL_PX) dx = this.FILL_EDGE_SCROLL_STEP;
			}
			if (this.rowsWindowed()) {
				if (clientY - rect.top < this.FILL_EDGE_SCROLL_PX) dy = -this.FILL_EDGE_SCROLL_STEP;
				else if (rect.bottom - clientY < this.FILL_EDGE_SCROLL_PX) dy = this.FILL_EDGE_SCROLL_STEP;
			}
			return {
				dx,
				dy
			};
		};
		this.teardownFillDrag = () => {
			if (typeof document !== "undefined") {
				if (this.fillDragMove) document.removeEventListener("pointermove", this.fillDragMove);
				if (this.fillDragUp) document.removeEventListener("pointerup", this.fillDragUp);
			}
			this.fillDragMove = null;
			this.fillDragUp = null;
			this.fillDragging = false;
			if (this.fillEdgeScrollRaf != null) {
				if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.fillEdgeScrollRaf);
				this.fillEdgeScrollRaf = null;
			}
		};
		this.FILL_HITTEST_PROBE_RADIUS_PX = 8;
		this.FILL_HITTEST_PROBE_STEP_PX = 2;
		this.resolveCellAt = (clientX, clientY) => {
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
		};
		this.cellIndexFromPoint = (clientX, clientY) => {
			if (typeof document === "undefined" || !document.elementFromPoint) return null;
			const direct = this.resolveCellAt(clientX, clientY);
			if (direct) return direct;
			for (let d = this.FILL_HITTEST_PROBE_STEP_PX; d <= this.FILL_HITTEST_PROBE_RADIUS_PX; d += this.FILL_HITTEST_PROBE_STEP_PX) {
				const right = this.resolveCellAt(clientX + d, clientY);
				if (right) return right;
				const left = this.resolveCellAt(clientX - d, clientY);
				if (left) return left;
			}
			return null;
		};
		this.onFillHandlePointerDown = (e) => {
			if (!e) return;
			if (e.preventDefault) e.preventDefault();
			if (e.stopPropagation) e.stopPropagation();
			this.teardownFillDrag();
			this.fillDragging = true;
			const sourceBox = this.normalizedRange();
			let lastCell = sourceBox ? {
				r: sourceBox.r1,
				c: sourceBox.c1
			} : null;
			let lastClientX = 0;
			let lastClientY = 0;
			const applyPointAt = (clientX, clientY) => {
				const cell = this.cellIndexFromPoint(clientX, clientY);
				if (cell && (!lastCell || cell.r !== lastCell.r || cell.c !== lastCell.c)) {
					lastCell = cell;
					this.setRangeFocus(cell.r, cell.c);
				}
			};
			const scrollStep = () => {
				if (!this.fillDragging) {
					this.fillEdgeScrollRaf = null;
					return;
				}
				const d = this.edgeDelta(lastClientX, lastClientY);
				if (d.dx === 0 && d.dy === 0) {
					this.fillEdgeScrollRaf = null;
					return;
				}
				if (this.gridScrollEl) {
					if (d.dx !== 0) this.gridScrollEl.scrollLeft = this.gridScrollEl.scrollLeft + d.dx;
					if (d.dy !== 0) this.gridScrollEl.scrollTop = this.gridScrollEl.scrollTop + d.dy;
				}
				applyPointAt(lastClientX, lastClientY);
				this.fillEdgeScrollRaf = requestAnimationFrame(scrollStep);
			};
			const move = (ev) => {
				if (!this.fillDragging) return;
				lastClientX = ev.clientX;
				lastClientY = ev.clientY;
				applyPointAt(ev.clientX, ev.clientY);
				if (this.fillEdgeScrollRaf == null && typeof requestAnimationFrame === "function") {
					const d = this.edgeDelta(ev.clientX, ev.clientY);
					if (d.dx !== 0 || d.dy !== 0) this.fillEdgeScrollRaf = requestAnimationFrame(scrollStep);
				}
			};
			const up = () => {
				this.teardownFillDrag();
				if (lastCell && sourceBox && (lastCell.r !== sourceBox.r1 || lastCell.c !== sourceBox.c1)) this.fillRange(sourceBox, lastCell);
			};
			this.fillDragMove = move;
			this.fillDragUp = up;
			if (typeof document !== "undefined") {
				document.addEventListener("pointermove", move);
				document.addEventListener("pointerup", up);
			}
		};
		this.rangeDragging = false;
		this.rangeDragMove = null;
		this.rangeDragUp = null;
		this.rangeDragMoved = false;
		this.teardownRangeDrag = () => {
			if (typeof document !== "undefined") {
				if (this.rangeDragMove) document.removeEventListener("pointermove", this.rangeDragMove);
				if (this.rangeDragUp) document.removeEventListener("pointerup", this.rangeDragUp);
			}
			this.rangeDragMove = null;
			this.rangeDragUp = null;
			this.rangeDragging = false;
		};
		this.beginRangeDrag = (anchorR, anchorC) => {
			this.teardownRangeDrag();
			this.rangeDragging = true;
			this.rangeDragMoved = false;
			let lastCell = {
				r: anchorR,
				c: anchorC
			};
			const move = (ev) => {
				if (!this.rangeDragging) return;
				const cell = this.cellIndexFromPoint(ev.clientX, ev.clientY);
				if (cell && (cell.r !== lastCell.r || cell.c !== lastCell.c)) {
					lastCell = cell;
					this.rangeDragMoved = true;
					this.setRangeFocus(cell.r, cell.c, anchorR, anchorC);
				}
			};
			const up = () => {
				this.teardownRangeDrag();
			};
			this.rangeDragMove = move;
			this.rangeDragUp = up;
			if (typeof document !== "undefined") {
				document.addEventListener("pointermove", move);
				document.addEventListener("pointerup", up);
			}
		};
		this.activeCellColumnId = () => {
			if (this._activeIsHeader.value) return null;
			const row = (this._rows.value || [])[this._activeRow.value];
			if (!row) return null;
			const cell = this.visibleCellsFor(row)[this._activeColIndex.value];
			return cell && cell.column ? cell.column.id : null;
		};
		this.isActiveCellEditable = () => {
			if (this.rowIndexIsGrouped(this._activeRow.value)) return false;
			const colId = this.activeCellColumnId();
			return colId != null && this.columnEditable(colId);
		};
		this.isEditing = (rowIndex, colIndex) => {
			if (this._editVer.value < 0) return false;
			if (this.rowIndexIsGrouped(rowIndex)) return false;
			if (this._editingRowIndex.value != null && this._editingRowIndex.value === rowIndex) {
				const colId = this.columnIdAt(rowIndex, colIndex);
				return colId != null && this.columnEditable(colId);
			}
			return this._editingRow.value === rowIndex && this._editingCol.value === colIndex;
		};
		this.cellAriaInvalid = (rowIndex, colIndex) => this.isEditing(rowIndex, colIndex) && !!this._invalidMsg.value ? "true" : null;
		this.runValidator = (colId, value, row) => {
			const m = this.editMetaOf(colId);
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
		};
		this.setInvalid = (msg) => {
			this._invalidMsg.value = msg != null ? msg : "";
		};
		this.sourceIndexOfRow = (visibleRowIndex) => {
			const row = (this._rows.value || [])[visibleRowIndex];
			if (!row) return visibleRowIndex;
			const orig = row.original;
			const idx = (this.currentData() || []).indexOf(orig);
			return idx >= 0 ? idx : visibleRowIndex;
		};
		this.editingColumnId = () => {
			const row = (this._rows.value || [])[this._editingRow.value];
			if (!row) return null;
			const cell = this.visibleCellsFor(row)[this._editingCol.value];
			return cell && cell.column ? cell.column.id : null;
		};
		this.editingColumnField = () => {
			const colId = this.editingColumnId();
			if (colId == null) return null;
			const d = this.defFor(colId);
			return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
		};
		this.editingCellValue = () => {
			const row = (this._rows.value || [])[this._editingRow.value];
			if (!row) return null;
			const cell = this.visibleCellsFor(row)[this._editingCol.value];
			return cell ? cell.getValue() : null;
		};
		this.editingRowOriginal = () => {
			const row = (this._rows.value || [])[this._editingRow.value];
			return row ? row.original : null;
		};
		this.editingRowId = () => {
			const row = (this._rows.value || [])[this._editingRow.value];
			return row ? row.id : null;
		};
		this.resolveEditFocusCellEl = (rowIndex, colIndex) => {
			if (rowIndex == null || colIndex == null || rowIndex < 0 || colIndex < 0) return null;
			return this.resolveCellEl(String(rowIndex), colIndex);
		};
		this.focusEditorWhenReady = (rowIndex, colIndex, selectAll = true) => {
			if (!this.gridRoot) return;
			let attempts = 0;
			const tryFocus = () => {
				const cellEl = this.resolveEditFocusCellEl(rowIndex, colIndex);
				const el = cellEl && cellEl.querySelector ? cellEl.querySelector("[data-editing-cell][data-builtin-editor]") : null;
				if (!el) {
					if (cellEl && cellEl.querySelector ? cellEl.querySelector("[data-editing-cell]") : null) return;
					attempts = attempts + 1;
					if (attempts >= 30) return;
					if (typeof requestAnimationFrame === "function") requestAnimationFrame(tryFocus);
					else setTimeout(tryFocus, 16);
					return;
				}
				const ae = this.gridRoot && this.gridRoot.getRootNode ? this.gridRoot.getRootNode().activeElement : null;
				if (ae && el && ae !== el && ae.closest && this.gridRoot.contains(ae) && ae.hasAttribute && ae.hasAttribute("data-editing-cell")) {
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
		};
		this.columnIdAt = (rowIndex, colIndex) => {
			const row = (this._rows.value || [])[rowIndex];
			if (!row) return null;
			const cell = this.visibleCellsFor(row)[colIndex];
			return cell && cell.column ? cell.column.id : null;
		};
		this.cellValueAt = (rowIndex, colIndex) => {
			const row = (this._rows.value || [])[rowIndex];
			if (!row) return null;
			const cell = this.visibleCellsFor(row)[colIndex];
			return cell ? cell.getValue() : null;
		};
		this.beginEdit = (rowIndex, colIndex, seed) => {
			if (this.rowIndexIsGrouped(rowIndex)) return;
			const colId = this.columnIdAt(rowIndex, colIndex);
			if (colId == null || !this.columnEditable(colId)) return;
			this.committedThisSession = false;
			this.setInvalid("");
			this._editingRowIndex.value = null;
			this._rowDraft.value = {};
			this._editingRow.value = rowIndex;
			this._editingCol.value = colIndex;
			this._draftValue.value = seed != null ? seed : this.cellValueAt(rowIndex, colIndex);
			this._activeInControl.value = true;
			this._editVer.value = this._editVer.value + 1;
			this._editFocusColId.value = colId;
			this.focusEditorWhenReady(rowIndex, colIndex, seed == null);
		};
		this.focusCellWhenReady = (row, col) => {
			if (!this.gridRoot) return;
			let attempts = 0;
			const tryFocus = () => {
				const el = this.resolveCellEl(String(row), col);
				if (el) {
					const ae = this.gridRoot && this.gridRoot.getRootNode ? this.gridRoot.getRootNode().activeElement : null;
					if (ae && ae !== el && this.gridRoot.contains && this.gridRoot.contains(ae) && ae.closest) {
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
		};
		this.endEdit = () => {
			this._editingRow.value = -1;
			this._editingCol.value = -1;
			this._draftValue.value = null;
			this._invalidMsg.value = "";
			this._activeInControl.value = false;
			this._editVer.value = this._editVer.value + 1;
			this._editFocusColId.value = null;
		};
		this.endRowEdit = () => {
			this._editingRowIndex.value = null;
			this._rowDraft.value = {};
			this._invalidMsg.value = "";
			this._activeInControl.value = false;
			this._editVer.value = this._editVer.value + 1;
			this._editFocusColId.value = null;
		};
		this.editorAutofocusFor = (colId, rowIndex) => {
			if (this._editVer.value < 0) return false;
			if (this._editingRowIndex.value != null) {
				if (this._editingRowIndex.value !== rowIndex) return false;
			} else if (this._editingRow.value !== rowIndex) return false;
			return this._editFocusColId.value != null && this._editFocusColId.value === colId;
		};
		this.coerceCellValue = (colId, raw) => {
			const kind = this.editorTypeOf(colId);
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
		};
		this.commitEdit = (overrideValue = void 0, skipFocusReturn = false) => {
			if (this._editingRow.value < 0) return false;
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
			const rawValue = overrideValue !== void 0 ? overrideValue : this._draftValue.value;
			const newValue = this.coerceCellValue(colId, rawValue);
			const err = this.runValidator(colId, newValue, rowOriginal);
			if (err !== true) {
				this.setInvalid(err);
				this.focusEditorWhenReady(this._editingRow.value, this._editingCol.value);
				return false;
			}
			this.setInvalid("");
			const changed = !Object.is(newValue, oldValue);
			const focusRow = this._editingRow.value;
			const focusCol = this._editingCol.value;
			this.editTransition = true;
			this.committedThisSession = true;
			if (changed) {
				const srcIndex = this.sourceIndexOfRow(this._editingRow.value);
				const next = replaceRowValue(this.currentData(), srcIndex, field, newValue);
				this.writeData(next);
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
				if (skipFocusReturn !== true) this.pendingEditFollow = {
					rowOriginal,
					rowId,
					col: focusCol
				};
			} else if (skipFocusReturn !== true) this.focusCellWhenReady(focusRow, focusCol);
			return true;
		};
		this.toggleActiveBooleanCell = () => {
			if (this.rowIndexIsGrouped(this._activeRow.value)) return;
			const colId = this.columnIdAt(this._activeRow.value, this._activeColIndex.value);
			if (colId == null || !this.columnEditable(colId)) return;
			const row = (this._rows.value || [])[this._activeRow.value];
			if (!row) return;
			const rowOriginal = row.original;
			const rowId = row.id;
			const oldValue = this.cellValueAt(this._activeRow.value, this._activeColIndex.value);
			const newValue = !oldValue;
			const err = this.runValidator(colId, newValue, rowOriginal);
			if (err !== true) {
				this.setInvalid(err);
				return;
			}
			this.setInvalid("");
			const def = this.defFor(colId);
			const field = def && def.accessorKey != null ? def.accessorKey : colId;
			const srcIndex = this.sourceIndexOfRow(this._activeRow.value);
			this.committedThisSession = true;
			this.writeData(replaceRowValue(this.currentData(), srcIndex, field, newValue));
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
			this.pendingEditFollow = {
				rowOriginal,
				rowId,
				col: this._activeColIndex.value
			};
		};
		this.cancelEdit = () => {
			if (this._editingRow.value < 0) return;
			const focusRow = this._editingRow.value;
			const focusCol = this._editingCol.value;
			this.editTransition = true;
			this.endEdit();
			this.editTransition = false;
			this.focusCellWhenReady(focusRow, focusCol);
		};
		this.editableColumnsForRow = (rowIndex) => {
			const row = (this._rows.value || [])[rowIndex];
			if (!row) return [];
			const cells = this.visibleCellsFor(row);
			const out = [];
			for (let c = 0; c < cells.length; c++) {
				const cell = cells[c];
				const colId = cell && cell.column ? cell.column.id : null;
				if (colId == null || !this.columnEditable(colId)) continue;
				const d = this.defFor(colId);
				const field = d ? d.accessorKey != null ? d.accessorKey : colId : colId;
				out.push({
					colId,
					field,
					colIndex: c
				});
			}
			return out;
		};
		this.focusRowEditorAt = (rowIndex, colIndex) => {
			if (!this.gridRoot) return;
			let attempts = 0;
			const tryFocus = () => {
				const cellEl = this.resolveCellEl(String(rowIndex), colIndex);
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
		};
		this.beginRowEdit = (row) => {
			const rowIndex = this.rowIndexOf(row);
			if (rowIndex < 0) return;
			if (this.rowIndexIsGrouped(rowIndex)) return;
			const editable = this.editableColumnsForRow(rowIndex);
			if (editable.length === 0) return;
			this.committedThisSession = false;
			this._editingRow.value = -1;
			this._editingCol.value = -1;
			this._draftValue.value = null;
			this.setInvalid("");
			const draft = {};
			const r = (this._rows.value || [])[rowIndex];
			const orig = r ? r.original : null;
			for (let i = 0; i < editable.length; i++) {
				const ec = editable[i];
				draft[ec.colId] = orig ? orig[ec.field] : null;
			}
			this._rowDraft.value = draft;
			this._editingRowIndex.value = rowIndex;
			this._activeInControl.value = true;
			this._editVer.value = this._editVer.value + 1;
			this._editFocusColId.value = editable[0].colId;
			this.focusEditorWhenReady(rowIndex, editable[0].colIndex);
		};
		this.commitRow = () => {
			if (this._editingRowIndex.value == null) return false;
			const rowIndex = this._editingRowIndex.value;
			const editable = this.editableColumnsForRow(rowIndex);
			if (editable.length === 0) {
				this.endRowEdit();
				return false;
			}
			const r = (this._rows.value || [])[rowIndex];
			const rowOriginal = r ? r.original : null;
			const rowId = r ? r.id : null;
			const draft = this._rowDraft.value || {};
			for (let i = 0; i < editable.length; i++) {
				const ec = editable[i];
				const err = this.runValidator(ec.colId, this.coerceCellValue(ec.colId, draft[ec.colId]), rowOriginal);
				if (err !== true) {
					this.setInvalid(err);
					this._editFocusColId.value = ec.colId;
					this._editVer.value = this._editVer.value + 1;
					this.focusRowEditorAt(rowIndex, ec.colIndex);
					return false;
				}
			}
			this.setInvalid("");
			const changes = [];
			const fieldValues = {};
			for (let i = 0; i < editable.length; i++) {
				const ec = editable[i];
				const newValue = this.coerceCellValue(ec.colId, draft[ec.colId]);
				const oldValue = rowOriginal ? rowOriginal[ec.field] : null;
				fieldValues[ec.field] = newValue;
				if (oldValue !== newValue) changes.push({
					columnId: ec.colId,
					oldValue,
					newValue
				});
			}
			const focusRow = this._activeRow.value;
			const focusCol = this._activeColIndex.value;
			const changed = changes.length > 0;
			this.editTransition = true;
			if (changed) {
				const srcIndex = this.sourceIndexOfRow(rowIndex);
				const next = replaceRowValues(this.currentData(), srcIndex, fieldValues);
				this.writeData(next);
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
			if (changed) this.pendingEditFollow = {
				rowOriginal,
				rowId,
				col: focusCol
			};
			else this.focusCellWhenReady(focusRow, focusCol);
			return true;
		};
		this.cancelRow = () => {
			if (this._editingRowIndex.value == null) return;
			const focusRow = this._activeRow.value;
			const focusCol = this._activeColIndex.value;
			this.editTransition = true;
			this.endRowEdit();
			this.editTransition = false;
			this.focusCellWhenReady(focusRow, focusCol);
		};
		this.nextEditableCell = (fromRow, fromCol) => {
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
		this.prevEditableCell = (fromRow, fromCol) => {
			const rowList = this._rows.value || [];
			if (rowList.length === 0) return null;
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
					c = (prow ? this.visibleCellsFor(prow) : []).length - 1;
				}
			}
			return null;
		};
		this.editTransition = false;
		this.pendingEditFollow = null;
		this.committedThisSession = false;
		this.inRowEdit = () => this._editingRowIndex.value != null;
		this.editorValueFor = (colId) => this.inRowEdit() ? this._rowDraft.value ? this._rowDraft.value[colId] : null : this._draftValue.value;
		this.editorCheckedFor = (colId) => !!(this.inRowEdit() ? this._rowDraft.value ? this._rowDraft.value[colId] : null : this._draftValue.value);
		this.editorCommitFor = (colId) => (value) => {
			if (this.inRowEdit()) {
				this.setRowDraft(colId, value);
				return;
			}
			this.commitEdit(value);
		};
		this.editorCancelFor = () => () => {
			if (this.inRowEdit()) {
				this.cancelRow();
				return;
			}
			this.cancelEdit();
		};
		this.onCellEditorInput = (colId, evt) => {
			const v = evt && evt.target ? evt.target.value : "";
			if (this.inRowEdit()) {
				this.setRowDraft(colId, v);
				return;
			}
			this._draftValue.value = v;
		};
		this.onCellEditorCheckbox = (colId, evt) => {
			const v = !!(evt && evt.target && evt.target.checked);
			if (this.inRowEdit()) {
				this.setRowDraft(colId, v);
				return;
			}
			this._draftValue.value = v;
		};
		this.setRowDraft = (colId, value) => {
			const src = this._rowDraft.value || {};
			const next = {};
			for (const k in src) next[k] = src[k];
			next[colId] = value;
			this._rowDraft.value = next;
		};
		this.rowEditTab = (target, backward) => {
			const rowIndex = this._editingRowIndex.value;
			if (rowIndex == null) return;
			const editable = this.editableColumnsForRow(rowIndex);
			if (editable.length === 0) return;
			const cols = editable.map((ec) => ec.colIndex);
			const cell = target && target.closest ? target.closest("[data-grid-cell]") : null;
			const curAttr = cell ? cell.getAttribute("data-col-index") : null;
			const cur = curAttr != null ? parseInt(curAttr, 10) : -1;
			let pos = cols.indexOf(cur);
			if (pos < 0) pos = 0;
			const len = cols.length;
			const nextPos = backward ? (pos - 1 + len) % len : (pos + 1) % len;
			this._editFocusColId.value = editable[nextPos].colId;
			this._editVer.value = this._editVer.value + 1;
			this.focusRowEditorAt(rowIndex, cols[nextPos]);
		};
		this.onEditorKeyDown = (e) => {
			if (!e) return;
			const key = e.key;
			if (this.inRowEdit()) {
				if (key === "Enter") {
					e.preventDefault();
					this.commitRow();
				} else if (key === "Escape") {
					e.preventDefault();
					this.cancelRow();
				} else if (key === "Tab") {
					e.preventDefault();
					this.rowEditTab(e.target, e.shiftKey);
				}
				return;
			}
			if (key === "Enter") {
				e.preventDefault();
				this.commitEdit(void 0);
			} else if (key === "Tab") {
				e.preventDefault();
				const fromRow = this._editingRow.value;
				const fromCol = this._editingCol.value;
				const target = e.shiftKey ? this.prevEditableCell(fromRow, fromCol) : this.nextEditableCell(fromRow, fromCol);
				const committed = this.commitEdit(void 0, true);
				if (committed && target) {
					this._activeRow.value = target.row;
					this._activeColIndex.value = target.col;
					this.beginEdit(target.row, target.col, null);
				} else if (committed) this.focusCellWhenReady(fromRow, fromCol);
			} else if (key === "Escape") {
				e.preventDefault();
				this.cancelEdit();
			}
		};
		this.onEditorBlur = (e) => {
			if (this.inRowEdit()) {
				if (this.editTransition) return;
				const rowNext = e ? e.relatedTarget : null;
				const rowNextCell = rowNext && rowNext.closest ? rowNext.closest("[data-grid-cell]") : null;
				const rowNextRow = rowNextCell ? rowNextCell.getAttribute("data-row") : null;
				if (rowNextRow != null && rowNextRow === String(this._editingRowIndex.value)) return;
				this.commitRow();
				return;
			}
			if (this._editingRow.value < 0 || this.editTransition) return;
			const next = e ? e.relatedTarget : null;
			const fromCell = e && e.target && e.target.closest ? e.target.closest("[data-grid-cell]") : null;
			if (next == null) {
				if (!this.outsidePointerDown) return;
				this.outsidePointerDown = false;
				if (!fromCell) return;
				if (fromCell.getAttribute("data-row") !== String(this._editingRow.value) || fromCell.getAttribute("data-col-index") !== String(this._editingCol.value)) return;
				this.commitEdit(void 0, true);
				return;
			}
			if (!(this.gridRoot && this.gridRoot.contains && this.gridRoot.contains(next))) {
				this.commitEdit(void 0);
				return;
			}
			const nextCell = next.closest ? next.closest("[data-grid-cell]") : null;
			if (!nextCell || !fromCell || nextCell === fromCell) return;
			const fromRow = fromCell.getAttribute("data-row");
			const fromCol = fromCell.getAttribute("data-col-index");
			if (fromRow !== String(this._editingRow.value) || fromCol !== String(this._editingCol.value)) return;
			const destRow = nextCell.getAttribute("data-row");
			const destCol = nextCell.getAttribute("data-col-index");
			this.commitEdit(void 0, true);
			const reseatDestFocus = () => {
				if (!this.gridRoot || destRow == null || destCol == null || destRow === "__header") return;
				const root = this.gridRoot.getRootNode ? this.gridRoot.getRootNode() : null;
				const act = root && root.activeElement ? root.activeElement : null;
				if (act && this.gridRoot.contains && this.gridRoot.contains(act)) return;
				const el = this.resolveCellEl(destRow, parseInt(destCol, 10));
				if (el) el.focus();
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(reseatDestFocus);
			else setTimeout(reseatDestFocus, 0);
		};
		this.editCell = (rowIndex, colIndex) => {
			const lastRow = this.bodyRowCount() - 1;
			const maxRow = lastRow < 0 ? 0 : lastRow;
			const maxCol = this.visibleColCount() - 1;
			const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
			const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
			this.committedThisSession = false;
			this._activeIsHeader.value = false;
			this._activeRow.value = r;
			this._activeColIndex.value = c;
			this.beginEdit(r, c, null);
		};
		this.commitEditing = () => {
			if (this.inRowEdit()) {
				this.commitRow();
				return;
			}
			if (this._editingRow.value >= 0) this.commitEdit(void 0);
		};
		this.editRow = (rowIndex) => {
			const lastRow = this.bodyRowCount() - 1;
			const maxRow = lastRow < 0 ? 0 : lastRow;
			const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
			const row = (this._rows.value || [])[r];
			if (!row) return;
			this._activeIsHeader.value = false;
			this._activeRow.value = r;
			this.beginRowEdit(row);
		};
		this.focusAbsCellWhenReady = (absRow, localRow, col) => {
			if (!this.gridRoot) return;
			let attempts = 0;
			const want = String(this.headerRowCount() + absRow + 1);
			const myEpoch = this.focusIntentEpoch;
			const tryFocus = () => {
				if (this.focusIntentEpoch !== myEpoch) return;
				const el = this.resolveCellEl(String(localRow), col);
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
		};
		this.focusCell = (rowIndex, colIndex) => {
			if (!this.isGrid()) return;
			this.focusIntentEpoch = this.focusIntentEpoch + 1;
			const maxCol = this.visibleColCount() - 1;
			const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
			const absLast = this.prePaginationRowCount() - 1;
			const absRow = clamp(Math.trunc(Number(rowIndex)) || 0, 0, absLast < 0 ? 0 : absLast);
			const prevAbs = this.toAbsRow(this._activeRow.value);
			const prevCol = this._activeColIndex.value;
			const prevIsHeader = this._activeIsHeader.value;
			if (this.rowsWindowed()) {
				this._activeIsHeader.value = false;
				this._activeInControl.value = false;
				this._activeRow.value = absRow;
				this._activeColIndex.value = c;
				this.focusActiveCell(absRow, c, false);
			} else {
				const size = this.pageSize();
				const targetPage = size > 0 ? Math.floor(absRow / size) : 0;
				const localRow = absRow - targetPage * size;
				const switched = targetPage !== this.pageIndex();
				if (switched) this.setPage(targetPage);
				this._activeIsHeader.value = false;
				this._activeInControl.value = false;
				this._activeRow.value = localRow;
				this._activeColIndex.value = c;
				if (switched) this.focusAbsCellWhenReady(absRow, localRow, c);
				else this.focusActiveCell(localRow, c, false);
			}
			if (absRow !== prevAbs || c !== prevCol || prevIsHeader) this.dispatchEvent(new CustomEvent("activecell-change", {
				detail: {
					rowIndex: absRow,
					colIndex: c
				},
				bubbles: true,
				composed: true
			}));
		};
		this.getActiveCell = () => this._activeIsHeader.value ? {
			rowIndex: null,
			colIndex: this._activeColIndex.value,
			isHeader: true
		} : {
			rowIndex: this.toAbsRow(this._activeRow.value),
			colIndex: this._activeColIndex.value,
			isHeader: false
		};
		this.clearActiveCell = () => {
			if (!this.isGrid()) return;
			this._activeIsHeader.value = false;
			this._activeInControl.value = false;
			this._activeRow.value = 0;
			this._activeColIndex.value = 0;
		};
		this.toggleRowExpanded = (rowId) => {
			if (!this.table) return;
			const target = String(rowId);
			const flat = this.table.getCoreRowModel().flatRows;
			for (const r of flat) if (r.id === target || r.original && String(r.original.id) === target) {
				r.toggleExpanded();
				return;
			}
		};
		this.expandAll = () => {
			if (!this.table) return;
			this.table.toggleAllRowsExpanded(true);
		};
		this.collapseAll = () => {
			if (!this.table) return;
			this.table.resetExpanded(true);
		};
		this.getExpandedRows = () => {
			if (!this.table) return [];
			const out = [];
			const flat = this.table.getCoreRowModel().flatRows;
			for (const r of flat) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
			return out;
		};
		this.applyGrouping = (cols) => {
			if (this.table) this.table.setGrouping(cols);
		};
		this.clearGrouping = () => {
			if (this.table) this.table.setGrouping([]);
		};
		this.getFacetedUniqueValues = (colId) => {
			if (this.tick() < 0 || !this.table) return [];
			const col = this.table.getColumn(colId);
			if (!col || !col.getFacetedUniqueValues) return [];
			const map = col.getFacetedUniqueValues();
			return map ? Array.from(map.keys()) : [];
		};
		this.getFacetedMinMaxValues = (colId) => {
			if (this.tick() < 0 || !this.table) return null;
			const col = this.table.getColumn(colId);
			if (!col || !col.getFacetedMinMaxValues) return null;
			return col.getFacetedMinMaxValues() || null;
		};
	}
	static {
		this.shadowRootOptions = {
			...LitElement.shadowRootOptions,
			slotAssignment: "manual"
		};
	}
	static {
		this.styles = css`
:host{display:contents}
:host {
  --rdt-font: var(--rozie-data-table-font);
  --rdt-color: var(--rozie-data-table-fg);
  --rdt-cell-padding: var(--rozie-data-table-cell-padding);
  --rdt-border: 1px solid var(--rozie-data-table-border-color);
  --rdt-header-bg: var(--rozie-data-table-header-bg);
  --rdt-header-weight: var(--rozie-data-table-header-weight);
  --rdt-sort-ind-opacity: var(--rozie-data-table-sort-indicator-opacity);
  --rdt-filter-border: 1px solid var(--rozie-data-table-control-border-color);
  --rdt-filter-radius: var(--rozie-data-table-radius);
  --rdt-page-btn-border: 1px solid var(--rozie-data-table-control-border-color);
  --rdt-page-btn-radius: var(--rozie-data-table-radius);
  --rdt-page-btn-disabled-opacity: var(--rozie-data-table-disabled-opacity);
  --rdt-page-size-border: 1px solid var(--rozie-data-table-control-border-color);
  --rdt-page-size-radius: var(--rozie-data-table-radius);
  --rdt-resize-grip-color: var(--rozie-data-table-resize-grip-color);
  --rdt-resize-grip-active: var(--rozie-data-table-resize-grip-active);
  --rdt-pin-btn-active-bg: var(--rozie-data-table-pin-active-bg);
  --rdt-colvis-summary-border: 1px solid var(--rozie-data-table-control-border-color);
  --rdt-colvis-summary-radius: var(--rozie-data-table-radius);
  --rdt-colvis-menu-border: 1px solid var(--rozie-data-table-border-color);
  --rdt-colvis-menu-radius: var(--rozie-data-table-radius);
  --rdt-colvis-menu-bg: var(--rozie-data-table-menu-bg);
  --rdt-colvis-menu-shadow: var(--rozie-data-table-menu-shadow);
  --rdt-select-accent: var(--rozie-data-table-select-accent);
}
.rozie-data-table[data-rozie-s-d5dcab4c] {
  border-collapse: collapse;
  width: 100%;
  font: var(--rdt-font, 14px system-ui, sans-serif);
  color: var(--rdt-color, inherit);
}
.rozie-data-table.rdt-col-windowed[data-rozie-s-d5dcab4c] {
  table-layout: fixed;
}
.rozie-data-table.rdt-col-windowed[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c],
.rozie-data-table.rdt-col-windowed[data-rozie-s-d5dcab4c] .rdt-td[data-rozie-s-d5dcab4c] {
  box-sizing: border-box;
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
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="1"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="2"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="3"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="4"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="5"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="6"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="7"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before,
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="8"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  content: '';
  display: inline-block;
  vertical-align: middle;
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="1"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(1 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="2"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(2 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="3"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(3 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="4"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(4 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="5"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(5 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="6"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(6 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="7"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(7 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[data-rozie-s-d5dcab4c] tbody[data-rozie-s-d5dcab4c] tr[data-depth="8"][data-rozie-s-d5dcab4c] > .rdt-expander-td[data-rozie-s-d5dcab4c] + .rdt-td[data-rozie-s-d5dcab4c]::before {
  width: calc(8 * var(--rdt-tree-indent, 1.25rem));
}
.rozie-data-table[role="grid"][data-rozie-s-d5dcab4c] {
  user-select: none;
}
.rozie-data-table[role="grid"][data-rozie-s-d5dcab4c] input[data-rozie-s-d5dcab4c],
.rozie-data-table[role="grid"][data-rozie-s-d5dcab4c] textarea[data-rozie-s-d5dcab4c],
.rozie-data-table[role="grid"][data-rozie-s-d5dcab4c] select[data-rozie-s-d5dcab4c],
.rozie-data-table[role="grid"][data-rozie-s-d5dcab4c] [contenteditable="true"][data-rozie-s-d5dcab4c] {
  user-select: text;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-all[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-row[data-rozie-s-d5dcab4c] {
  cursor: pointer;
  accent-color: var(--rdt-select-accent, currentColor);
}
`;
	}
	_armListeners() {
		{
			const slotEl = this.shadowRoot?.querySelector("slot:not([name])");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotDefault = this._slotDefaultElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"groupBar\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotGroupBar = this._slotGroupBarElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"selectAll\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotSelectAll = this._slotSelectAllElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot:not([name])");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotDynamicColHeader = this._slotDynamicColHeaderElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot:not([name])");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotDynamicFilter = this._slotDynamicFilterElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"selectCell\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotSelectCell = this._slotSelectCellElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot:not([name])");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotDynamicCell = this._slotDynamicCellElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot:not([name])");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotDynamicEditor = this._slotDynamicEditorElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"detail\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotDetail = this._slotDetailElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"colHeader\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotColHeader = this._slotColHeaderElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"filter\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotFilter = this._slotFilterElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"cell\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotCell = this._slotCellElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
		{
			const slotEl = this.shadowRoot?.querySelector("slot[name=\"editor\"]");
			if (slotEl !== null && slotEl !== void 0) {
				const update = () => {
					this._hasSlotEditor = this._slotEditorElements.length > 0;
				};
				slotEl.addEventListener("slotchange", update);
				this._disconnectCleanups.push(() => slotEl.removeEventListener("slotchange", update));
				update();
			}
		}
	}
	connectedCallback() {
		this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute("slot") && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
		this._hasSlotGroupBar = Array.from(this.children).some((el) => el.getAttribute("slot") === "groupBar");
		this._hasSlotSelectAll = Array.from(this.children).some((el) => el.getAttribute("slot") === "selectAll");
		this._hasSlotDynamicColHeader = Array.from(this.children).some((el) => !el.hasAttribute("slot") && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
		this._hasSlotDynamicFilter = Array.from(this.children).some((el) => !el.hasAttribute("slot") && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
		this._hasSlotSelectCell = Array.from(this.children).some((el) => el.getAttribute("slot") === "selectCell");
		this._hasSlotDynamicCell = Array.from(this.children).some((el) => !el.hasAttribute("slot") && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
		this._hasSlotDynamicEditor = Array.from(this.children).some((el) => !el.hasAttribute("slot") && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
		this._hasSlotDetail = Array.from(this.children).some((el) => el.getAttribute("slot") === "detail");
		this._hasSlotColHeader = Array.from(this.children).some((el) => el.getAttribute("slot") === "colHeader");
		this._hasSlotFilter = Array.from(this.children).some((el) => el.getAttribute("slot") === "filter");
		this._hasSlotCell = Array.from(this.children).some((el) => el.getAttribute("slot") === "cell");
		this._hasSlotEditor = Array.from(this.children).some((el) => el.getAttribute("slot") === "editor");
		super.connectedCallback();
		if (this.hasUpdated && this._rozieTornDown) {
			this._rozieTornDown = false;
			this._armListeners();
		}
	}
	firstUpdated() {
		this._armListeners();
		this._disconnectCleanups.push(effect(() => {
			this.sorting, this.globalFilter, this.columnFilters, this.pagination, this.rowCount, this.pageCount, this.rowSelection, this.expanded, this.expandable, this.grouping, this.groupable, this.columnVisibility, this.columnSizing, this.columnOrder, this.columnPinning, this.selectionMode, (this.data || []).length, this.data, this._dataDefault.value, this.columns, this._colReg.value;
			untracked(() => {
				if (this.__rozieWatchInitial_0) {
					this.__rozieWatchInitial_0 = false;
					return;
				}
				(() => {
					this.seedColumnPinning();
					this.reFeed();
					this.maybeClearHistoryOnExternalSwap();
				})();
			});
		}));
		this._disconnectCleanups.push(effect(() => {
			this.sorting, this.columnFilters, this.globalFilter, this._sortingDefault.value, this._columnFiltersDefault.value, this._globalFilterDefault.value;
			untracked(() => {
				if (this.__rozieWatchInitial_1) {
					this.__rozieWatchInitial_1 = false;
					return;
				}
				(() => {
					const msg = this.buildSortFilterAnnounce();
					if (msg) this._liveAnnounce.value = msg;
				})();
			});
		}));
		this._disconnectCleanups.push(effect(() => {
			this._colReg.value;
			this.__rozieCtxProvider_data_table_columns.setValue(((__rozieCtxHost) => ({
				registerColumn: (id, spec) => {
					if (id == null) return;
					const key = String(id);
					if (key === "__proto__" || key === "constructor" || key === "prototype") return;
					const prev = __rozieCtxHost._colReg.value ? __rozieCtxHost._colReg.value[key] : void 0;
					if (prev !== void 0 && columnSpecsEquivalent(prev, spec)) return;
					__rozieCtxHost._colReg.value = {
						...__rozieCtxHost._colReg.value,
						[key]: spec
					};
				},
				unregisterColumn: (id) => {
					if (id == null) return;
					const r = { ...__rozieCtxHost._colReg.value };
					delete r[String(id)];
					__rozieCtxHost._colReg.value = r;
				}
			}))(this));
		}));
		this._dataDefault.value = this.data || [];
		this.seedColumnPinning();
		this.table = createTable({
			data: this.currentData(),
			columns: this.tableColumns(),
			state: this.currentState(),
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			getExpandedRowModel: getExpandedRowModel(),
			getSubRows: this.getSubRows || void 0,
			getRowCanExpand: this.expandable === true && this.getSubRows == null ? () => true : void 0,
			onExpandedChange: this.onExpandedChangeCb,
			autoResetExpanded: false,
			getGroupedRowModel: getGroupedRowModel(),
			onGroupingChange: this.onGroupingChangeCb,
			getFacetedRowModel: getFacetedRowModel(),
			getFacetedUniqueValues: getFacetedUniqueValues(),
			getFacetedMinMaxValues: getFacetedMinMaxValues(),
			manualPagination: this.manual === true,
			manualFiltering: this.manual === true,
			manualSorting: this.manual === true,
			rowCount: this.rowCount ?? void 0,
			pageCount: this.pageCount ?? void 0,
			enableRowSelection: this.selectionMode !== "none",
			enableMultiRowSelection: this.selectionMode === "multiple",
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
			columnResizeMode: "onChange",
			enableColumnResizing: true,
			renderFallbackValue: null,
			onStateChange: () => {}
		});
		this.refreshRowModel = () => {
			if (!this.table) return;
			const nextRows = this.windowSource().slice();
			const nextGroups = this.table.getHeaderGroups().slice();
			this._rows.value = nextRows;
			this._headerGroups.value = nextGroups;
			this._rowModelVer.value = this._rowModelVer.value + 1;
			if (this.rowsWindowed() && this.virtualizer) {
				this.virtualizer.setOptions(this.virtualizerOptions());
				this.virtualizer._willUpdate();
			}
			this.remeasureColumnWindow();
			const nextRowCount = nextRows.length;
			const nextColCount = nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0;
			this.clampActiveCell(nextRowCount, nextColCount);
			const pgState = this.table.getState().pagination;
			const pc = this.table.getPageCount();
			if (pc > 0 && pgState.pageIndex > pc - 1) this.writePagination({
				pageIndex: pc - 1,
				pageSize: pgState.pageSize
			});
			if (this.pendingEditFollow && this.isGrid()) {
				const follow = this.pendingEditFollow;
				this.pendingEditFollow = null;
				const followIdx = indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
				if (followIdx >= 0) this.focusCellWhenReady(followIdx, follow.col);
			}
			this.syncIndeterminate();
			if (typeof queueMicrotask !== "undefined") queueMicrotask(this.syncIndeterminate);
			else Promise.resolve().then(this.syncIndeterminate);
		};
		this.refreshRowModel();
		this.gridRoot = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector(".rozie-data-table") : null;
		if (typeof document !== "undefined") {
			this.docPointerDown = (ev) => {
				if (!this.gridRoot) {
					this.outsidePointerDown = false;
					return;
				}
				const path = ev && typeof ev.composedPath === "function" ? ev.composedPath() : null;
				const inside = path ? path.indexOf(this.gridRoot) !== -1 : !!(ev && ev.target && this.gridRoot.contains && this.gridRoot.contains(ev.target));
				this.outsidePointerDown = !inside;
			};
			document.addEventListener("pointerdown", this.docPointerDown, true);
		}
		if (this.isWindowed()) this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector(".rdt-scroll") : null;
		if (this.rowsWindowed()) {
			this.virtualizer = new Virtualizer(this.virtualizerOptions());
			this.virtualizerCleanup = this.virtualizer._didMount();
		}
		if (this.colsWindowed()) {
			this.colVirtualizer = new Virtualizer(this.columnVirtualizerOptions());
			this.colVirtualizerCleanup = this.colVirtualizer._didMount();
		}
		if (this.isWindowed()) this._windowVer.value = this._windowVer.value + 1;
		if (this.isWindowed()) {
			const afterFirstFrame = () => {
				if (this.rowsWindowed()) {
					this.remeasureWindow();
					if (!(this.gridScrollEl ? this.gridScrollEl.clientHeight : 0)) console.warn("[rozie-data-table] virtual is on but the scroll container has no bounded height; set maxHeight or --rozie-data-table-max-height");
					const pg = this.pagination;
					const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
					if (this.manual !== true && pgConfigured) console.warn("[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.");
				}
				if (this.colsWindowed()) {
					if (!(this.gridScrollEl ? this.gridScrollEl.clientWidth : 0)) console.warn("[rozie-data-table] virtual is on for columns but the scroll container has no bounded width; set a CSS width on an ancestor so the column window can be measured");
					this.bumpWindowVer();
				}
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));
			else setTimeout(afterFirstFrame, 0);
		}
		this.announceState.sorting = this.effectiveSorting();
		this.announceState.columnFilters = this.effectiveColumnFilters();
		this.announceState.globalFilter = this.effectiveGlobalFilter();
	}
	updated(changedProperties) {
		this.maybeClearHistoryOnExternalSwap();
		this.remeasureColumnSizes();
		if (!this.table) return;
		const d = this.currentData() || [];
		if (d === this.lastData && d.length === this.lastDataLen) return;
		this.lastData = d;
		this.lastDataLen = d.length;
		this.reFeed();
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	attributeChangedCallback(name, old, value) {
		super.attributeChangedCallback(name, old, value);
		if (name === "data") this._dataControllable.notifyAttributeChange(value);
		if (name === "sorting") this._sortingControllable.notifyAttributeChange(value);
		if (name === "global-filter") this._globalFilterControllable.notifyAttributeChange(value);
		if (name === "column-filters") this._columnFiltersControllable.notifyAttributeChange(value);
		if (name === "pagination") this._paginationControllable.notifyAttributeChange(value);
		if (name === "expanded") this._expandedControllable.notifyAttributeChange(value);
		if (name === "grouping") this._groupingControllable.notifyAttributeChange(value);
		if (name === "row-selection") this._rowSelectionControllable.notifyAttributeChange(value);
		if (name === "column-visibility") this._columnVisibilityControllable.notifyAttributeChange(value);
		if (name === "column-sizing") this._columnSizingControllable.notifyAttributeChange(value);
		if (name === "column-order") this._columnOrderControllable.notifyAttributeChange(value);
		if (name === "column-pinning") this._columnPinningControllable.notifyAttributeChange(value);
	}
	render() {
		return html`

<div class="rozie-data-table-wrap" data-rozie-ref="__rozieRoot" data-rozie-s-d5dcab4c>

<div class="rdt-column-defs" style="display:none" aria-hidden="true" data-rozie-s-d5dcab4c><slot></slot></div>

${!!this._invalidMsg.value ? html`<div class="rdt-sr-live" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c>${this._invalidMsg.value}</div>` : nothing}${!!this._pasteAnnounce.value ? html`<div class="rdt-sr-live rdt-sr-paste" data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c>${this._pasteAnnounce.value}</div>` : nothing}${!!this._rangeAnnounce.value ? html`<div class="rdt-sr-live rdt-sr-range" data-testid="range-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c>${this._rangeAnnounce.value}</div>` : nothing}${!!this._liveAnnounce.value ? html`<div class="rdt-sr-live rdt-sr-sortfilter" data-testid="sortfilter-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c>${this._liveAnnounce.value}</div>` : nothing}<div class="rdt-toolbar" data-rozie-s-d5dcab4c>
  <input class="rdt-global-filter" type="text" role="searchbox" aria-label="Search table" .value=${this.globalFilterValue()} @input=${($event) => {
			this.onGlobalFilterInput($event);
		}} data-rozie-s-d5dcab4c />
  
  ${this.allLeafColumns().length ? html`<details class="rdt-colvis" data-rozie-s-d5dcab4c>
    <summary class="rdt-colvis-summary" data-rozie-s-d5dcab4c>Columns</summary>
    <div class="rdt-colvis-menu" role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c>
      ${repeat(this.allLeafColumns(), (lc, _idx) => lc.id, (lc, _idx) => html`<label class="rdt-colvis-item" data-rozie-s-d5dcab4c>
        <input class="rdt-colvis-checkbox" type="checkbox" ?checked=${lc.visible} @change=${($event) => {
			this.onToggleVisibility(lc.id);
		}} data-rozie-s-d5dcab4c />
        <span class="rdt-colvis-label" data-rozie-s-d5dcab4c>${rozieDisplay(lc.label)}</span>
      </label>`)}
    </div>
  </details>` : nothing}</div>


${this.groupable ? html`<div class="rdt-group-bar-host" data-rozie-s-d5dcab4c>
  ${this.groupBar !== void 0 ? this.groupBar({
			grouping: this.groupingKeys(),
			groupableColumns: this.groupableColumns(),
			applyGrouping: this.applyGrouping,
			clearGrouping: this.clearGrouping
		}) : html`<slot name="groupBar" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					grouping: this.groupingKeys(),
					groupableColumns: this.groupableColumns()
				});
			} catch {
				return "{}";
			}
		})()} @rozie-group-bar-apply-grouping=${($event) => this.applyGrouping($event.detail)} @rozie-group-bar-clear-grouping=${($event) => this.clearGrouping($event.detail)}>
    ${repeat(this.groupingKeys(), (gk, _idx) => gk, (gk, _idx) => html`<span class="rdt-group-token" data-group-token="" data-rozie-s-d5dcab4c>${rozieDisplay(gk)}</span>`)}
  </slot>`}
</div>` : nothing}${this.isWindowed() ? html`<div class="rdt-scroll" style=${rozieStyle(this.rowsWindowed() && this.maxHeight ? "max-height:" + this.maxHeight + ";overflow:auto;--rozie-data-table-max-height:" + this.maxHeight : "overflow:auto")} data-rozie-s-d5dcab4c>
<table class="${Object.entries({
			"rozie-data-table": true,
			"rdt-sticky": this.stickyHeader,
			"rdt-col-windowed": this.colsWindowed()
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role=${rozieAttr(this.tableRole())} aria-rowcount=${rozieAttr(this.gridAriaRowCount())} aria-colcount=${rozieAttr(this.gridAriaColCount())} @keydown=${($event) => {
			this.onGridKeyDown($event);
		}} @focusin=${($event) => {
			this.syncActiveFromEvent($event);
		}} @focusout=${($event) => {
			this.onGridFocusOut($event);
		}} @mousedown=${($event) => {
			this.onGridMouseDown($event);
		}} @dblclick=${($event) => {
			this.onGridDblClick($event);
		}} @click=${($event) => {
			this.onGridClick($event);
		}} data-rozie-s-d5dcab4c>
  <thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat(this._headerGroups.value, (hg, hgLevel) => hg.id, (hg, hgLevel) => html`<tr class="rdt-tr" role="row" aria-rowindex=${rozieAttr(hgLevel + 1)} data-rozie-s-d5dcab4c>
      
      ${this.colsWindowed() ? html`<th class="rdt-col-spacer" aria-hidden="true" style=${rozieStyle("width:" + this.colPadLeft() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></th>` : nothing}${repeat(this.windowedHeadersFor(hg, hgLevel), (wh, _idx) => wh.header.id, (wh, _idx) => html`<th class="${Object.entries({
			"rdt-th": true,
			"rdt-select-th": this.isSelectColumn(wh.header.column.id),
			"rdt-expander-th": this.isExpanderColumn(wh.header.column.id),
			"rdt-th-resizing": this.columnIsResizing(wh.header.column.id),
			"rdt-cell-active": this.isActiveCell("__header", this.headerColIndexOf(hg, wh.header), hgLevel)
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role="columnheader" data-col=${rozieAttr(wh.header.column.id)} data-grid-cell="" data-row="__header" data-header-level=${rozieAttr(hgLevel)} colspan=${rozieAttr(wh.span > 1 ? wh.span : null)} data-col-index=${rozieAttr(this.headerColIndexOf(hg, wh.header))} aria-colindex=${rozieAttr(this.headerLeafStart(hg, wh.header) + 1)} tabindex=${rozieAttr(this.cellTabindex("__header", this.headerColIndexOf(hg, wh.header), hgLevel))} aria-sort=${rozieAttr(this.ariaSortFor(wh.header.column.id))} style=${rozieStyle(this.thStyle(wh.header, wh.width))} data-rozie-s-d5dcab4c>
        ${this.isSelectColumn(wh.header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectAll !== void 0 ? this.selectAll({
			checked: this.isAllRowsSelected(),
			indeterminate: this.isSomeRowsSelected(),
			toggle: this.onToggleAllRows
		}) : html`<slot name="selectAll" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					checked: this.isAllRowsSelected(),
					indeterminate: this.isSomeRowsSelected()
				});
			} catch {
				return "{}";
			}
		})()} @rozie-select-all-toggle=${($event) => this.onToggleAllRows($event.detail)}>
            ${this.selectionMode === "multiple" ? html`<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" ?checked=${this.isAllRowsSelected()} @change=${($event) => {
			this.onToggleAllRows($event);
		}} data-rozie-s-d5dcab4c />` : nothing}</slot>`}
        </span>` : this.isExpanderColumn(wh.header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${wh.header.column.getCanSort && wh.header.column.getCanSort() ? html`<button class="rdt-sort-btn" type="button" @click=${($event) => {
			this.onHeaderSort(wh.header.column.id, $event);
		}} data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.rozieSlots?.[`colHeader-${wh.header.column.id}`] !== void 0 ? this.rozieSlots?.[`colHeader-${wh.header.column.id}`]({
			columnId: wh.header.column.id,
			column: wh.header.column,
			label: this.headerLabel(wh.header.column.id)
		}) : html`<slot name="${`colHeader-${wh.header.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: wh.header.column.id,
					column: wh.header.column,
					label: this.headerLabel(wh.header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>
                ${this.colHeader !== void 0 ? this.colHeader({
			columnId: wh.header.column.id,
			column: wh.header.column,
			label: this.headerLabel(wh.header.column.id)
		}) : html`<slot name="colHeader" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: wh.header.column.id,
					column: wh.header.column,
					label: this.headerLabel(wh.header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(this.headerLabel(wh.header.column.id))}</slot>`}
              </slot>`}
            </span>
            <span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>${rozieDisplay(this.sortIndicator(wh.header.column.id))}</span>
          </button>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.rozieSlots?.[`colHeader-${wh.header.column.id}`] !== void 0 ? this.rozieSlots?.[`colHeader-${wh.header.column.id}`]({
			columnId: wh.header.column.id,
			column: wh.header.column,
			label: this.headerLabel(wh.header.column.id)
		}) : html`<slot name="${`colHeader-${wh.header.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: wh.header.column.id,
					column: wh.header.column,
					label: this.headerLabel(wh.header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>
                ${this.colHeader !== void 0 ? this.colHeader({
			columnId: wh.header.column.id,
			column: wh.header.column,
			label: this.headerLabel(wh.header.column.id)
		}) : html`<slot name="colHeader" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: wh.header.column.id,
					column: wh.header.column,
					label: this.headerLabel(wh.header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(this.headerLabel(wh.header.column.id))}</slot>`}
              </slot>`}
            </span>
          </span>`}<rozie-popover trigger="click" placement="bottom-end" strategy="fixed" .offset=${4} data-rozie-s-d5dcab4c><button class="rdt-col-menu-trigger" type="button" aria-label=${rozieAttr("Column options for " + this.headerLabel(wh.header.column.id))} data-rozie-s-d5dcab4c slot="anchor">⋯</button><div class="rdt-col-menu" role="menu" data-rozie-s-d5dcab4c>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(wh.header.column.id) === "left"} @click=${($event) => {
			this.onPinColumn(wh.header.column.id, "left", $event);
		}} data-rozie-s-d5dcab4c>Pin left</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(wh.header.column.id) === "right"} @click=${($event) => {
			this.onPinColumn(wh.header.column.id, "right", $event);
		}} data-rozie-s-d5dcab4c>Pin right</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${!this.columnPinSide(wh.header.column.id)} @click=${($event) => {
			this.onPinColumn(wh.header.column.id, false, $event);
		}} data-rozie-s-d5dcab4c>Unpin</button>
              <hr class="rdt-col-menu-sep" data-rozie-s-d5dcab4c />
              <button class="rdt-col-menu-item" type="button" role="menuitem" @click=${($event) => {
			this.onHideColumn(wh.header.column.id, $event);
		}} data-rozie-s-d5dcab4c>Hide column</button>
            </div></rozie-popover>
          <button class="rdt-resize-handle" type="button" aria-label=${rozieAttr("Resize " + this.headerLabel(wh.header.column.id))} @pointerdown=${($event) => {
			this.onResizeStart(wh.header.column.id, $event);
		}} @touchstart=${($event) => {
			this.onResizeStart(wh.header.column.id, $event);
		}} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button>
        </span>`}</th>`)}
      
      ${this.colsWindowed() ? html`<th class="rdt-col-spacer" aria-hidden="true" style=${rozieStyle("width:" + this.colPadRight() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></th>` : nothing}</tr>`)}
    
    ${this.hasAnyFilterableColumn() ? html`<tr class="rdt-filter-row" data-rozie-s-d5dcab4c>
      ${this.colsWindowed() ? html`<th class="rdt-col-spacer" aria-hidden="true" style=${rozieStyle("width:" + this.colPadLeft() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></th>` : nothing}${repeat(this.windowedHeadersFor(this._headerGroups.value[this._headerGroups.value.length - 1], this._headerGroups.value.length - 1), (wh, _idx) => wh.header.id, (wh, _idx) => html`<th class="rdt-filter-cell" role="presentation" data-col=${rozieAttr(wh.header.column.id)} style=${rozieStyle(this.pinStyle(wh.header.column.id))} data-rozie-s-d5dcab4c>
        ${this.isSelectColumn(wh.header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : this.isExpanderColumn(wh.header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.columnIsFilterable(wh.header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.rozieSlots?.[`filter-${wh.header.column.id}`] !== void 0 ? this.rozieSlots?.[`filter-${wh.header.column.id}`]({
			columnId: wh.header.column.id,
			value: this.columnFilterValue(wh.header.column.id),
			uniqueValues: this.getFacetedUniqueValues(wh.header.column.id),
			minMax: this.getFacetedMinMaxValues(wh.header.column.id),
			columnLabel: this.headerLabel(wh.header.column.id),
			setFilter: this.setColumnFilter
		}) : html`<slot name="${`filter-${wh.header.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: wh.header.column.id,
					value: this.columnFilterValue(wh.header.column.id),
					uniqueValues: this.getFacetedUniqueValues(wh.header.column.id),
					minMax: this.getFacetedMinMaxValues(wh.header.column.id),
					columnLabel: this.headerLabel(wh.header.column.id)
				});
			} catch {
				return "{}";
			}
		})()} @rozie-default-set-filter=${($event) => this.setColumnFilter($event.detail)}>
              ${this.filter !== void 0 ? this.filter({
			columnId: wh.header.column.id,
			value: this.columnFilterValue(wh.header.column.id),
			uniqueValues: this.getFacetedUniqueValues(wh.header.column.id),
			minMax: this.getFacetedMinMaxValues(wh.header.column.id),
			columnLabel: this.headerLabel(wh.header.column.id),
			setFilter: this.setColumnFilter
		}) : html`<slot name="filter" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: wh.header.column.id,
					value: this.columnFilterValue(wh.header.column.id),
					uniqueValues: this.getFacetedUniqueValues(wh.header.column.id),
					minMax: this.getFacetedMinMaxValues(wh.header.column.id),
					columnLabel: this.headerLabel(wh.header.column.id)
				});
			} catch {
				return "{}";
			}
		})()} @rozie-filter-set-filter=${($event) => this.setColumnFilter($event.detail)}>
                <input class="rdt-col-filter" type="text" aria-label=${rozieAttr("Filter " + this.headerLabel(wh.header.column.id))} .value=${this.columnFilterValue(wh.header.column.id)} @input=${($event) => {
			this.onColumnFilterInput(wh.header.column.id, $event);
		}} @click=${($event) => {
			this.stopEvent($event);
		}} data-rozie-s-d5dcab4c />
              </slot>`}
            </slot>`}
          </span>` : nothing}</span>`}</th>`)}
      ${this.colsWindowed() ? html`<th class="rdt-col-spacer" aria-hidden="true" style=${rozieStyle("width:" + this.colPadRight() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></th>` : nothing}</tr>` : nothing}</thead>

  <tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>
    
    <tr class="rdt-spacer" aria-hidden="true" data-rozie-s-d5dcab4c>
      <td colspan=${rozieAttr(this.windowedColSpan())} style=${rozieStyle("height:" + this.padTop() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></td>
    </tr>
    
    ${repeat(this.windowedRows(), (wr, _idx) => wr.row.id, (wr, _idx) => html`
    <tr class="${Object.entries({
			"rdt-tr": true,
			"rdt-group-header": this.rowIsGrouped(wr.row),
			"rdt-row-pinned": wr.pinned
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role="row" data-row=${rozieAttr(wr.vi.index)} aria-rowindex=${rozieAttr(this.headerRowCount() + wr.vi.index + 1)} data-index=${rozieAttr(wr.vi.index)} data-pinned=${rozieAttr(wr.pinned ? "true" : null)} data-depth=${rozieAttr(wr.row.depth)} data-group-header=${rozieAttr(this.rowIsGrouped(wr.row) ? wr.row.id : null)} data-group-leaf=${rozieAttr(this.groupingActive() && !this.rowIsGrouped(wr.row) ? wr.row.id : null)} aria-expanded=${rozieAttr(this.rowIsGrouped(wr.row) ? !!this.rowIsExpanded(wr.row) : null)} aria-selected=${rozieAttr(this.selectionMode !== "none" ? !!this.rowIsSelected(wr.row) : null)} aria-level=${rozieAttr(this.groupingActive() ? wr.row.depth + 1 : null)} data-rozie-s-d5dcab4c>
      
      ${this.colsWindowed() ? html`<td class="rdt-col-spacer" aria-hidden="true" style=${rozieStyle("width:" + this.colPadLeft() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></td>` : nothing}${repeat(this.windowedCells(wr.row), (cell, _idx) => cell.id, (cell, _idx) => html`<td class="${Object.entries({
			"rdt-td": true,
			"rdt-select-td": this.isSelectColumn(cell.column.id),
			"rdt-expander-td": this.isExpanderColumn(cell.column.id),
			"rdt-in-range": this.inRange(wr.vi.index, this.colIndexOf(wr.row, cell)),
			"rdt-cell-active": this.isActiveCell(String(wr.vi.index), this.colIndexOf(wr.row, cell))
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role=${rozieAttr(this.cellRole())} data-col=${rozieAttr(cell.column.id)} data-grid-cell="" data-row=${rozieAttr(wr.vi.index)} data-col-index=${rozieAttr(this.colIndexOf(wr.row, cell))} tabindex=${rozieAttr(this.cellTabindex(String(wr.vi.index), this.colIndexOf(wr.row, cell)))} style=${rozieStyle(this.bodyCellStyle(wr.row, cell.column.id))} aria-invalid=${rozieAttr(this.cellAriaInvalid(wr.vi.index, this.colIndexOf(wr.row, cell)))} aria-colindex=${rozieAttr(this.colIndexOf(wr.row, cell) + 1)} aria-selected=${rozieAttr(this.inRange(wr.vi.index, this.colIndexOf(wr.row, cell)) ? "true" : null)} data-in-range=${rozieAttr(this.inRange(wr.vi.index, this.colIndexOf(wr.row, cell)) ? "true" : null)} data-agg-cell=${rozieAttr(this.cellIsAggregated(cell) ? cell.column.id : null)} data-rozie-s-d5dcab4c>
        
        ${this.isExpanderColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.rowCanExpand(wr.row) ? html`<button class="rdt-expander" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(wr.row)} aria-label=${rozieAttr(this.rowIsExpanded(wr.row) ? "Collapse row" : "Expand row")} @click=${($event) => {
			this.onToggleExpand(wr.row, $event);
		}} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(wr.row) ? "▾" : "▸")}</button>` : nothing}</span>` : this.isSelectColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectCell !== void 0 ? this.selectCell({
			row: this.cellSlotRow(wr.row),
			checked: this.rowIsSelected(wr.row),
			toggle: (e) => this.onToggleRow(wr.row, e)
		}) : html`<slot name="selectCell" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					row: this.cellSlotRow(wr.row),
					checked: this.rowIsSelected(wr.row)
				});
			} catch {
				return "{}";
			}
		})()} @rozie-select-cell-toggle=${($event) => ((e) => this.onToggleRow(wr.row, e))($event.detail)}>
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" ?checked=${this.rowIsSelected(wr.row)} @change=${($event) => {
			this.onToggleRow(wr.row, $event);
		}} data-rozie-s-d5dcab4c />
          </slot>`}
        </span>` : this.cellIsGrouped(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          <button class="rdt-expander rdt-group-toggle" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(wr.row)} aria-label=${rozieAttr(this.rowIsExpanded(wr.row) ? "Collapse group" : "Expand group")} @click=${($event) => {
			this.onToggleExpand(wr.row, $event);
		}} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(wr.row) ? "▾" : "▸")}</button>
          <span class="rdt-group-value" data-rozie-s-d5dcab4c>
            ${this.rozieSlots?.[`cell-${cell.column.id}`] !== void 0 ? this.rozieSlots?.[`cell-${cell.column.id}`]({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(wr.row),
			value: cell.getValue()
		}) : html`<slot name="${`cell-${cell.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(wr.row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>
              ${this.cell !== void 0 ? this.cell({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(wr.row),
			value: cell.getValue()
		}) : html`<slot name="cell" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(wr.row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(cell.getValue())}</slot>`}
            </slot>`}
          </span>
          <span class="rdt-group-count" data-rozie-s-d5dcab4c>${rozieDisplay("(" + this.groupSubRowCount(wr.row) + ")")}</span>
        </span>` : this.isEditing(wr.vi.index, this.colIndexOf(wr.row, cell)) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.editorTypeOf(cell.column.id) === "number" ? html`<input class="rdt-cell-editor" type="number" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @input=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />` : this.editorTypeOf(cell.column.id) === "select" ? html`<select class="rdt-cell-editor" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @change=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c>
            ${repeat(this.editorOptionsOf(cell.column.id), (opt, _idx) => opt.value, (opt, _idx) => html`<option value=${rozieAttr(opt.value)} ?selected=${opt.value === this.editorValueFor(cell.column.id)} data-rozie-s-d5dcab4c>${rozieDisplay(opt.label)}</option>`)}
          </select>` : this.editorTypeOf(cell.column.id) === "checkbox" ? html`<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} ?checked=${this.editorCheckedFor(cell.column.id)} @change=${($event) => {
			this.onCellEditorCheckbox(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />` : this.editorTypeOf(cell.column.id) === "custom" ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.rozieSlots?.[`editor-${cell.column.id}`] !== void 0 ? this.rozieSlots?.[`editor-${cell.column.id}`]({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(wr.row),
			value: this.editorValueFor(cell.column.id),
			commit: this.editorCommitFor(cell.column.id),
			cancel: this.editorCancelFor(),
			columnLabel: this.headerLabel(cell.column.id),
			autofocus: this.editorAutofocusFor(cell.column.id, wr.vi.index)
		}) : html`<slot name="${`editor-${cell.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(wr.row),
					value: this.editorValueFor(cell.column.id),
					commit: this.editorCommitFor(cell.column.id),
					cancel: this.editorCancelFor(),
					columnLabel: this.headerLabel(cell.column.id),
					autofocus: this.editorAutofocusFor(cell.column.id, wr.vi.index)
				});
			} catch {
				return "{}";
			}
		})()}>
              ${this.editor !== void 0 ? this.editor({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(wr.row),
			value: this.editorValueFor(cell.column.id),
			commit: this.editorCommitFor(cell.column.id),
			cancel: this.editorCancelFor(),
			columnLabel: this.headerLabel(cell.column.id),
			autofocus: this.editorAutofocusFor(cell.column.id, wr.vi.index)
		}) : html`<slot name="editor" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(wr.row),
					value: this.editorValueFor(cell.column.id),
					commit: this.editorCommitFor(cell.column.id),
					cancel: this.editorCancelFor(),
					columnLabel: this.headerLabel(cell.column.id),
					autofocus: this.editorAutofocusFor(cell.column.id, wr.vi.index)
				});
			} catch {
				return "{}";
			}
		})()}>
                <input class="rdt-cell-editor" type="text" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @input=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />
              </slot>`}
            </slot>`}
          </span>` : html`<input class="rdt-cell-editor" type="text" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @input=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />`}</span>` : this.cellIsPlaceholder(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-cell-value" data-rozie-s-d5dcab4c>
          ${this.rozieSlots?.[`cell-${cell.column.id}`] !== void 0 ? this.rozieSlots?.[`cell-${cell.column.id}`]({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(wr.row),
			value: cell.getValue()
		}) : html`<slot name="${`cell-${cell.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(wr.row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>
            ${this.cell !== void 0 ? this.cell({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(wr.row),
			value: cell.getValue()
		}) : html`<slot name="cell" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(wr.row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(cell.getValue())}</slot>`}
          </slot>`}
        </span>`}${this.isFillHandleCell(wr.vi.index, this.colIndexOf(wr.row, cell)) ? html`<span class="rdt-fill-handle" data-fill-handle="" data-testid="fill-handle" aria-hidden="true" @pointerdown=${($event) => {
			this.onFillHandlePointerDown($event);
		}} data-rozie-s-d5dcab4c></span>` : nothing}</td>`)}
      
      ${this.colsWindowed() ? html`<td class="rdt-col-spacer" aria-hidden="true" style=${rozieStyle("width:" + this.colPadRight() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></td>` : nothing}</tr>
    
    ${this.rowShowsDetail(wr.row) ? html`<tr class="rdt-detail-row" role="row" data-detail-row=${rozieAttr(wr.row.id)} data-rozie-s-d5dcab4c>
      <td class="rdt-detail-cell" colspan=${rozieAttr(this.windowedColSpan())} data-rozie-s-d5dcab4c>
        ${this.detail !== void 0 ? this.detail({ row: wr.row.original }) : html`<slot name="detail" data-rozie-params=${(() => {
			try {
				return JSON.stringify({ row: wr.row.original });
			} catch {
				return "{}";
			}
		})()}></slot>`}
      </td>
    </tr>` : nothing}`)}
    
    <tr class="rdt-spacer" aria-hidden="true" data-rozie-s-d5dcab4c>
      <td colspan=${rozieAttr(this.windowedColSpan())} style=${rozieStyle("height:" + this.padBottom() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c></td>
    </tr>
  </tbody>
</table>
</div>` : html`<table class="${Object.entries({
			"rozie-data-table": true,
			"rdt-sticky": this.stickyHeader
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role=${rozieAttr(this.tableRole())} aria-rowcount=${rozieAttr(this.gridAriaRowCount())} aria-colcount=${rozieAttr(this.gridAriaColCount())} @keydown=${($event) => {
			this.onGridKeyDown($event);
		}} @focusin=${($event) => {
			this.syncActiveFromEvent($event);
		}} @focusout=${($event) => {
			this.onGridFocusOut($event);
		}} @mousedown=${($event) => {
			this.onGridMouseDown($event);
		}} @dblclick=${($event) => {
			this.onGridDblClick($event);
		}} @click=${($event) => {
			this.onGridClick($event);
		}} data-rozie-s-d5dcab4c>
  <thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat(this._headerGroups.value, (hg, hgLevel) => hg.id, (hg, hgLevel) => html`<tr class="rdt-tr" role="row" aria-rowindex=${rozieAttr(hgLevel + 1)} data-rozie-s-d5dcab4c>
      ${repeat(hg.headers, (header, _idx) => header.id, (header, _idx) => html`<th class="${Object.entries({
			"rdt-th": true,
			"rdt-select-th": this.isSelectColumn(header.column.id),
			"rdt-expander-th": this.isExpanderColumn(header.column.id),
			"rdt-th-resizing": this.columnIsResizing(header.column.id),
			"rdt-cell-active": this.isActiveCell("__header", this.headerColIndexOf(hg, header), hgLevel)
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role="columnheader" data-col=${rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-header-level=${rozieAttr(hgLevel)} colspan=${rozieAttr(header.colSpan > 1 ? header.colSpan : null)} data-col-index=${rozieAttr(this.headerColIndexOf(hg, header))} aria-colindex=${rozieAttr(this.headerLeafStart(hg, header) + 1)} tabindex=${rozieAttr(this.cellTabindex("__header", this.headerColIndexOf(hg, header), hgLevel))} aria-sort=${rozieAttr(this.ariaSortFor(header.column.id))} style=${rozieStyle(this.thStyle(header))} data-rozie-s-d5dcab4c>
        
        
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectAll !== void 0 ? this.selectAll({
			checked: this.isAllRowsSelected(),
			indeterminate: this.isSomeRowsSelected(),
			toggle: this.onToggleAllRows
		}) : html`<slot name="selectAll" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					checked: this.isAllRowsSelected(),
					indeterminate: this.isSomeRowsSelected()
				});
			} catch {
				return "{}";
			}
		})()} @rozie-select-all-toggle=${($event) => this.onToggleAllRows($event.detail)}>
            
            ${this.selectionMode === "multiple" ? html`<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" ?checked=${this.isAllRowsSelected()} @change=${($event) => {
			this.onToggleAllRows($event);
		}} data-rozie-s-d5dcab4c />` : nothing}</slot>`}
        </span>` : this.isExpanderColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          
          ${header.column.getCanSort && header.column.getCanSort() ? html`<button class="rdt-sort-btn" type="button" @click=${($event) => {
			this.onHeaderSort(header.column.id, $event);
		}} data-rozie-s-d5dcab4c>
            
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.rozieSlots?.[`colHeader-${header.column.id}`] !== void 0 ? this.rozieSlots?.[`colHeader-${header.column.id}`]({
			columnId: header.column.id,
			column: header.column,
			label: this.headerLabel(header.column.id)
		}) : html`<slot name="${`colHeader-${header.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: header.column.id,
					column: header.column,
					label: this.headerLabel(header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>
                ${this.colHeader !== void 0 ? this.colHeader({
			columnId: header.column.id,
			column: header.column,
			label: this.headerLabel(header.column.id)
		}) : html`<slot name="colHeader" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: header.column.id,
					column: header.column,
					label: this.headerLabel(header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
              </slot>`}
            </span>
            <span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>${rozieDisplay(this.sortIndicator(header.column.id))}</span>
          </button>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.rozieSlots?.[`colHeader-${header.column.id}`] !== void 0 ? this.rozieSlots?.[`colHeader-${header.column.id}`]({
			columnId: header.column.id,
			column: header.column,
			label: this.headerLabel(header.column.id)
		}) : html`<slot name="${`colHeader-${header.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: header.column.id,
					column: header.column,
					label: this.headerLabel(header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>
                ${this.colHeader !== void 0 ? this.colHeader({
			columnId: header.column.id,
			column: header.column,
			label: this.headerLabel(header.column.id)
		}) : html`<slot name="colHeader" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: header.column.id,
					column: header.column,
					label: this.headerLabel(header.column.id)
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
              </slot>`}
            </span>
          </span>`}<rozie-popover trigger="click" placement="bottom-end" strategy="fixed" .offset=${4} data-rozie-s-d5dcab4c><button class="rdt-col-menu-trigger" type="button" aria-label=${rozieAttr("Column options for " + this.headerLabel(header.column.id))} data-rozie-s-d5dcab4c slot="anchor">⋯</button><div class="rdt-col-menu" role="menu" data-rozie-s-d5dcab4c>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(header.column.id) === "left"} @click=${($event) => {
			this.onPinColumn(header.column.id, "left", $event);
		}} data-rozie-s-d5dcab4c>Pin left</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${this.columnPinSide(header.column.id) === "right"} @click=${($event) => {
			this.onPinColumn(header.column.id, "right", $event);
		}} data-rozie-s-d5dcab4c>Pin right</button>
              <button class="rdt-col-menu-item" type="button" role="menuitem" aria-pressed=${!this.columnPinSide(header.column.id)} @click=${($event) => {
			this.onPinColumn(header.column.id, false, $event);
		}} data-rozie-s-d5dcab4c>Unpin</button>
              <hr class="rdt-col-menu-sep" data-rozie-s-d5dcab4c />
              <button class="rdt-col-menu-item" type="button" role="menuitem" @click=${($event) => {
			this.onHideColumn(header.column.id, $event);
		}} data-rozie-s-d5dcab4c>Hide column</button>
            </div></rozie-popover>
          
          <button class="rdt-resize-handle" type="button" aria-label=${rozieAttr("Resize " + this.headerLabel(header.column.id))} @pointerdown=${($event) => {
			this.onResizeStart(header.column.id, $event);
		}} @touchstart=${($event) => {
			this.onResizeStart(header.column.id, $event);
		}} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button>
        </span>`}</th>`)}
    </tr>`)}
    
    ${this.hasAnyFilterableColumn() ? html`<tr class="rdt-filter-row" data-rozie-s-d5dcab4c>
      ${repeat(this._headerGroups.value[this._headerGroups.value.length - 1].headers, (header, _idx) => header.id, (header, _idx) => html`<th class="rdt-filter-cell" role="presentation" style=${rozieStyle(this.pinStyle(header.column.id))} data-rozie-s-d5dcab4c>
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : this.isExpanderColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.columnIsFilterable(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.rozieSlots?.[`filter-${header.column.id}`] !== void 0 ? this.rozieSlots?.[`filter-${header.column.id}`]({
			columnId: header.column.id,
			value: this.columnFilterValue(header.column.id),
			uniqueValues: this.getFacetedUniqueValues(header.column.id),
			minMax: this.getFacetedMinMaxValues(header.column.id),
			columnLabel: this.headerLabel(header.column.id),
			setFilter: this.setColumnFilter
		}) : html`<slot name="${`filter-${header.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: header.column.id,
					value: this.columnFilterValue(header.column.id),
					uniqueValues: this.getFacetedUniqueValues(header.column.id),
					minMax: this.getFacetedMinMaxValues(header.column.id),
					columnLabel: this.headerLabel(header.column.id)
				});
			} catch {
				return "{}";
			}
		})()} @rozie-default-set-filter=${($event) => this.setColumnFilter($event.detail)}>
              ${this.filter !== void 0 ? this.filter({
			columnId: header.column.id,
			value: this.columnFilterValue(header.column.id),
			uniqueValues: this.getFacetedUniqueValues(header.column.id),
			minMax: this.getFacetedMinMaxValues(header.column.id),
			columnLabel: this.headerLabel(header.column.id),
			setFilter: this.setColumnFilter
		}) : html`<slot name="filter" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: header.column.id,
					value: this.columnFilterValue(header.column.id),
					uniqueValues: this.getFacetedUniqueValues(header.column.id),
					minMax: this.getFacetedMinMaxValues(header.column.id),
					columnLabel: this.headerLabel(header.column.id)
				});
			} catch {
				return "{}";
			}
		})()} @rozie-filter-set-filter=${($event) => this.setColumnFilter($event.detail)}>
                <input class="rdt-col-filter" type="text" aria-label=${rozieAttr("Filter " + this.headerLabel(header.column.id))} .value=${this.columnFilterValue(header.column.id)} @input=${($event) => {
			this.onColumnFilterInput(header.column.id, $event);
		}} @click=${($event) => {
			this.stopEvent($event);
		}} data-rozie-s-d5dcab4c />
              </slot>`}
            </slot>`}
          </span>` : nothing}</span>`}</th>`)}
    </tr>` : nothing}</thead>

  <tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>
    
    ${repeat(this._rows.value, (row, _idx) => row.id, (row, _idx) => html`
    <tr class="${Object.entries({
			"rdt-tr": true,
			"rdt-group-header": this.rowIsGrouped(row)
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role="row" data-depth=${rozieAttr(row.depth)} aria-rowindex=${rozieAttr(this.bodyAriaRowIndex(row))} data-group-header=${rozieAttr(this.rowIsGrouped(row) ? row.id : null)} data-group-leaf=${rozieAttr(this.groupingActive() && !this.rowIsGrouped(row) ? row.id : null)} aria-expanded=${rozieAttr(this.rowIsGrouped(row) ? !!this.rowIsExpanded(row) : null)} aria-selected=${rozieAttr(this.selectionMode !== "none" ? !!this.rowIsSelected(row) : null)} aria-level=${rozieAttr(this.groupingActive() ? row.depth + 1 : null)} data-rozie-s-d5dcab4c>
      ${repeat(this.visibleCellsFor(row), (cell, _idx) => cell.id, (cell, _idx) => html`<td class="${Object.entries({
			"rdt-td": true,
			"rdt-select-td": this.isSelectColumn(cell.column.id),
			"rdt-expander-td": this.isExpanderColumn(cell.column.id),
			"rdt-in-range": this.inRange(this.rowIndexOf(row), this.colIndexOf(row, cell)),
			"rdt-cell-active": this.isActiveCell(String(this.rowIndexOf(row)), this.colIndexOf(row, cell))
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" role=${rozieAttr(this.cellRole())} data-col=${rozieAttr(cell.column.id)} data-grid-cell="" data-row=${rozieAttr(this.rowIndexOf(row))} data-col-index=${rozieAttr(this.colIndexOf(row, cell))} tabindex=${rozieAttr(this.cellTabindex(String(this.rowIndexOf(row)), this.colIndexOf(row, cell)))} style=${rozieStyle(this.bodyCellStyle(row, cell.column.id))} aria-invalid=${rozieAttr(this.cellAriaInvalid(this.rowIndexOf(row), this.colIndexOf(row, cell)))} aria-colindex=${rozieAttr(this.colIndexOf(row, cell) + 1)} aria-selected=${rozieAttr(this.inRange(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? "true" : null)} data-in-range=${rozieAttr(this.inRange(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? "true" : null)} data-agg-cell=${rozieAttr(this.cellIsAggregated(cell) ? cell.column.id : null)} data-rozie-s-d5dcab4c>
        
        ${this.isExpanderColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.rowCanExpand(row) ? html`<button class="rdt-expander" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(row)} aria-label=${rozieAttr(this.rowIsExpanded(row) ? "Collapse row" : "Expand row")} @click=${($event) => {
			this.onToggleExpand(row, $event);
		}} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(row) ? "▾" : "▸")}</button>` : nothing}</span>` : this.isSelectColumn(cell.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectCell !== void 0 ? this.selectCell({
			row: this.cellSlotRow(row),
			checked: this.rowIsSelected(row),
			toggle: (e) => this.onToggleRow(row, e)
		}) : html`<slot name="selectCell" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					row: this.cellSlotRow(row),
					checked: this.rowIsSelected(row)
				});
			} catch {
				return "{}";
			}
		})()} @rozie-select-cell-toggle=${($event) => ((e) => this.onToggleRow(row, e))($event.detail)}>
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" ?checked=${this.rowIsSelected(row)} @change=${($event) => {
			this.onToggleRow(row, $event);
		}} data-rozie-s-d5dcab4c />
          </slot>`}
        </span>` : this.cellIsGrouped(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          <button class="rdt-expander rdt-group-toggle" type="button" data-expander="" aria-expanded=${!!this.rowIsExpanded(row)} aria-label=${rozieAttr(this.rowIsExpanded(row) ? "Collapse group" : "Expand group")} @click=${($event) => {
			this.onToggleExpand(row, $event);
		}} data-rozie-s-d5dcab4c>${rozieDisplay(this.rowIsExpanded(row) ? "▾" : "▸")}</button>
          <span class="rdt-group-value" data-rozie-s-d5dcab4c>
            ${this.rozieSlots?.[`cell-${cell.column.id}`] !== void 0 ? this.rozieSlots?.[`cell-${cell.column.id}`]({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(row),
			value: cell.getValue()
		}) : html`<slot name="${`cell-${cell.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>
              ${this.cell !== void 0 ? this.cell({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(row),
			value: cell.getValue()
		}) : html`<slot name="cell" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(cell.getValue())}</slot>`}
            </slot>`}
          </span>
          <span class="rdt-group-count" data-rozie-s-d5dcab4c>${rozieDisplay("(" + this.groupSubRowCount(row) + ")")}</span>
        </span>` : this.isEditing(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.editorTypeOf(cell.column.id) === "number" ? html`<input class="rdt-cell-editor" type="number" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @input=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />` : this.editorTypeOf(cell.column.id) === "select" ? html`<select class="rdt-cell-editor" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @change=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c>
            ${repeat(this.editorOptionsOf(cell.column.id), (opt, _idx) => opt.value, (opt, _idx) => html`<option value=${rozieAttr(opt.value)} ?selected=${opt.value === this.editorValueFor(cell.column.id)} data-rozie-s-d5dcab4c>${rozieDisplay(opt.label)}</option>`)}
          </select>` : this.editorTypeOf(cell.column.id) === "checkbox" ? html`<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} ?checked=${this.editorCheckedFor(cell.column.id)} @change=${($event) => {
			this.onCellEditorCheckbox(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />` : this.editorTypeOf(cell.column.id) === "custom" ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
            ${this.rozieSlots?.[`editor-${cell.column.id}`] !== void 0 ? this.rozieSlots?.[`editor-${cell.column.id}`]({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(row),
			value: this.editorValueFor(cell.column.id),
			commit: this.editorCommitFor(cell.column.id),
			cancel: this.editorCancelFor(),
			columnLabel: this.headerLabel(cell.column.id),
			autofocus: this.editorAutofocusFor(cell.column.id, this.rowIndexOf(row))
		}) : html`<slot name="${`editor-${cell.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(row),
					value: this.editorValueFor(cell.column.id),
					commit: this.editorCommitFor(cell.column.id),
					cancel: this.editorCancelFor(),
					columnLabel: this.headerLabel(cell.column.id),
					autofocus: this.editorAutofocusFor(cell.column.id, this.rowIndexOf(row))
				});
			} catch {
				return "{}";
			}
		})()}>
              ${this.editor !== void 0 ? this.editor({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(row),
			value: this.editorValueFor(cell.column.id),
			commit: this.editorCommitFor(cell.column.id),
			cancel: this.editorCancelFor(),
			columnLabel: this.headerLabel(cell.column.id),
			autofocus: this.editorAutofocusFor(cell.column.id, this.rowIndexOf(row))
		}) : html`<slot name="editor" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(row),
					value: this.editorValueFor(cell.column.id),
					commit: this.editorCommitFor(cell.column.id),
					cancel: this.editorCancelFor(),
					columnLabel: this.headerLabel(cell.column.id),
					autofocus: this.editorAutofocusFor(cell.column.id, this.rowIndexOf(row))
				});
			} catch {
				return "{}";
			}
		})()}>
                <input class="rdt-cell-editor" type="text" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @input=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />
              </slot>`}
            </slot>`}
          </span>` : html`<input class="rdt-cell-editor" type="text" data-editing-cell="" data-builtin-editor="" aria-invalid=${rozieAttr(this._invalidMsg.value ? "true" : null)} .value=${this.editorValueFor(cell.column.id)} @input=${($event) => {
			this.onCellEditorInput(cell.column.id, $event);
		}} @keydown=${($event) => {
			this.onEditorKeyDown($event);
		}} @blur=${($event) => {
			this.onEditorBlur($event);
		}} data-rozie-s-d5dcab4c />`}</span>` : this.cellIsPlaceholder(cell) ? html`<span style="display:contents" data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-cell-value" data-rozie-s-d5dcab4c>
          ${this.rozieSlots?.[`cell-${cell.column.id}`] !== void 0 ? this.rozieSlots?.[`cell-${cell.column.id}`]({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(row),
			value: cell.getValue()
		}) : html`<slot name="${`cell-${cell.column.id}`}" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>
            ${this.cell !== void 0 ? this.cell({
			columnId: cell.column.id,
			column: cell.column,
			row: this.cellSlotRow(row),
			value: cell.getValue()
		}) : html`<slot name="cell" data-rozie-params=${(() => {
			try {
				return JSON.stringify({
					columnId: cell.column.id,
					column: cell.column,
					row: this.cellSlotRow(row),
					value: cell.getValue()
				});
			} catch {
				return "{}";
			}
		})()}>${rozieDisplay(cell.getValue())}</slot>`}
          </slot>`}
        </span>`}${this.isFillHandleCell(this.rowIndexOf(row), this.colIndexOf(row, cell)) ? html`<span class="rdt-fill-handle" data-fill-handle="" data-testid="fill-handle" aria-hidden="true" @pointerdown=${($event) => {
			this.onFillHandlePointerDown($event);
		}} data-rozie-s-d5dcab4c></span>` : nothing}</td>`)}
    </tr>
    
    ${this.rowShowsDetail(row) ? html`<tr class="rdt-detail-row" role="row" data-detail-row=${rozieAttr(row.id)} data-rozie-s-d5dcab4c>
      <td class="rdt-detail-cell" colspan=${rozieAttr(this.visibleColCount())} data-rozie-s-d5dcab4c>
        ${this.detail !== void 0 ? this.detail({ row: row.original }) : html`<slot name="detail" data-rozie-params=${(() => {
			try {
				return JSON.stringify({ row: row.original });
			} catch {
				return "{}";
			}
		})()}></slot>`}
      </td>
    </tr>` : nothing}`)}
  </tbody>
</table>`}${!this.rowsWindowed() ? html`<div class="rdt-pagination" role="group" aria-label="Pagination" data-rozie-s-d5dcab4c>
  <button class="rdt-page-btn rdt-page-prev" type="button" ?disabled=${!this.canPrevPage()} @click=${($event) => {
			this.onPrevPage();
		}} data-rozie-s-d5dcab4c>Prev</button>
  <span class="rdt-page-status" aria-live="polite" data-rozie-s-d5dcab4c>
    ${rozieDisplay("Page " + (this.pageIndex() + 1) + " of " + this.displayPageCount())}
  </span>
  <button class="rdt-page-btn rdt-page-next" type="button" ?disabled=${!this.canNextPage()} @click=${($event) => {
			this.onNextPage();
		}} data-rozie-s-d5dcab4c>Next</button>
  <select class="rdt-page-size" aria-label="Rows per page" .value=${this.pageSize()} @change=${($event) => {
			this.onPageSizeChange($event);
		}} data-rozie-s-d5dcab4c>
    <option value=${10} ?selected=${10 === this.pageSize()} data-rozie-s-d5dcab4c>10</option>
    <option value=${25} ?selected=${25 === this.pageSize()} data-rozie-s-d5dcab4c>25</option>
    <option value=${50} ?selected=${50 === this.pageSize()} data-rozie-s-d5dcab4c>50</option>
    <option value=${100} ?selected=${100 === this.pageSize()} data-rozie-s-d5dcab4c>100</option>
  </select>
</div>` : nothing}</div>
`;
	}
	get data() {
		return this._dataControllable.read();
	}
	set data(v) {
		this._dataControllable.notifyPropertyWrite(v);
	}
	get sorting() {
		return this._sortingControllable.read();
	}
	set sorting(v) {
		this._sortingControllable.notifyPropertyWrite(v);
	}
	get globalFilter() {
		return this._globalFilterControllable.read();
	}
	set globalFilter(v) {
		this._globalFilterControllable.notifyPropertyWrite(v);
	}
	get columnFilters() {
		return this._columnFiltersControllable.read();
	}
	set columnFilters(v) {
		this._columnFiltersControllable.notifyPropertyWrite(v);
	}
	get pagination() {
		return this._paginationControllable.read();
	}
	set pagination(v) {
		this._paginationControllable.notifyPropertyWrite(v);
	}
	get expanded() {
		return this._expandedControllable.read();
	}
	set expanded(v) {
		this._expandedControllable.notifyPropertyWrite(v);
	}
	get grouping() {
		return this._groupingControllable.read();
	}
	set grouping(v) {
		this._groupingControllable.notifyPropertyWrite(v);
	}
	get rowSelection() {
		return this._rowSelectionControllable.read();
	}
	set rowSelection(v) {
		this._rowSelectionControllable.notifyPropertyWrite(v);
	}
	get columnVisibility() {
		return this._columnVisibilityControllable.read();
	}
	set columnVisibility(v) {
		this._columnVisibilityControllable.notifyPropertyWrite(v);
	}
	get columnSizing() {
		return this._columnSizingControllable.read();
	}
	set columnSizing(v) {
		this._columnSizingControllable.notifyPropertyWrite(v);
	}
	get columnOrder() {
		return this._columnOrderControllable.read();
	}
	set columnOrder(v) {
		this._columnOrderControllable.notifyPropertyWrite(v);
	}
	get columnPinning() {
		return this._columnPinningControllable.read();
	}
	set columnPinning(v) {
		this._columnPinningControllable.notifyPropertyWrite(v);
	}
};
__decorate([property({
	type: Array,
	attribute: "data"
})], DataTable.prototype, "_data_attr", void 0);
__decorate([property({ type: Array })], DataTable.prototype, "columns", void 0);
__decorate([property({
	type: String,
	reflect: true
})], DataTable.prototype, "selectionMode", void 0);
__decorate([property({
	type: Array,
	attribute: "sorting"
})], DataTable.prototype, "_sorting_attr", void 0);
__decorate([property({
	type: String,
	attribute: "global-filter"
})], DataTable.prototype, "_globalFilter_attr", void 0);
__decorate([property({
	type: Array,
	attribute: "column-filters"
})], DataTable.prototype, "_columnFilters_attr", void 0);
__decorate([property({
	type: Object,
	attribute: "pagination"
})], DataTable.prototype, "_pagination_attr", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "manual", void 0);
__decorate([property({
	type: Number,
	reflect: true
})], DataTable.prototype, "rowCount", void 0);
__decorate([property({
	type: Number,
	reflect: true
})], DataTable.prototype, "pageCount", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "expandable", void 0);
__decorate([property({
	type: Object,
	attribute: "expanded"
})], DataTable.prototype, "_expanded_attr", void 0);
__decorate([property({ type: Function })], DataTable.prototype, "getSubRows", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "groupable", void 0);
__decorate([property({
	type: Array,
	attribute: "grouping"
})], DataTable.prototype, "_grouping_attr", void 0);
__decorate([property({
	type: Object,
	attribute: "row-selection"
})], DataTable.prototype, "_rowSelection_attr", void 0);
__decorate([property({
	type: Object,
	attribute: "column-visibility"
})], DataTable.prototype, "_columnVisibility_attr", void 0);
__decorate([property({
	type: Object,
	attribute: "column-sizing"
})], DataTable.prototype, "_columnSizing_attr", void 0);
__decorate([property({
	type: Array,
	attribute: "column-order"
})], DataTable.prototype, "_columnOrder_attr", void 0);
__decorate([property({
	type: Object,
	attribute: "column-pinning"
})], DataTable.prototype, "_columnPinning_attr", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "stickyHeader", void 0);
__decorate([property({
	type: String,
	reflect: true
})], DataTable.prototype, "interactionMode", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "singleClickEdit", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "undoable", void 0);
__decorate([property({
	type: Number,
	reflect: true
})], DataTable.prototype, "undoLimit", void 0);
__decorate([property({ converter: { fromAttribute: (v) => v === null ? false : v === "true" ? true : v === "false" ? false : v === "" ? true : v } })], DataTable.prototype, "virtual", void 0);
__decorate([property({
	type: Number,
	reflect: true
})], DataTable.prototype, "estimateRowHeight", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], DataTable.prototype, "autoMeasure", void 0);
__decorate([property({
	type: String,
	reflect: true
})], DataTable.prototype, "maxHeight", void 0);
__decorate([query("[data-rozie-ref=\"__rozieRoot\"]")], DataTable.prototype, "_ref__rozieRoot", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotDefault", void 0);
__decorate([queryAssignedElements({ flatten: true })], DataTable.prototype, "_slotDefaultElements", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotGroupBar", void 0);
__decorate([queryAssignedElements({
	slot: "groupBar",
	flatten: true
})], DataTable.prototype, "_slotGroupBarElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "groupBar", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotSelectAll", void 0);
__decorate([queryAssignedElements({
	slot: "selectAll",
	flatten: true
})], DataTable.prototype, "_slotSelectAllElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "selectAll", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotDynamicColHeader", void 0);
__decorate([queryAssignedElements({ flatten: true })], DataTable.prototype, "_slotDynamicColHeaderElements", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotDynamicFilter", void 0);
__decorate([queryAssignedElements({ flatten: true })], DataTable.prototype, "_slotDynamicFilterElements", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotSelectCell", void 0);
__decorate([queryAssignedElements({
	slot: "selectCell",
	flatten: true
})], DataTable.prototype, "_slotSelectCellElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "selectCell", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotDynamicCell", void 0);
__decorate([queryAssignedElements({ flatten: true })], DataTable.prototype, "_slotDynamicCellElements", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotDynamicEditor", void 0);
__decorate([queryAssignedElements({ flatten: true })], DataTable.prototype, "_slotDynamicEditorElements", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotDetail", void 0);
__decorate([queryAssignedElements({
	slot: "detail",
	flatten: true
})], DataTable.prototype, "_slotDetailElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "detail", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotColHeader", void 0);
__decorate([queryAssignedElements({
	slot: "colHeader",
	flatten: true
})], DataTable.prototype, "_slotColHeaderElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "colHeader", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotFilter", void 0);
__decorate([queryAssignedElements({
	slot: "filter",
	flatten: true
})], DataTable.prototype, "_slotFilterElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "filter", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotCell", void 0);
__decorate([queryAssignedElements({
	slot: "cell",
	flatten: true
})], DataTable.prototype, "_slotCellElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "cell", void 0);
__decorate([state()], DataTable.prototype, "_hasSlotEditor", void 0);
__decorate([queryAssignedElements({
	slot: "editor",
	flatten: true
})], DataTable.prototype, "_slotEditorElements", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "editor", void 0);
__decorate([property({ attribute: false })], DataTable.prototype, "rozieSlots", void 0);
DataTable = __decorate([customElement("rozie-data-table")], DataTable);
var DataTable_default = DataTable;
//#endregion
//#region src/Column.ts
const __rozieCtx_data_table_columns = createContext(Symbol.for("rozie:data-table:columns"));
let Column = class Column extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.id = "";
		this.field = "";
		this.header = "";
		this.sortable = false;
		this.filterable = false;
		this.pinned = "";
		this.width = "";
		this.expandable = false;
		this.groupable = true;
		this.aggregationFn = null;
		this.editable = false;
		this.editor = "text";
		this.editorOptions = [];
		this.validate = null;
		this.__rozieFirstUpdateDone = false;
		this.__rozieCtxConsumer_data_table_columns = new ContextConsumer(this, {
			context: __rozieCtx_data_table_columns,
			subscribe: true
		});
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.reg = null;
		this.registered = false;
		this.colId = () => this.id !== "" ? this.id : this.field;
		this.buildSpec = () => ({
			id: this.colId(),
			field: this.field !== "" ? this.field : this.colId(),
			header: this.header,
			sortable: this.sortable,
			filterable: this.filterable,
			pinned: this.pinned,
			width: this.width,
			expandable: this.expandable,
			groupable: this.groupable,
			aggregationFn: this.aggregationFn,
			editable: this.editable,
			editor: this.editor,
			editorOptions: this.editorOptions,
			validate: this.validate
		});
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	get registry() {
		return this.__rozieCtxConsumer_data_table_columns.value;
	}
	firstUpdated() {
		this.reg = this.registry;
		this._disconnectCleanups.push((() => {
			if (this.reg) this.reg.unregisterColumn(this.colId());
		}));
		if (this.reg && !this.registered) {
			this.registered = true;
			this.reg.registerColumn(this.colId(), this.buildSpec());
		}
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && (changedProperties.has("id") || changedProperties.has("field") || changedProperties.has("header") || changedProperties.has("sortable") || changedProperties.has("filterable") || changedProperties.has("pinned") || changedProperties.has("width") || changedProperties.has("expandable") || changedProperties.has("groupable") || changedProperties.has("aggregationFn") || changedProperties.has("editable") || changedProperties.has("editor") || changedProperties.has("editorOptions") || changedProperties.has("validate"))) {
			this.id, this.field, this.header, this.sortable, this.filterable, this.pinned, this.width, this.expandable, this.groupable, this.aggregationFn, this.editable, this.editor, this.editorOptions, this.validate;
			(() => {
				if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
			})();
		}
		this.__rozieFirstUpdateDone = true;
		if (this.registered) return;
		const live = this.registry;
		if (live == null) return;
		this.reg = live;
		this.registered = true;
		this.reg.registerColumn(this.colId(), this.buildSpec());
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`

<div class="rozie-data-table-column" style="display:none" data-rozie-s-289f2d72></div>
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], Column.prototype, "id", void 0);
__decorate([property({
	type: String,
	reflect: true
})], Column.prototype, "field", void 0);
__decorate([property({
	type: String,
	reflect: true
})], Column.prototype, "header", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], Column.prototype, "sortable", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], Column.prototype, "filterable", void 0);
__decorate([property({
	type: String,
	reflect: true
})], Column.prototype, "pinned", void 0);
__decorate([property({ type: String })], Column.prototype, "width", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], Column.prototype, "expandable", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], Column.prototype, "groupable", void 0);
__decorate([property({ type: String })], Column.prototype, "aggregationFn", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], Column.prototype, "editable", void 0);
__decorate([property({
	type: String,
	reflect: true
})], Column.prototype, "editor", void 0);
__decorate([property({ type: Array })], Column.prototype, "editorOptions", void 0);
__decorate([property({ type: Function })], Column.prototype, "validate", void 0);
Column = __decorate([customElement("rozie-column")], Column);
var Column_default = Column;
//#endregion
//#region src/EditorText.ts
let EditorText = class EditorText extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.row = null;
		this.value = null;
		this.commit = null;
		this.cancel = null;
		this.autofocus = false;
		this.columnLabel = "";
		this._draft = signal("");
		this._touched = signal(false);
		this.__rozieFirstUpdateDone = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.draftValue = () => this._touched.value ? this._draft.value : this.value != null ? String(this.value) : "";
		this.onInput = (e) => {
			this._draft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.doCommit = () => {
			this.commit && this.commit(this.draftValue());
		};
		this.doCancel = () => {
			this.cancel && this.cancel();
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Enter") {
				e.preventDefault();
				this.doCommit();
			} else if (e && e.key === "Escape") {
				e.preventDefault();
				this.doCancel();
			}
		};
		this.onBlur = () => {
			this.doCommit();
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	firstUpdated() {
		if (this.autofocus) this._refInputEl?.focus();
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && changedProperties.has("autofocus")) ((v) => {
			if (v) this._refInputEl?.focus();
		})(this.autofocus);
		this.__rozieFirstUpdateDone = true;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<input class="rdt-cell-editor" type="text" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @input=${($event) => {
			this.onInput($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-ref="inputEl" data-rozie-s-0d17f43a />
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], EditorText.prototype, "columnId", void 0);
__decorate([property({ type: Object })], EditorText.prototype, "column", void 0);
__decorate([property({ type: Object })], EditorText.prototype, "row", void 0);
__decorate([property({ type: Object })], EditorText.prototype, "value", void 0);
__decorate([property({ type: Function })], EditorText.prototype, "commit", void 0);
__decorate([property({ type: Function })], EditorText.prototype, "cancel", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], EditorText.prototype, "autofocus", void 0);
__decorate([property({
	type: String,
	reflect: true
})], EditorText.prototype, "columnLabel", void 0);
__decorate([query("[data-rozie-ref=\"inputEl\"]")], EditorText.prototype, "_refInputEl", void 0);
EditorText = __decorate([customElement("rozie-editor-text")], EditorText);
var EditorText_default = EditorText;
//#endregion
//#region src/EditorNumber.ts
let EditorNumber = class EditorNumber extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.row = null;
		this.value = null;
		this.commit = null;
		this.cancel = null;
		this.autofocus = false;
		this.columnLabel = "";
		this._draft = signal("");
		this._touched = signal(false);
		this.__rozieFirstUpdateDone = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.draftValue = () => this._touched.value ? this._draft.value : this.value != null ? String(this.value) : "";
		this.onInput = (e) => {
			this._draft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.doCommit = () => {
			if (!this.commit) return;
			const raw = this.draftValue();
			if (raw == null || String(raw).trim() === "") {
				this.commit(null);
				return;
			}
			const n = Number(raw);
			this.commit(Number.isNaN(n) ? null : n);
		};
		this.doCancel = () => {
			this.cancel && this.cancel();
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Enter") {
				e.preventDefault();
				this.doCommit();
			} else if (e && e.key === "Escape") {
				e.preventDefault();
				this.doCancel();
			}
		};
		this.onBlur = () => {
			this.doCommit();
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	firstUpdated() {
		if (this.autofocus) this._refInputEl?.focus();
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && changedProperties.has("autofocus")) ((v) => {
			if (v) this._refInputEl?.focus();
		})(this.autofocus);
		this.__rozieFirstUpdateDone = true;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<input class="rdt-cell-editor" type="number" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @input=${($event) => {
			this.onInput($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-ref="inputEl" data-rozie-s-b2792b32 />
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], EditorNumber.prototype, "columnId", void 0);
__decorate([property({ type: Object })], EditorNumber.prototype, "column", void 0);
__decorate([property({ type: Object })], EditorNumber.prototype, "row", void 0);
__decorate([property({ type: Object })], EditorNumber.prototype, "value", void 0);
__decorate([property({ type: Function })], EditorNumber.prototype, "commit", void 0);
__decorate([property({ type: Function })], EditorNumber.prototype, "cancel", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], EditorNumber.prototype, "autofocus", void 0);
__decorate([property({
	type: String,
	reflect: true
})], EditorNumber.prototype, "columnLabel", void 0);
__decorate([query("[data-rozie-ref=\"inputEl\"]")], EditorNumber.prototype, "_refInputEl", void 0);
EditorNumber = __decorate([customElement("rozie-editor-number")], EditorNumber);
var EditorNumber_default = EditorNumber;
//#endregion
//#region src/EditorSelect.ts
let EditorSelect = class EditorSelect extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.row = null;
		this.value = null;
		this.commit = null;
		this.cancel = null;
		this.options = [];
		this.autofocus = false;
		this.columnLabel = "";
		this._draft = signal("");
		this._touched = signal(false);
		this.__rozieFirstUpdateDone = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.draftValue = () => this._touched.value ? this._draft.value : this.value != null ? String(this.value) : "";
		this.onChange = (e) => {
			this._draft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.doCommit = () => {
			this.commit && this.commit(this.draftValue());
		};
		this.doCancel = () => {
			this.cancel && this.cancel();
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Enter") {
				e.preventDefault();
				this.doCommit();
			} else if (e && e.key === "Escape") {
				e.preventDefault();
				this.doCancel();
			}
		};
		this.onBlur = () => {
			this.doCommit();
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	firstUpdated() {
		if (this.autofocus) this._refSelectEl?.focus();
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && changedProperties.has("autofocus")) ((v) => {
			if (v) this._refSelectEl?.focus();
		})(this.autofocus);
		this.__rozieFirstUpdateDone = true;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<select class="rdt-cell-editor" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @change=${($event) => {
			this.onChange($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-ref="selectEl" data-rozie-s-117f1a16>
  ${repeat(this.options, (opt, _idx) => opt.value, (opt, _idx) => html`<option value=${rozieAttr(opt.value)} ?selected=${opt.value === this.draftValue()} data-rozie-s-117f1a16>${rozieDisplay(opt.label)}</option>`)}
</select>
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], EditorSelect.prototype, "columnId", void 0);
__decorate([property({ type: Object })], EditorSelect.prototype, "column", void 0);
__decorate([property({ type: Object })], EditorSelect.prototype, "row", void 0);
__decorate([property({ type: Object })], EditorSelect.prototype, "value", void 0);
__decorate([property({ type: Function })], EditorSelect.prototype, "commit", void 0);
__decorate([property({ type: Function })], EditorSelect.prototype, "cancel", void 0);
__decorate([property({ type: Array })], EditorSelect.prototype, "options", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], EditorSelect.prototype, "autofocus", void 0);
__decorate([property({
	type: String,
	reflect: true
})], EditorSelect.prototype, "columnLabel", void 0);
__decorate([query("[data-rozie-ref=\"selectEl\"]")], EditorSelect.prototype, "_refSelectEl", void 0);
EditorSelect = __decorate([customElement("rozie-editor-select")], EditorSelect);
var EditorSelect_default = EditorSelect;
//#endregion
//#region src/EditorCheckbox.ts
let EditorCheckbox = class EditorCheckbox extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.row = null;
		this.value = null;
		this.commit = null;
		this.cancel = null;
		this.autofocus = false;
		this.columnLabel = "";
		this.__rozieFirstUpdateDone = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.onChange = (e) => {
			this.commit && this.commit(!!(e && e.target ? e.target.checked : false));
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Escape") {
				e.preventDefault();
				this.cancel && this.cancel();
			}
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	firstUpdated() {
		if (this.autofocus) this._refInputEl?.focus();
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && changedProperties.has("autofocus")) ((v) => {
			if (v) this._refInputEl?.focus();
		})(this.autofocus);
		this.__rozieFirstUpdateDone = true;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} ?checked=${!!this.value} @change=${($event) => {
			this.onChange($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} data-rozie-ref="inputEl" data-rozie-s-3d792482 />
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], EditorCheckbox.prototype, "columnId", void 0);
__decorate([property({ type: Object })], EditorCheckbox.prototype, "column", void 0);
__decorate([property({ type: Object })], EditorCheckbox.prototype, "row", void 0);
__decorate([property({ type: Object })], EditorCheckbox.prototype, "value", void 0);
__decorate([property({ type: Function })], EditorCheckbox.prototype, "commit", void 0);
__decorate([property({ type: Function })], EditorCheckbox.prototype, "cancel", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], EditorCheckbox.prototype, "autofocus", void 0);
__decorate([property({
	type: String,
	reflect: true
})], EditorCheckbox.prototype, "columnLabel", void 0);
__decorate([query("[data-rozie-ref=\"inputEl\"]")], EditorCheckbox.prototype, "_refInputEl", void 0);
EditorCheckbox = __decorate([customElement("rozie-editor-checkbox")], EditorCheckbox);
var EditorCheckbox_default = EditorCheckbox;
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
//#region src/EditorDate.ts
let EditorDate = class EditorDate extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.row = null;
		this.value = null;
		this.commit = null;
		this.cancel = null;
		this.autofocus = false;
		this.columnLabel = "";
		this._draft = signal("");
		this._touched = signal(false);
		this.__rozieFirstUpdateDone = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.draftValue = () => this._touched.value ? this._draft.value : toIsoDateString(this.value);
		this.onInput = (e) => {
			this._draft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.doCommit = () => {
			this.commit && this.commit(this.draftValue());
		};
		this.doCancel = () => {
			this.cancel && this.cancel();
		};
		this.onChange = (e) => {
			this._draft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Enter") {
				e.preventDefault();
				this.doCommit();
			} else if (e && e.key === "Escape") {
				e.preventDefault();
				this.doCancel();
			}
		};
		this.onBlur = () => {
			this.doCommit();
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	firstUpdated() {
		if (this.autofocus) this._refInputEl?.focus();
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && changedProperties.has("autofocus")) ((v) => {
			if (v) this._refInputEl?.focus();
		})(this.autofocus);
		this.__rozieFirstUpdateDone = true;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<input class="rdt-cell-editor" type="date" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @input=${($event) => {
			this.onInput($event);
		}} @change=${($event) => {
			this.onChange($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-ref="inputEl" data-rozie-s-7abe1a56 />
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], EditorDate.prototype, "columnId", void 0);
__decorate([property({ type: Object })], EditorDate.prototype, "column", void 0);
__decorate([property({ type: Object })], EditorDate.prototype, "row", void 0);
__decorate([property({ type: Object })], EditorDate.prototype, "value", void 0);
__decorate([property({ type: Function })], EditorDate.prototype, "commit", void 0);
__decorate([property({ type: Function })], EditorDate.prototype, "cancel", void 0);
__decorate([property({
	type: Boolean,
	reflect: true
})], EditorDate.prototype, "autofocus", void 0);
__decorate([property({
	type: String,
	reflect: true
})], EditorDate.prototype, "columnLabel", void 0);
__decorate([query("[data-rozie-ref=\"inputEl\"]")], EditorDate.prototype, "_refInputEl", void 0);
EditorDate = __decorate([customElement("rozie-editor-date")], EditorDate);
var EditorDate_default = EditorDate;
//#endregion
//#region src/FilterText.ts
let FilterText = class FilterText extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.value = null;
		this.setFilter = null;
		this.columnLabel = "";
		this._draft = signal("");
		this._touched = signal(false);
		this.__rozieFirstUpdateDone = false;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.draftValue = () => this._touched.value ? this._draft.value : this.value != null ? String(this.value) : "";
		this.onInput = (e) => {
			this._draft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.applyFilter = () => {
			this.setFilter && this.setFilter(this.columnId, this.draftValue());
		};
		this.clearFilter = () => {
			this._draft.value = "";
			this._touched.value = false;
			this.setFilter && this.setFilter(this.columnId, "");
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Enter") {
				e.preventDefault();
				this.applyFilter();
			} else if (e && e.key === "Escape") {
				e.preventDefault();
				this.clearFilter();
			}
		};
		this.onBlur = () => {
			this.applyFilter();
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	updated(changedProperties) {
		if (this.__rozieFirstUpdateDone && changedProperties.has("value")) {
			this.value;
			this._touched.value = false;
		}
		this.__rozieFirstUpdateDone = true;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<input class="rdt-col-filter" part="col-filter" type="text" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @input=${($event) => {
			this.onInput($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-s-18cbb44e />
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], FilterText.prototype, "columnId", void 0);
__decorate([property({ type: Object })], FilterText.prototype, "column", void 0);
__decorate([property({ type: Object })], FilterText.prototype, "value", void 0);
__decorate([property({ type: Function })], FilterText.prototype, "setFilter", void 0);
__decorate([property({
	type: String,
	reflect: true
})], FilterText.prototype, "columnLabel", void 0);
FilterText = __decorate([customElement("rozie-filter-text")], FilterText);
var FilterText_default = FilterText;
//#endregion
//#region src/FilterNumberRange.ts
let FilterNumberRange = class FilterNumberRange extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.value = null;
		this.setFilter = null;
		this.minMax = null;
		this.columnLabel = "";
		this._minDraft = signal("");
		this._maxDraft = signal("");
		this._touched = signal(false);
		this.__rozieWatchInitial_0 = true;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.minDraftValue = () => this._touched.value ? this._minDraft.value : Array.isArray(this.value) && this.value[0] != null ? String(this.value[0]) : "";
		this.maxDraftValue = () => this._touched.value ? this._maxDraft.value : Array.isArray(this.value) && this.value[1] != null ? String(this.value[1]) : "";
		this.onMinInput = (e) => {
			this._minDraft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.onMaxInput = (e) => {
			this._maxDraft.value = e && e.target ? e.target.value : "";
			this._touched.value = true;
		};
		this.onKeydown = (e) => {
			if (e && e.key === "Enter") this.applyRange(this.minDraftValue(), this.maxDraftValue());
		};
		this.onBlur = () => {
			this.applyRange(this.minDraftValue(), this.maxDraftValue());
		};
		this.minPlaceholder = () => Array.isArray(this.minMax) && this.minMax[0] != null ? String(this.minMax[0]) : "";
		this.maxPlaceholder = () => Array.isArray(this.minMax) && this.minMax[1] != null ? String(this.minMax[1]) : "";
		this.applyRange = (minDraft, maxDraft) => {
			const minNum = minDraft === "" ? void 0 : Number(minDraft);
			const maxNum = maxDraft === "" ? void 0 : Number(maxDraft);
			if (minNum === void 0 && maxNum === void 0) this.setFilter && this.setFilter(this.columnId, "");
			else this.setFilter && this.setFilter(this.columnId, [minNum, maxNum]);
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	firstUpdated() {
		this._disconnectCleanups.push(effect(() => {
			Array.isArray(this.value) && String(this.value[0]) + "" + String(this.value[1]);
			untracked(() => {
				if (this.__rozieWatchInitial_0) {
					this.__rozieWatchInitial_0 = false;
					return;
				}
				this._touched.value = false;
			});
		}));
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<span style="display:flex; align-items: center" data-rozie-s-97b2c090>
  <input class="rdt-col-filter" part="col-filter" type="number" aria-label=${rozieAttr(this.a11yLabel() + " min")} placeholder=${rozieAttr(this.minPlaceholder())} .value=${this.minDraftValue()} @input=${($event) => {
			this.onMinInput($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-s-97b2c090 />
  <span data-rozie-s-97b2c090> - </span>
  <input class="rdt-col-filter" part="col-filter" type="number" aria-label=${rozieAttr(this.a11yLabel() + " max")} placeholder=${rozieAttr(this.maxPlaceholder())} .value=${this.maxDraftValue()} @input=${($event) => {
			this.onMaxInput($event);
		}} @keydown=${($event) => {
			this.onKeydown($event);
		}} @blur=${($event) => {
			this.onBlur();
		}} data-rozie-s-97b2c090 />
</span>
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], FilterNumberRange.prototype, "columnId", void 0);
__decorate([property({ type: Object })], FilterNumberRange.prototype, "column", void 0);
__decorate([property({ type: Object })], FilterNumberRange.prototype, "value", void 0);
__decorate([property({ type: Function })], FilterNumberRange.prototype, "setFilter", void 0);
__decorate([property({ type: Object })], FilterNumberRange.prototype, "minMax", void 0);
__decorate([property({
	type: String,
	reflect: true
})], FilterNumberRange.prototype, "columnLabel", void 0);
FilterNumberRange = __decorate([customElement("rozie-filter-number-range")], FilterNumberRange);
var FilterNumberRange_default = FilterNumberRange;
//#endregion
//#region src/FilterSelect.ts
let FilterSelect = class FilterSelect extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.columnId = "";
		this.column = null;
		this.value = null;
		this.setFilter = null;
		this.uniqueValues = [];
		this.columnLabel = "";
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.selectValue = () => this.value != null ? String(this.value) : "";
		this.onChange = (e) => {
			const v = e && e.target ? e.target.value : "";
			if (v === "") this.setFilter && this.setFilter(this.columnId, "");
			else this.setFilter && this.setFilter(this.columnId, v);
		};
		this.a11yLabel = () => {
			if (typeof this.columnLabel === "string" && this.columnLabel !== "") return this.columnLabel;
			return this.columnId;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<select class="rdt-col-filter" part="col-filter" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.selectValue()} @change=${($event) => {
			this.onChange($event);
		}} data-rozie-s-d75b42b2>
  <option value="" data-rozie-s-d75b42b2>All</option>
  ${repeat(this.uniqueValues, (opt, _idx) => opt, (opt, _idx) => html`<option value=${rozieAttr(opt)} ?selected=${opt === this.selectValue()} data-rozie-s-d75b42b2>${rozieDisplay(opt)}</option>`)}
</select>
`;
	}
};
__decorate([property({
	type: String,
	reflect: true
})], FilterSelect.prototype, "columnId", void 0);
__decorate([property({ type: Object })], FilterSelect.prototype, "column", void 0);
__decorate([property({ type: Object })], FilterSelect.prototype, "value", void 0);
__decorate([property({ type: Function })], FilterSelect.prototype, "setFilter", void 0);
__decorate([property({ type: Array })], FilterSelect.prototype, "uniqueValues", void 0);
__decorate([property({
	type: String,
	reflect: true
})], FilterSelect.prototype, "columnLabel", void 0);
FilterSelect = __decorate([customElement("rozie-filter-select")], FilterSelect);
var FilterSelect_default = FilterSelect;
//#endregion
//#region src/GroupBar.ts
let GroupBar = class GroupBar extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.grouping = [];
		this.groupableColumns = [];
		this.applyGrouping = null;
		this.clearGrouping = null;
		this._draggingId = signal("");
		this._isOver = signal(false);
		this._dragKind = signal("");
		this._dropKey = signal("");
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.onChipDragStart = (e, id) => {
			this._draggingId.value = id;
			this._dragKind.value = "chip";
			if (e && e.dataTransfer) e.dataTransfer.setData("text/plain", id);
		};
		this.onTokenDragStart = (e, gk) => {
			this._draggingId.value = gk;
			this._dragKind.value = "token";
			if (e && e.dataTransfer) e.dataTransfer.setData("text/plain", gk);
		};
		this.onDragOver = (e) => {
			if (e) e.preventDefault();
			this._isOver.value = true;
		};
		this.onTokenDragOver = (e, gk) => {
			if (e) e.preventDefault();
			if (this._dragKind.value === "token") this._dropKey.value = gk;
		};
		this.onDragLeave = (e) => {
			if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
			this._isOver.value = false;
			this._dropKey.value = "";
		};
		this.resetDrag = () => {
			this._draggingId.value = "";
			this._dragKind.value = "";
			this._dropKey.value = "";
			this._isOver.value = false;
		};
		this.onDragEnd = () => {
			this.resetDrag();
		};
		this.onDrop = (e) => {
			if (e) e.preventDefault();
			const kind = this._dragKind.value;
			const anchor = this._dropKey.value;
			const id = e && e.dataTransfer && e.dataTransfer.getData("text/plain") || this._draggingId.value;
			this.resetDrag();
			if (!id) return;
			if (kind === "token") {
				if (this.grouping.indexOf(id) === -1) return;
				const without = this.grouping.filter((k) => k !== id);
				let to = without.length;
				if (anchor && anchor !== id) {
					const j = without.indexOf(anchor);
					if (j !== -1) to = j;
				}
				const next = without.slice(0, to).concat([id]).concat(without.slice(to));
				this.applyGrouping && this.applyGrouping(next);
				return;
			}
			if (this.grouping.indexOf(id) !== -1) return;
			const next = this.grouping.concat([id]);
			this.applyGrouping && this.applyGrouping(next);
		};
		this.removeKey = (key) => {
			this.applyGrouping && this.applyGrouping(this.grouping.filter((k) => k !== key));
		};
		this.clearAll = () => {
			this.clearGrouping && this.clearGrouping();
		};
		this.labelFor = (key) => {
			const col = this.groupableColumns.find((c) => c.id === key);
			return col && col.label || key;
		};
	}
	static {
		this.styles = css`
:host{display:contents}
.rdt-group-drop-zone[data-rozie-s-546c469a] {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rdt-group-bar-gap, 0.375rem);
  min-width: var(--rdt-group-drop-zone-min, 8rem);
  min-height: 1.75rem;
  padding: var(--rdt-group-drop-zone-pad, 0.1875rem 0.5rem);
  border: 1px dashed var(--rdt-group-drop-zone-border, rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-group-drop-zone-radius, 0.375rem);
  background: var(--rdt-group-drop-zone-bg, transparent);
  transition: border-color 0.12s ease, background 0.12s ease;
}
.rdt-group-drop-zone.is-over[data-rozie-s-546c469a] {
  border-color: var(--rdt-group-drop-zone-border-over, rgba(37, 99, 235, 0.7));
  background: var(--rdt-group-drop-zone-bg-over, rgba(37, 99, 235, 0.08));
}
.rdt-group-drop-hint[data-rozie-s-546c469a] {
  opacity: 0.55;
  font-size: 0.8125em;
  user-select: none;
  pointer-events: none;
}
.rdt-group-bar[data-rozie-s-546c469a] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rdt-group-bar-gap, 0.375rem);
}
.rdt-group-token-remove[data-rozie-s-546c469a] {
  display: inline-flex;
  align-items: center;
  margin-inline-start: 0.125rem;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
}
.rdt-group-token-remove[data-rozie-s-546c469a]:hover {
  opacity: 1;
}
.rdt-group-clear[data-rozie-s-546c469a] {
  cursor: pointer;
}
.rdt-group-token-remove[data-rozie-s-546c469a]:focus-visible,
.rdt-group-clear[data-rozie-s-546c469a]:focus-visible {
  outline: var(--rdt-focus-ring, 2px solid rgba(37, 99, 235, 0.7));
  outline-offset: 1px;
  border-radius: 2px;
}
.rdt-group-token.is-drop-target[data-rozie-s-546c469a] {
  box-shadow: inset 3px 0 0 0 var(--rdt-group-drop-marker, rgba(37, 99, 235, 0.9));
}
`;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<div class="rdt-group-bar" data-rozie-s-546c469a>
  
  ${repeat(this.groupableColumns, (col, _idx) => col.id, (col, _idx) => html`<span class="rdt-group-token" part="group-token" draggable="true" @dragstart=${($event) => {
			this.onChipDragStart($event, col.id);
		}} @dragend=${($event) => {
			this.onDragEnd();
		}} data-rozie-s-546c469a>${rozieDisplay(col.label)}</span>`)}

  
  <span class="${Object.entries({
			"rdt-group-drop-zone": true,
			"is-over": this._isOver.value
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" data-group-drop-zone="" @dragover=${($event) => {
			this.onDragOver($event);
		}} @dragleave=${($event) => {
			this.onDragLeave($event);
		}} @drop=${($event) => {
			this.onDrop($event);
		}} data-rozie-s-546c469a>
    
    ${!this.grouping.length ? html`<span class="rdt-group-drop-hint" data-rozie-s-546c469a>Drag columns here to group</span>` : nothing}${repeat(this.grouping, (gk, _idx) => gk, (gk, _idx) => html`<span class="${Object.entries({
			"rdt-group-token": true,
			"is-drop-target": this._dragKind.value === "token" && this._dropKey.value === gk && this._draggingId.value !== gk
		}).filter(([, v]) => v).map(([k]) => k).join(" ")}" part="group-token" data-group-token="" draggable="true" @dragstart=${($event) => {
			this.onTokenDragStart($event, gk);
		}} @dragover=${($event) => {
			this.onTokenDragOver($event, gk);
		}} @dragend=${($event) => {
			this.onDragEnd();
		}} data-rozie-s-546c469a>
      ${rozieDisplay(this.labelFor(gk))}
      <button class="rdt-group-token-remove" type="button" aria-label=${rozieAttr("Remove " + this.labelFor(gk) + " grouping")} @click=${($event) => {
			this.removeKey(gk);
		}} data-rozie-s-546c469a>×</button>
    </span>`)}
  </span>

  
  ${this.grouping.length ? html`<button class="rdt-group-clear" type="button" @click=${($event) => {
			this.clearAll();
		}} data-rozie-s-546c469a>Clear</button>` : nothing}</div>
`;
	}
};
__decorate([property({ type: Array })], GroupBar.prototype, "grouping", void 0);
__decorate([property({ type: Array })], GroupBar.prototype, "groupableColumns", void 0);
__decorate([property({ type: Function })], GroupBar.prototype, "applyGrouping", void 0);
__decorate([property({ type: Function })], GroupBar.prototype, "clearGrouping", void 0);
GroupBar = __decorate([customElement("rozie-group-bar")], GroupBar);
var GroupBar_default = GroupBar;
//#endregion
//#region src/DetailPanel.ts
let DetailPanel = class DetailPanel extends SignalWatcher(LitElement) {
	constructor(..._args) {
		super(..._args);
		this.row = null;
		this._disconnectCleanups = [];
		this._rozieTornDown = false;
		this.entries = () => {
			const r = this.row;
			if (!r) return [];
			return Object.keys(r).map((key) => ({
				key,
				value: r[key] == null ? "" : String(r[key])
			}));
		};
	}
	static {
		this.styles = css`
:host{display:contents}
`;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		queueMicrotask(() => {
			if (this.isConnected || this._rozieTornDown) return;
			this._rozieTornDown = true;
			for (const fn of this._disconnectCleanups) fn();
			this._disconnectCleanups = [];
		});
	}
	render() {
		return html`
<dl class="rdt-detail-panel" data-rozie-s-8f65bdaa>
  
  ${repeat(this.entries(), (pair, _idx) => pair.key, (pair, _idx) => html`<div class="rdt-detail-entry" data-rozie-s-8f65bdaa>
    <dt class="rdt-detail-key" data-rozie-s-8f65bdaa>${rozieDisplay(pair.key)}</dt>
    <dd class="rdt-detail-value" data-rozie-s-8f65bdaa>${rozieDisplay(pair.value)}</dd>
  </div>`)}
</dl>
`;
	}
};
__decorate([property({ type: Object })], DetailPanel.prototype, "row", void 0);
DetailPanel = __decorate([customElement("rozie-detail-panel")], DetailPanel);
var DetailPanel_default = DetailPanel;
//#endregion
export { Column_default as Column, DataTable_default as DataTable, DataTable_default as default, DetailPanel_default as DetailPanel, EditorCheckbox_default as EditorCheckbox, EditorDate_default as EditorDate, EditorNumber_default as EditorNumber, EditorSelect_default as EditorSelect, EditorText_default as EditorText, FilterNumberRange_default as FilterNumberRange, FilterSelect_default as FilterSelect, FilterText_default as FilterText, GroupBar_default as GroupBar };
