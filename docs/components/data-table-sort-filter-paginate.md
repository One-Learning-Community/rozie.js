# Sort, filter & paginate

The three everyday table operations are each an independent two-way slice with an uncontrolled fallback — bind one only when you want to own it. None require any `onChange → setState` wiring; the table writes a fresh slice back on every transition and fires the matching change event regardless of binding.

## Sorting (multi-sort)

Mark a column `sortable` and clicking its header cycles the sort; **shift-click** a second sortable header to add a secondary sort. The state is `SortingState` — `[{ id, desc }]` — surfaced through `r-model:sorting` and the `sort-change` event, with an uncontrolled fallback when unbound.

```rozie
<DataTable :data="$data.rows" r-model:sorting="$data.sorting">
  <Column field="name" header="Name" sortable />
  <Column field="created" header="Created" sortable />
</DataTable>
```

Drive it imperatively with the `sortColumn(colId, desc?)` and `clearSorting()` handle verbs (see the [API reference](/components/data-table-api#imperative-handle)).

## Filtering — global + per-column

Two filter surfaces, both funnelling through the one `filter-change` event:

- **Global filter** — `r-model:globalFilter` is a single search string that narrows all columns.
- **Per-column filter** — `r-model:columnFilters` is `[{ id, value }]`, gated by each column's `filterable` flag (only `filterable` columns show an input and accept a filter).

```rozie
<DataTable :data="$data.rows"
  r-model:globalFilter="$data.search"
  r-model:columnFilters="$data.columnFilters">
  <Column field="name" header="Name" filterable />
  <Column field="status" header="Status" filterable />
</DataTable>
```

For checkbox lists / range sliders built on a column's cross-filtered distinct values, see [Faceted filtering](/components/data-table-faceted-filtering).

## Custom filter and sort rules {#custom-filter-and-sort-rules}

By default each column filters and sorts with table-core's `'auto'` rule, which picks a rule from the column's value type. Set `filterFn` and/or `sortingFn` on a `<Column>` (or on a `:columns` config entry) to choose the rule yourself. Each takes either a built-in name or a function.

**Built-in names.** Filters: `includesString`, `includesStringSensitive`, `equalsString`, `arrIncludes`, `arrIncludesAll`, `arrIncludesSome`, `equals`, `weakEquals`, `inNumberRange`. Sorting: `alphanumeric`, `alphanumericCaseSensitive`, `text`, `textCaseSensitive`, `datetime`, `basic`. An unknown name falls back to `'auto'` and logs one console warning for that column and name.

**Functions.** The table calls your function with cell values and the original row objects, never table-core's internal `Row`:

- `filterFn(value, filterValue, row) => boolean`: `value` is the cell value, `filterValue` is the column's current filter value, and `row` is the original data object. Return `true` to keep the row.
- `sortingFn(a, b, rowA, rowB) => number`: `a` and `b` are the two cell values and `rowA` / `rowB` the original data objects. Sort ascending (negative when `a` comes first); table-core handles descending order, `sortUndefined` and tie-breaking around it, as it does for the built-ins.

A filter function that throws counts as a match, so a bug in it shows rows rather than hiding them. A sort function that throws counts as equal (`0`). If your filter function carries table-core's `resolveFilterValue` property, it is honoured.

`filterFn` changes *how* a column matches, not *whether* it can be filtered: a column still filters only when it is `filterable`.

```rozie
<DataTable :data="$data.rows" r-model:columnFilters="$data.columnFilters">
  <!-- cell holds a list of grade ids, e.g. [40, 41] -->
  <Column field="grades" header="Grades" :filterable="true"
    :filterFn="(value, filter) => filter === '__empty'
      ? !value?.length
      : value?.some((id) => filter.includes(id))" />
  <Column field="owner" header="Owner" :filterable="true" filterFn="equalsString" />
  <Column field="access" header="Public" :filterable="true" filterFn="equals" />
</DataTable>
```

With that column set, `columnFilters` of `[{ id: 'grades', value: '__empty' }]` shows the rows with no grades, and `[{ id: 'grades', value: [40] }]` shows the rows that include grade 40. For the plain "includes any of" case, the built-in `filterFn="arrIncludesSome"` with a filter value of `[40]` does the same without a function. Because the `data` array never changes, changing filters and sorts this way keeps [undo history](/components/data-table-grid-mode#undo-redo) intact; filtering the array yourself before passing it in counts as a new dataset and clears it.

Things to know:

- **The table re-filters and re-sorts only when its inputs change**: when `data`, `columnFilters`, `globalFilter` or `sorting` change. A rule that reads outside state (an owner-name lookup, a "selected owner" variable) does not re-run when that state changes, and swapping in a new rule function does not re-run it either. Call the [`refreshView()`](/components/data-table-api#imperative-handle) handle verb after the outside inputs change. It works whether or not [`holdView`](/components/data-table-grid-mode#holding-the-view-while-editing) is on. On `<Column>`, the table always calls the latest `filterFn` / `sortingFn` you passed, so a closure over a changing value picks up the new value on the next refresh.
- **The built-in header filter input passes text.** A column whose cells hold lists or ids needs its own filter UI that sets a matching filter value: the [`#filter` slot](/components/data-table-faceted-filtering) (whose `setFilter(columnId, value)` parameter applies it) or `r-model:columnFilters`. Otherwise your rule receives whatever string was typed.
- **Clearing a filter means removing its entry from `columnFilters`.** Emptying the built-in filter input, or calling the `#filter` slot's `setFilter(columnId, value)` with `null` or `''`, does that for you. The table keeps every other value you set, so a sentinel such as `'__empty'`, `[]` or `0` stays in effect until the entry is removed.

## Pagination

`r-model:pagination` is `{ pageIndex, pageSize }` (default `{ pageIndex: 0, pageSize: 10 }`); it feeds the built-in prev/next + page-size chrome and surfaces through `page-change`. Drive it with the `setPage(idx)` / `setRowsPerPage(size)` handle verbs.

## Server-side (`manual`) mode

Set `manual` to flip on `manualPagination` / `manualFiltering` / `manualSorting` at once: table-core then trusts the consumer-supplied rows (it does not sort/filter/paginate them itself) and only emits the change events, so you can fetch the matching page/sort/filter slice from a server and feed it back through `:data`.

Under `manual`, `:data` holds only the current page, not the full dataset — table-core can no longer derive a page count from `data.length`. Without a count supplied from elsewhere, `getPageCount()` stays `-1` and `getCanNextPage()` stays permanently `false`, so the consumer can never leave page 0. Supply one of:

- **`rowCount`** — the total server-side row count; table-core derives `⌈rowCount / pageSize⌉`.
- **`pageCount`** — an explicit total page count; wins over a `rowCount`-derived value when both are set.

```rozie
<DataTable :data="$data.page" manual :rowCount="$data.totalRows"
  r-model:pagination="$data.pagination"
  r-model:sorting="$data.sorting"
  @page-change="$data.fetchPage($event)">
  <Column field="name" header="Name" sortable />
</DataTable>
```

## Per-framework code

The idiomatic per-target consumption snippet is on the [usage page](/components/data-table-usage); the [live demo](/components/data-table-demo) binds `sorting`, `globalFilter`, and `pagination` against the real Vue package.

## See also

- [API reference](/components/data-table-api) — the full `sorting` / `globalFilter` / `columnFilters` / `pagination` / `manual` prop and event details.
- [Faceted filtering](/components/data-table-faceted-filtering) — cross-filtered facets per column.
- [Row selection](/components/data-table-selection) — none / single / multiple selection.
