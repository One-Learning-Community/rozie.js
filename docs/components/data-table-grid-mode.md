# Grid mode & keyboard

`DataTable` is an accessible **table** by default and an opt-in WAI-ARIA **grid** when you set `interactionMode="grid"`. This page covers both the grid interaction contract and the underlying accessibility surface.

## Grid interaction mode

By default `DataTable` is an accessible **table** — Tab steps between the native controls (sort buttons, checkboxes, filters, pagination). Set `interactionMode="grid"` to opt into the full WAI-ARIA **[grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)** pattern, where the whole grid is a single tab-stop and arrow keys move a roving active cell across both axes:

```rozie
<DataTable :data="$data.rows" interactionMode="grid" @activecell-change="onMove($event)">
  <Column field="name" header="Name" sortable />
  <Column field="email" header="Email" />
  <Column field="status" header="Status" sortable />
</DataTable>
```

What flips on:

- **Roles.** The root becomes `role="grid"` and body cells become `role="gridcell"` (headers stay `role="columnheader"`). `'table'` mode keeps `role="table"` / `role="cell"`, byte-for-byte unchanged.
- **Roving tab-stop.** Exactly one cell carries `tabindex="0"` at a time; the rest are `tabindex="-1"`. Tab moves focus *into* the grid (landing on the active cell) and a second Tab moves *out* — the grid is one stop in the page tab order, not one-stop-per-cell. There is **no focus-steal on mount**: the entry cell waits for the first Tab/click.
- **2-D keyboard navigation (APG).** `ArrowLeft/Right/Up/Down` move one cell; `Home`/`End` jump to the row's first/last cell; `Ctrl+Home`/`Ctrl+End` jump to the first/last cell of the grid; `PageUp`/`PageDown` jump by a row page. `ArrowUp` from the first body row crosses into the header row. Every index is clamped to the visible model — a move past an edge is a no-op (and does **not** emit `activecell-change`).
- **Cell-level interaction.** `Enter` (or `F2`) focuses the active cell's first interactive control; `Tab`/`Shift+Tab` then cycle *within* the cell (focus containment); `Escape` returns focus to the cell and resumes navigation. Keys are only intercepted while a cell is focused — a caret inside an in-cell `<input>` reached without `Enter` keeps its native behavior.
- **Mouse + roving model stay in sync.** Clicking a cell makes it the active cell (the roving `tabindex="0"` follows), so the next arrow key continues from where you clicked.
- **Index-addressed, sort/filter-stable.** The active cell is tracked as a `{ rowIndex, colIndex }` pair over the *visible* model — never a stored DOM node — so it survives a re-sort, filter, page change, or column hide/reorder/pin (it clamps to the new bounds rather than getting lost). Hidden columns are simply absent from the navigable order.

**Cell range selection.** In grid mode a rectangular cell-range selection extends via `Shift+Arrow` / `Shift+Click`, surfaced through the one-way `range-change` event (payload `{ anchor, focus }`, each corner a `{ rowIndex, colIndex }` pair, or `{ anchor: null, focus: null }`) and the `getSelectedRange()` verb. It is never a `model:true` slice.

Drive and observe it imperatively via the [`focusCell`](/components/data-table-api#imperative-handle) / `getActiveCell` / `clearActiveCell` handle verbs and the [`activecell-change`](/components/data-table-api#events) event. The exact behavioral contract is locked by a cross-framework VR matrix (`tests/visual-regression/specs/data-table-grid.spec.ts`) proving REQ-1..7 identically on all six targets.

## Accessibility

- Semantic ARIA table roles throughout: `role="table"` / `role="rowgroup"` / `role="row"` / `role="columnheader"` / `role="cell"`, with `aria-sort` (the string-safe `'ascending'` \| `'descending'` \| `'none'`) on sortable headers.
- **Every interactive control is a native, focusable element** with an accessible name — the sort buttons, the select-all + per-row checkboxes, the pagination prev/next + page-size `<select>`, the global + per-column filter inputs, the column-visibility `<details>` disclosure, the per-header pin buttons, and the edge resize handles. There is no div-with-click-only control.
- The keyboard / focus surface is the **table-oriented** default (Tab between the native controls). Opt into `interactionMode="grid"` (above) for the full WAI-ARIA **grid** pattern — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation — on top of the same accessible chrome.
- Select-all scopes to the filtered rows (the TanStack default) and shows the indeterminate state on a partial selection.

## Per-framework code

The per-target consumption snippet is on the [usage page](/components/data-table-usage).

## See also

- [Editing](/components/data-table-editing) — grid mode pairs naturally with cell editing.
- [API reference](/components/data-table-api) — the `interactionMode` prop, the `activecell-change` / `range-change` events, and the grid-mode verbs.
