/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/data-table.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the `$expose({ ... })` call in DataTable.rozie), but their human-readable
 * descriptions have no first-class IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/ROZ137/Lit-lifecycle): none of these verbs
 * collides with a declared prop name, an emitted event name, a React
 * model-setter, or an inherited `HTMLElement` member / Lit reserved lifecycle
 * name (`update`/`render`/`firstUpdated`/`updated`/`willUpdate`/`requestUpdate`).
 * Each verb drives `@tanstack/table-core` so the matching write funnel fires the
 * corresponding change event.
 */
export const handleManifest = {
  sortColumn:
    'Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Drives table-core so `sort-change` fires with the fresh `SortingState`.',
  clearSorting: 'Clear all sorting — `clearSorting()`. Resets to the unsorted core row model and fires `sort-change`.',
  toggleRowExpanded:
    "Toggle ONE row's expanded state (phase 50 req-3) — `toggleRowExpanded(rowId)` where `rowId` is the consumer's row `id` (the data field) OR the table-core row id (both resolve). Scans the core flat-row set so a collapsed parent is still resolvable. Drives table-core so `expand-change` fires with the fresh `ExpandedState`. Multi-expand: it does not collapse other open rows.",
  expandAll:
    'Open every expandable row (phase 50 req-3) — `expandAll()`. Drives table-core (`toggleAllRowsExpanded(true)`) so `expand-change` fires; the payload may be the `true` expand-all literal (Pitfall 2).',
  collapseAll:
    'Collapse every row (phase 50 req-3) — `collapseAll()`. Resets the expanded set to a blank state (`resetExpanded(true)` → `{}`) and fires `expand-change` with `{}`.',
  getExpandedRows:
    'Return the original row data for the currently-expanded rows (phase 50 req-3) — `getExpandedRows()` → `unknown[]` (empty when nothing is expanded). The read-verb twin of the `expand-change` event.',
  applyGrouping:
    'Set the full grouping — `applyGrouping(cols)` where `cols` is a fresh ORDERED `string[]` of column ids (multi-column → nested groups, e.g. `["region","category"]`). Drives table-core (`table.setGrouping`) so `group-change` fires with the fresh `GroupingState`. (Named `applyGrouping`, not `setGrouping`: a `set<ModelProp>` verb collides with React`s auto-generated `grouping` useState setter and an $expose verb is rename-protected — ROZ524; same `applyColumnOrder` precedent.)',
  clearGrouping:
    'Clear all grouping — `clearGrouping()`. Resets to the ungrouped (flat) row model (`table.setGrouping([])`) and fires `group-change` with `[]`.',
  getFacetedUniqueValues:
    "Return a column's CROSS-FILTERED distinct values (phase 50 reqs 8-9, D-03) — `getFacetedUniqueValues(colId)` → `unknown[]` of distinct values (KEYS ONLY — occurrence counts are deliberately NOT exposed). Resolves the column via `table.getColumn(colId)` and reads table-core's faceted unique-value map, returning `Array.from(map.keys())`. Cross-filtered: the values reflect rows passing all OTHER active column filters and update when an upstream filter changes. Empty array when the column/table is missing. Inert (the faceted models stay off-path) until this verb or the `#filter` slot reads a facet.",
  getFacetedMinMaxValues:
    "Return a numeric column's CROSS-FILTERED `[min, max]` range (phase 50 reqs 8-9, D-03) — `getFacetedMinMaxValues(colId)` → `[number, number] | null`. Resolves the column via `table.getColumn(colId)` and reads table-core's faceted min/max. Cross-filtered (reflects rows passing all OTHER active column filters) and updates when an upstream filter changes. `null` when unavailable. The read twin handed to the `#filter` scoped slot so a consumer builds a numeric range slider purely from exposed values.",
  getColumnDefs:
    'Return the resolved `ColumnDef[]` (the id-keyed LWW union of the `:columns` config array and the `<Column>` children) — `getColumnDefs()`.',
  toggleAllRows:
    'Select or clear all (filtered) rows — `toggleAllRows(value)`. Drives table-core so `selection-change` fires with the fresh `RowSelectionState`.',
  clearSelection: 'Clear the row selection — `clearSelection()`. Fires `selection-change` with `{}`.',
  getSelectedRows:
    'Return the original row data for the currently-selected rows — `getSelectedRows()` → `unknown[]` (empty when nothing is selected).',
  setPage: 'Go to a 0-based page index — `setPage(idx)`. Drives table-core so `page-change` fires with the fresh `{ pageIndex, pageSize }`.',
  setRowsPerPage: 'Set the page size — `setRowsPerPage(size)`. Fires `page-change` with the fresh pagination object.',
  toggleColumnVisibility:
    'Show/hide a column — `toggleColumnVisibility(colId)`. Drives table-core so `visibility-change` fires with the fresh `VisibilityState`.',
  applyColumnOrder:
    'Set the full column order — `applyColumnOrder(order)` where `order` is a fresh `string[]`. Fires `reorder-change`. (Named `applyColumnOrder`, not `setColumnOrder`: a `set<ModelProp>` verb collides with React`s auto-generated `columnOrder` setter and an $expose verb is rename-protected — ROZ524.)',
  resetColumnSizing: 'Reset all column widths to their defaults — `resetColumnSizing()`. Fires `resize-change`.',
  pinColumn:
    "Pin a column to a side or unpin it — `pinColumn(colId, side)` where `side` is `'left'` | `'right'` | `false`. Fires `pin-change` with the fresh `ColumnPinningState`.",
  focusCell:
    'Move + focus the active cell (grid interaction mode) — `focusCell(rowIndex, colIndex)`, addressed by index over the visible model (D-03; args coerced to integers and clamped to bounds). Fires `activecell-change`. (Named `focusCell`, not `focus`: a bare `focus` verb shadows the inherited `HTMLElement.focus` on Lit — ROZ137.)',
  getActiveCell:
    'Return the current active-cell position — `getActiveCell()` → `{ rowIndex, colIndex }` integers (no row data, no DOM node).',
  clearActiveCell:
    'Reset the roving active-cell position to the entry cell and exit interaction mode — `clearActiveCell()`. The next Tab-in re-enters at the entry cell (D-01). (Named `clearActiveCell`, not `clear`: distinct from the listbox `clear` selection verb.)',
  editCell:
    'Programmatically open the editor on a cell (Phase 51) — `editCell(rowIndex, colIndex)`, addressed by index over the visible model (args coerced to integers + clamped). No-op on a non-editable cell. (Named `editCell`, not `edit`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.)',
  commitEditing:
    'Programmatically commit the open editor (Phase 51) — `commitEditing()`. Runs the column validator; on success writes the bound `r-model:data` and fires one `cell-edit-commit`; on a validation failure keeps the editor open (D-01). No-op when no cell is editing. (Named `commitEditing`, not `commit`.)',
  editRow:
    'Programmatically enter FULL-ROW edit on a body row (Phase 51 req-6 / D-06) — `editRow(rowIndex)`, addressed by index over the visible model (args coerced to integers + clamped). The API twin of the `Shift+F2` shortcut: every editable cell in the row enters edit at once. A later save commits the whole row in one `r-model:data` write + one `row-edit-commit`; `Escape` reverts the row as a unit. No-op on a row with no editable columns. (Named `editRow`, not `edit`/`editColumn`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.)',
  getSelectedRange:
    'Return the current rectangular cell-range selection (Phase 51 req-7 / D-07) — `getSelectedRange()` → `{ anchor, focus }` where each corner is a `{ rowIndex, colIndex }` index pair over the visible model (integers only — no row data, no DOM node, T-49-02), or `{ anchor: null, focus: null }` when no range is set. The range is extended by `Shift+Arrow` / `Shift+Click` and is ONE-WAY (this read verb + the `range-change` event), NOT a `model:true` slice (D-07). (Named `getSelectedRange`, not `getRange`/`getSelection`: collision-clean against `getSelectedRows`, the verb/event/prop, and the Lit ROZ137 reserved sets.)',
};

export default handleManifest;
