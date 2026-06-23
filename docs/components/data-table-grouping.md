# Grouping & aggregation

Grouping is driven by the two-way `grouping` slice — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region', 'category']`). An empty/unbound list is ungrouped (byte-identical-off). `getGroupedRowModel` is wired unconditionally (inert while `grouping` is empty), so grouping engages the moment you populate the `grouping` model; it surfaces through `r-model:grouping` and the `group-change` event.

```rozie
<DataTable :data="$data.rows" r-model:grouping="$data.grouping">
  <Column field="region" header="Region" groupable />
  <Column field="category" header="Category" groupable />
  <Column field="revenue" header="Revenue" aggregationFn="sum" />
</DataTable>
```

**Aggregation.** Each column's group-header value comes from its `aggregationFn` Column prop — a built-in name (`'sum'` \| `'min'` \| `'max'` \| `'extent'` \| `'mean'` \| `'median'` \| `'unique'` \| `'uniqueCount'` \| `'count'`) or a custom `(columnId, leafRows, childRows) => any` (defensively wrapped — a throw cannot crash the table). Null → no aggregation (placeholder cell).

**Collapsible group headers.** Group-header rows ride the expand model, so they collapse/expand like any other expandable row. When grouping is active and `expanded` is untouched, group subtrees **auto-expand** (the `expanded` default of `null` keeps that path reachable).

**Per-column opt-out.** Every column is `groupable` by default; opt one out with `:groupable="false"` so the headless `#groupBar` does not offer it as a grouping target. The flag gates only the group-bar surface — grouping itself is driven by the `grouping` model.

Drive it imperatively with `applyGrouping(cols)` / `clearGrouping()` (see the [API reference](/components/data-table-api#imperative-handle)).

## The headless `#groupBar` + `GroupBar` drop-in

Set `groupable` to opt into the **headless `#groupBar`** host region (default `false` is byte-identical-off). The component ships **no** built-in drag UI — the `#groupBar` slot (scope `{ grouping, groupableColumns, applyGrouping, clearGrouping }`) hands you the ordered `grouping` array, the `groupableColumns` (`[{ id, label }]`), and the `applyGrouping` / `clearGrouping` helpers so you build any bar/drag UI.

For the common case the package also ships an **opt-in `GroupBar` drop-in** (an additive named export) that fills the slot with a working **drag-to-group** bar (native HTML5 drag-and-drop, zero extra deps): drag a column chip into the drop zone to add it to the grouping, click a token's × to remove it, and a "Clear" affordance resets. It holds **no** grouping source of truth — it always reads the `grouping` array and routes every change through `applyGrouping` / `clearGrouping`, exactly the headless `#groupBar` contract.

```ts
import { DataTable, Column, GroupBar } from '@rozie-ui/data-table-<target>';
```

| Component | Renders | Slot | Scope read |
| --- | --- | --- | --- |
| `GroupBar` | draggable column chips + removable grouping tokens + clear | `#groupBar` | `grouping`, `groupableColumns`, `applyGrouping`, `clearGrouping` |

## Per-framework code

The per-target wiring is the [grouping + aggregation snippet](/components/data-table-usage#grouping-aggregation-headless-groupbar) and the [drop-in group bar + detail panel snippet](/components/data-table-usage#drop-in-group-bar-detail-panel-groupbar-detail) on the usage page.

## See also

- [Expandable rows & master-detail](/components/data-table-expandable) — group headers ride the expand model.
- [API reference](/components/data-table-api) — the `groupable` / `grouping` props, the `#groupBar` slot, and the grouping verbs.
