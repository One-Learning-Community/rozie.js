# Columns

Columns are declared either as `<Column>` children, via the `:columns` config-array escape hatch, or both. Cell and header rendering is a single scoped slot on the parent `<DataTable>`, dispatched by `columnId`.

## The `<Column>` declarative API

A `<Column>` declares one column of the table. It is **renderless** — it draws nothing itself; it registers a column spec with the parent `<DataTable>` (via a `$provide`/`$inject` registry) on mount and unregisters on cleanup. The `<td>` / `<th>` hosts are framework-owned by the parent's keyed `r-for`.

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `field` | `String` | `''` | The row field this column reads (table-core `accessorKey`). |
| `header` | `String` | `''` | The header label (rendered when no `#header` template is supplied). |
| `id` | `String` | `''` | The column id. Defaults to `field` when omitted. |
| `sortable` | `Boolean` | `false` | Whether this column participates in click-to-sort. |
| `filterable` | `Boolean` | `false` | Whether this column shows a per-column filter input. |
| `pinned` | `String` | `''` | Initial pin side: `''` (unpinned) \| `'left'` \| `'right'`. |
| `width` | `String \| Number` | `''` | Optional fixed/initial column width (CSS length or px number). |
| `groupable` | `Boolean` | `true` | Whether this column is offered to the headless `#groupBar` as a grouping target (opt-out via `:groupable="false"`). Grouping is engaged via the parent's `grouping` model, not this flag. |
| `aggregationFn` | `String \| Function` | `null` | The aggregation for this column's group-header value: a built-in name (`'sum'` \| `'min'` \| `'max'` \| `'extent'` \| `'mean'` \| `'median'` \| `'unique'` \| `'uniqueCount'` \| `'count'`) or a custom `(columnId, leafRows, childRows) => any`. A custom fn is defensively wrapped (a throw cannot crash the table). Null → no aggregation (placeholder cell). |
| `editable` | `Boolean` | `false` | Whether this column's cells can be edited (and their committed values written back through the `data` model). See [Editing](/components/data-table-editing). Bare `<Column editable />` only coerces to `true` on Vue + Lit; bind `:editable="true"` elsewhere. |
| `editor` | `String` | `'text'` | The built-in editor when `editable`: `'text'` \| `'number'` \| `'select'` \| `'checkbox'` \| `'custom'`. `'custom'` ships no built-in editor — the `#editor` scoped slot (or a [drop-in editor component](/components/data-table-editing#drop-in-editor-components)) renders it. |
| `editorOptions` | `Array` | `[]` | For `editor="select"`: the `[{ value, label }]` dropdown options. Ignored for the other editor types. |
| `validate` | `Function` | `null` | A synchronous per-column validator `(value, row) => true \| string`: return `true`/falsy to accept, a string to reject with that message (the editor stays open and the error is announced via aria-live). Defensively wrapped — a thrown error coerces to a generic message. |

Because a bare boolean attribute on a child component (`<Column sortable />`) only coerces to `true` on Vue + Lit, **bind it** in the other targets — `:sortable="true"` (React/Solid/Angular/Svelte) — or rely on each consumer framework's own boolean-attribute convention.

## Two coexisting column-declaration forms

Columns may be declared via `<Column>` children **or** via the `:columns` config-array escape hatch **or both** — they resolve to the same internal column set via an **id-keyed last-write-wins union**: the `:columns` array is applied first (lower precedence), then the `<Column>` children override by id. Each config entry is `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`:

```rozie
<DataTable :data="$data.rows" :columns="[
  { field: 'name', header: 'Name', sortable: true },
  { field: 'email', header: 'Email' },
]" />
```

See the [config-array usage snippet](/components/data-table-usage#columns-as-a-config-array) and the [declarative `<Column>` children + custom cell snippet](/components/data-table-usage#declarative-column-children-a-custom-cell) for the per-framework form.

## Cell & header rendering — the parent `#cell` / `#colHeader` slot

A `<Column>` is **renderless** and carries **metadata only** — it never renders a cell itself. Custom cell and header rendering is a **single scoped slot on the parent `<DataTable>`**, `#cell` (scope `{ columnId, column, row, value }`) and `#colHeader` (scope `{ columnId, column, label }`), **dispatched by `columnId`**: you write one slot and switch on `columnId` to vary the render per column. A column the slot does not render (or any column when no slot is supplied) shows the plain accessor value — the fast path. This holds whether columns are declared as `<Column>` children or via the `:columns` array.

> **Why parent-level, not per-`<Column>`?** The `<td>` / `<th>` hosts are framework-owned by the parent's keyed `r-for`, and a renderless child cannot plain-render into a sibling's host. So the one `#cell` / `#colHeader` scoped slot lives on `<DataTable>` and dispatches by `columnId` (design decision **D-A**). The header slot is named `#colHeader` (not `#header`) because a `#header` slot lowers to a Svelte snippet prop named `header`, which collides with a common local.

```rozie
<DataTable :data="$data.rows">
  <Column field="status" header="Status" sortable />
  <!-- One slot, switched by columnId -->
  <template #cell="{ columnId, value }">
    <StatusBadge r-if="columnId === 'status'" :status="value" />
    <template r-else>{{ value }}</template>
  </template>
  <template #colHeader="{ columnId, label }">
    {{ label }}<span r-if="columnId === 'status'"> ⚑</span>
  </template>
</DataTable>
```

> **React / Solid / Lit render-prop form (the one documented cross-framework divergence).** On the JSX/property targets the slot surfaces as a prop holding a render function rather than a `<template>`: React `renderCell` / `renderColHeader`, Solid `cellSlot` / `colHeaderSlot` — `(ctx) => ReactNode` / `JSX.Element` — and Lit the `.cell` / `.colHeader` properties (a function returning a Lit template). The scope object (`{ columnId, column, row, value }` / `{ columnId, column, label }`) is identical across all six. Vue, Svelte (a `{#snippet cell()}`), and Angular (an `<ng-template #cell>`) use their native slot/snippet/template mechanism. See the [declarative `<Column>` children + custom cell usage snippet](/components/data-table-usage#declarative-column-children-a-custom-cell) for the exact per-target form.

## See also

- [API reference](/components/data-table-api) — every prop, two-way slice, event, slot, and handle verb.
- [Sort, filter & paginate](/components/data-table-sort-filter-paginate) — wiring the `sortable` / `filterable` columns to state.
- [Editing](/components/data-table-editing) — the `editable` / `editor` / `validate` Column props in depth.
