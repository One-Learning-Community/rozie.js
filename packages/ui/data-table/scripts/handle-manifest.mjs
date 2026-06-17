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
};

export default handleManifest;
