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

## Pagination

`r-model:pagination` is `{ pageIndex, pageSize }` (default `{ pageIndex: 0, pageSize: 10 }`); it feeds the built-in prev/next + page-size chrome and surfaces through `page-change`. Drive it with the `setPage(idx)` / `setRowsPerPage(size)` handle verbs.

## Server-side (`manual`) mode

Set `manual` to flip on `manualPagination` / `manualFiltering` / `manualSorting` at once: table-core then trusts the consumer-supplied rows (it does not sort/filter/paginate them itself) and only emits the change events, so you can fetch the matching page/sort/filter slice from a server and feed it back through `:data`.

## Per-framework code

The idiomatic per-target consumption snippet is on the [usage page](/components/data-table-usage); the [live demo](/components/data-table-demo) binds `sorting`, `globalFilter`, and `pagination` against the real Vue package.

## See also

- [API reference](/components/data-table-api) — the full `sorting` / `globalFilter` / `columnFilters` / `pagination` / `manual` prop and event details.
- [Faceted filtering](/components/data-table-faceted-filtering) — cross-filtered facets per column.
- [Row selection](/components/data-table-selection) — none / single / multiple selection.
