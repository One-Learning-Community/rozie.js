# Expandable rows & master-detail

Set `expandable` to opt into expandable rows: a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates. The default `false` is byte-identical-off. The two-way `expanded` slice is **multi-expand** (`{ [rowId]: true }`, or the `true` literal after `expandAll`), so several rows stay open at once. There are two expand modes:

- **Detail panel** — with no `getSubRows`, an open row reveals a full-width `#detail` panel (scope `{ row }`) below it; render arbitrary content.
- **Nested sub-rows** — supply `getSubRows(originalRow, index) => TData[]` and table-core flattens the hierarchy into depth-indented child rows.

```rozie
<DataTable :data="$data.rows" expandable r-model:expanded="$data.expanded"
  :getSubRows="(row) => row.children">
  <Column field="name" header="Name" />
  <Column field="headcount" header="Headcount" />

  <!-- #detail is used only when getSubRows is absent -->
  <template #detail="{ row }">
    <aside class="detail">More about {{ row.name }}</aside>
  </template>
</DataTable>
```

Drive expansion imperatively with `toggleRowExpanded(rowId)` / `expandAll()` / `collapseAll()` / `getExpandedRows()` (see the [API reference](/components/data-table-api#imperative-handle)), and observe it via the [`expand-change`](/components/data-table-api#events) event (fires exactly once per change; payload is the fresh `ExpandedState`, which may be the `true` literal after `expandAll`). When grouping is active and `expanded` is untouched, group subtrees auto-expand.

## The `DetailPanel` drop-in

The `#detail` slot is fully headless — you can render any panel. The package also ships an **opt-in `DetailPanel` drop-in**, an additive named export alongside `DataTable` that fills the `#detail` slot with a forkable starter rendering the open row's own fields as a key/value definition list:

```ts
import { DataTable, Column, DetailPanel } from '@rozie-ui/data-table-<target>';
```

| Component | Renders | Slot | Scope read |
| --- | --- | --- | --- |
| `DetailPanel` | the row's fields as a `<dl>` key/value list | `#detail` | `row` |

Mark the table `expandable`, then forward the slot scope to the drop-in — or fork it as a template.

## Per-framework code

The per-target wiring is the [expandable rows snippet](/components/data-table-usage#expandable-rows-detail-slot-nested-sub-rows) and the [drop-in group bar + detail panel snippet](/components/data-table-usage#drop-in-group-bar-detail-panel-groupbar-detail) on the usage page.

## See also

- [Grouping & aggregation](/components/data-table-grouping) — group-header rows ride the same expand model.
- [API reference](/components/data-table-api) — the `expandable` / `expanded` / `getSubRows` props, the `#detail` slot, and the expand verbs.
