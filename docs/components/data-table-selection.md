# Row selection

`selectionMode` controls row selection: `'none'` (default), `'single'`, or `'multiple'`. In `'multiple'` mode a leading checkbox column auto-injects with a select-all header. The selected set is the two-way `rowSelection` slice — `{ [rowId]: true }` — surfaced through `r-model:rowSelection` and the `selection-change` event, with an uncontrolled fallback when unbound.

```rozie
<DataTable :data="$data.rows" selectionMode="multiple" r-model:rowSelection="$data.selected">
  <Column field="name" header="Name" />
  <Column field="email" header="Email" />
</DataTable>
```

Selection is **checkbox-only** — toggling a row's checkbox (or the select-all header) changes the set; clicking the row body does not select. **Select-all scopes to the filtered rows** (the TanStack default) and the header checkbox shows the indeterminate state on a partial selection.

## Overriding the checkboxes

Two slots let you replace the default chrome (both only in `selectionMode="multiple"`):

- `#selectAll` — scope `{ checked, indeterminate, toggle }` — override the select-all header.
- `#selectCell` — scope `{ row, checked, toggle }` — override the per-row select checkbox.

## Imperative handle

Drive and read the selection through the handle: `toggleAllRows(value)` selects/clears all filtered rows (fires `selection-change`), `clearSelection()` empties it (fires `selection-change` with `{}`), and `getSelectedRows()` returns the original row data for the selected rows. The full handle is on the [API reference](/components/data-table-api#imperative-handle).

## Per-framework code

The per-target consumption snippet is on the [usage page](/components/data-table-usage); the [live demo](/components/data-table-demo) wires `rowSelection` plus the `toggleAllRows` / `clearSelection` verbs against the real Vue package.

## See also

- [API reference](/components/data-table-api) — the `selectionMode` prop, the `rowSelection` model, and the `selectAll` / `selectCell` slots.
- [Sort, filter & paginate](/components/data-table-sort-filter-paginate) — select-all scopes to the filtered rows.
