# Columns

Columns are declared either as `<Column>` children, via the `:columns` config-array escape hatch, or both. Cell and header rendering is a single scoped slot on the parent `<DataTable>`, dispatched by `columnId`.

## The `<Column>` declarative API

A `<Column>` declares one column of the table. It is **renderless** — it draws nothing itself; it registers a column spec with the parent `<DataTable>` (via a `$provide`/`$inject` registry) on mount and unregisters on cleanup. The `<td>` / `<th>` hosts are framework-owned by the parent's keyed `r-for`.

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `field` | `String` | `''` | The row field this column reads (table-core `accessorKey`). |
| `header` | `String` | `''` | The header label (rendered when no `#colHeader` template is supplied). |
| `id` | `String` | `''` | The column id. Defaults to `field` when omitted. |
| `sortable` | `Boolean` | `false` | Whether this column participates in click-to-sort. |
| `filterable` | `Boolean` | `false` | Whether this column shows a per-column filter input. |
| `pinned` | `String` | `''` | Initial pin side (`''` \| `'left'` \| `'right'`). Applied once as the table's starting `columnPinning` state, so `column.getIsPinned()` reports it and the column renders in the corresponding sticky rail. Because table-core orders visible cells `[left-pinned, center, right-pinned]`, pinning also **reorders** the column. A consumer who has already pinned something — an initial `r-model:columnPinning` value or an interactive pin — owns the slice, and this declaration is ignored; likewise an interactive unpin is never re-applied. |
| `width` | `String \| Number` | `''` | Optional fixed/initial column width (CSS length or px number). |
| `groupable` | `Boolean` | `true` | Whether this column is offered to the headless `#groupBar` as a grouping target (opt-out via `:groupable="false"`). Grouping is engaged via the parent's `grouping` model, not this flag. |
| `aggregationFn` | `String \| Function` | `null` | The aggregation for this column's group-header value: a built-in name (`'sum'` \| `'min'` \| `'max'` \| `'extent'` \| `'mean'` \| `'median'` \| `'unique'` \| `'uniqueCount'` \| `'count'`) or a custom `(columnId, leafRows, childRows) => any`. A custom fn is defensively wrapped (a throw cannot crash the table). Null → no aggregation (placeholder cell). |
| `editable` | `Boolean` | `false` | Whether this column's cells can be edited (and their committed values written back through the `data` model). See [Editing](/components/data-table-editing). Bare `<Column editable />` only coerces to `true` on Vue + Lit; bind `:editable="true"` elsewhere. |
| `editor` | `String` | `'text'` | The built-in editor when `editable`: `'text'` \| `'number'` \| `'select'` \| `'checkbox'` \| `'custom'`. `'custom'` ships no built-in editor — the `#editor` scoped slot (or a [drop-in editor component](/components/data-table-editing#drop-in-editor-components)) renders it. |
| `editorOptions` | `Array` | `[]` | For `editor="select"`: the `[{ value, label }]` dropdown options. Ignored for the other editor types. |
| `validate` | `Function` | `null` | A synchronous per-column validator `(value, row) => true \| string`: return `true`/falsy to accept, a string to reject with that message (the editor stays open and the error is announced via aria-live). Defensively wrapped — a thrown error coerces to a generic message. |

::: warning Changed in 0.5.0
`pinned` is now a real initial pin seed. In 0.4.0 and earlier the field was carried onto the column
definition and read by nothing, so declaring `pinned="left"` had no effect and this page documented it
as inert. It now applies once as the table's starting `columnPinning` state — which also **reorders**
the column, because table-core orders visible cells `[left-pinned, center, right-pinned]`.

If you already declare `pinned` on a column and do not want it pinned, remove the declaration. If you
bind `r-model:columnPinning` with a non-empty value, or a user has pinned interactively, you own the
slice and the declaration is ignored — that case is unchanged.
:::

Because a bare boolean attribute on a child component (`<Column sortable />`) only coerces to `true` on Vue + Lit, **bind it** in the other targets — `:sortable="true"` (React/Solid/Angular/Svelte) — or rely on each consumer framework's own boolean-attribute convention.

## Two coexisting column-declaration forms

Columns may be declared via `<Column>` children **or** via the `:columns` config-array escape hatch **or both** — they resolve to the same internal column set via an **id-keyed last-write-wins union**: the `:columns` array is applied first (lower precedence), then the `<Column>` children override by id. A leaf config entry accepts the full key set `<Column>` exposes as props — `{ id?, field, header?, sortable?, filterable?, pinned?, width?, expandable?, groupable?, aggregationFn?, editable?, editor?, editorOptions?, validate? }` (each key's semantics match the identically-named `<Column>` attribute; `pinned` behaves exactly as described above — an initial pin seed). `expandable` (reserved per-column metadata flagging participation in the expand affordance; default `false`) is a genuine `<Column>` prop too — the table above doesn't yet list it, but `<Column :expandable="true">` works identically to the config-array key:

```rozie
<DataTable :data="$data.rows" :columns="[
  { field: 'name', header: 'Name', sortable: true },
  { field: 'email', header: 'Email' },
]" />
```

See the [config-array usage snippet](/components/data-table-usage#columns-as-a-config-array) and the [declarative `<Column>` children + custom cell snippet](/components/data-table-usage#declarative-column-children-a-custom-cell) for the per-framework form.

## Grouped column headers

A config-array entry may, instead of `field`, carry a nested `columns` array: `{ id?, header, columns: [...] }`. table-core then renders an extra header row — the parent entry's `header` spans its children as a **group header**, and each child resolves as its own leaf column (which may itself nest further). A group entry carries no accessor and can never be sorted, filtered, pinned, or used as a grouping key; only its leaf children can.

```rozie
<DataTable :data="$data.rows" :columns="[
  { header: 'Contact', columns: [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'email', header: 'Email' },
  ] },
  { field: 'status', header: 'Status', filterable: true },
]" />
```

If a group entry omits `id`, one is derived deterministically from its children's ids, so it stays addressable (e.g. for `columnVisibility`) without colliding with a same-titled sibling group. **Nesting is available only on the config-array form** — `<Column>` has no nested-column surface; a grouped header cannot be built from `<Column>` children alone.

## Cell & header rendering — the parent `#cell` / `#colHeader` slot

A `<Column>` is **renderless** and carries **metadata only** — it never renders a cell itself. Custom cell and header rendering is a **single scoped slot on the parent `<DataTable>`**, `#cell` (scope `{ columnId, column, row, value }`) and `#colHeader` (scope `{ columnId, column, label }`), **dispatched by `columnId`**: you write one slot and switch on `columnId` to vary the render per column. A column the slot does not render (or any column when no slot is supplied) shows the plain accessor value — the fast path. This holds whether columns are declared as `<Column>` children or via the `:columns` array.

> **Why parent-level, not per-`<Column>`?** The `<td>` / `<th>` hosts are framework-owned by the parent's keyed `r-for`, and a renderless child cannot plain-render into a sibling's host. So the one `#cell` / `#colHeader` scoped slot lives on `<DataTable>` and dispatches by `columnId`. The header slot is named `#colHeader` (not `#header`) because a `#header` slot lowers to a Svelte snippet prop named `header`, which collides with a common local.

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

## Per-column slot families {#per-column-slot-families}

Alongside the generic `#cell` / `#colHeader` / `#filter` / `#editor` slots (each dispatched by `columnId` inside a single fill), `@rozie-ui/data-table` also exposes a **per-column dynamic-name slot family** on all four column-scoped seams: `cell-<columnId>`, `colHeader-<columnId>`, `filter-<columnId>`, `editor-<columnId>`. A family member is an ordinary **static** named fill — no runtime dispatch on your side:

```rozie
<DataTable :data="$data.rows">
  <Column field="price" header="Price" sortable />
  <!-- Targets ONLY the price column — no columnId branch needed -->
  <template #cell-price="{ row, value }">
    <strong :class="{ negative: value < 0 }">{{ formatCurrency(value) }}</strong>
  </template>
</DataTable>
```

**Three-tier precedence**, per seam, resolved structurally (not by a runtime presence check): the per-column family fill (`#cell-price`) wins if supplied, falling back to the shared generic fill (`#cell`) if supplied, falling back to the built-in render if neither is supplied. Filling `#cell-price` does not disable `#cell` for every *other* column — the two tiers compose.

**Two gate rules**, applied identically to both the family and the generic tier of the same seam:

- The **editor** family (`editor-<columnId>`, and the generic `#editor`) reaches only columns with `editable: true` and `editor="custom"` — and, for any pointer or keyboard edit entry (as opposed to the imperative `editCell`/`editRow` handle verbs), the table needs `interactionMode="grid"`. A column with a built-in editor type (`'text'` / `'number'` / `'select'` / `'checkbox'`) never routes through either editor tier.
- The **filter** family (`filter-<columnId>`, and the generic `#filter`) reaches only columns declaring `filterable`. A non-filterable column never routes through either filter tier.

`cell` and `colHeader` carry no such gate — every column reaches those two seams.

**Chrome columns are structurally excluded, not gated.** The auto-injected row-expander column (`__rdt_expander`) and the row-selection column each take their own dedicated branch earlier in the render chain — they never reach the generic `#cell` / `#colHeader` slot, so they never reach the family tier either. A fill named for one of them (e.g. `#cell-__rdt_expander`) is legal Rozie but structurally inert — it will never be invoked.

Consumer typing note: on five of six targets the family key is template-literal-typed with an inferred scoped-parameter shape, but the emitted type also carries a trailing catch-all index signature, so a misspelled column id still typechecks (it is inert at runtime rather than a compile error) — see [Dynamic slot names](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) for the exact emitted shape and the Angular divergence.

See the [per-column slot families usage snippet](/components/data-table-usage#per-column-slot-families-cell-id-colheader-id-filter-id-editor-id) for the concrete syntax on every target (React/Solid `slots`, Vue native `#cell-<id>`, Svelte `snippets`, Angular `[templates]`, Lit `.rozieSlots`) and the [Slots reference](/components/data-table-api#slots) for the full row-by-row param list.

- [Editing](/components/data-table-editing) — the `editor-<columnId>` family and its `editor:'custom'` gate, plus the drop-in editor components.
- [Faceted filtering](/components/data-table-faceted-filtering) — the `filter-<columnId>` family and its `filterable` gate, plus the drop-in filter components.

## See also

- [API reference](/components/data-table-api) — every prop, two-way slice, event, slot, and handle verb.
- [Sort, filter & paginate](/components/data-table-sort-filter-paginate) — wiring the `sortable` / `filterable` columns to state.
- [Editing](/components/data-table-editing) — the `editable` / `editor` / `validate` Column props in depth.
