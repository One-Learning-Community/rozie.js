# Faceted filtering

Per-column **faceted** filtering is **headless and read-only**: the component exposes the cross-filtered distinct values and numeric ranges for each `filterable` column, but ships **no** built-in facet UI. You build the checkbox list / range slider in the `#filter` slot and drive the `columnFilters` model yourself.

```rozie
<DataTable :data="$data.rows" r-model:columnFilters="$data.columnFilters">
  <Column field="category" header="Category" filterable />
  <Column field="price" header="Price" filterable />

  <template #filter="{ columnId, uniqueValues, minMax }">
    <fieldset r-if="columnId === 'category'">
      <label r-for="v in uniqueValues" :key="v"><input type="checkbox" /> {{ v }}</label>
    </fieldset>
    <input r-else type="range" :min="minMax[0]" :max="minMax[1]" />
  </template>
</DataTable>
```

The `#filter` scope is `{ columnId, uniqueValues, minMax, setFilter }`: `uniqueValues` is the **cross-filtered** distinct values (`unknown[]`, keys only — occurrence counts are deliberately not exposed), `minMax` is the cross-filtered numeric `[min, max]` (or `null`), and `setFilter(columnId, value)` applies a column filter through the same funnel the built-in per-column input uses (passing `null`/`''` clears that column's filter). "Cross-filtered" means each facet reflects the rows passing all *other* active column filters. The slot fires no event — call `setFilter` (or update `columnFilters` directly, shape `[{ id: columnId, value }]`) from your own UI. The same data is readable imperatively via [`getFacetedUniqueValues`](/components/data-table-api#imperative-handle) / `getFacetedMinMaxValues`. Faceting stays off-path (byte-identical-off) until the `#filter` slot or a faceted verb reads it.

## Drop-in filter components

The `#filter` slot is fully headless — you can render any facet UI. For the common cases the package also ships **opt-in drop-in filter components** so you don't have to hand-roll the input wiring: `FilterText`, `FilterNumberRange`, and `FilterSelect`. Like the [editor drop-ins](/components/data-table-editing#drop-in-editor-components) they are **additive named exports** alongside `DataTable` (which stays the headless **default** export — importing the filters is byte-identical-off if you never use them):

```ts
import { DataTable, Column, FilterText, FilterNumberRange, FilterSelect }
  from '@rozie-ui/data-table-<target>';
// (Vue: `import DataTable, { Column, FilterText, … }` — DataTable is the default.
//  Lit: the single side-effect import registers the <rozie-filter-*> custom elements.)
```

Each drop-in takes the `#filter` slot scope as its props — `{ columnId, column, value, setFilter }` — and writes the column filter by calling `setFilter(columnId, value)`; `FilterSelect` additionally reads `uniqueValues` (the faceted keys) and `FilterNumberRange` additionally reads `minMax` (the faceted bounds), both of which already arrive in the slot scope. Mark the column `filterable` so the `#filter` slot renders, then dispatch by `columnId` and forward the scope to the matching drop-in. Use them **as-is**, or fork one as a template for a bespoke filter.

| Component | Renders | Writes | Extra scope read |
| --- | --- | --- | --- |
| `FilterText` | `<input type="text">` | `setFilter(columnId, draft)` (Enter / blur; Escape clears) | — |
| `FilterNumberRange` | two `<input type="number">` | `setFilter(columnId, [min, max])` (`inNumberRange` shape; both empty clears) | `minMax` |
| `FilterSelect` | `<select>` | `setFilter(columnId, value)` (leading "All" option clears) | `uniqueValues` |

## Per-framework code

The per-target wiring is the [faceted filtering exposure snippet](/components/data-table-usage#faceted-filtering-exposure-headless-filter) and the [drop-in filter components snippet](/components/data-table-usage#drop-in-filter-components-filter) on the usage page.

## See also

- [Sort, filter & paginate](/components/data-table-sort-filter-paginate) — the global + per-column filter basics that faceting builds on.
- [API reference](/components/data-table-api) — the `#filter` slot scope and the `getFacetedUniqueValues` / `getFacetedMinMaxValues` verbs.
