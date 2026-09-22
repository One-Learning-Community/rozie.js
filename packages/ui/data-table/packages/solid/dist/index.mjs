import { Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from "solid-js";
import { Key } from "@solid-primitives/keyed";
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieContext, rozieDisplay } from "@rozie/runtime-solid";
import Popover from "@rozie-ui/popover-solid";
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
//#region src/DataTable.tsx
__rozieInjectStyle("DataTable-d5dcab4c", `[data-rozie-s-d5dcab4c]:host {
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
}`);
function DataTable(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columns: [],
		selectionMode: "none",
		manual: false,
		rowCount: null,
		pageCount: null,
		expandable: false,
		getSubRows: null,
		groupable: false,
		stickyHeader: false,
		interactionMode: "table",
		singleClickEdit: false,
		undoable: false,
		undoLimit: 100,
		virtual: false,
		estimateRowHeight: 40,
		autoMeasure: false,
		maxHeight: ""
	}, _props), [
		"data",
		"columns",
		"selectionMode",
		"sorting",
		"globalFilter",
		"columnFilters",
		"pagination",
		"manual",
		"rowCount",
		"pageCount",
		"expandable",
		"expanded",
		"getSubRows",
		"groupable",
		"grouping",
		"rowSelection",
		"columnVisibility",
		"columnSizing",
		"columnOrder",
		"columnPinning",
		"stickyHeader",
		"interactionMode",
		"singleClickEdit",
		"undoable",
		"undoLimit",
		"virtual",
		"estimateRowHeight",
		"autoMeasure",
		"maxHeight",
		"children",
		"ref",
		"onSortChange",
		"onExpandChange",
		"onGroupChange",
		"onFilterChange",
		"onPageChange",
		"onSelectionChange",
		"onVisibilityChange",
		"onResizeChange",
		"onReorderChange",
		"onPinChange",
		"onHistoryChange",
		"onActivecellChange",
		"onRangeChange",
		"onCellEditCommit",
		"onRowEditCommit"
	]);
	const resolved = () => local.children;
	onMount(() => {
		local.ref?.({
			sortColumn,
			clearSorting,
			toggleRowExpanded,
			expandAll,
			collapseAll,
			getExpandedRows,
			applyGrouping,
			clearGrouping,
			getFacetedUniqueValues: getFacetedUniqueValues$1,
			getFacetedMinMaxValues: getFacetedMinMaxValues$1,
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
	});
	const __ctx_data_table_columns = rozieContext("data-table:columns");
	const [data, setData] = createControllableSignal(_props, "data", []);
	const [sorting, setSorting] = createControllableSignal(_props, "sorting", []);
	const [globalFilter, setGlobalFilter] = createControllableSignal(_props, "globalFilter", "");
	const [columnFilters, setColumnFilters] = createControllableSignal(_props, "columnFilters", []);
	const [pagination, setPagination] = createControllableSignal(_props, "pagination", {
		pageIndex: 0,
		pageSize: 10
	});
	const [expanded, setExpanded] = createControllableSignal(_props, "expanded", null);
	const [grouping, setGrouping] = createControllableSignal(_props, "grouping", null);
	const [rowSelection, setRowSelection] = createControllableSignal(_props, "rowSelection", {});
	const [columnVisibility, setColumnVisibility] = createControllableSignal(_props, "columnVisibility", {});
	const [columnSizing, setColumnSizing] = createControllableSignal(_props, "columnSizing", {});
	const [columnOrder, setColumnOrder] = createControllableSignal(_props, "columnOrder", []);
	const [columnPinning, setColumnPinning] = createControllableSignal(_props, "columnPinning", {
		left: [],
		right: []
	});
	const [dataDefault, setDataDefault] = createSignal([]);
	const [sortingDefault, setSortingDefault] = createSignal([]);
	const [globalFilterDefault, setGlobalFilterDefault] = createSignal("");
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
	const [activeInControl, setActiveInControl] = createSignal(false);
	const [editingRow, setEditingRow] = createSignal(-1);
	const [editingCol, setEditingCol] = createSignal(-1);
	const [draftValue, setDraftValue] = createSignal(null);
	const [invalidMsg, setInvalidMsg] = createSignal("");
	const [editVer, setEditVer] = createSignal(0);
	const [editFocusColId, setEditFocusColId] = createSignal(null);
	const [editingRowIndex, setEditingRowIndex] = createSignal(null);
	const [rowDraft, setRowDraft] = createSignal({});
	const [rangeAnchor, setRangeAnchor] = createSignal(null);
	const [rangeFocus, setRangeFocus] = createSignal(null);
	const [pasteAnnounce, setPasteAnnounce] = createSignal("");
	const [rangeAnnounce, setRangeAnnounce] = createSignal("");
	const [liveAnnounce, setLiveAnnounce] = createSignal("");
	onMount(() => {
		setDataDefault(data() || []);
		seedColumnPinning();
		table = createTable({
			data: currentData(),
			columns: tableColumns(),
			state: currentState(),
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			getExpandedRowModel: getExpandedRowModel(),
			getSubRows: local.getSubRows || void 0,
			getRowCanExpand: local.expandable === true && local.getSubRows == null ? () => true : void 0,
			onExpandedChange: onExpandedChangeCb,
			autoResetExpanded: false,
			getGroupedRowModel: getGroupedRowModel(),
			onGroupingChange: onGroupingChangeCb,
			getFacetedRowModel: getFacetedRowModel(),
			getFacetedUniqueValues: getFacetedUniqueValues(),
			getFacetedMinMaxValues: getFacetedMinMaxValues(),
			manualPagination: local.manual === true,
			manualFiltering: local.manual === true,
			manualSorting: local.manual === true,
			rowCount: local.rowCount ?? void 0,
			pageCount: local.pageCount ?? void 0,
			enableRowSelection: local.selectionMode !== "none",
			enableMultiRowSelection: local.selectionMode === "multiple",
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
			columnResizeMode: "onChange",
			enableColumnResizing: true,
			renderFallbackValue: null,
			onStateChange: () => {}
		});
		refreshRowModel = () => {
			if (!table) return;
			const nextRows = windowSource().slice();
			const nextGroups = table.getHeaderGroups().slice();
			setRows(nextRows);
			setHeaderGroups(nextGroups);
			setRowModelVer(rowModelVer() + 1);
			if (rowsWindowed() && virtualizer) {
				virtualizer.setOptions(virtualizerOptions());
				virtualizer._willUpdate();
			}
			remeasureColumnWindow();
			const nextRowCount = nextRows.length;
			clampActiveCell(nextRowCount, nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0);
			const pgState = table.getState().pagination;
			const pc = table.getPageCount();
			if (pc > 0 && pgState.pageIndex > pc - 1) writePagination({
				pageIndex: pc - 1,
				pageSize: pgState.pageSize
			});
			if (pendingEditFollow && isGrid()) {
				const follow = pendingEditFollow;
				pendingEditFollow = null;
				const followIdx = indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
				if (followIdx >= 0) focusCellWhenReady(followIdx, follow.col);
			}
			syncIndeterminate();
			if (typeof queueMicrotask !== "undefined") queueMicrotask(syncIndeterminate);
			else Promise.resolve().then(syncIndeterminate);
		};
		refreshRowModel();
		gridRoot = __rozieRootRef ? __rozieRootRef.querySelector(".rozie-data-table") : null;
		if (typeof document !== "undefined") {
			docPointerDown = (ev) => {
				if (!gridRoot) {
					outsidePointerDown = false;
					return;
				}
				const path = ev && typeof ev.composedPath === "function" ? ev.composedPath() : null;
				outsidePointerDown = !(path ? path.indexOf(gridRoot) !== -1 : !!(ev && ev.target && gridRoot.contains && gridRoot.contains(ev.target)));
			};
			document.addEventListener("pointerdown", docPointerDown, true);
		}
		if (isWindowed()) gridScrollEl = __rozieRootRef ? __rozieRootRef.querySelector(".rdt-scroll") : null;
		if (rowsWindowed()) {
			virtualizer = new Virtualizer(virtualizerOptions());
			virtualizerCleanup = virtualizer._didMount();
		}
		if (colsWindowed()) {
			colVirtualizer = new Virtualizer(columnVirtualizerOptions());
			colVirtualizerCleanup = colVirtualizer._didMount();
		}
		if (isWindowed()) setWindowVer(windowVer() + 1);
		if (isWindowed()) {
			const afterFirstFrame = () => {
				if (rowsWindowed()) {
					remeasureWindow();
					if (!(gridScrollEl ? gridScrollEl.clientHeight : 0)) console.warn("[rozie-data-table] virtual is on but the scroll container has no bounded height; set maxHeight or --rozie-data-table-max-height");
					const pg = pagination();
					const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
					if (local.manual !== true && pgConfigured) console.warn("[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.");
				}
				if (colsWindowed()) {
					if (!(gridScrollEl ? gridScrollEl.clientWidth : 0)) console.warn("[rozie-data-table] virtual is on for columns but the scroll container has no bounded width; set a CSS width on an ancestor so the column window can be measured");
					bumpWindowVer();
				}
			};
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));
			else setTimeout(afterFirstFrame, 0);
		}
		announceState.sorting = effectiveSorting();
		announceState.columnFilters = effectiveColumnFilters();
		announceState.globalFilter = effectiveGlobalFilter();
	});
	onCleanup(() => {
		if (docPointerDown && typeof document !== "undefined") {
			document.removeEventListener("pointerdown", docPointerDown, true);
			docPointerDown = null;
		}
		if (virtualizerCleanup) virtualizerCleanup();
		if (colVirtualizerCleanup) colVirtualizerCleanup();
		teardownColRtlWatch();
		teardownRemeasure();
		teardownFillDrag();
		teardownRangeDrag();
	});
	createEffect(() => {
		maybeClearHistoryOnExternalSwap();
		remeasureColumnSizes();
		if (!table) return;
		const d = currentData() || [];
		if (d === lastData && d.length === lastDataLen) return;
		lastData = d;
		lastDataLen = d.length;
		reFeed();
	});
	createEffect(on(() => [
		sorting(),
		globalFilter(),
		columnFilters(),
		pagination(),
		local.rowCount,
		local.pageCount,
		rowSelection(),
		expanded(),
		local.expandable,
		grouping(),
		local.groupable,
		columnVisibility(),
		columnSizing(),
		columnOrder(),
		columnPinning(),
		local.selectionMode,
		(data() || []).length,
		data(),
		dataDefault(),
		local.columns,
		colReg()
	], (v) => untrack(() => (() => {
		seedColumnPinning();
		reFeed();
		maybeClearHistoryOnExternalSwap();
	})()), { defer: true }));
	createEffect(on(() => [
		sorting(),
		columnFilters(),
		globalFilter(),
		sortingDefault(),
		columnFiltersDefault(),
		globalFilterDefault()
	], (v) => untrack(() => (() => {
		const msg = buildSortFilterAnnounce();
		if (msg) setLiveAnnounce(msg);
	})()), { defer: true }));
	let __rozieRootRef = null;
	let table = null;
	let virtualizer = null;
	let virtualizerCleanup = null;
	let gridScrollEl = null;
	let colVirtualizer = null;
	let colVirtualizerCleanup = null;
	let remeasurePending = false;
	let remeasureRaf = null;
	let remeasureDisposed = false;
	const GRID_PAGE_STEP = 10;
	let gridRoot = null;
	let outsidePointerDown = false;
	let docPointerDown = null;
	let programmatic = 0;
	let focusIntentEpoch = 0;
	const DATA_WRITE_TOKEN_KEY = "__rozieDataWriteToken";
	let undoStack = [];
	let redoStack = [];
	let restoringHistory = false;
	let expandedTouched = false;
	function groupingActiveDefault() {
		return ((grouping() != null ? grouping() : groupingDefault()) || []).length > 0;
	}
	function effectiveColumnPinning() {
		const base = columnPinning() != null ? columnPinning() : columnPinningDefault();
		const rail = [];
		if (selectionEnabled()) rail.push(SELECT_COL_ID);
		if (local.expandable === true) rail.push(EXPANDER_COL_ID);
		if (rail.length === 0) return base;
		const deduped = (base && base.left ? base.left : []).filter((id) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID);
		return {
			...base,
			left: rail.concat(deduped)
		};
	}
	let pinSeedApplied = false;
	function seedColumnPinning() {
		if (pinSeedApplied) return;
		const live = columnPinning() != null ? columnPinning() : columnPinningDefault();
		const isRealPin = (id) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID;
		if ((live && live.left ? live.left : []).filter(isRealPin).length > 0 || (live && live.right ? live.right : []).filter(isRealPin).length > 0) {
			pinSeedApplied = true;
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
		pinSeedApplied = true;
		const seeded = {
			left,
			right
		};
		setColumnPinningDefault(seeded);
		setColumnPinning(seeded);
	}
	function currentState() {
		return {
			sorting: sorting() != null ? sorting() : sortingDefault(),
			globalFilter: globalFilter() != null ? globalFilter() : globalFilterDefault(),
			columnFilters: columnFilters() != null ? columnFilters() : columnFiltersDefault(),
			pagination: pagination() != null ? pagination() : paginationDefault(),
			rowSelection: rowSelection() != null ? rowSelection() : rowSelectionDefault(),
			expanded: expanded() != null ? expanded() : groupingActiveDefault() && !expandedTouched ? true : expandedDefault(),
			grouping: grouping() != null ? grouping() : groupingDefault(),
			columnVisibility: columnVisibility() != null ? columnVisibility() : columnVisibilityDefault(),
			columnSizing: columnSizing() != null ? columnSizing() : columnSizingDefault(),
			columnOrder: columnOrder() != null ? columnOrder() : columnOrderDefault(),
			columnPinning: effectiveColumnPinning(),
			columnSizingInfo: columnSizingInfo()
		};
	}
	function currentData() {
		return data() != null ? data() : dataDefault();
	}
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
	const editorWarned = Object.create(null);
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
	let columnDefsCache = null;
	let columnDefsCacheColumnsRef = void 0;
	let columnDefsCacheColRegRef = void 0;
	let columnDefsIndexCache = null;
	function columnDefs() {
		const cfg = local.columns || [];
		const reg = colReg() || {};
		if (columnDefsCache && local.columns === columnDefsCacheColumnsRef && colReg() === columnDefsCacheColRegRef) return columnDefsCache;
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
		columnDefsCache = out;
		columnDefsCacheColumnsRef = local.columns;
		columnDefsCacheColRegRef = colReg();
		columnDefsIndexCache = indexDefsById(out);
		return out;
	}
	function defIndex() {
		columnDefs();
		return columnDefsIndexCache || Object.create(null);
	}
	const SELECT_COL_ID = "__rdt_select";
	const EXPANDER_COL_ID = "__rdt_expander";
	function selectionEnabled() {
		return local.selectionMode === "single" || local.selectionMode === "multiple";
	}
	function tableColumns() {
		const cols = columnDefs();
		let withExpander = cols;
		if (local.expandable === true) withExpander = [{
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
	}
	function writeSorting(next) {
		if (programmatic) return;
		programmatic++;
		setSortingDefault(next);
		setSorting(next);
		_props.onSortChange?.(next);
		programmatic--;
	}
	function writeExpanded(next) {
		if (programmatic) return;
		programmatic++;
		expandedTouched = true;
		setExpandedDefault(next);
		setExpanded(next);
		_props.onExpandChange?.(next);
		programmatic--;
	}
	function writeGrouping(next) {
		if (programmatic) return;
		programmatic++;
		setGroupingDefault(next);
		setGrouping(next);
		_props.onGroupChange?.(next);
		programmatic--;
	}
	function writeGlobalFilter(next) {
		if (programmatic) return;
		programmatic++;
		setGlobalFilterDefault(next);
		setGlobalFilter(next);
		_props.onFilterChange?.({ globalFilter: next });
		programmatic--;
	}
	function writeColumnFilters(next) {
		if (programmatic) return;
		programmatic++;
		setColumnFiltersDefault(next);
		setColumnFilters(next);
		_props.onFilterChange?.({ columnFilters: next });
		programmatic--;
	}
	function writePagination(next) {
		if (programmatic) return;
		programmatic++;
		setPaginationDefault(next);
		setPagination(next);
		_props.onPageChange?.(next);
		programmatic--;
	}
	function writeRowSelection(next) {
		if (programmatic) return;
		programmatic++;
		setRowSelectionDefault(next);
		setRowSelection(next);
		_props.onSelectionChange?.(next);
		programmatic--;
	}
	function writeColumnVisibility(next) {
		if (programmatic) return;
		programmatic++;
		setColumnVisibilityDefault(next);
		setColumnVisibility(next);
		_props.onVisibilityChange?.(next);
		programmatic--;
	}
	function writeColumnSizing(next) {
		if (programmatic) return;
		programmatic++;
		setColumnSizingDefault(next);
		setColumnSizing(next);
		_props.onResizeChange?.(next);
		programmatic--;
	}
	function writeColumnOrder(next) {
		if (programmatic) return;
		programmatic++;
		setColumnOrderDefault(next);
		setColumnOrder(next);
		_props.onReorderChange?.(next);
		programmatic--;
	}
	function writeColumnPinning(next) {
		if (programmatic) return;
		const strip = (ids) => (ids || []).filter((id) => id !== SELECT_COL_ID && id !== EXPANDER_COL_ID);
		const clean = {
			...next,
			left: strip(next && next.left),
			right: strip(next && next.right)
		};
		programmatic++;
		setColumnPinningDefault(clean);
		setColumnPinning(clean);
		_props.onPinChange?.(clean);
		programmatic--;
	}
	function writeData(next) {
		if (programmatic) return;
		if (local.undoable && !restoringHistory) {
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
		programmatic++;
		setDataDefault(fresh);
		setData(fresh);
		programmatic--;
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
		undoStack.push(current);
		const limit = local.undoLimit != null ? local.undoLimit : 100;
		while (undoStack.length > limit) undoStack.shift();
		redoStack = [];
	}
	function canUndo() {
		return undoStack.length > 0;
	}
	function canRedo() {
		return redoStack.length > 0;
	}
	function clearHistory() {
		undoStack = [];
		redoStack = [];
	}
	function emitHistoryChange() {
		_props.onHistoryChange?.({
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
		const prev = undoStack.pop();
		redoStack.push(currentData());
		restoringHistory = true;
		writeData(prev);
		restoringHistory = false;
		emitHistoryChange();
	}
	function redo() {
		if (!canRedo()) return;
		const next = redoStack.pop();
		undoStack.push(currentData());
		restoringHistory = true;
		writeData(next);
		restoringHistory = false;
		emitHistoryChange();
	}
	let refreshRowModel = null;
	function onSortingChangeCb(updater) {
		writeSorting(applyUpdater(updater, currentState().sorting));
	}
	function onExpandedChangeCb(updater) {
		writeExpanded(applyUpdater(updater, currentState().expanded));
	}
	function onGroupingChangeCb(updater) {
		writeGrouping(applyUpdater(updater, currentState().grouping));
	}
	function onGlobalFilterChangeCb(updater) {
		writeGlobalFilter(applyUpdater(updater, currentState().globalFilter));
	}
	function onColumnFiltersChangeCb(updater) {
		writeColumnFilters(applyUpdater(updater, currentState().columnFilters));
	}
	function onPaginationChangeCb(updater) {
		writePagination(applyUpdater(updater, currentState().pagination));
	}
	function onRowSelectionChangeCb(updater) {
		writeRowSelection(applyUpdater(updater, currentState().rowSelection));
	}
	function onColumnVisibilityChangeCb(updater) {
		writeColumnVisibility(applyUpdater(updater, currentState().columnVisibility));
	}
	function onColumnSizingChangeCb(updater) {
		writeColumnSizing(applyUpdater(updater, currentState().columnSizing));
	}
	function onColumnOrderChangeCb(updater) {
		writeColumnOrder(applyUpdater(updater, currentState().columnOrder));
	}
	function onColumnPinningChangeCb(updater) {
		writeColumnPinning(applyUpdater(updater, currentState().columnPinning));
	}
	let columnSizingInfoSync = null;
	function onColumnSizingInfoChangeCb(updater) {
		const next = applyUpdater(updater, columnSizingInfoSync != null ? columnSizingInfoSync : columnSizingInfo());
		if (next == null) return;
		columnSizingInfoSync = next;
		setColumnSizingInfo(next);
	}
	function resolveVirtual() {
		const v = local.virtual;
		if (typeof v === "string") {
			if (v === "rows") return "rows";
			if (v === "columns") return "columns";
			if (v === "both") return "both";
			return "off";
		}
		return v === true ? "rows" : "off";
	}
	function rowsWindowed() {
		const s = resolveVirtual();
		return s === "rows" || s === "both";
	}
	function colsWindowed() {
		const s = resolveVirtual();
		return s === "columns" || s === "both";
	}
	function isWindowed() {
		return rowsWindowed() || colsWindowed();
	}
	function autoMeasureOn() {
		return local.autoMeasure === true;
	}
	function columnCount() {
		return visibleColCount();
	}
	function columnSize(i) {
		if (!table || !table.getVisibleLeafColumns) return 150;
		const c = table.getVisibleLeafColumns()[i];
		return c && typeof c.getSize === "function" ? c.getSize() : 150;
	}
	function forcedColumns() {
		if (!colsWindowed()) return [];
		const out = [];
		if (table && table.getVisibleLeafColumns) {
			const cols = table.getVisibleLeafColumns();
			for (let i = 0; i < cols.length; i++) {
				const c = cols[i];
				if (c && c.getIsPinned && c.getIsPinned()) out.push(i);
			}
		}
		if (!activeIsHeader() && activeColIndex() >= 0 && out.indexOf(activeColIndex()) === -1) out.push(activeColIndex());
		if (editingRow() >= 0 && editingCol() >= 0 && out.indexOf(editingCol()) === -1) out.push(editingCol());
		return out;
	}
	function windowedCells(row) {
		windowVer();
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
	function windowSource() {
		if (!table) return [];
		if (rowsWindowed()) return table.getPrePaginationRowModel().rows;
		return table.getRowModel().rows;
	}
	function scheduleRemeasure() {
		if (remeasureDisposed) return;
		if (remeasurePending) return;
		remeasurePending = true;
		let ranMicro = false;
		const microPass = () => {
			remeasureWindow();
		};
		const rafPass = () => {
			remeasureRaf = null;
			remeasurePending = false;
			remeasureWindow();
		};
		if (typeof queueMicrotask !== "undefined") {
			ranMicro = true;
			queueMicrotask(microPass);
		}
		if (typeof requestAnimationFrame === "function") remeasureRaf = requestAnimationFrame(rafPass);
		else if (ranMicro) remeasurePending = false;
		else remeasureRaf = setTimeout(rafPass, 0);
	}
	function teardownRemeasure() {
		remeasureDisposed = true;
		if (remeasureRaf != null) {
			if (typeof requestAnimationFrame === "function") cancelAnimationFrame(remeasureRaf);
			else clearTimeout(remeasureRaf);
			remeasureRaf = null;
		}
		remeasurePending = false;
	}
	function pinnedEditIndex() {
		if (editingRow() >= 0) return editingRow();
		if (editingRowIndex() != null) return editingRowIndex();
		return -1;
	}
	function pinnedMeasurement(pin) {
		if (!virtualizer || pin < 0) return null;
		const ms = virtualizer.getMeasurements();
		return ms && ms[pin] ? ms[pin] : null;
	}
	function remeasureWindow() {
		if (remeasureDisposed) return;
		if (!virtualizer || !gridRoot) return;
		if (virtualizer.scrollState) return;
		const trs = gridRoot.querySelectorAll("tbody.rdt-tbody > tr[data-index]");
		for (const tr of trs) virtualizer.measureElement(tr);
		if (afterRowRemeasure) afterRowRemeasure();
	}
	function virtualItemKey(i) {
		const src = windowSource();
		return src && src[i] ? src[i].id : void 0;
	}
	const COL_OVERSCAN = 3;
	let colRtlObserver = null;
	let colRtlObserverEl = null;
	function isColRtl() {
		if (!gridScrollEl || typeof getComputedStyle !== "function") return false;
		return getComputedStyle(gridScrollEl).direction === "rtl";
	}
	function ensureColRtlWatch() {
		if (!gridScrollEl || colRtlObserverEl === gridScrollEl || typeof MutationObserver !== "function") return;
		if (colRtlObserver) colRtlObserver.disconnect();
		colRtlObserver = new MutationObserver(() => {
			if (colVirtualizer) colVirtualizer.setOptions({
				...colVirtualizer.options,
				isRtl: isColRtl()
			});
		});
		colRtlObserver.observe(gridScrollEl, {
			attributes: true,
			attributeFilter: ["dir"]
		});
		colRtlObserverEl = gridScrollEl;
	}
	function teardownColRtlWatch() {
		if (colRtlObserver) colRtlObserver.disconnect();
		colRtlObserver = null;
		colRtlObserverEl = null;
	}
	function columnVirtualizerOptions() {
		ensureColRtlWatch();
		return {
			count: columnCount(),
			getScrollElement: () => gridScrollEl,
			estimateSize: (i) => columnSize(i),
			horizontal: true,
			isRtl: isColRtl(),
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			measureElement,
			overscan: COL_OVERSCAN,
			onChange: () => {
				setWindowVer(windowVer() + 1);
			}
		};
	}
	let measuredRowTotal = 0;
	let measuredRowCount = 0;
	let lastFedRowEstimate = 0;
	let foldedRowHeights = {};
	let windowVerBumpPending = false;
	function bumpWindowVer() {
		if (windowVerBumpPending) return;
		windowVerBumpPending = true;
		const flush = () => {
			windowVerBumpPending = false;
			setWindowVer(windowVer() + 1);
		};
		if (typeof queueMicrotask !== "undefined") queueMicrotask(flush);
		else setTimeout(flush, 0);
	}
	const ESTIMATE_REFEED_DELTA_PX = 4;
	function estimateRowSize(i) {
		if (!autoMeasureOn()) return local.estimateRowHeight;
		if (measuredRowCount === 0) return local.estimateRowHeight;
		return Math.round(measuredRowTotal / measuredRowCount);
	}
	function foldMeasuredRow(index, height) {
		const prev = foldedRowHeights[index];
		if (prev === height) return;
		if (prev == null) {
			measuredRowTotal = measuredRowTotal + height;
			measuredRowCount = measuredRowCount + 1;
		} else measuredRowTotal = measuredRowTotal - prev + height;
		foldedRowHeights[index] = height;
	}
	function refineRowEstimate() {
		if (!autoMeasureOn() || !virtualizer) return;
		const items = virtualizer.getVirtualItems();
		const measurements = virtualizer.getMeasurements();
		for (let i = 0; i < items.length; i++) {
			const idx = items[i].index;
			const m = measurements && measurements[idx];
			if (m) foldMeasuredRow(idx, m.size);
		}
		if (virtualizer.scrollState) return;
		const est = estimateRowSize(0);
		if (Math.abs(est - lastFedRowEstimate) < ESTIMATE_REFEED_DELTA_PX) return;
		const anchorIndex = items.length ? items[0].index : -1;
		const anchorStart = items.length ? items[0].start : 0;
		virtualizer.setOptions(virtualizerOptions());
		virtualizer._willUpdate();
		lastFedRowEstimate = est;
		if (anchorIndex >= 0 && gridScrollEl) {
			const freshMeasurements = virtualizer.getMeasurements();
			const fresh = freshMeasurements && freshMeasurements[anchorIndex];
			if (fresh) {
				const delta = fresh.start - anchorStart;
				if (delta !== 0) gridScrollEl.scrollTop = gridScrollEl.scrollTop + delta;
			}
		}
		bumpWindowVer();
	}
	function virtualizerOptions() {
		return {
			count: windowSource().length,
			getScrollElement: () => gridScrollEl,
			estimateSize: (i) => estimateRowSize(i),
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			measureElement,
			overscan: 8,
			getItemKey: virtualItemKey,
			onChange: () => {
				bumpWindowVer();
				scheduleRemeasure();
			}
		};
	}
	function pinMeasurement(pin) {
		return pinnedMeasurement(pin);
	}
	function windowedRows() {
		windowVer();
		editVer();
		if (!virtualizer) {
			if (!rowsWindowed()) return (rows() || []).map((r, i) => ({
				vi: { index: i },
				row: r
			}));
			return [];
		}
		const items = virtualizer.getVirtualItems();
		const rowList = rows() || [];
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
		windowVer();
		editVer();
		if (!rowsWindowed() || !virtualizer) return 0;
		const items = virtualizer.getVirtualItems();
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
		windowVer();
		editVer();
		if (!rowsWindowed() || !virtualizer) return 0;
		const items = virtualizer.getVirtualItems();
		if (!items.length) return 0;
		let pad = virtualizer.getTotalSize() - items[items.length - 1].end;
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
		if (!rowsWindowed() || !virtualizer) return false;
		const items = virtualizer.getVirtualItems();
		for (const it of items) if (it.index === r) return false;
		return true;
	}
	function windowedColIndices() {
		windowVer();
		editVer();
		if (!colsWindowed()) {
			const n = columnCount();
			const out = [];
			for (let i = 0; i < n; i++) out.push(i);
			return out;
		}
		if (!colVirtualizer) return [];
		const idx = colVirtualizer.getVirtualItems().map((it) => it.index);
		const forced = forcedColumns();
		for (let i = 0; i < forced.length; i++) if (idx.indexOf(forced[i]) === -1) idx.push(forced[i]);
		idx.sort((a, b) => a - b);
		return idx;
	}
	function colPadLeft() {
		windowVer();
		editVer();
		if (!colsWindowed() || !colVirtualizer) return 0;
		const items = colVirtualizer.getVirtualItems();
		let pad = items.length ? items[0].start : 0;
		if (items.length) {
			const firstIdx = items[0].index;
			const forced = forcedColumns();
			for (let i = 0; i < forced.length; i++) if (forced[i] < firstIdx) pad = pad - columnSize(forced[i]);
		}
		return pad < 0 ? 0 : pad;
	}
	function colPadRight() {
		windowVer();
		editVer();
		if (!colsWindowed() || !colVirtualizer) return 0;
		const items = colVirtualizer.getVirtualItems();
		if (!items.length) return 0;
		let pad = colVirtualizer.getTotalSize() - items[items.length - 1].end;
		const lastIdx = items[items.length - 1].index;
		const forced = forcedColumns();
		for (let i = 0; i < forced.length; i++) if (forced[i] > lastIdx) pad = pad - columnSize(forced[i]);
		return pad < 0 ? 0 : pad;
	}
	function colIsOutsideWindow(c) {
		if (!colsWindowed() || !colVirtualizer) return false;
		const items = colVirtualizer.getVirtualItems();
		for (const it of items) if (it.index === c) return false;
		return true;
	}
	let afterRowRemeasure = refineRowEstimate;
	const announceState = {
		sorting: null,
		columnFilters: null,
		globalFilter: null
	};
	function effectiveSorting() {
		return sorting() != null ? sorting() : sortingDefault();
	}
	function effectiveColumnFilters() {
		return columnFilters() != null ? columnFilters() : columnFiltersDefault();
	}
	function effectiveGlobalFilter() {
		return globalFilter() != null ? globalFilter() : globalFilterDefault();
	}
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
	function reFeed() {
		if (!table) return;
		table.setOptions((prev) => ({
			...prev,
			data: currentData(),
			columns: tableColumns(),
			state: currentState(),
			enableRowSelection: local.selectionMode !== "none",
			enableMultiRowSelection: local.selectionMode === "multiple",
			rowCount: local.rowCount ?? void 0,
			pageCount: local.pageCount ?? void 0,
			getExpandedRowModel: getExpandedRowModel(),
			getSubRows: local.getSubRows || void 0,
			getRowCanExpand: local.expandable === true && local.getSubRows == null ? () => true : void 0,
			onExpandedChange: onExpandedChangeCb,
			autoResetExpanded: false,
			getGroupedRowModel: getGroupedRowModel(),
			onGroupingChange: onGroupingChangeCb,
			getFacetedRowModel: getFacetedRowModel(),
			getFacetedUniqueValues: getFacetedUniqueValues(),
			getFacetedMinMaxValues: getFacetedMinMaxValues(),
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
	let lastPropsData = null;
	function maybeClearHistoryOnExternalSwap() {
		const pd = data();
		if (pd === lastPropsData) return;
		lastPropsData = pd;
		if (!local.undoable) return;
		if (pd != null && pd[DATA_WRITE_TOKEN_KEY] != null) return;
		clearHistory();
	}
	let lastData = null;
	let lastDataLen = -1;
	function onHeaderSort(colId, evt) {
		if (!table) return;
		const col = table.getColumn(colId);
		if (!col || !col.getCanSort()) return;
		const multi = !!(evt && evt.shiftKey);
		col.toggleSorting(void 0, multi);
	}
	function tick() {
		return rowModelVer();
	}
	function ariaSortFor(colId) {
		if (tick() < 0 || !table) return "none";
		const col = table.getColumn(colId);
		if (!col) return "none";
		const dir = col.getIsSorted();
		if (dir === "asc") return "ascending";
		if (dir === "desc") return "descending";
		return "none";
	}
	function sortIndicator(colId) {
		if (tick() < 0 || !table) return "";
		const col = table.getColumn(colId);
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
		return rowModelVer() >= 0 ? row.getVisibleCells() : [];
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
	function onResizeStart(colId, evt) {
		if (evt && evt.stopPropagation) evt.stopPropagation();
		if (!table) return;
		const header = findHeader(colId);
		if (!header || !header.getResizeHandler) return;
		const handler = header.getResizeHandler();
		if (handler) handler(evt);
	}
	function findHeader(colId) {
		const groups = headerGroups() || [];
		for (const hg of groups) {
			const hs = hg.headers || [];
			for (const h of hs) if (h && h.column && h.column.id === colId) return h;
		}
		return null;
	}
	function columnIsResizing(colId) {
		if (tick() < 0 || !table) return false;
		const header = findHeader(colId);
		return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
	}
	function onToggleVisibility(colId) {
		if (!table) return;
		const col = table.getColumn(colId);
		if (col && col.toggleVisibility) col.toggleVisibility();
	}
	function allLeafColumns() {
		if (tick() < 0 || !table) return [];
		const cols = table.getAllLeafColumns ? table.getAllLeafColumns() : [];
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
		if (tick() < 0 || !table) return false;
		const col = table.getColumn(colId);
		if (!col || !col.getIsPinned) return false;
		return col.getIsPinned();
	}
	function onPinColumn(colId, side, evt) {
		if (evt && evt.stopPropagation) evt.stopPropagation();
		if (!table) return;
		const col = table.getColumn(colId);
		if (col && col.pin) col.pin(side);
	}
	function pinStyle(colId, zIndex = 1) {
		if (tick() < 0 || !table) return "";
		const col = table.getColumn(colId);
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
	function onGlobalFilterInput(evt) {
		const value = evt && evt.target ? evt.target.value : "";
		if (table) {
			table.setGlobalFilter(value);
			return;
		}
		writeGlobalFilter(value);
	}
	function onColumnFilterInput(colId, evt) {
		setColumnFilter(colId, evt && evt.target ? evt.target.value : "");
	}
	function globalFilterValue() {
		const v = currentState().globalFilter;
		return v != null ? v : "";
	}
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
	function displayPageCount() {
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
	function onPageSizeChange(evt) {
		if (!table) return;
		const v = evt && evt.target ? evt.target.value : "";
		const n = parseInt(v, 10);
		table.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
	}
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
		return local.getSubRows == null && !rowIsGrouped(row) && rowIsExpanded(row);
	}
	function onToggleExpand(row, evt) {
		if (!row || !row.toggleExpanded) return;
		const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest("tr") : null;
		row.toggleExpanded();
		if (ownerRow && typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
			const btn = ownerRow.querySelector("[data-expander]");
			if (btn) btn.focus();
		});
	}
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
		return rowIsGrouped((rows() || [])[rowIndex]);
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
	let groupRowDescriptorCache = null;
	let groupRowDescriptorCacheVer = void 0;
	function groupRowDescriptor(row) {
		const ver = rowModelVer();
		if (!groupRowDescriptorCache || groupRowDescriptorCacheVer !== ver) {
			groupRowDescriptorCache = Object.create(null);
			groupRowDescriptorCacheVer = ver;
		}
		const key = String(row.id);
		let d = groupRowDescriptorCache[key];
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
			groupRowDescriptorCache[key] = d;
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
	function stopEvent(evt) {
		if (evt && evt.stopPropagation) evt.stopPropagation();
	}
	function isAllRowsSelected() {
		return !!(tick() >= 0 && table && table.getIsAllRowsSelected());
	}
	function isSomeRowsSelected() {
		return !!(tick() >= 0 && table && table.getIsSomeRowsSelected());
	}
	function onToggleAllRows(evt) {
		if (!table) return;
		table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
	}
	function rowIsSelected(row) {
		if (!row) return false;
		const id = row.id;
		const sel = currentState().rowSelection || {};
		if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
		return !!(row.getIsSelected && row.getIsSelected());
	}
	function onToggleRow(row, evt) {
		if (!row || !row.toggleSelected) return;
		row.toggleSelected(!!(evt && evt.target && evt.target.checked));
	}
	function onHideColumn(colId, evt) {
		if (evt && evt.stopPropagation) evt.stopPropagation();
		if (!table) return;
		const col = table.getColumn(colId);
		if (col && col.toggleVisibility) col.toggleVisibility(false);
	}
	function hasAnyFilterableColumn() {
		const cols = allLeafColumns();
		for (const c of cols) if (c && columnIsFilterable(c.id)) return true;
		return false;
	}
	let selectAllBox = null;
	function syncIndeterminate() {
		if (!__rozieRootRef || !__rozieRootRef.querySelector) return;
		selectAllBox = __rozieRootRef.querySelector(".rdt-select-all");
		if (selectAllBox) selectAllBox.indeterminate = isSomeRowsSelected() && !isAllRowsSelected();
	}
	function sortColumn(colId, desc) {
		if (table) table.getColumn(colId) && table.getColumn(colId).toggleSorting(desc, false);
	}
	function clearSorting() {
		if (table) table.resetSorting(true);
	}
	function getColumnDefs() {
		return columnDefs();
	}
	function toggleAllRows(value) {
		if (table) table.toggleAllRowsSelected(value);
	}
	function clearSelection() {
		if (table) table.resetRowSelection(true);
	}
	function getSelectedRows() {
		return table ? table.getSelectedRowModel().rows.map((r) => r.original) : [];
	}
	function setPage(idx) {
		if (table) table.setPageIndex(idx);
	}
	function setRowsPerPage(size) {
		if (table) table.setPageSize(size);
	}
	function toggleColumnVisibility(colId) {
		if (table) {
			const c = table.getColumn(colId);
			if (c && c.toggleVisibility) c.toggleVisibility();
		}
	}
	function applyColumnOrder(order) {
		if (table) table.setColumnOrder(order);
	}
	function resetColumnSizing() {
		if (table) table.resetColumnSizing(true);
	}
	function pinColumn(colId, side) {
		if (table) {
			const c = table.getColumn(colId);
			if (c && c.pin) c.pin(side);
		}
	}
	function getRowIndexRelativeToPage(absRow) {
		const abs = absRow == null ? toAbsRow(activeRow()) : Math.trunc(Number(absRow)) || 0;
		if (rowsWindowed()) return abs;
		return abs - pageRowOffset();
	}
	function cut() {
		return cutRange();
	}
	function isGrid() {
		return local.interactionMode === "grid";
	}
	function tableRole() {
		return isGrid() ? "grid" : "table";
	}
	function cellRole() {
		return isGrid() ? "gridcell" : "cell";
	}
	function rowIndexOf(row) {
		return tick() >= 0 ? (rows() || []).indexOf(row) : -1;
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
		if (!table || rowsWindowed()) return bodyRowCount();
		const pm = table.getPrePaginationRowModel();
		return pm && pm.rows ? pm.rows.length : bodyRowCount();
	}
	function cellTabindex(rowKey, colIndex, level = null) {
		if (!isGrid()) return null;
		if (bodyRowCount() === 0) return rowKey === "__header" && colIndex === 0 && level === headerLeafLevel() ? 0 : -1;
		if (activeIsHeader()) {
			if (rowKey !== "__header") return -1;
			return colIndex === activeColIndex() && level === activeHeaderLevel() ? 0 : -1;
		}
		return rowKey === String(activeRow()) && colIndex === activeColIndex() ? 0 : -1;
	}
	function isActiveCell(rowKey, colIndex, level = null) {
		if (!isGrid()) return false;
		if (activeIsHeader()) {
			if (rowKey !== "__header") return false;
			return colIndex === activeColIndex() && level === activeHeaderLevel();
		}
		if (rowKey === "__header") return false;
		return rowKey === String(activeRow()) && colIndex === activeColIndex();
	}
	function resolveCellEl(rowKey, colIndex, level = null) {
		if (!gridRoot) return null;
		let sel = "[data-grid-cell][data-row=\"" + rowKey + "\"][data-col-index=\"" + colIndex + "\"]";
		if (rowKey === "__header" && level != null) sel = sel + "[data-header-level=\"" + level + "\"]";
		return gridRoot.querySelector(sel);
	}
	function focusActiveCell(nextRow = null, nextCol = null, nextIsHeader = null, nextLevel = null) {
		if (!isGrid() || !gridRoot) return;
		focusIntentEpoch = focusIntentEpoch + 1;
		const r = nextRow == null ? activeRow() : nextRow;
		const c = nextCol == null ? activeColIndex() : nextCol;
		const lvl = nextLevel == null ? activeHeaderLevel() : nextLevel;
		const header = nextIsHeader == null ? activeIsHeader() : nextIsHeader;
		const rowOut = rowsWindowed() && virtualizer && rowIsOutsideWindow(r);
		const colOut = colsWindowed() && colVirtualizer && colIsOutsideWindow(c);
		if (!header && (rowOut || colOut)) {
			if (rowOut) virtualizer.scrollToIndex(r, { align: "center" });
			if (colOut) colVirtualizer.scrollToIndex(c, { align: "center" });
			let focusAttempts = 0;
			const myEpoch = focusIntentEpoch;
			const focusWhenReady = () => {
				if (focusIntentEpoch !== myEpoch) return;
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
		if (!table) return (rows() || []).length;
		if (local.manual === true) {
			if (local.rowCount != null) return local.rowCount;
			if (local.pageCount != null) return local.pageCount * pageSize();
		}
		const fm = table.getFilteredRowModel();
		return fm && fm.rows ? fm.rows.length : (rows() || []).length;
	}
	function headerRowCount() {
		return (headerGroups() || []).length;
	}
	function gridAriaRowCount() {
		return headerRowCount() + totalRowCount();
	}
	function ariaPageOffset() {
		return table ? pageIndex() * pageSize() : 0;
	}
	function bodyAriaRowIndex(row) {
		return headerRowCount() + rowIndexOf(row) + ariaPageOffset() + 1;
	}
	function gridAriaColCount() {
		return visibleColCount();
	}
	function visibleColCount() {
		const rowList = rows() || [];
		if (rowList.length) return rowList[0].getVisibleCells().length;
		const hg = headerGroups() || [];
		return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
	}
	function bodyRowCount() {
		return (rows() || []).length;
	}
	function headerLeafLevel() {
		const hg = headerGroups() || [];
		return hg.length ? hg.length - 1 : 0;
	}
	function headerCountAtLevel(level) {
		const hg = headerGroups() || [];
		if (!hg.length) return visibleColCount();
		const grp = level >= 0 && level < hg.length ? hg[level] : null;
		if (!grp || !grp.headers) return visibleColCount();
		return grp.headers.length;
	}
	function headerAt(level, colIndex) {
		const grp = (headerGroups() || [])[level];
		if (!grp || !grp.headers) return null;
		return grp.headers[colIndex] || null;
	}
	function parentHeaderColIndex(level, colIndex) {
		if (level <= 0) return -1;
		const h = headerAt(level, colIndex);
		if (!h || !h.column || !h.column.parent) return -1;
		const parentId = h.column.parent.id;
		const pg = (headerGroups() || [])[level - 1];
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
		const cg = (headerGroups() || [])[level + 1];
		if (!cg || !cg.headers) return -1;
		for (let i = 0; i < cg.headers.length; i++) {
			const ch = cg.headers[i];
			if (ch && ch.column && ch.column.id === childId) return i;
		}
		return -1;
	}
	function moveCol(delta) {
		const max = (activeIsHeader() ? headerCountAtLevel(activeHeaderLevel()) : visibleColCount()) - 1;
		const nextCol = clamp(activeColIndex() + delta, 0, max < 0 ? 0 : max);
		setActiveColIndex(nextCol);
		return nextCol;
	}
	function moveRow(delta) {
		const lastRow = bodyRowCount() - 1;
		const maxRow = lastRow < 0 ? 0 : lastRow;
		const leafLevel = headerLeafLevel();
		if (activeIsHeader()) {
			if (delta > 0) {
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
				if (bodyRowCount() === 0) return {
					row: activeRow(),
					col: activeColIndex(),
					isHeader: true,
					level: activeHeaderLevel()
				};
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
	function gotoColEdge(toEnd) {
		const max = (activeIsHeader() ? headerCountAtLevel(activeHeaderLevel()) : visibleColCount()) - 1;
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
		return resolveCellEl(activeIsHeader() ? "__header" : String(activeRow()), activeColIndex(), activeIsHeader() ? activeHeaderLevel() : null);
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
		const active = gridRoot ? gridRoot.getRootNode().activeElement : null;
		const cur = list.indexOf(active);
		let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
		if (i >= list.length) i = 0;
		if (i < 0) i = list.length - 1;
		list[i].focus();
	}
	function onGridKeyDown(e) {
		if (!isGrid() || !e) return;
		const key = e.key;
		if (editingRow() >= 0) return;
		if (editingRowIndex() != null) return;
		if (activeInControl()) {
			if (key === "Escape") {
				e.preventDefault();
				setActiveInControl(false);
				focusActiveCell(activeRow(), activeColIndex());
			} else if (key === "Tab") {
				e.preventDefault();
				cycleWithinCell(currentCellEl(), !e.shiftKey);
			}
			return;
		}
		const tgt = e.target;
		if (!tgt || !tgt.hasAttribute || !tgt.hasAttribute("data-grid-cell")) return;
		const prevRow = activeRow();
		const prevCol = activeColIndex();
		const prevIsHeader = activeIsHeader();
		const prevLevel = activeHeaderLevel();
		let nextRow = prevRow;
		let nextCol = prevCol;
		let nextIsHeader = prevIsHeader;
		let nextLevel = prevLevel;
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && !activeIsHeader() && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
			e.preventDefault();
			if (key === "ArrowUp") extendRange(-activeRow(), 0);
			else if (key === "ArrowDown") extendRange(bodyRowCount() - 1 - activeRow(), 0);
			else if (key === "ArrowLeft") extendRange(0, -activeColIndex());
			else extendRange(0, visibleColCount() - 1 - activeColIndex());
			return;
		} else if ((e.ctrlKey || e.metaKey) && !activeIsHeader() && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
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
		} else if (key === "ArrowRight" && e.shiftKey && !activeIsHeader()) {
			e.preventDefault();
			extendRange(0, 1);
			return;
		} else if (key === "ArrowLeft" && e.shiftKey && !activeIsHeader()) {
			e.preventDefault();
			extendRange(0, -1);
			return;
		} else if (key === "ArrowDown" && e.shiftKey && !activeIsHeader()) {
			e.preventDefault();
			extendRange(1, 0);
			return;
		} else if (key === "ArrowUp" && e.shiftKey && !activeIsHeader()) {
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
			if (local.undoable) {
				e.preventDefault();
				redo();
				return;
			}
		} else if ((key === "y" || key === "Y") && (e.ctrlKey || e.metaKey)) {
			if (local.undoable) {
				e.preventDefault();
				redo();
				return;
			}
		} else if ((key === "z" || key === "Z") && (e.ctrlKey || e.metaKey)) {
			if (local.undoable) {
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
			if (!activeIsHeader()) selectAllBody();
			return;
		} else if (key === "F2" && e.shiftKey && isActiveCellEditable()) {
			e.preventDefault();
			beginRowEdit((rows() || [])[activeRow()]);
			return;
		} else if ((key === "Enter" || key === "F2" || key === " ") && isActiveCellEditable() && editorTypeOf(activeCellColumnId()) === "checkbox") {
			e.preventDefault();
			toggleActiveBooleanCell();
			return;
		} else if ((key === "Enter" || key === "F2") && isActiveCellEditable()) {
			e.preventDefault();
			beginEdit(activeRow(), activeColIndex(), null);
			return;
		} else if (isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && editorTypeOf(activeCellColumnId()) !== "checkbox") {
			e.preventDefault();
			const editType = editorTypeOf(activeCellColumnId());
			const seed = editType === "text" || editType === "number" ? key : null;
			beginEdit(activeRow(), activeColIndex(), seed);
			return;
		} else if (key === "Enter" && !activeIsHeader() && rowIsGrouped((rows() || [])[activeRow()])) {
			e.preventDefault();
			const grpRow = activeRow();
			const grpCol = activeColIndex();
			onToggleExpand((rows() || [])[activeRow()], e);
			recoverGridFocus(String(grpRow), grpCol, null, true);
			return;
		} else if (key === "Enter" || key === "F2") {
			e.preventDefault();
			enterControl();
			return;
		} else return;
		focusActiveCell(nextRow, nextCol, nextIsHeader, nextLevel);
		if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader || nextLevel !== prevLevel) _props.onActivecellChange?.(nextIsHeader ? {
			rowIndex: null,
			colIndex: nextCol,
			isHeader: true
		} : {
			rowIndex: toAbsRow(nextRow),
			colIndex: nextCol,
			isHeader: false
		});
	}
	function syncActiveFromEvent(e) {
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
		const prevIsHeader = activeIsHeader();
		const prevRow = activeRow();
		const prevCol = activeColIndex();
		const prevLevel = activeHeaderLevel();
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
		if (isHeader !== prevIsHeader || col !== prevCol || (isHeader ? movedLevel !== prevLevel : movedRow !== prevRow)) focusIntentEpoch = focusIntentEpoch + 1;
		if (rangeTransition) rangeTransition = false;
		else if (rangeClickPending && rangeClickPending.isHeader === isHeader && rangeClickPending.r === movedRow && rangeClickPending.c === col) rangeClickPending = null;
		else {
			rangeClickPending = null;
			clearRange();
		}
		if (tgt === cellEl) setActiveInControl(false);
	}
	function onGridMouseDown(e) {
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
			rangeClickPending = {
				isHeader: false,
				r: row,
				c: col
			};
			return;
		}
		if (isEditing(row, col)) return;
		beginRangeDrag(row, col);
	}
	function onGridDblClick(e) {
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
		const rowObj = (rows() || [])[row];
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
	}
	function onGridClick(e) {
		if (!isGrid() || !e) return;
		if (!local.singleClickEdit) return;
		if (e.shiftKey) return;
		if (rangeDragMoved) {
			rangeDragMoved = false;
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
		if (editingRow() === row && editingCol() === col) return;
		const colId = columnIdAt(row, col);
		if (colId != null && columnEditable(colId)) beginEdit(row, col, null);
	}
	function onGridFocusOut(e) {
		if (!isGrid() || !activeInControl()) return;
		const next = e ? e.relatedTarget : null;
		const cellEl = currentCellEl();
		if (!cellEl || !next || !cellEl.contains(next)) setActiveInControl(false);
	}
	function recoverGridFocus(rowKey, col, level, guardMoved = false) {
		if (!gridRoot) return;
		let attempts = 0;
		const tryFocus = () => {
			if (guardMoved) {
				const ae = gridRoot && gridRoot.getRootNode ? gridRoot.getRootNode().activeElement : null;
				const aeCell = ae && ae.closest ? ae.closest("[data-grid-cell]") : null;
				if (aeCell && gridRoot.contains(aeCell)) {
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
	function clampActiveCell(rowCount, colCount) {
		if (!isGrid()) return;
		const colN = colCount != null ? colCount : visibleColCount();
		const rowN = rowCount != null ? rowCount : bodyRowCount();
		let recoverFocus = false;
		let doomedRow = -1;
		let doomedCol = 0;
		if (gridRoot) {
			const rootNode = gridRoot.getRootNode ? gridRoot.getRootNode() : null;
			const focusedEl = rootNode ? rootNode.activeElement : null;
			const focusedCell = focusedEl && focusedEl.closest ? focusedEl.closest("[data-grid-cell]") : null;
			if (focusedCell && gridRoot.contains(focusedCell)) {
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
		const col = clamp(activeColIndex(), 0, maxCol < 0 ? 0 : maxCol);
		if (col !== activeColIndex()) setActiveColIndex(col);
		if (rowN <= 0) {
			setActiveIsHeader(true);
			setActiveHeaderLevel(headerLeafLevel());
			setActiveColIndex(0);
			gridEmptyFallback = true;
			clampRange(rowN - 1, colN - 1);
			return;
		}
		if (gridEmptyFallback) {
			gridEmptyFallback = false;
			setActiveIsHeader(false);
			setActiveRow(0);
		}
		if (!activeIsHeader()) {
			const lastRow = rowN - 1;
			const maxRow = lastRow < 0 ? 0 : lastRow;
			const row = clamp(activeRow(), 0, maxRow);
			if (row !== activeRow()) setActiveRow(row);
		}
		clampRange(rowN - 1, colN - 1);
		if (recoverFocus) {
			const recRow = clamp(doomedRow, 0, rowN - 1);
			const recCol = clamp(doomedCol, 0, maxCol < 0 ? 0 : maxCol);
			recoverGridFocus(String(recRow), recCol, null);
		}
	}
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
	let lastColSizeSig = 0;
	function remeasureColumnSizes() {
		if (!colsWindowed() || !colVirtualizer || !colVirtualizer.measure) return;
		const n = columnCount();
		let sig = n;
		for (let i = 0; i < n; i++) sig = Math.imul(sig, 31) + columnSize(i) | 0;
		if (sig === lastColSizeSig) return;
		lastColSizeSig = sig;
		colVirtualizer.measure();
	}
	function remeasureColumnWindow() {
		if (!colsWindowed() || !colVirtualizer) return;
		colVirtualizer.setOptions(columnVirtualizerOptions());
		remeasureColumnSizes();
		colVirtualizer._willUpdate();
	}
	let gridEmptyFallback = false;
	let rangeTransition = false;
	let rangeClickPending = null;
	let rangeActive = false;
	function inRange(rIdx, cIdx) {
		const a = rangeAnchor();
		const f = rangeFocus();
		if (!a || !f) return false;
		const r0 = a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex;
		const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
		const c0 = a.colIndex < f.colIndex ? a.colIndex : f.colIndex;
		const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
		return rIdx >= r0 && rIdx <= r1 && cIdx >= c0 && cIdx <= c1;
	}
	function getSelectedRange() {
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
		const a = rangeAnchor();
		const f = rangeFocus();
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
		_props.onRangeChange?.({
			anchor,
			focus
		});
	}
	function extendRange(dRow, dCol) {
		if (activeIsHeader()) return;
		const maxRow = bodyRowCount() - 1;
		const maxCol = visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) return;
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
		setActiveRow(nextRow);
		setActiveColIndex(nextCol);
		rangeTransition = true;
		focusActiveCell(nextRow, nextCol, false);
		if (!hadRange || nextRow !== focus.rowIndex || nextCol !== focus.colIndex) emitRangeChange(anchor, nextFocus);
	}
	function setRangeFocus$local(rIdx, cIdx, anchorR = null, anchorC = null) {
		const maxRow = bodyRowCount() - 1;
		const maxCol = visibleColCount() - 1;
		if (maxRow < 0 || maxCol < 0) return;
		let anchor = rangeAnchor();
		if (!anchor && anchorR != null && anchorC != null) anchor = {
			rowIndex: clamp(Math.trunc(Number(anchorR)) || 0, 0, maxRow),
			colIndex: clamp(Math.trunc(Number(anchorC)) || 0, 0, maxCol)
		};
		if (!anchor) anchor = {
			rowIndex: activeRow(),
			colIndex: activeColIndex()
		};
		const nextFocus = {
			rowIndex: clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow),
			colIndex: clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol)
		};
		setRangeAnchor(anchor);
		setRangeFocus(nextFocus);
		rangeActive = true;
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
		rangeActive = true;
		emitRangeChange(anchor, focus);
	}
	function clearRange() {
		if (!rangeActive) return;
		rangeActive = false;
		setRangeAnchor(null);
		setRangeFocus(null);
		emitRangeChange(null, null);
	}
	function clampRange(maxRowArg, maxColArg) {
		const a = rangeAnchor();
		const f = rangeFocus();
		if (!a && !f) return;
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
	function announce(msg) {
		setPasteAnnounce(msg != null ? msg : "");
	}
	function clipboardActiveAllowed() {
		return !activeIsHeader();
	}
	function fieldOfColId(colId) {
		const d = defFor(colId);
		return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
	}
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
			editTransition = true;
			writeData(next);
			editTransition = false;
			for (let i = 0; i < committed.length; i++) try {
				_props.onCellEditCommit?.(committed[i]);
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
		const row = (rows() || [])[rowIndex];
		return row ? row.original : null;
	}
	function rowIdAt(rowIndex) {
		const row = (rows() || [])[rowIndex];
		return row ? row.id : null;
	}
	function pasteRange() {
		if (!clipboardActiveAllowed()) return;
		if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.readText) return;
		const box = normalizedRange();
		const anchorRow = box ? box.r0 : activeRow();
		const anchorCol = box ? box.c0 : activeColIndex();
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
		const r0 = box ? box.r0 : activeRow();
		const r1 = box ? box.r1 : activeRow();
		const c0 = box ? box.c0 : activeColIndex();
		const c1 = box ? box.c1 : activeColIndex();
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
		const r0 = box ? box.r0 : activeRow();
		const r1 = box ? box.r1 : activeRow();
		const c0 = box ? box.c0 : activeColIndex();
		const c1 = box ? box.c1 : activeColIndex();
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
	let fillDragging = false;
	let fillDragMove = null;
	let fillDragUp = null;
	let fillEdgeScrollRaf = null;
	const FILL_EDGE_SCROLL_PX = 24;
	const FILL_EDGE_SCROLL_STEP = 16;
	function edgeDelta(clientX, clientY) {
		if (!gridScrollEl) return {
			dx: 0,
			dy: 0
		};
		const rect = gridScrollEl.getBoundingClientRect();
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
	function teardownFillDrag() {
		if (typeof document !== "undefined") {
			if (fillDragMove) document.removeEventListener("pointermove", fillDragMove);
			if (fillDragUp) document.removeEventListener("pointerup", fillDragUp);
		}
		fillDragMove = null;
		fillDragUp = null;
		fillDragging = false;
		if (fillEdgeScrollRaf != null) {
			if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(fillEdgeScrollRaf);
			fillEdgeScrollRaf = null;
		}
	}
	const FILL_HITTEST_PROBE_RADIUS_PX = 8;
	const FILL_HITTEST_PROBE_STEP_PX = 2;
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
	function onFillHandlePointerDown(e) {
		if (!e) return;
		if (e.preventDefault) e.preventDefault();
		if (e.stopPropagation) e.stopPropagation();
		teardownFillDrag();
		fillDragging = true;
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
			if (!fillDragging) {
				fillEdgeScrollRaf = null;
				return;
			}
			const d = edgeDelta(lastClientX, lastClientY);
			if (d.dx === 0 && d.dy === 0) {
				fillEdgeScrollRaf = null;
				return;
			}
			if (gridScrollEl) {
				if (d.dx !== 0) gridScrollEl.scrollLeft = gridScrollEl.scrollLeft + d.dx;
				if (d.dy !== 0) gridScrollEl.scrollTop = gridScrollEl.scrollTop + d.dy;
			}
			applyPointAt(lastClientX, lastClientY);
			fillEdgeScrollRaf = requestAnimationFrame(scrollStep);
		};
		const move = (ev) => {
			if (!fillDragging) return;
			lastClientX = ev.clientX;
			lastClientY = ev.clientY;
			applyPointAt(ev.clientX, ev.clientY);
			if (fillEdgeScrollRaf == null && typeof requestAnimationFrame === "function") {
				const d = edgeDelta(ev.clientX, ev.clientY);
				if (d.dx !== 0 || d.dy !== 0) fillEdgeScrollRaf = requestAnimationFrame(scrollStep);
			}
		};
		const up = () => {
			teardownFillDrag();
			if (lastCell && sourceBox && (lastCell.r !== sourceBox.r1 || lastCell.c !== sourceBox.c1)) fillRange(sourceBox, lastCell);
		};
		fillDragMove = move;
		fillDragUp = up;
		if (typeof document !== "undefined") {
			document.addEventListener("pointermove", move);
			document.addEventListener("pointerup", up);
		}
	}
	let rangeDragging = false;
	let rangeDragMove = null;
	let rangeDragUp = null;
	let rangeDragMoved = false;
	function teardownRangeDrag() {
		if (typeof document !== "undefined") {
			if (rangeDragMove) document.removeEventListener("pointermove", rangeDragMove);
			if (rangeDragUp) document.removeEventListener("pointerup", rangeDragUp);
		}
		rangeDragMove = null;
		rangeDragUp = null;
		rangeDragging = false;
	}
	function beginRangeDrag(anchorR, anchorC) {
		teardownRangeDrag();
		rangeDragging = true;
		rangeDragMoved = false;
		let lastCell = {
			r: anchorR,
			c: anchorC
		};
		const move = (ev) => {
			if (!rangeDragging) return;
			const cell = cellIndexFromPoint(ev.clientX, ev.clientY);
			if (cell && (cell.r !== lastCell.r || cell.c !== lastCell.c)) {
				lastCell = cell;
				rangeDragMoved = true;
				setRangeFocus$local(cell.r, cell.c, anchorR, anchorC);
			}
		};
		const up = () => {
			teardownRangeDrag();
		};
		rangeDragMove = move;
		rangeDragUp = up;
		if (typeof document !== "undefined") {
			document.addEventListener("pointermove", move);
			document.addEventListener("pointerup", up);
		}
	}
	function activeCellColumnId() {
		if (activeIsHeader()) return null;
		const row = (rows() || [])[activeRow()];
		if (!row) return null;
		const cell = visibleCellsFor(row)[activeColIndex()];
		return cell && cell.column ? cell.column.id : null;
	}
	function isActiveCellEditable() {
		if (rowIndexIsGrouped(activeRow())) return false;
		const colId = activeCellColumnId();
		return colId != null && columnEditable(colId);
	}
	function isEditing(rowIndex, colIndex) {
		if (editVer() < 0) return false;
		if (rowIndexIsGrouped(rowIndex)) return false;
		if (editingRowIndex() != null && editingRowIndex() === rowIndex) {
			const colId = columnIdAt(rowIndex, colIndex);
			return colId != null && columnEditable(colId);
		}
		return editingRow() === rowIndex && editingCol() === colIndex;
	}
	function cellAriaInvalid(rowIndex, colIndex) {
		return isEditing(rowIndex, colIndex) && !!invalidMsg() ? "true" : null;
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
		const row = (rows() || [])[visibleRowIndex];
		if (!row) return visibleRowIndex;
		const orig = row.original;
		const idx = (currentData() || []).indexOf(orig);
		return idx >= 0 ? idx : visibleRowIndex;
	}
	function editingColumnId() {
		const row = (rows() || [])[editingRow()];
		if (!row) return null;
		const cell = visibleCellsFor(row)[editingCol()];
		return cell && cell.column ? cell.column.id : null;
	}
	function editingColumnField() {
		const colId = editingColumnId();
		if (colId == null) return null;
		const d = defFor(colId);
		return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
	}
	function editingCellValue() {
		const row = (rows() || [])[editingRow()];
		if (!row) return null;
		const cell = visibleCellsFor(row)[editingCol()];
		return cell ? cell.getValue() : null;
	}
	function editingRowOriginal() {
		const row = (rows() || [])[editingRow()];
		return row ? row.original : null;
	}
	function editingRowId() {
		const row = (rows() || [])[editingRow()];
		return row ? row.id : null;
	}
	function resolveEditFocusCellEl(rowIndex, colIndex) {
		if (rowIndex == null || colIndex == null || rowIndex < 0 || colIndex < 0) return null;
		return resolveCellEl(String(rowIndex), colIndex);
	}
	function focusEditorWhenReady(rowIndex, colIndex, selectAll = true) {
		if (!gridRoot) return;
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
			const ae = gridRoot && gridRoot.getRootNode ? gridRoot.getRootNode().activeElement : null;
			if (ae && el && ae !== el && ae.closest && gridRoot.contains(ae) && ae.hasAttribute && ae.hasAttribute("data-editing-cell")) {
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
		const row = (rows() || [])[rowIndex];
		if (!row) return null;
		const cell = visibleCellsFor(row)[colIndex];
		return cell && cell.column ? cell.column.id : null;
	}
	function cellValueAt(rowIndex, colIndex) {
		const row = (rows() || [])[rowIndex];
		if (!row) return null;
		const cell = visibleCellsFor(row)[colIndex];
		return cell ? cell.getValue() : null;
	}
	function beginEdit(rowIndex, colIndex, seed) {
		if (rowIndexIsGrouped(rowIndex)) return;
		const colId = columnIdAt(rowIndex, colIndex);
		if (colId == null || !columnEditable(colId)) return;
		committedThisSession = false;
		setInvalid("");
		setEditingRowIndex(null);
		setRowDraft({});
		setEditingRow(rowIndex);
		setEditingCol(colIndex);
		setDraftValue(seed != null ? seed : cellValueAt(rowIndex, colIndex));
		setActiveInControl(true);
		setEditVer(editVer() + 1);
		setEditFocusColId(colId);
		focusEditorWhenReady(rowIndex, colIndex, seed == null);
	}
	function focusCellWhenReady(row, col) {
		if (!gridRoot) return;
		let attempts = 0;
		const tryFocus = () => {
			const el = resolveCellEl(String(row), col);
			if (el) {
				const ae = gridRoot && gridRoot.getRootNode ? gridRoot.getRootNode().activeElement : null;
				if (ae && ae !== el && gridRoot.contains && gridRoot.contains(ae) && ae.closest) {
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
	}
	function endEdit() {
		setEditingRow(-1);
		setEditingCol(-1);
		setDraftValue(null);
		setInvalidMsg("");
		setActiveInControl(false);
		setEditVer(editVer() + 1);
		setEditFocusColId(null);
	}
	function endRowEdit() {
		setEditingRowIndex(null);
		setRowDraft({});
		setInvalidMsg("");
		setActiveInControl(false);
		setEditVer(editVer() + 1);
		setEditFocusColId(null);
	}
	function editorAutofocusFor(colId, rowIndex) {
		if (editVer() < 0) return false;
		if (editingRowIndex() != null) {
			if (editingRowIndex() !== rowIndex) return false;
		} else if (editingRow() !== rowIndex) return false;
		return editFocusColId() != null && editFocusColId() === colId;
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
		if (editingRow() < 0) return false;
		if (committedThisSession) return false;
		const colId = editingColumnId();
		if (colId == null) {
			endEdit();
			return false;
		}
		const field = editingColumnField();
		const oldValue = editingCellValue();
		const rowOriginal = editingRowOriginal();
		const rowId = editingRowId();
		const newValue = coerceCellValue(colId, overrideValue !== void 0 ? overrideValue : draftValue());
		const err = runValidator(colId, newValue, rowOriginal);
		if (err !== true) {
			setInvalid(err);
			focusEditorWhenReady(editingRow(), editingCol());
			return false;
		}
		setInvalid("");
		const changed = !Object.is(newValue, oldValue);
		const focusRow = editingRow();
		const focusCol = editingCol();
		editTransition = true;
		committedThisSession = true;
		if (changed) {
			const srcIndex = sourceIndexOfRow(editingRow());
			writeData(replaceRowValue(currentData(), srcIndex, field, newValue));
			_props.onCellEditCommit?.({
				rowId,
				columnId: colId,
				oldValue,
				newValue
			});
		}
		endEdit();
		editTransition = false;
		if (changed) {
			if (skipFocusReturn !== true) pendingEditFollow = {
				rowOriginal,
				rowId,
				col: focusCol
			};
		} else if (skipFocusReturn !== true) focusCellWhenReady(focusRow, focusCol);
		return true;
	}
	function toggleActiveBooleanCell() {
		if (rowIndexIsGrouped(activeRow())) return;
		const colId = columnIdAt(activeRow(), activeColIndex());
		if (colId == null || !columnEditable(colId)) return;
		const row = (rows() || [])[activeRow()];
		if (!row) return;
		const rowOriginal = row.original;
		const rowId = row.id;
		const oldValue = cellValueAt(activeRow(), activeColIndex());
		const newValue = !oldValue;
		const err = runValidator(colId, newValue, rowOriginal);
		if (err !== true) {
			setInvalid(err);
			return;
		}
		setInvalid("");
		const def = defFor(colId);
		const field = def && def.accessorKey != null ? def.accessorKey : colId;
		const srcIndex = sourceIndexOfRow(activeRow());
		committedThisSession = true;
		writeData(replaceRowValue(currentData(), srcIndex, field, newValue));
		_props.onCellEditCommit?.({
			rowId,
			columnId: colId,
			oldValue,
			newValue
		});
		pendingEditFollow = {
			rowOriginal,
			rowId,
			col: activeColIndex()
		};
	}
	function cancelEdit() {
		if (editingRow() < 0) return;
		const focusRow = editingRow();
		const focusCol = editingCol();
		editTransition = true;
		endEdit();
		editTransition = false;
		focusCellWhenReady(focusRow, focusCol);
	}
	function editableColumnsForRow(rowIndex) {
		const row = (rows() || [])[rowIndex];
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
		if (!gridRoot) return;
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
		committedThisSession = false;
		setEditingRow(-1);
		setEditingCol(-1);
		setDraftValue(null);
		setInvalid("");
		const draft = {};
		const r = (rows() || [])[rowIndex];
		const orig = r ? r.original : null;
		for (let i = 0; i < editable.length; i++) {
			const ec = editable[i];
			draft[ec.colId] = orig ? orig[ec.field] : null;
		}
		setRowDraft(draft);
		setEditingRowIndex(rowIndex);
		setActiveInControl(true);
		setEditVer(editVer() + 1);
		setEditFocusColId(editable[0].colId);
		focusEditorWhenReady(rowIndex, editable[0].colIndex);
	}
	function commitRow() {
		if (editingRowIndex() == null) return false;
		const rowIndex = editingRowIndex();
		const editable = editableColumnsForRow(rowIndex);
		if (editable.length === 0) {
			endRowEdit();
			return false;
		}
		const r = (rows() || [])[rowIndex];
		const rowOriginal = r ? r.original : null;
		const rowId = r ? r.id : null;
		const draft = rowDraft() || {};
		for (let i = 0; i < editable.length; i++) {
			const ec = editable[i];
			const err = runValidator(ec.colId, coerceCellValue(ec.colId, draft[ec.colId]), rowOriginal);
			if (err !== true) {
				setInvalid(err);
				setEditFocusColId(ec.colId);
				setEditVer(editVer() + 1);
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
		const focusRow = activeRow();
		const focusCol = activeColIndex();
		const changed = changes.length > 0;
		editTransition = true;
		if (changed) {
			const srcIndex = sourceIndexOfRow(rowIndex);
			writeData(replaceRowValues(currentData(), srcIndex, fieldValues));
			_props.onRowEditCommit?.({
				rowId,
				changes
			});
		}
		endRowEdit();
		editTransition = false;
		if (changed) pendingEditFollow = {
			rowOriginal,
			rowId,
			col: focusCol
		};
		else focusCellWhenReady(focusRow, focusCol);
		return true;
	}
	function cancelRow() {
		if (editingRowIndex() == null) return;
		const focusRow = activeRow();
		const focusCol = activeColIndex();
		editTransition = true;
		endRowEdit();
		editTransition = false;
		focusCellWhenReady(focusRow, focusCol);
	}
	function nextEditableCell(fromRow, fromCol) {
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
	function prevEditableCell(fromRow, fromCol) {
		const rowList = rows() || [];
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
	let editTransition = false;
	let pendingEditFollow = null;
	let committedThisSession = false;
	function inRowEdit() {
		return editingRowIndex() != null;
	}
	function editorValueFor(colId) {
		return inRowEdit() ? rowDraft() ? rowDraft()[colId] : null : draftValue();
	}
	function editorCheckedFor(colId) {
		return !!(inRowEdit() ? rowDraft() ? rowDraft()[colId] : null : draftValue());
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
	function onCellEditorInput(colId, evt) {
		const v = evt && evt.target ? evt.target.value : "";
		if (inRowEdit()) {
			setRowDraft$local(colId, v);
			return;
		}
		setDraftValue(v);
	}
	function onCellEditorCheckbox(colId, evt) {
		const v = !!(evt && evt.target && evt.target.checked);
		if (inRowEdit()) {
			setRowDraft$local(colId, v);
			return;
		}
		setDraftValue(v);
	}
	function setRowDraft$local(colId, value) {
		const src = rowDraft() || {};
		const next = {};
		for (const k in src) next[k] = src[k];
		next[colId] = value;
		setRowDraft(next);
	}
	function rowEditTab(target, backward) {
		const rowIndex = editingRowIndex();
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
		setEditVer(editVer() + 1);
		focusRowEditorAt(rowIndex, cols[nextPos]);
	}
	function onEditorKeyDown(e) {
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
			const fromRow = editingRow();
			const fromCol = editingCol();
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
	}
	function onEditorBlur(e) {
		if (inRowEdit()) {
			if (editTransition) return;
			const rowNext = e ? e.relatedTarget : null;
			const rowNextCell = rowNext && rowNext.closest ? rowNext.closest("[data-grid-cell]") : null;
			const rowNextRow = rowNextCell ? rowNextCell.getAttribute("data-row") : null;
			if (rowNextRow != null && rowNextRow === String(editingRowIndex())) return;
			commitRow();
			return;
		}
		if (editingRow() < 0 || editTransition) return;
		const next = e ? e.relatedTarget : null;
		const fromCell = e && e.target && e.target.closest ? e.target.closest("[data-grid-cell]") : null;
		if (next == null) {
			if (!outsidePointerDown) return;
			outsidePointerDown = false;
			if (!fromCell) return;
			if (fromCell.getAttribute("data-row") !== String(editingRow()) || fromCell.getAttribute("data-col-index") !== String(editingCol())) return;
			commitEdit(void 0, true);
			return;
		}
		if (!(gridRoot && gridRoot.contains && gridRoot.contains(next))) {
			commitEdit(void 0);
			return;
		}
		const nextCell = next.closest ? next.closest("[data-grid-cell]") : null;
		if (!nextCell || !fromCell || nextCell === fromCell) return;
		const fromRow = fromCell.getAttribute("data-row");
		const fromCol = fromCell.getAttribute("data-col-index");
		if (fromRow !== String(editingRow()) || fromCol !== String(editingCol())) return;
		const destRow = nextCell.getAttribute("data-row");
		const destCol = nextCell.getAttribute("data-col-index");
		commitEdit(void 0, true);
		const reseatDestFocus = () => {
			if (!gridRoot || destRow == null || destCol == null || destRow === "__header") return;
			const root = gridRoot.getRootNode ? gridRoot.getRootNode() : null;
			const act = root && root.activeElement ? root.activeElement : null;
			if (act && gridRoot.contains && gridRoot.contains(act)) return;
			const el = resolveCellEl(destRow, parseInt(destCol, 10));
			if (el) el.focus();
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(reseatDestFocus);
		else setTimeout(reseatDestFocus, 0);
	}
	function editCell(rowIndex, colIndex) {
		const lastRow = bodyRowCount() - 1;
		const maxRow = lastRow < 0 ? 0 : lastRow;
		const maxCol = visibleColCount() - 1;
		const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
		const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
		committedThisSession = false;
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
		if (editingRow() >= 0) commitEdit(void 0);
	}
	function editRow(rowIndex) {
		const lastRow = bodyRowCount() - 1;
		const maxRow = lastRow < 0 ? 0 : lastRow;
		const r = clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
		const row = (rows() || [])[r];
		if (!row) return;
		setActiveIsHeader(false);
		setActiveRow(r);
		beginRowEdit(row);
	}
	function focusAbsCellWhenReady(absRow, localRow, col) {
		if (!gridRoot) return;
		let attempts = 0;
		const want = String(headerRowCount() + absRow + 1);
		const myEpoch = focusIntentEpoch;
		const tryFocus = () => {
			if (focusIntentEpoch !== myEpoch) return;
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
		focusIntentEpoch = focusIntentEpoch + 1;
		const maxCol = visibleColCount() - 1;
		const c = clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
		const absLast = prePaginationRowCount() - 1;
		const absRow = clamp(Math.trunc(Number(rowIndex)) || 0, 0, absLast < 0 ? 0 : absLast);
		const prevAbs = toAbsRow(activeRow());
		const prevCol = activeColIndex();
		const prevIsHeader = activeIsHeader();
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
		if (absRow !== prevAbs || c !== prevCol || prevIsHeader) _props.onActivecellChange?.({
			rowIndex: absRow,
			colIndex: c
		});
	}
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
	function clearActiveCell() {
		if (!isGrid()) return;
		setActiveIsHeader(false);
		setActiveInControl(false);
		setActiveRow(0);
		setActiveColIndex(0);
	}
	function toggleRowExpanded(rowId) {
		if (!table) return;
		const target = String(rowId);
		const flat = table.getCoreRowModel().flatRows;
		for (const r of flat) if (r.id === target || r.original && String(r.original.id) === target) {
			r.toggleExpanded();
			return;
		}
	}
	function expandAll() {
		if (!table) return;
		table.toggleAllRowsExpanded(true);
	}
	function collapseAll() {
		if (!table) return;
		table.resetExpanded(true);
	}
	function getExpandedRows() {
		if (!table) return [];
		const out = [];
		const flat = table.getCoreRowModel().flatRows;
		for (const r of flat) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
		return out;
	}
	function applyGrouping(cols) {
		if (table) table.setGrouping(cols);
	}
	function clearGrouping() {
		if (table) table.setGrouping([]);
	}
	function getFacetedUniqueValues$1(colId) {
		if (tick() < 0 || !table) return [];
		const col = table.getColumn(colId);
		if (!col || !col.getFacetedUniqueValues) return [];
		const map = col.getFacetedUniqueValues();
		return map ? Array.from(map.keys()) : [];
	}
	function getFacetedMinMaxValues$1(colId) {
		if (tick() < 0 || !table) return null;
		const col = table.getColumn(colId);
		if (!col || !col.getFacetedMinMaxValues) return null;
		return col.getFacetedMinMaxValues() || null;
	}
	return <__ctx_data_table_columns.Provider value={{
		registerColumn: (id, spec) => {
			if (id == null) return;
			const key = String(id);
			if (key === "__proto__" || key === "constructor" || key === "prototype") return;
			const prev = colReg() ? colReg()[key] : void 0;
			if (prev !== void 0 && columnSpecsEquivalent(prev, spec)) return;
			setColReg({
				...colReg(),
				[key]: spec
			});
		},
		unregisterColumn: (id) => {
			if (id == null) return;
			const r = { ...colReg() };
			delete r[String(id)];
			setColReg(r);
		}
	}}>
    <>

    <div class={"rozie-data-table-wrap"} ref={(el) => {
		__rozieRootRef = el;
	}} data-rozie-s-d5dcab4c="">

    <div class={"rdt-column-defs"} style={{ display: "none" }} aria-hidden="true" data-rozie-s-d5dcab4c="">{resolved()}</div>

    {<Show when={!!invalidMsg()}><div class={"rdt-sr-live"} role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{invalidMsg()}</div></Show>}{<Show when={!!pasteAnnounce()}><div class={"rdt-sr-live rdt-sr-paste"} data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{pasteAnnounce()}</div></Show>}{<Show when={!!rangeAnnounce()}><div class={"rdt-sr-live rdt-sr-range"} data-testid="range-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{rangeAnnounce()}</div></Show>}{<Show when={!!liveAnnounce()}><div class={"rdt-sr-live rdt-sr-sortfilter"} data-testid="sortfilter-announce" role="status" aria-live="polite" aria-atomic="true" data-rozie-s-d5dcab4c="">{liveAnnounce()}</div></Show>}<div class={"rdt-toolbar"} data-rozie-s-d5dcab4c="">
      <input type="text" role="searchbox" aria-label="Search table" class={"rdt-global-filter"} value={globalFilterValue()} onInput={($event) => {
		onGlobalFilterInput($event);
	}} data-rozie-s-d5dcab4c="" />
      
      {<Show when={allLeafColumns().length}><details class={"rdt-colvis"} data-rozie-s-d5dcab4c="">
        <summary class={"rdt-colvis-summary"} data-rozie-s-d5dcab4c="">Columns</summary>
        <div class={"rdt-colvis-menu"} role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c="">
          <Key each={allLeafColumns()} by={(lc) => lc.id}>{(lc) => <label class={"rdt-colvis-item"} data-rozie-s-d5dcab4c="">
            <input type="checkbox" class={"rdt-colvis-checkbox"} checked={lc().visible} onChange={($event) => {
		onToggleVisibility(lc().id);
	}} data-rozie-s-d5dcab4c="" />
            <span class={"rdt-colvis-label"} data-rozie-s-d5dcab4c="">{rozieDisplay(lc().label)}</span>
          </label>}</Key>
        </div>
      </details></Show>}</div>


    {<Show when={local.groupable}><div class={"rdt-group-bar-host"} data-rozie-s-d5dcab4c="">
      {(_props.groupBarSlot ?? _props.slots?.["groupBar"])?.({
		get grouping() {
			return groupingKeys();
		},
		get groupableColumns() {
			return groupableColumns();
		},
		applyGrouping,
		clearGrouping
	}) ?? <Key each={groupingKeys()} by={(gk) => gk}>{(gk) => <span class={"rdt-group-token"} data-group-token="" data-rozie-s-d5dcab4c="">{rozieDisplay(gk())}</span>}</Key>}
    </div></Show>}{<Show when={isWindowed()} fallback={<table aria-rowcount={rozieAttr(gridAriaRowCount())} aria-colcount={rozieAttr(gridAriaColCount())} class={"rozie-data-table " + rozieClass({ "rdt-sticky": local.stickyHeader })} role={rozieAttr(tableRole())} onKeyDown={($event) => {
		onGridKeyDown($event);
	}} onFocusIn={($event) => {
		syncActiveFromEvent($event);
	}} onFocusOut={($event) => {
		onGridFocusOut($event);
	}} onMouseDown={($event) => {
		onGridMouseDown($event);
	}} onDblClick={($event) => {
		onGridDblClick($event);
	}} onClick={($event) => {
		onGridClick($event);
	}} data-rozie-s-d5dcab4c="">
      <thead class={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <Key each={headerGroups()} by={(hg) => hg.id}>{(hg, hgLevel) => <tr class={"rdt-tr"} role="row" aria-rowindex={rozieAttr(hgLevel() + 1)} data-rozie-s-d5dcab4c="">
          <Key each={hg().headers} by={(header) => header.id}>{(header) => <th class={"rdt-th " + rozieClass({
		"rdt-select-th": isSelectColumn(header().column.id),
		"rdt-expander-th": isExpanderColumn(header().column.id),
		"rdt-th-resizing": columnIsResizing(header().column.id),
		"rdt-cell-active": isActiveCell("__header", headerColIndexOf(hg(), header()), hgLevel())
	})} role="columnheader" data-col={rozieAttr(header().column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel())} colSpan={rozieAttr(header().colSpan > 1 ? header().colSpan : null)} data-col-index={rozieAttr(headerColIndexOf(hg(), header()))} aria-colindex={rozieAttr(headerLeafStart(hg(), header()) + 1)} tabIndex={rozieAttr(cellTabindex("__header", headerColIndexOf(hg(), header()), hgLevel()))} aria-sort={rozieAttr(ariaSortFor(header().column.id))} style={parseInlineStyle(thStyle(header()))} data-rozie-s-d5dcab4c="">
            
            
            {<Show when={isSelectColumn(header().column.id)} fallback={<Show when={isExpanderColumn(header().column.id)} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              
              {<Show when={header().column.getCanSort && header().column.getCanSort()} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {_props.slots?.[`colHeader-${header().column.id}`]?.({
		get columnId() {
			return header().column.id;
		},
		get column() {
			return header().column;
		},
		get label() {
			return headerLabel(header().column.id);
		}
	}) ?? (_props.colHeaderSlot ?? _props.slots?.["colHeader"])?.({
		get columnId() {
			return header().column.id;
		},
		get column() {
			return header().column;
		},
		get label() {
			return headerLabel(header().column.id);
		}
	}) ?? rozieDisplay(headerLabel(header().column.id))}
                </span>
              </span>}><button type="button" class={"rdt-sort-btn"} onClick={($event) => {
		onHeaderSort(header().column.id, $event);
	}} data-rozie-s-d5dcab4c="">
                
                <span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {_props.slots?.[`colHeader-${header().column.id}`]?.({
		get columnId() {
			return header().column.id;
		},
		get column() {
			return header().column;
		},
		get label() {
			return headerLabel(header().column.id);
		}
	}) ?? (_props.colHeaderSlot ?? _props.slots?.["colHeader"])?.({
		get columnId() {
			return header().column.id;
		},
		get column() {
			return header().column;
		},
		get label() {
			return headerLabel(header().column.id);
		}
	}) ?? rozieDisplay(headerLabel(header().column.id))}
                </span>
                <span class={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(header().column.id))}</span>
              </button></Show>}<Popover trigger="click" placement="bottom-end" strategy="fixed" offset={4} data-rozie-s-d5dcab4c="" anchorSlot={() => <>
                  <button type="button" class={"rdt-col-menu-trigger"} aria-label={rozieAttr("Column options for " + headerLabel(header().column.id))} data-rozie-s-d5dcab4c="">⋯</button>
                </>}><div class={"rdt-col-menu"} role="menu" data-rozie-s-d5dcab4c="">
                  <button type="button" role="menuitem" aria-pressed={columnPinSide(header().column.id) === "left"} class={"rdt-col-menu-item"} onClick={($event) => {
		onPinColumn(header().column.id, "left", $event);
	}} data-rozie-s-d5dcab4c="">Pin left</button>
                  <button type="button" role="menuitem" aria-pressed={columnPinSide(header().column.id) === "right"} class={"rdt-col-menu-item"} onClick={($event) => {
		onPinColumn(header().column.id, "right", $event);
	}} data-rozie-s-d5dcab4c="">Pin right</button>
                  <button type="button" role="menuitem" aria-pressed={!columnPinSide(header().column.id)} class={"rdt-col-menu-item"} onClick={($event) => {
		onPinColumn(header().column.id, false, $event);
	}} data-rozie-s-d5dcab4c="">Unpin</button>
                  <hr class={"rdt-col-menu-sep"} data-rozie-s-d5dcab4c="" />
                  <button type="button" role="menuitem" class={"rdt-col-menu-item"} onClick={($event) => {
		onHideColumn(header().column.id, $event);
	}} data-rozie-s-d5dcab4c="">Hide column</button>
                </div></Popover>
              
              <button type="button" aria-label={rozieAttr("Resize " + headerLabel(header().column.id))} class={"rdt-resize-handle"} onPointerDown={($event) => {
		onResizeStart(header().column.id, $event);
	}} onTouchStart={($event) => {
		onResizeStart(header().column.id, $event);
	}} data-rozie-s-d5dcab4c=""><span class={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectAllSlot ?? _props.slots?.["selectAll"])?.({
		get checked() {
			return isAllRowsSelected();
		},
		get indeterminate() {
			return isSomeRowsSelected();
		},
		get toggle() {
			return onToggleAllRows;
		}
	}) ?? <Show when={local.selectionMode === "multiple"}><input type="checkbox" aria-label="Select all rows" class={"rdt-select-all"} checked={isAllRowsSelected()} onChange={($event) => {
		onToggleAllRows($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}
            </span></Show>}</th>}</Key>
        </tr>}</Key>
        
        {<Show when={hasAnyFilterableColumn()}><tr class={"rdt-filter-row"} data-rozie-s-d5dcab4c="">
          <Key each={headerGroups()[headerGroups().length - 1].headers} by={(header) => header.id}>{(header) => <th class={"rdt-filter-cell"} role="presentation" style={parseInlineStyle(pinStyle(header().column.id))} data-rozie-s-d5dcab4c="">
            {<Show when={isSelectColumn(header().column.id)} fallback={<Show when={isExpanderColumn(header().column.id)} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={columnIsFilterable(header().column.id)}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {_props.slots?.[`filter-${header().column.id}`]?.({
		get columnId() {
			return header().column.id;
		},
		get value() {
			return columnFilterValue(header().column.id);
		},
		get uniqueValues() {
			return getFacetedUniqueValues$1(header().column.id);
		},
		get minMax() {
			return getFacetedMinMaxValues$1(header().column.id);
		},
		get columnLabel() {
			return headerLabel(header().column.id);
		},
		get setFilter() {
			return setColumnFilter;
		}
	}) ?? (_props.filterSlot ?? _props.slots?.["filter"])?.({
		get columnId() {
			return header().column.id;
		},
		get value() {
			return columnFilterValue(header().column.id);
		},
		get uniqueValues() {
			return getFacetedUniqueValues$1(header().column.id);
		},
		get minMax() {
			return getFacetedMinMaxValues$1(header().column.id);
		},
		get columnLabel() {
			return headerLabel(header().column.id);
		},
		get setFilter() {
			return setColumnFilter;
		}
	}) ?? <input type="text" aria-label={rozieAttr("Filter " + headerLabel(header().column.id))} class={"rdt-col-filter"} value={columnFilterValue(header().column.id)} onInput={($event) => {
		onColumnFilterInput(header().column.id, $event);
	}} onClick={($event) => {
		stopEvent($event);
	}} data-rozie-s-d5dcab4c="" />}
              </span></Show>}</span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}</th>}</Key>
        </tr></Show>}</thead>

      <tbody class={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        
        <Key each={rows()} by={(row) => row.id}>{(row) => <>
        <tr class={"rdt-tr " + rozieClass({ "rdt-group-header": rowIsGrouped(row()) })} role="row" data-depth={rozieAttr(row().depth)} aria-rowindex={rozieAttr(bodyAriaRowIndex(row()))} data-group-header={rozieAttr(rowIsGrouped(row()) ? row().id : null)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(row()) ? row().id : null)} aria-expanded={(rowIsGrouped(row()) ? !!rowIsExpanded(row()) : null) ?? void 0} aria-selected={(local.selectionMode !== "none" ? !!rowIsSelected(row()) : null) ?? void 0} aria-level={rozieAttr(groupingActive() ? row().depth + 1 : null)} data-rozie-s-d5dcab4c="">
          <Key each={visibleCellsFor(row())} by={(cell) => cell.id}>{(cell) => <td class={"rdt-td " + rozieClass({
		"rdt-select-td": isSelectColumn(cell().column.id),
		"rdt-expander-td": isExpanderColumn(cell().column.id),
		"rdt-in-range": inRange(rowIndexOf(row()), colIndexOf(row(), cell())),
		"rdt-cell-active": isActiveCell(String(rowIndexOf(row())), colIndexOf(row(), cell()))
	})} role={rozieAttr(cellRole())} data-col={rozieAttr(cell().column.id)} data-grid-cell="" data-row={rozieAttr(rowIndexOf(row()))} data-col-index={rozieAttr(colIndexOf(row(), cell()))} tabIndex={rozieAttr(cellTabindex(String(rowIndexOf(row())), colIndexOf(row(), cell())))} style={parseInlineStyle(bodyCellStyle(row(), cell().column.id))} aria-invalid={rozieAttr(cellAriaInvalid(rowIndexOf(row()), colIndexOf(row(), cell())))} aria-colindex={rozieAttr(colIndexOf(row(), cell()) + 1)} aria-selected={(inRange(rowIndexOf(row()), colIndexOf(row(), cell())) ? "true" : null) ?? void 0} data-in-range={rozieAttr(inRange(rowIndexOf(row()), colIndexOf(row(), cell())) ? "true" : null)} data-agg-cell={rozieAttr(cellIsAggregated(cell()) ? cell().column.id : null)} data-rozie-s-d5dcab4c="">
            
            {<Show when={isExpanderColumn(cell().column.id)} fallback={<Show when={isSelectColumn(cell().column.id)} fallback={<Show when={cellIsGrouped(cell())} fallback={<Show when={isEditing(rowIndexOf(row()), colIndexOf(row(), cell()))} fallback={<Show when={cellIsPlaceholder(cell())} fallback={<span class={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {_props.slots?.[`cell-${cell().column.id}`]?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(row());
		},
		get value() {
			return cell().getValue();
		}
	}) ?? (_props.cellSlot ?? _props.slots?.["cell"])?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(row());
		},
		get value() {
			return cell().getValue();
		}
	}) ?? rozieDisplay(cell().getValue())}
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={editorTypeOf(cell().column.id) === "number"} fallback={<Show when={editorTypeOf(cell().column.id) === "select"} fallback={<Show when={editorTypeOf(cell().column.id) === "checkbox"} fallback={<Show when={editorTypeOf(cell().column.id) === "custom"} fallback={<input type="text" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onInput={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" />}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {_props.slots?.[`editor-${cell().column.id}`]?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(row());
		},
		get value() {
			return editorValueFor(cell().column.id);
		},
		get commit() {
			return editorCommitFor(cell().column.id);
		},
		get cancel() {
			return editorCancelFor();
		},
		get columnLabel() {
			return headerLabel(cell().column.id);
		},
		get autofocus() {
			return editorAutofocusFor(cell().column.id, rowIndexOf(row()));
		}
	}) ?? (_props.editorSlot ?? _props.slots?.["editor"])?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(row());
		},
		get value() {
			return editorValueFor(cell().column.id);
		},
		get commit() {
			return editorCommitFor(cell().column.id);
		},
		get cancel() {
			return editorCancelFor();
		},
		get columnLabel() {
			return headerLabel(cell().column.id);
		},
		get autofocus() {
			return editorAutofocusFor(cell().column.id, rowIndexOf(row()));
		}
	}) ?? <input type="text" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onInput={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" />}
              </span></Show>}><input type="checkbox" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} checked={editorCheckedFor(cell().column.id)} onChange={($event) => {
		onCellEditorCheckbox(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}><select data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onChange={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="">
                <Key each={editorOptionsOf(cell().column.id)} by={(opt) => opt.value}>{(opt) => <option value={rozieAttr(opt().value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt().label)}</option>}</Key>
              </select></Show>}><input type="number" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onInput={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}</span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" data-expander="" aria-expanded={!!rowIsExpanded(row())} aria-label={rozieAttr(rowIsExpanded(row()) ? "Collapse group" : "Expand group")} class={"rdt-expander rdt-group-toggle"} onClick={($event) => {
		onToggleExpand(row(), $event);
	}} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row()) ? "▾" : "▸")}</button>
              <span class={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {_props.slots?.[`cell-${cell().column.id}`]?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(row());
		},
		get value() {
			return cell().getValue();
		}
	}) ?? (_props.cellSlot ?? _props.slots?.["cell"])?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(row());
		},
		get value() {
			return cell().getValue();
		}
	}) ?? rozieDisplay(cell().getValue())}
              </span>
              <span class={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay("(" + groupSubRowCount(row()) + ")")}</span>
            </span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectCellSlot ?? _props.slots?.["selectCell"])?.({
		get row() {
			return cellSlotRow(row());
		},
		get checked() {
			return rowIsSelected(row());
		},
		toggle: (e) => onToggleRow(row(), e)
	}) ?? <input type="checkbox" aria-label="Select row" class={"rdt-select-row"} checked={rowIsSelected(row())} onChange={($event) => {
		onToggleRow(row(), $event);
	}} data-rozie-s-d5dcab4c="" />}
            </span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={rowCanExpand(row())}><button type="button" data-expander="" aria-expanded={!!rowIsExpanded(row())} aria-label={rozieAttr(rowIsExpanded(row()) ? "Collapse row" : "Expand row")} class={"rdt-expander"} onClick={($event) => {
		onToggleExpand(row(), $event);
	}} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(row()) ? "▾" : "▸")}</button></Show>}</span></Show>}{<Show when={isFillHandleCell(rowIndexOf(row()), colIndexOf(row(), cell()))}><span data-fill-handle="" data-testid="fill-handle" aria-hidden="true" class={"rdt-fill-handle"} onPointerDown={($event) => {
		onFillHandlePointerDown($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}</td>}</Key>
        </tr>
        
        {<Show when={rowShowsDetail(row())}><tr class={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(row().id)} data-rozie-s-d5dcab4c="">
          <td class={"rdt-detail-cell"} colSpan={rozieAttr(visibleColCount())} data-rozie-s-d5dcab4c="">
            {(_props.detailSlot ?? _props.slots?.["detail"])?.({ get row() {
		return row().original;
	} })}
          </td>
        </tr></Show>}</>}</Key>
      </tbody>
    </table>}><div class={"rdt-scroll"} style={parseInlineStyle(rowsWindowed() && local.maxHeight ? "max-height:" + local.maxHeight + ";overflow:auto;--rozie-data-table-max-height:" + local.maxHeight : "overflow:auto")} data-rozie-s-d5dcab4c="">
    <table aria-rowcount={rozieAttr(gridAriaRowCount())} aria-colcount={rozieAttr(gridAriaColCount())} class={"rozie-data-table " + rozieClass({
		"rdt-sticky": local.stickyHeader,
		"rdt-col-windowed": colsWindowed()
	})} role={rozieAttr(tableRole())} onKeyDown={($event) => {
		onGridKeyDown($event);
	}} onFocusIn={($event) => {
		syncActiveFromEvent($event);
	}} onFocusOut={($event) => {
		onGridFocusOut($event);
	}} onMouseDown={($event) => {
		onGridMouseDown($event);
	}} onDblClick={($event) => {
		onGridDblClick($event);
	}} onClick={($event) => {
		onGridClick($event);
	}} data-rozie-s-d5dcab4c="">
      <thead class={"rdt-thead"} role="rowgroup" data-rozie-s-d5dcab4c="">
        <Key each={headerGroups()} by={(hg) => hg.id}>{(hg, hgLevel) => <tr class={"rdt-tr"} role="row" aria-rowindex={rozieAttr(hgLevel() + 1)} data-rozie-s-d5dcab4c="">
          
          {<Show when={colsWindowed()}><th class={"rdt-col-spacer"} aria-hidden="true" style={parseInlineStyle("width:" + colPadLeft() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" /></Show>}<Key each={windowedHeadersFor(hg(), hgLevel())} by={(wh) => wh.header.id}>{(wh) => <th class={"rdt-th " + rozieClass({
		"rdt-select-th": isSelectColumn(wh().header.column.id),
		"rdt-expander-th": isExpanderColumn(wh().header.column.id),
		"rdt-th-resizing": columnIsResizing(wh().header.column.id),
		"rdt-cell-active": isActiveCell("__header", headerColIndexOf(hg(), wh().header), hgLevel())
	})} role="columnheader" data-col={rozieAttr(wh().header.column.id)} data-grid-cell="" data-row="__header" data-header-level={rozieAttr(hgLevel())} colSpan={rozieAttr(wh().span > 1 ? wh().span : null)} data-col-index={rozieAttr(headerColIndexOf(hg(), wh().header))} aria-colindex={rozieAttr(headerLeafStart(hg(), wh().header) + 1)} tabIndex={rozieAttr(cellTabindex("__header", headerColIndexOf(hg(), wh().header), hgLevel()))} aria-sort={rozieAttr(ariaSortFor(wh().header.column.id))} style={parseInlineStyle(thStyle(wh().header, wh().width))} data-rozie-s-d5dcab4c="">
            {<Show when={isSelectColumn(wh().header.column.id)} fallback={<Show when={isExpanderColumn(wh().header.column.id)} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={wh().header.column.getCanSort && wh().header.column.getCanSort()} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                <span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {_props.slots?.[`colHeader-${wh().header.column.id}`]?.({
		get columnId() {
			return wh().header.column.id;
		},
		get column() {
			return wh().header.column;
		},
		get label() {
			return headerLabel(wh().header.column.id);
		}
	}) ?? (_props.colHeaderSlot ?? _props.slots?.["colHeader"])?.({
		get columnId() {
			return wh().header.column.id;
		},
		get column() {
			return wh().header.column;
		},
		get label() {
			return headerLabel(wh().header.column.id);
		}
	}) ?? rozieDisplay(headerLabel(wh().header.column.id))}
                </span>
              </span>}><button type="button" class={"rdt-sort-btn"} onClick={($event) => {
		onHeaderSort(wh().header.column.id, $event);
	}} data-rozie-s-d5dcab4c="">
                <span class={"rdt-header-label"} data-rozie-s-d5dcab4c="">
                  {_props.slots?.[`colHeader-${wh().header.column.id}`]?.({
		get columnId() {
			return wh().header.column.id;
		},
		get column() {
			return wh().header.column;
		},
		get label() {
			return headerLabel(wh().header.column.id);
		}
	}) ?? (_props.colHeaderSlot ?? _props.slots?.["colHeader"])?.({
		get columnId() {
			return wh().header.column.id;
		},
		get column() {
			return wh().header.column;
		},
		get label() {
			return headerLabel(wh().header.column.id);
		}
	}) ?? rozieDisplay(headerLabel(wh().header.column.id))}
                </span>
                <span class={"rdt-sort-ind"} aria-hidden="true" data-rozie-s-d5dcab4c="">{rozieDisplay(sortIndicator(wh().header.column.id))}</span>
              </button></Show>}<Popover trigger="click" placement="bottom-end" strategy="fixed" offset={4} data-rozie-s-d5dcab4c="" anchorSlot={() => <>
                  <button type="button" class={"rdt-col-menu-trigger"} aria-label={rozieAttr("Column options for " + headerLabel(wh().header.column.id))} data-rozie-s-d5dcab4c="">⋯</button>
                </>}><div class={"rdt-col-menu"} role="menu" data-rozie-s-d5dcab4c="">
                  <button type="button" role="menuitem" aria-pressed={columnPinSide(wh().header.column.id) === "left"} class={"rdt-col-menu-item"} onClick={($event) => {
		onPinColumn(wh().header.column.id, "left", $event);
	}} data-rozie-s-d5dcab4c="">Pin left</button>
                  <button type="button" role="menuitem" aria-pressed={columnPinSide(wh().header.column.id) === "right"} class={"rdt-col-menu-item"} onClick={($event) => {
		onPinColumn(wh().header.column.id, "right", $event);
	}} data-rozie-s-d5dcab4c="">Pin right</button>
                  <button type="button" role="menuitem" aria-pressed={!columnPinSide(wh().header.column.id)} class={"rdt-col-menu-item"} onClick={($event) => {
		onPinColumn(wh().header.column.id, false, $event);
	}} data-rozie-s-d5dcab4c="">Unpin</button>
                  <hr class={"rdt-col-menu-sep"} data-rozie-s-d5dcab4c="" />
                  <button type="button" role="menuitem" class={"rdt-col-menu-item"} onClick={($event) => {
		onHideColumn(wh().header.column.id, $event);
	}} data-rozie-s-d5dcab4c="">Hide column</button>
                </div></Popover>
              <button type="button" aria-label={rozieAttr("Resize " + headerLabel(wh().header.column.id))} class={"rdt-resize-handle"} onPointerDown={($event) => {
		onResizeStart(wh().header.column.id, $event);
	}} onTouchStart={($event) => {
		onResizeStart(wh().header.column.id, $event);
	}} data-rozie-s-d5dcab4c=""><span class={"rdt-resize-grip"} aria-hidden="true" data-rozie-s-d5dcab4c="" /></button>
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectAllSlot ?? _props.slots?.["selectAll"])?.({
		get checked() {
			return isAllRowsSelected();
		},
		get indeterminate() {
			return isSomeRowsSelected();
		},
		get toggle() {
			return onToggleAllRows;
		}
	}) ?? <Show when={local.selectionMode === "multiple"}><input type="checkbox" aria-label="Select all rows" class={"rdt-select-all"} checked={isAllRowsSelected()} onChange={($event) => {
		onToggleAllRows($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}
            </span></Show>}</th>}</Key>
          
          {<Show when={colsWindowed()}><th class={"rdt-col-spacer"} aria-hidden="true" style={parseInlineStyle("width:" + colPadRight() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" /></Show>}</tr>}</Key>
        
        {<Show when={hasAnyFilterableColumn()}><tr class={"rdt-filter-row"} data-rozie-s-d5dcab4c="">
          {<Show when={colsWindowed()}><th class={"rdt-col-spacer"} aria-hidden="true" style={parseInlineStyle("width:" + colPadLeft() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" /></Show>}<Key each={windowedHeadersFor(headerGroups()[headerGroups().length - 1], headerGroups().length - 1)} by={(wh) => wh.header.id}>{(wh) => <th class={"rdt-filter-cell"} role="presentation" data-col={rozieAttr(wh().header.column.id)} style={parseInlineStyle(pinStyle(wh().header.column.id))} data-rozie-s-d5dcab4c="">
            {<Show when={isSelectColumn(wh().header.column.id)} fallback={<Show when={isExpanderColumn(wh().header.column.id)} fallback={<span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={columnIsFilterable(wh().header.column.id)}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {_props.slots?.[`filter-${wh().header.column.id}`]?.({
		get columnId() {
			return wh().header.column.id;
		},
		get value() {
			return columnFilterValue(wh().header.column.id);
		},
		get uniqueValues() {
			return getFacetedUniqueValues$1(wh().header.column.id);
		},
		get minMax() {
			return getFacetedMinMaxValues$1(wh().header.column.id);
		},
		get columnLabel() {
			return headerLabel(wh().header.column.id);
		},
		get setFilter() {
			return setColumnFilter;
		}
	}) ?? (_props.filterSlot ?? _props.slots?.["filter"])?.({
		get columnId() {
			return wh().header.column.id;
		},
		get value() {
			return columnFilterValue(wh().header.column.id);
		},
		get uniqueValues() {
			return getFacetedUniqueValues$1(wh().header.column.id);
		},
		get minMax() {
			return getFacetedMinMaxValues$1(wh().header.column.id);
		},
		get columnLabel() {
			return headerLabel(wh().header.column.id);
		},
		get setFilter() {
			return setColumnFilter;
		}
	}) ?? <input type="text" aria-label={rozieAttr("Filter " + headerLabel(wh().header.column.id))} class={"rdt-col-filter"} value={columnFilterValue(wh().header.column.id)} onInput={($event) => {
		onColumnFilterInput(wh().header.column.id, $event);
	}} onClick={($event) => {
		stopEvent($event);
	}} data-rozie-s-d5dcab4c="" />}
              </span></Show>}</span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}</th>}</Key>
          {<Show when={colsWindowed()}><th class={"rdt-col-spacer"} aria-hidden="true" style={parseInlineStyle("width:" + colPadRight() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" /></Show>}</tr></Show>}</thead>

      <tbody class={"rdt-tbody"} role="rowgroup" data-rozie-s-d5dcab4c="">
        
        <tr class={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={rozieAttr(windowedColSpan())} style={parseInlineStyle("height:" + padTop() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" />
        </tr>
        
        <Key each={windowedRows()} by={(wr) => wr.row.id}>{(wr) => <>
        <tr class={"rdt-tr " + rozieClass({
		"rdt-group-header": rowIsGrouped(wr().row),
		"rdt-row-pinned": wr().pinned
	})} role="row" data-row={rozieAttr(wr().vi.index)} aria-rowindex={rozieAttr(headerRowCount() + wr().vi.index + 1)} data-index={rozieAttr(wr().vi.index)} data-pinned={rozieAttr(wr().pinned ? "true" : null)} data-depth={rozieAttr(wr().row.depth)} data-group-header={rozieAttr(rowIsGrouped(wr().row) ? wr().row.id : null)} data-group-leaf={rozieAttr(groupingActive() && !rowIsGrouped(wr().row) ? wr().row.id : null)} aria-expanded={(rowIsGrouped(wr().row) ? !!rowIsExpanded(wr().row) : null) ?? void 0} aria-selected={(local.selectionMode !== "none" ? !!rowIsSelected(wr().row) : null) ?? void 0} aria-level={rozieAttr(groupingActive() ? wr().row.depth + 1 : null)} data-rozie-s-d5dcab4c="">
          
          {<Show when={colsWindowed()}><td class={"rdt-col-spacer"} aria-hidden="true" style={parseInlineStyle("width:" + colPadLeft() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" /></Show>}<Key each={windowedCells(wr().row)} by={(cell) => cell.id}>{(cell) => <td class={"rdt-td " + rozieClass({
		"rdt-select-td": isSelectColumn(cell().column.id),
		"rdt-expander-td": isExpanderColumn(cell().column.id),
		"rdt-in-range": inRange(wr().vi.index, colIndexOf(wr().row, cell())),
		"rdt-cell-active": isActiveCell(String(wr().vi.index), colIndexOf(wr().row, cell()))
	})} role={rozieAttr(cellRole())} data-col={rozieAttr(cell().column.id)} data-grid-cell="" data-row={rozieAttr(wr().vi.index)} data-col-index={rozieAttr(colIndexOf(wr().row, cell()))} tabIndex={rozieAttr(cellTabindex(String(wr().vi.index), colIndexOf(wr().row, cell())))} style={parseInlineStyle(bodyCellStyle(wr().row, cell().column.id))} aria-invalid={rozieAttr(cellAriaInvalid(wr().vi.index, colIndexOf(wr().row, cell())))} aria-colindex={rozieAttr(colIndexOf(wr().row, cell()) + 1)} aria-selected={(inRange(wr().vi.index, colIndexOf(wr().row, cell())) ? "true" : null) ?? void 0} data-in-range={rozieAttr(inRange(wr().vi.index, colIndexOf(wr().row, cell())) ? "true" : null)} data-agg-cell={rozieAttr(cellIsAggregated(cell()) ? cell().column.id : null)} data-rozie-s-d5dcab4c="">
            
            {<Show when={isExpanderColumn(cell().column.id)} fallback={<Show when={isSelectColumn(cell().column.id)} fallback={<Show when={cellIsGrouped(cell())} fallback={<Show when={isEditing(wr().vi.index, colIndexOf(wr().row, cell()))} fallback={<Show when={cellIsPlaceholder(cell())} fallback={<span class={"rdt-cell-value"} data-rozie-s-d5dcab4c="">
              {_props.slots?.[`cell-${cell().column.id}`]?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(wr().row);
		},
		get value() {
			return cell().getValue();
		}
	}) ?? (_props.cellSlot ?? _props.slots?.["cell"])?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(wr().row);
		},
		get value() {
			return cell().getValue();
		}
	}) ?? rozieDisplay(cell().getValue())}
            </span>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="" /></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={editorTypeOf(cell().column.id) === "number"} fallback={<Show when={editorTypeOf(cell().column.id) === "select"} fallback={<Show when={editorTypeOf(cell().column.id) === "checkbox"} fallback={<Show when={editorTypeOf(cell().column.id) === "custom"} fallback={<input type="text" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onInput={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" />}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
                {_props.slots?.[`editor-${cell().column.id}`]?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(wr().row);
		},
		get value() {
			return editorValueFor(cell().column.id);
		},
		get commit() {
			return editorCommitFor(cell().column.id);
		},
		get cancel() {
			return editorCancelFor();
		},
		get columnLabel() {
			return headerLabel(cell().column.id);
		},
		get autofocus() {
			return editorAutofocusFor(cell().column.id, wr().vi.index);
		}
	}) ?? (_props.editorSlot ?? _props.slots?.["editor"])?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(wr().row);
		},
		get value() {
			return editorValueFor(cell().column.id);
		},
		get commit() {
			return editorCommitFor(cell().column.id);
		},
		get cancel() {
			return editorCancelFor();
		},
		get columnLabel() {
			return headerLabel(cell().column.id);
		},
		get autofocus() {
			return editorAutofocusFor(cell().column.id, wr().vi.index);
		}
	}) ?? <input type="text" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onInput={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" />}
              </span></Show>}><input type="checkbox" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} checked={editorCheckedFor(cell().column.id)} onChange={($event) => {
		onCellEditorCheckbox(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}><select data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onChange={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="">
                <Key each={editorOptionsOf(cell().column.id)} by={(opt) => opt.value}>{(opt) => <option value={rozieAttr(opt().value)} data-rozie-s-d5dcab4c="">{rozieDisplay(opt().label)}</option>}</Key>
              </select></Show>}><input type="number" data-editing-cell="" data-builtin-editor="" aria-invalid={rozieAttr(invalidMsg() ? "true" : null)} class={"rdt-cell-editor"} value={editorValueFor(cell().column.id)} onInput={($event) => {
		onCellEditorInput(cell().column.id, $event);
	}} onKeyDown={($event) => {
		onEditorKeyDown($event);
	}} onBlur={($event) => {
		onEditorBlur($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}</span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              <button type="button" data-expander="" aria-expanded={!!rowIsExpanded(wr().row)} aria-label={rozieAttr(rowIsExpanded(wr().row) ? "Collapse group" : "Expand group")} class={"rdt-expander rdt-group-toggle"} onClick={($event) => {
		onToggleExpand(wr().row, $event);
	}} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(wr().row) ? "▾" : "▸")}</button>
              <span class={"rdt-group-value"} data-rozie-s-d5dcab4c="">
                {_props.slots?.[`cell-${cell().column.id}`]?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(wr().row);
		},
		get value() {
			return cell().getValue();
		}
	}) ?? (_props.cellSlot ?? _props.slots?.["cell"])?.({
		get columnId() {
			return cell().column.id;
		},
		get column() {
			return cell().column;
		},
		get row() {
			return cellSlotRow(wr().row);
		},
		get value() {
			return cell().getValue();
		}
	}) ?? rozieDisplay(cell().getValue())}
              </span>
              <span class={"rdt-group-count"} data-rozie-s-d5dcab4c="">{rozieDisplay("(" + groupSubRowCount(wr().row) + ")")}</span>
            </span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {(_props.selectCellSlot ?? _props.slots?.["selectCell"])?.({
		get row() {
			return cellSlotRow(wr().row);
		},
		get checked() {
			return rowIsSelected(wr().row);
		},
		toggle: (e) => onToggleRow(wr().row, e)
	}) ?? <input type="checkbox" aria-label="Select row" class={"rdt-select-row"} checked={rowIsSelected(wr().row)} onChange={($event) => {
		onToggleRow(wr().row, $event);
	}} data-rozie-s-d5dcab4c="" />}
            </span></Show>}><span style={{ display: "contents" }} data-rozie-s-d5dcab4c="">
              {<Show when={rowCanExpand(wr().row)}><button type="button" data-expander="" aria-expanded={!!rowIsExpanded(wr().row)} aria-label={rozieAttr(rowIsExpanded(wr().row) ? "Collapse row" : "Expand row")} class={"rdt-expander"} onClick={($event) => {
		onToggleExpand(wr().row, $event);
	}} data-rozie-s-d5dcab4c="">{rozieDisplay(rowIsExpanded(wr().row) ? "▾" : "▸")}</button></Show>}</span></Show>}{<Show when={isFillHandleCell(wr().vi.index, colIndexOf(wr().row, cell()))}><span data-fill-handle="" data-testid="fill-handle" aria-hidden="true" class={"rdt-fill-handle"} onPointerDown={($event) => {
		onFillHandlePointerDown($event);
	}} data-rozie-s-d5dcab4c="" /></Show>}</td>}</Key>
          
          {<Show when={colsWindowed()}><td class={"rdt-col-spacer"} aria-hidden="true" style={parseInlineStyle("width:" + colPadRight() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" /></Show>}</tr>
        
        {<Show when={rowShowsDetail(wr().row)}><tr class={"rdt-detail-row"} role="row" data-detail-row={rozieAttr(wr().row.id)} data-rozie-s-d5dcab4c="">
          <td class={"rdt-detail-cell"} colSpan={rozieAttr(windowedColSpan())} data-rozie-s-d5dcab4c="">
            {(_props.detailSlot ?? _props.slots?.["detail"])?.({ get row() {
		return wr().row.original;
	} })}
          </td>
        </tr></Show>}</>}</Key>
        
        <tr class={"rdt-spacer"} aria-hidden="true" data-rozie-s-d5dcab4c="">
          <td colSpan={rozieAttr(windowedColSpan())} style={parseInlineStyle("height:" + padBottom() + "px;padding:0;border:0")} data-rozie-s-d5dcab4c="" />
        </tr>
      </tbody>
    </table>
    </div></Show>}{<Show when={!rowsWindowed()}><div class={"rdt-pagination"} role="group" aria-label="Pagination" data-rozie-s-d5dcab4c="">
      <button type="button" class={"rdt-page-btn rdt-page-prev"} disabled={!canPrevPage()} onClick={($event) => {
		onPrevPage();
	}} data-rozie-s-d5dcab4c="">Prev</button>
      <span class={"rdt-page-status"} aria-live="polite" data-rozie-s-d5dcab4c="">
        {rozieDisplay("Page " + (pageIndex() + 1) + " of " + displayPageCount())}
      </span>
      <button type="button" class={"rdt-page-btn rdt-page-next"} disabled={!canNextPage()} onClick={($event) => {
		onNextPage();
	}} data-rozie-s-d5dcab4c="">Next</button>
      <select aria-label="Rows per page" class={"rdt-page-size"} value={pageSize()} onChange={($event) => {
		onPageSizeChange($event);
	}} data-rozie-s-d5dcab4c="">
        <option value={10} data-rozie-s-d5dcab4c="">10</option>
        <option value={25} data-rozie-s-d5dcab4c="">25</option>
        <option value={50} data-rozie-s-d5dcab4c="">50</option>
        <option value={100} data-rozie-s-d5dcab4c="">100</option>
      </select>
    </div></Show>}</div>
    </>
    </__ctx_data_table_columns.Provider>;
}
//#endregion
//#region src/Column.tsx
function Column(_props) {
	const [local, attrs] = splitProps(mergeProps({
		id: "",
		field: "",
		header: "",
		sortable: false,
		filterable: false,
		pinned: "",
		width: "",
		expandable: false,
		groupable: true,
		aggregationFn: null,
		editable: false,
		editor: "text",
		editorOptions: [],
		validate: null
	}, _props), [
		"id",
		"field",
		"header",
		"sortable",
		"filterable",
		"pinned",
		"width",
		"expandable",
		"groupable",
		"aggregationFn",
		"editable",
		"editor",
		"editorOptions",
		"validate"
	]);
	const registry = useContext(rozieContext("data-table:columns"));
	onMount(() => {
		const _cleanup = (() => {
			if (reg && !registered) {
				registered = true;
				reg.registerColumn(colId(), buildSpec());
			}
		})();
		if (_cleanup) onCleanup(_cleanup);
		onCleanup(() => {
			if (reg) reg.unregisterColumn(colId());
		});
	});
	createEffect(() => {
		if (registered) return;
		const live = registry;
		if (live == null) return;
		reg = live;
		registered = true;
		reg.registerColumn(colId(), buildSpec());
	});
	createEffect(on(() => [
		local.id,
		local.field,
		local.header,
		local.sortable,
		local.filterable,
		local.pinned,
		local.width,
		local.expandable,
		local.groupable,
		local.aggregationFn,
		local.editable,
		local.editor,
		local.editorOptions,
		local.validate
	], (v) => untrack(() => (() => {
		if (reg) reg.registerColumn(colId(), buildSpec());
	})()), { defer: true }));
	let reg = null;
	reg = registry;
	let registered = false;
	function colId() {
		return local.id !== "" ? local.id : local.field;
	}
	function buildSpec() {
		return {
			id: colId(),
			field: local.field !== "" ? local.field : colId(),
			header: local.header,
			sortable: local.sortable,
			filterable: local.filterable,
			pinned: local.pinned,
			width: local.width,
			expandable: local.expandable,
			groupable: local.groupable,
			aggregationFn: local.aggregationFn,
			editable: local.editable,
			editor: local.editor,
			editorOptions: local.editorOptions,
			validate: local.validate
		};
	}
	return <>

    <div class={"rozie-data-table-column"} style={{ display: "none" }} data-rozie-s-289f2d72="" />
    </>;
}
//#endregion
//#region src/EditorText.tsx
function EditorText(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		row: null,
		value: null,
		commit: null,
		cancel: null,
		autofocus: false,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"row",
		"value",
		"commit",
		"cancel",
		"autofocus",
		"columnLabel"
	]);
	const [draft, setDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	onMount(() => {
		if (local.autofocus) inputElRef?.focus();
	});
	createEffect(on(() => local.autofocus, (v) => untrack(() => ((v) => {
		if (v) inputElRef?.focus();
	})(v)), { defer: true }));
	let inputElRef = null;
	function draftValue() {
		return touched() ? draft() : local.value != null ? String(local.value) : "";
	}
	function onInput(e) {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function doCommit() {
		local.commit && local.commit(draftValue());
	}
	function doCancel() {
		local.cancel && local.cancel();
	}
	function onKeydown(e) {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}
	function onBlur() {
		doCommit();
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <input type="text" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} ref={(el) => {
		inputElRef = el;
	}} class={"rdt-cell-editor"} value={draftValue()} onInput={($event) => {
		onInput($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-0d17f43a="" />
    </>;
}
//#endregion
//#region src/EditorNumber.tsx
function EditorNumber(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		row: null,
		value: null,
		commit: null,
		cancel: null,
		autofocus: false,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"row",
		"value",
		"commit",
		"cancel",
		"autofocus",
		"columnLabel"
	]);
	const [draft, setDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	onMount(() => {
		if (local.autofocus) inputElRef?.focus();
	});
	createEffect(on(() => local.autofocus, (v) => untrack(() => ((v) => {
		if (v) inputElRef?.focus();
	})(v)), { defer: true }));
	let inputElRef = null;
	function draftValue() {
		return touched() ? draft() : local.value != null ? String(local.value) : "";
	}
	function onInput(e) {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function doCommit() {
		if (!local.commit) return;
		const raw = draftValue();
		if (raw == null || String(raw).trim() === "") {
			local.commit(null);
			return;
		}
		const n = Number(raw);
		local.commit(Number.isNaN(n) ? null : n);
	}
	function doCancel() {
		local.cancel && local.cancel();
	}
	function onKeydown(e) {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}
	function onBlur() {
		doCommit();
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <input type="number" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} ref={(el) => {
		inputElRef = el;
	}} class={"rdt-cell-editor"} value={draftValue()} onInput={($event) => {
		onInput($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-b2792b32="" />
    </>;
}
//#endregion
//#region src/EditorSelect.tsx
function EditorSelect(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		row: null,
		value: null,
		commit: null,
		cancel: null,
		options: [],
		autofocus: false,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"row",
		"value",
		"commit",
		"cancel",
		"options",
		"autofocus",
		"columnLabel"
	]);
	const [draft, setDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	onMount(() => {
		if (local.autofocus) selectElRef?.focus();
	});
	createEffect(on(() => local.autofocus, (v) => untrack(() => ((v) => {
		if (v) selectElRef?.focus();
	})(v)), { defer: true }));
	let selectElRef = null;
	function draftValue() {
		return touched() ? draft() : local.value != null ? String(local.value) : "";
	}
	function onChange(e) {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function doCommit() {
		local.commit && local.commit(draftValue());
	}
	function doCancel() {
		local.cancel && local.cancel();
	}
	function onKeydown(e) {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}
	function onBlur() {
		doCommit();
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <select data-editing-cell="" aria-label={rozieAttr(a11yLabel())} ref={(el) => {
		selectElRef = el;
	}} class={"rdt-cell-editor"} value={draftValue()} onChange={($event) => {
		onChange($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-117f1a16="">
      <Key each={local.options} by={(opt) => opt.value}>{(opt) => <option value={rozieAttr(opt().value)} data-rozie-s-117f1a16="">{rozieDisplay(opt().label)}</option>}</Key>
    </select>
    </>;
}
//#endregion
//#region src/EditorCheckbox.tsx
function EditorCheckbox(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		row: null,
		value: null,
		commit: null,
		cancel: null,
		autofocus: false,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"row",
		"value",
		"commit",
		"cancel",
		"autofocus",
		"columnLabel"
	]);
	onMount(() => {
		if (local.autofocus) inputElRef?.focus();
	});
	createEffect(on(() => local.autofocus, (v) => untrack(() => ((v) => {
		if (v) inputElRef?.focus();
	})(v)), { defer: true }));
	let inputElRef = null;
	function onChange(e) {
		local.commit && local.commit(!!(e && e.target ? e.target.checked : false));
	}
	function onKeydown(e) {
		if (e && e.key === "Escape") {
			e.preventDefault();
			local.cancel && local.cancel();
		}
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <input type="checkbox" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} ref={(el) => {
		inputElRef = el;
	}} class={"rdt-cell-editor"} checked={!!local.value} onChange={($event) => {
		onChange($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} data-rozie-s-3d792482="" />
    </>;
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
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		row: null,
		value: null,
		commit: null,
		cancel: null,
		autofocus: false,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"row",
		"value",
		"commit",
		"cancel",
		"autofocus",
		"columnLabel"
	]);
	const [draft, setDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	onMount(() => {
		if (local.autofocus) inputElRef?.focus();
	});
	createEffect(on(() => local.autofocus, (v) => untrack(() => ((v) => {
		if (v) inputElRef?.focus();
	})(v)), { defer: true }));
	let inputElRef = null;
	function draftValue() {
		return touched() ? draft() : toIsoDateString(local.value);
	}
	function onInput(e) {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function doCommit() {
		local.commit && local.commit(draftValue());
	}
	function doCancel() {
		local.cancel && local.cancel();
	}
	function onChange(e) {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function onKeydown(e) {
		if (e && e.key === "Enter") {
			e.preventDefault();
			doCommit();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			doCancel();
		}
	}
	function onBlur() {
		doCommit();
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <input type="date" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} ref={(el) => {
		inputElRef = el;
	}} class={"rdt-cell-editor"} value={draftValue()} onInput={($event) => {
		onInput($event);
	}} onChange={($event) => {
		onChange($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-7abe1a56="" />
    </>;
}
//#endregion
//#region src/FilterText.tsx
function FilterText(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		value: null,
		setFilter: null,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"value",
		"setFilter",
		"columnLabel"
	]);
	const [draft, setDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	createEffect(on(() => local.value, (v) => untrack(() => (setTouched(false), void 0)), { defer: true }));
	function draftValue() {
		return touched() ? draft() : local.value != null ? String(local.value) : "";
	}
	function onInput(e) {
		setDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function applyFilter() {
		local.setFilter && local.setFilter(local.columnId, draftValue());
	}
	function clearFilter() {
		setDraft("");
		setTouched(false);
		local.setFilter && local.setFilter(local.columnId, "");
	}
	function onKeydown(e) {
		if (e && e.key === "Enter") {
			e.preventDefault();
			applyFilter();
		} else if (e && e.key === "Escape") {
			e.preventDefault();
			clearFilter();
		}
	}
	function onBlur() {
		applyFilter();
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <input part="col-filter" type="text" aria-label={rozieAttr(a11yLabel())} class={"rdt-col-filter"} value={draftValue()} onInput={($event) => {
		onInput($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-18cbb44e="" />
    </>;
}
//#endregion
//#region src/FilterNumberRange.tsx
function FilterNumberRange(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		value: null,
		setFilter: null,
		minMax: null,
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"value",
		"setFilter",
		"minMax",
		"columnLabel"
	]);
	const [minDraft, setMinDraft] = createSignal("");
	const [maxDraft, setMaxDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	createEffect(on(() => Array.isArray(local.value) ? String(local.value[0]) + "\0" + String(local.value[1]) : "", (v) => untrack(() => (setTouched(false), void 0)), { defer: true }));
	function minDraftValue() {
		return touched() ? minDraft() : Array.isArray(local.value) && local.value[0] != null ? String(local.value[0]) : "";
	}
	function maxDraftValue() {
		return touched() ? maxDraft() : Array.isArray(local.value) && local.value[1] != null ? String(local.value[1]) : "";
	}
	function onMinInput(e) {
		setMinDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function onMaxInput(e) {
		setMaxDraft(e && e.target ? e.target.value : "");
		setTouched(true);
	}
	function onKeydown(e) {
		if (e && e.key === "Enter") applyRange(minDraftValue(), maxDraftValue());
	}
	function onBlur() {
		applyRange(minDraftValue(), maxDraftValue());
	}
	function minPlaceholder() {
		return Array.isArray(local.minMax) && local.minMax[0] != null ? String(local.minMax[0]) : "";
	}
	function maxPlaceholder() {
		return Array.isArray(local.minMax) && local.minMax[1] != null ? String(local.minMax[1]) : "";
	}
	function applyRange(minDraft, maxDraft) {
		const minNum = minDraft === "" ? void 0 : Number(minDraft);
		const maxNum = maxDraft === "" ? void 0 : Number(maxDraft);
		if (minNum === void 0 && maxNum === void 0) local.setFilter && local.setFilter(local.columnId, "");
		else local.setFilter && local.setFilter(local.columnId, [minNum, maxNum]);
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <span style={{
		display: "flex",
		"align-items": "center"
	}} data-rozie-s-97b2c090="">
      <input part="col-filter" type="number" aria-label={rozieAttr(a11yLabel() + " min")} class={"rdt-col-filter"} placeholder={rozieAttr(minPlaceholder())} value={minDraftValue()} onInput={($event) => {
		onMinInput($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-97b2c090="" />
      <span data-rozie-s-97b2c090=""> - </span>
      <input part="col-filter" type="number" aria-label={rozieAttr(a11yLabel() + " max")} class={"rdt-col-filter"} placeholder={rozieAttr(maxPlaceholder())} value={maxDraftValue()} onInput={($event) => {
		onMaxInput($event);
	}} onKeyDown={($event) => {
		onKeydown($event);
	}} onBlur={($event) => {
		onBlur();
	}} data-rozie-s-97b2c090="" />
    </span>
    </>;
}
//#endregion
//#region src/FilterSelect.tsx
function FilterSelect(_props) {
	const [local, attrs] = splitProps(mergeProps({
		columnId: "",
		column: null,
		value: null,
		setFilter: null,
		uniqueValues: [],
		columnLabel: ""
	}, _props), [
		"columnId",
		"column",
		"value",
		"setFilter",
		"uniqueValues",
		"columnLabel"
	]);
	function selectValue() {
		return local.value != null ? String(local.value) : "";
	}
	function onChange(e) {
		const v = e && e.target ? e.target.value : "";
		if (v === "") local.setFilter && local.setFilter(local.columnId, "");
		else local.setFilter && local.setFilter(local.columnId, v);
	}
	function a11yLabel() {
		if (typeof local.columnLabel === "string" && local.columnLabel !== "") return local.columnLabel;
		return local.columnId;
	}
	return <>
    <select part="col-filter" aria-label={rozieAttr(a11yLabel())} class={"rdt-col-filter"} value={selectValue()} onChange={($event) => {
		onChange($event);
	}} data-rozie-s-d75b42b2="">
      <option value="" data-rozie-s-d75b42b2="">All</option>
      <Key each={local.uniqueValues} by={(opt) => opt}>{(opt) => <option value={rozieAttr(opt())} data-rozie-s-d75b42b2="">{rozieDisplay(opt())}</option>}</Key>
    </select>
    </>;
}
//#endregion
//#region src/GroupBar.tsx
__rozieInjectStyle("GroupBar-546c469a", `.rdt-group-drop-zone[data-rozie-s-546c469a] {
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
}`);
function GroupBar(_props) {
	const [local, attrs] = splitProps(mergeProps({
		grouping: [],
		groupableColumns: [],
		applyGrouping: null,
		clearGrouping: null
	}, _props), [
		"grouping",
		"groupableColumns",
		"applyGrouping",
		"clearGrouping"
	]);
	const [draggingId, setDraggingId] = createSignal("");
	const [isOver, setIsOver] = createSignal(false);
	const [dragKind, setDragKind] = createSignal("");
	const [dropKey, setDropKey] = createSignal("");
	function onChipDragStart(e, id) {
		setDraggingId(id);
		setDragKind("chip");
		if (e && e.dataTransfer) e.dataTransfer.setData("text/plain", id);
	}
	function onTokenDragStart(e, gk) {
		setDraggingId(gk);
		setDragKind("token");
		if (e && e.dataTransfer) e.dataTransfer.setData("text/plain", gk);
	}
	function onDragOver(e) {
		if (e) e.preventDefault();
		setIsOver(true);
	}
	function onTokenDragOver(e, gk) {
		if (e) e.preventDefault();
		if (dragKind() === "token") setDropKey(gk);
	}
	function onDragLeave(e) {
		if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
		setIsOver(false);
		setDropKey("");
	}
	function resetDrag() {
		setDraggingId("");
		setDragKind("");
		setDropKey("");
		setIsOver(false);
	}
	function onDragEnd() {
		resetDrag();
	}
	function onDrop(e) {
		if (e) e.preventDefault();
		const kind = dragKind();
		const anchor = dropKey();
		const id = e && e.dataTransfer && e.dataTransfer.getData("text/plain") || draggingId();
		resetDrag();
		if (!id) return;
		if (kind === "token") {
			if (local.grouping.indexOf(id) === -1) return;
			const without = local.grouping.filter((k) => k !== id);
			let to = without.length;
			if (anchor && anchor !== id) {
				const j = without.indexOf(anchor);
				if (j !== -1) to = j;
			}
			const next = without.slice(0, to).concat([id]).concat(without.slice(to));
			local.applyGrouping && local.applyGrouping(next);
			return;
		}
		if (local.grouping.indexOf(id) !== -1) return;
		const next = local.grouping.concat([id]);
		local.applyGrouping && local.applyGrouping(next);
	}
	function removeKey(key) {
		local.applyGrouping && local.applyGrouping(local.grouping.filter((k) => k !== key));
	}
	function clearAll() {
		local.clearGrouping && local.clearGrouping();
	}
	function labelFor(key) {
		const col = local.groupableColumns.find((c) => c.id === key);
		return col && col.label || key;
	}
	return <>
    <div class={"rdt-group-bar"} data-rozie-s-546c469a="">
      
      <Key each={local.groupableColumns} by={(col) => col.id}>{(col) => <span part="group-token" draggable="true" class={"rdt-group-token"} onDragStart={($event) => {
		onChipDragStart($event, col().id);
	}} onDragEnd={($event) => {
		onDragEnd();
	}} data-rozie-s-546c469a="">{rozieDisplay(col().label)}</span>}</Key>

      
      <span data-group-drop-zone="" class={"rdt-group-drop-zone " + rozieClass({ "is-over": isOver() })} onDragOver={($event) => {
		onDragOver($event);
	}} onDragLeave={($event) => {
		onDragLeave($event);
	}} onDrop={($event) => {
		onDrop($event);
	}} data-rozie-s-546c469a="">
        
        {<Show when={!local.grouping.length}><span class={"rdt-group-drop-hint"} data-rozie-s-546c469a="">Drag columns here to group</span></Show>}<Key each={local.grouping} by={(gk) => gk}>{(gk) => <span part="group-token" data-group-token="" draggable="true" class={"rdt-group-token " + rozieClass({ "is-drop-target": dragKind() === "token" && dropKey() === gk() && draggingId() !== gk() })} onDragStart={($event) => {
		onTokenDragStart($event, gk());
	}} onDragOver={($event) => {
		onTokenDragOver($event, gk());
	}} onDragEnd={($event) => {
		onDragEnd();
	}} data-rozie-s-546c469a="">
          {rozieDisplay(labelFor(gk()))}
          <button type="button" aria-label={rozieAttr("Remove " + labelFor(gk()) + " grouping")} class={"rdt-group-token-remove"} onClick={($event) => {
		removeKey(gk());
	}} data-rozie-s-546c469a="">×</button>
        </span>}</Key>
      </span>

      
      {<Show when={local.grouping.length}><button type="button" class={"rdt-group-clear"} onClick={($event) => {
		clearAll();
	}} data-rozie-s-546c469a="">Clear</button></Show>}</div>
    </>;
}
//#endregion
//#region src/DetailPanel.tsx
function DetailPanel(_props) {
	const [local, attrs] = splitProps(mergeProps({ row: null }, _props), ["row"]);
	function entries() {
		const r = local.row;
		if (!r) return [];
		return Object.keys(r).map((key) => ({
			key,
			value: r[key] == null ? "" : String(r[key])
		}));
	}
	return <>
    <dl class={"rdt-detail-panel"} data-rozie-s-8f65bdaa="">
      
      <Key each={entries()} by={(pair) => pair.key}>{(pair) => <div class={"rdt-detail-entry"} data-rozie-s-8f65bdaa="">
        <dt class={"rdt-detail-key"} data-rozie-s-8f65bdaa="">{rozieDisplay(pair().key)}</dt>
        <dd class={"rdt-detail-value"} data-rozie-s-8f65bdaa="">{rozieDisplay(pair().value)}</dd>
      </div>}</Key>
    </dl>
    </>;
}
//#endregion
export { Column, DataTable, DataTable as default, DetailPanel, EditorCheckbox, EditorDate, EditorNumber, EditorSelect, EditorText, FilterNumberRange, FilterSelect, FilterText, GroupBar };
