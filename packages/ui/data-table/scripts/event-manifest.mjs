/**
 * Hand-kept event-description manifest for @rozie-ui/data-table.
 *
 * Events are derived structurally from the source via `ir.emits` (the nine-slice
 * change events), but their human-readable descriptions have no first-class
 * `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing. Every change event
 * fires REGARDLESS of whether the matching `r-model` slice is bound (the
 * uncontrolled-fallback contract), so the consumer can observe state transitions
 * without two-way binding.
 */
export const eventManifest = {
  'sort-change':
    'Fired when the sort state changes (header click / shift-click multi-sort / a `sortColumn`/`clearSorting` call). Payload is the fresh `SortingState` array `[{ id, desc }]`.',
  'filter-change':
    'Fired when a filter changes. Payload is `{ globalFilter }` for the global search box or `{ columnFilters }` (the fresh `ColumnFiltersState` `[{ id, value }]`) for a per-column filter — both surface through this one event.',
  'page-change':
    'Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload is the fresh `{ pageIndex, pageSize }` object.',
  'selection-change':
    'Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload is the fresh `RowSelectionState` `{ [rowId]: true }` object.',
  'expanded-change':
    'Fired (phase 50) when the expanded-row set changes (an expander chevron toggle — click / Enter / Space — or a `toggleRowExpanded`/`expandAll`/`collapseAll` call). Fires exactly once per change (the echo-guarded write funnel dedups the React multi-render re-entry, D-07) and REGARDLESS of whether `r-model:expanded` is bound. Payload is the fresh `ExpandedState` — a `{ [rowId]: true }` object, or the `true` literal after `expandAll` (Pitfall 2: it is passed through verbatim — never `Object.keys` it without a `=== true` guard).',
  'visibility-change':
    'Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload is the fresh `VisibilityState` `{ [colId]: boolean }` object.',
  'resize-change':
    'Fired live during a column resize drag (`columnResizeMode: "onChange"`). Payload is the fresh `ColumnSizingState` `{ [colId]: number }` object.',
  'reorder-change':
    'Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload is the fresh `ColumnOrderState` `string[]`.',
  'pin-change':
    'Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload is the fresh `ColumnPinningState` `{ left: string[], right: string[] }` object.',
  'activecell-change':
    'Fired (grid interaction mode only) whenever the active cell moves — by keyboard navigation or a `focusCell` call. One-way notification; payload is `{ rowIndex, colIndex }` integers over the visible model. Fires on every move including arrow keypresses (D-02).',
  'cell-edit-commit':
    'Fired (Phase 51) when an editable cell commits a NEW, validated value — once per committed cell, from the single `commitEdit` call site (a rejected/invalid commit fires nothing — D-01). Pairs with the `r-model:data` write (one fresh-array replace per commit). Payload is `{ rowId, columnId, oldValue, newValue }`. `cancel`/`Escape` and a validation failure emit nothing.',
  'row-edit-commit':
    'Fired (Phase 51 req-6 / D-06) when a FULL-ROW edit commits — once per row save, from the single `commitRow` call site (React multi-emit dedup, D-07). A row enters full-row edit via `Shift+F2` or the `editRow` verb (every editable cell edits at once); one save validates every edited cell (D-01 — a single failure blocks the whole row and emits nothing) then writes the bound `r-model:data` ONCE (a single fresh-array row-object replace with all changes applied) and fires this event ONCE. `Escape` reverts the whole row as a unit and emits nothing. Payload is `{ rowId, changes }` where `changes` is `[{ columnId, oldValue, newValue }]` for ONLY the columns whose value actually changed.',
  'range-change':
    'Fired (Phase 51 req-7 / D-07) whenever the rectangular cell-range selection changes — extended by `Shift+Arrow` / `Shift+Click` from the single `extendRange`/`setRangeFocus` call sites (React multi-emit dedup, D-07). One-way notification (the range is NOT a `model:true` slice — the model:true count stays at 10, leaving the Angular multi-model-CVA condition untouched); it is a SEPARATE layer from the row-selection slice and the two never corrupt each other. Payload is `getSelectedRange()` → `{ anchor, focus }` where each corner is a `{ rowIndex, colIndex }` index pair over the visible model (integers only — no row data, no DOM node), or `null` when no range is set.',
};

export default eventManifest;
