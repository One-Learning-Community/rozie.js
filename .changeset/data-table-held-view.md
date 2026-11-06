---
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-vue": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-angular": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-lit": minor
---

Custom column filter and sort rules, holding the view while editing, and an active cell that stays on its record.

- **`filterFn` / `sortingFn`** on `<Column>` and on `columns` config entries. Each takes a table-core built-in name (`'arrIncludesSome'`, `'equalsString'`, `'alphanumeric'`, …) or a function: `filterFn(value, filterValue, row) => boolean` and an ascending `sortingFn(a, b, rowA, rowB) => number`, called with cell values and the original data objects. An unknown name falls back to `'auto'` with one console warning; a filter function that throws counts as a match and a sort function that throws counts as equal. List- and id-valued columns can now be filtered inside the table, so filtering no longer replaces the `data` array or clears undo history. The table re-filters only when `data`, `columnFilters`, `globalFilter` or `sorting` change; call `refreshView()` after the outside state a rule reads changes.
- **`holdView`** (default `false`): the table's own writes (edits, paste, fill, cut, clear, the boolean toggle, undo, redo) keep the rows' membership and order, and new values render in place. The view is re-derived when `sorting`, `columnFilters` or `globalFilter` change, on `refreshView()`, on an external `data` swap, or when `holdView` is toggled. New `refreshView()` and `getViewState()` verbs and a `view-state-change` event report `{ held, filterMismatches, sortMismatches }`. Grouping, `manual` mode and tree data fall back to live behaviour with one console warning. `getRowId` is not required.
- **Fix: the active cell follows its record.** After a re-sort, a filter change, `refreshView()` or one of the table's own writes, the active cell (and any open cell or row editor) moves with its record and fires `activecell-change` with the new position. If the record left the view, the active cell parks on the column header (`{ rowIndex: null, isHeader: true }`) and an open editor closes without writing, so the next keystroke can no longer edit a record nobody was looking at. Paging, page-size changes, expand/collapse and external data swaps still clamp to the same position when the record is gone. A sort, filter or write that reorders the rows clears an active cell range; a page-size change still clamps it. This applies to every grid, with or without `holdView`.
