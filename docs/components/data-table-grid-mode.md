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

Drive and observe it imperatively via the [`focusCell`](/components/data-table-api#imperative-handle) / `getActiveCell` / `clearActiveCell` handle verbs and the [`activecell-change`](/components/data-table-api#events) event. The exact behavioral contract is locked by a cross-framework visual-regression matrix proving the same behavior on all six targets.

## Clipboard, fill & clear

Grid mode also ships a spreadsheet-style clipboard, fill, and clear surface, scoped to the current active cell / range selection. Each shortcut below is a no-op — and falls through to the browser's native behavior — while a **header** cell is active, so it never silently mutates a body cell from an unexpected focus position:

- **Copy** — `Ctrl`/`Cmd`+`C` serializes the active range (or the single active cell when no range is set) to the system clipboard as TSV (tab-separated cells, newline-separated rows).
- **Paste** — `Ctrl`/`Cmd`+`V` reads TSV off the clipboard and tiles it across the current range, anchored at its top-left corner: a clipboard block smaller than the destination range repeats (tiles) to fill the whole range; a clipboard block larger than the range pastes its full block, extending past the original selection (clamped only to the table's own row/column bounds). Each destination cell is written only if its column is `editable` and the value passes that column's validator; everything else is silently skipped. The whole paste is one `r-model:data` write plus one `cell-edit-commit` per cell actually written, and an aria-live region announces how many of the attempted cells were committed.
- **Cut** — `Ctrl`/`Cmd`+`X` copies the range exactly as above, then clears the source cells through the same write path **Clear** (below) uses. Also reachable imperatively via the [`cut()`](/components/data-table-api#imperative-handle) handle verb.
- **Fill handle** — dragging the small handle at the active range's bottom-right corner tiles the range's existing values across the cells the drag covers (pure value-copy — there is no series/pattern detection, unlike a spreadsheet's numeric-sequence fill).
- **Clear** — `Delete` / `Backspace` clears the active cell or range through the same validator-gated write funnel as paste, minus the clipboard copy. Non-editable and validator-rejected cells are left untouched.
- **Select all cells** — `Ctrl`/`Cmd`+`A` selects the entire body as one rectangular range (always calls `preventDefault`, so the browser never selects the page itself while in grid mode). A no-op — selects nothing — when the active cell is a header.

Every mutation above (paste, fill, cut, clear) is reversible with `Ctrl`+`Z` once `undoable` is set — see [Undo & redo](#undo-redo) below.

## Undo & redo {#undo-redo}

Set `undoable` and every committed data mutation — a cell/row edit, a paste, a fill, a cut, or a clear — becomes one undo step:

- `Ctrl`/`Cmd`+`Z` undoes the most recent mutation; `Ctrl`/`Cmd`+`Y` **or** `Ctrl`/`Cmd`+`Shift`+`Z` redoes it. Both work whether a header or a body cell is active — unlike the clipboard shortcuts above, undo/redo is grid-wide.
- `undoLimit` (default `100`) bounds how many snapshots are retained; the oldest is evicted once the stack exceeds it.
- [`history-change`](/components/data-table-api#events) fires `{ canUndo, canRedo }` whenever that availability changes — drive an undo/redo toolbar button's `disabled` state from it.
- Five handle verbs mirror the keyboard: `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clearHistory()`. See the [API reference](/components/data-table-api#imperative-handle) for their exact contracts. Swapping in a new `data` array from outside the table clears history automatically — a fresh dataset never inherits the previous one's undo stack.

With `undoable` left at its default `false`, nothing is recorded, `Ctrl`+`Z`/`Y` are inert, and the grid is byte-behaviorally identical to a pre-undo build.

## Accessibility

- Semantic ARIA table roles throughout: `role="table"` / `role="rowgroup"` / `role="row"` / `role="columnheader"` / `role="cell"`, with `aria-sort` (the string-safe `'ascending'` \| `'descending'` \| `'none'`) on sortable headers.
- **Row counting.** The `<table>` root carries `aria-rowcount` — the full filtered pre-pagination row total (not just the current page) — and every header/body `<tr>` carries a 1-based `aria-rowindex` that already accounts for the header rows ahead of it. These are present in both `table` and `grid` interaction mode, and are unaffected by pagination or row windowing — the index always reflects the row's position in the full model.
- **Treegrid state (expandable rows and grouping).** When a row can expand — an expandable row or a group-header row — its `<tr>` carries `aria-expanded` (`"true"` / `"false"`). While grouping is active, every row (group header and leaf alike) additionally carries `aria-level` (1-based nesting depth), giving the multi-level grouped-row hierarchy the same treegrid semantics APG expects. Neither attribute appears on a row that can't expand and isn't part of an active grouping.
- **Column position is not yet advertised.** `aria-colcount` / `aria-colindex` are not emitted anywhere in the component. This means a column-windowed grid (`virtual="columns"` or `"both"`) gives assistive tech no way to tell a windowed leaf column's true position among the full column set — only the row axis currently carries that information.
- **Every interactive control is a native, focusable element** with an accessible name — the sort buttons, the select-all + per-row checkboxes, the pagination prev/next + page-size `<select>`, the global + per-column filter inputs, the column-visibility `<details>` disclosure, the per-header pin buttons, and the edge resize handles. There is no div-with-click-only control.
- The keyboard / focus surface is the **table-oriented** default (Tab between the native controls). Opt into `interactionMode="grid"` (above) for the full WAI-ARIA **grid** pattern — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation — on top of the same accessible chrome.
- Select-all scopes to the filtered rows (the TanStack default) and shows the indeterminate state on a partial selection.

## Per-framework code

The per-target consumption snippet is on the [usage page](/components/data-table-usage).

## See also

- [Editing](/components/data-table-editing) — grid mode pairs naturally with cell editing.
- [API reference](/components/data-table-api) — the `interactionMode` prop, the `activecell-change` / `range-change` events, and the grid-mode verbs.
