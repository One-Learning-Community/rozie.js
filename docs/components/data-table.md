# DataTable — the cross-framework headless data table

`DataTable` is Rozie's **headless, fully-accessible** data table / data grid — the `@rozie-ui` component that fills a real cross-framework toolchain gap. Sorting, global + per-column filtering, pagination, row selection, full column management (visibility, resize, reorder, pinning), **editable cells + full-row edit**, **multi-column grouping + aggregation**, **headless faceted filtering**, **expandable rows**, an opt-in WAI-ARIA **grid interaction mode**, and a sticky header are all authored once in `DataTable.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is **`@tanstack/table-core`** — the *same* framework-agnostic state machine that powers TanStack Table — wired to each framework's reactivity **with no per-framework adapter**. `table-core` owns no DOM (it is a pure `createTable → setOptions → getRowModel` pull-based state machine), so `DataTable` is the controlled-state half of an engine wrapper with none of the DOM-mutation half: Rozie owns the author-side API (the twelve two-way `r-model` slices, the `<Column>` declarative children, the per-column `#cell` / `#header` reactive templates, and the accessible chrome), table-core owns the row model, and the consumer just binds state.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/data-table` packages

`DataTable` ships as six pre-compiled, per-framework packages generated from a single `DataTable.rozie` source (plus the declarative `Column.rozie` child) via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/data-table-react` | `npm i @rozie-ui/data-table-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/react/README.md) |
| `@rozie-ui/data-table-vue` | `npm i @rozie-ui/data-table-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/vue/README.md) |
| `@rozie-ui/data-table-svelte` | `npm i @rozie-ui/data-table-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/svelte/README.md) |
| `@rozie-ui/data-table-angular` | `npm i @rozie-ui/data-table-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/angular/README.md) |
| `@rozie-ui/data-table-solid` | `npm i @rozie-ui/data-table-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/solid/README.md) |
| `@rozie-ui/data-table-lit` | `npm i @rozie-ui/data-table-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/packages/lit/README.md) |

Each package carries `@tanstack/table-core` as a **peer dependency** (so you control the table-core version — it is never a bundled copy) plus only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The codegen also enforces a hard rule: each leaf imports **only** `@tanstack/table-core`, never a `@tanstack/<framework>-table` adapter — the single-core no-adapter design is the whole point of the family. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `DataTable.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Pass a `data` array, declare columns (either as `<Column>` children or via the `:columns` config array), and bind whichever state slices you want to control. Everything works **uncontrolled** out of the box — bind a slice only when you want to own it:

```rozie
<components>
{
  DataTable: './DataTable.rozie',
  Column: './Column.rozie',
}
</components>

<data>
{
  rows: [
    { id: 1, name: 'Ada Lovelace', email: 'ada@analytical.engine', status: 'active' },
    { id: 2, name: 'Alan Turing',  email: 'alan@bletchley.park',   status: 'active' },
    { id: 3, name: 'Grace Hopper', email: 'grace@navy.mil',        status: 'away'   },
  ],
  sorting: [],
}
</data>

<template>
  <DataTable :data="$data.rows" r-model:sorting="$data.sorting" selectionMode="multiple" stickyHeader>
    <Column field="name" header="Name" sortable filterable />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" sortable />

    <!-- One #cell slot on <DataTable>, dispatched by columnId -->
    <template #cell="{ columnId, value }">
      <StatusBadge r-if="columnId === 'status'" :status="value" />
      <template r-else>{{ value }}</template>
    </template>
  </DataTable>
</template>
```

Each `r-model:<slice>` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `DataTable` a state slice, the table writes the fresh slice back on every transition, and the framework reconciler picks it up — no `onChange → setState` wiring. Every slice also has an **uncontrolled fallback**: a slice you do not bind is managed internally (and its change event still fires regardless of binding, so you can observe transitions without two-way binding).

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
| `editable` | `Boolean` | `false` | Whether this column's cells can be edited (and their committed values written back through the `data` model). See [Editable cells and full-row edit](#editable-cells-and-full-row-edit). Bare `<Column editable />` only coerces to `true` on Vue + Lit; bind `:editable="true"` elsewhere. |
| `editor` | `String` | `'text'` | The built-in editor when `editable`: `'text'` \| `'number'` \| `'select'` \| `'checkbox'` \| `'custom'`. `'custom'` ships no built-in editor — the `#editor` scoped slot (or a [drop-in editor component](#drop-in-editor-components)) renders it. |
| `editorOptions` | `Array` | `[]` | For `editor="select"`: the `[{ value, label }]` dropdown options. Ignored for the other editor types. |
| `validate` | `Function` | `null` | A synchronous per-column validator `(value, row) => true \| string`: return `true`/falsy to accept, a string to reject with that message (the editor stays open and the error is announced via aria-live). Defensively wrapped — a thrown error coerces to a generic message. |

Because a bare boolean attribute on a child component (`<Column sortable />`) only coerces to `true` on Vue + Lit, **bind it** in the other targets — `:sortable="true"` (React/Solid/Angular/Svelte) — or rely on each consumer framework's own boolean-attribute convention.

### Two coexisting column-declaration forms

Columns may be declared via `<Column>` children **or** via the `:columns` config-array escape hatch **or both** — they resolve to the same internal column set via an **id-keyed last-write-wins union**: the `:columns` array is applied first (lower precedence), then the `<Column>` children override by id. Each config entry is `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`:

```rozie
<DataTable :data="$data.rows" :columns="[
  { field: 'name', header: 'Name', sortable: true },
  { field: 'email', header: 'Email' },
]" />
```

### Cell & header rendering — the parent `#cell` / `#colHeader` slot

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

> **React / Solid / Lit render-prop form (the one documented cross-framework divergence).** On the JSX/property targets the slot surfaces as a prop holding a render function rather than a `<template>`: React `renderCell` / `renderColHeader`, Solid `cellSlot` / `colHeaderSlot` — `(ctx) => ReactNode` / `JSX.Element` — and Lit the `.cell` / `.colHeader` properties (a function returning a Lit template). The scope object (`{ columnId, column, row, value }` / `{ columnId, column, label }`) is identical across all six. Vue, Svelte (a `{#snippet cell()}`), and Angular (an `<ng-template #cell>`) use their native slot/snippet/template mechanism. See [usage examples](/components/data-table-usage) for the exact per-target snippet.

## API

### Props

The full prop surface. The twelve `model: true` slices (the **Two-way** column — `data` plus the eleven state slices) are each an independent, optional two-way `r-model` with an uncontrolled fallback; with multiple model props the Angular output emits **no** `ControlValueAccessor` (the multi-model condition disables it — the per-prop `valueChange` outputs still drive each two-way binding).

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `data` | `Array` | `—` | ✓ | ✓ | The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher). |
| `columns` | `Array` | `[]` | | | Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. |
| `selectionMode` | `String` | `"none"` | | | Row-selection mode: `'none'` \| `'single'` \| `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header. |
| `sorting` | `Array` | `[]` | ✓ | | `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. |
| `globalFilter` | `String` | `''` | ✓ | | The global search string — narrows all columns. Surfaces through `filter-change`. |
| `columnFilters` | `Array` | `[]` | ✓ | | `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). |
| `pagination` | `Object` | `{…}` | ✓ | | `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome. |
| `manual` | `Boolean` | `false` | | | Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events. |
| `expandable` | `Boolean` | `false` | | | Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). |
| `expanded` | `any` | `null` | ✓ | | `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand. |
| `getSubRows` | `Function` | `null` | | | Table-level child-row accessor `(originalRow, index) => TData[] \| undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode. |
| `groupable` | `Boolean` | `false` | | | Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI). |
| `grouping` | `Array` | `null` | ✓ | | `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array. |
| `rowSelection` | `Object` | `{}` | ✓ | | `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). |
| `columnVisibility` | `Object` | `{}` | ✓ | | `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. |
| `columnSizing` | `Object` | `{}` | ✓ | | `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). |
| `columnOrder` | `Array` | `[]` | ✓ | | `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). |
| `columnPinning` | `Object` | `{…}` | ✓ | | `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. |
| `stickyHeader` | `Boolean` | `false` | | | Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container. |
| `interactionMode` | `String` | `"table"` | | | `'table'` (default, row-oriented) \| `'grid'`. `'grid'` lights up the full WAI-ARIA **[grid interaction mode](#grid-interaction-mode)** — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation. `'table'` is byte-behaviorally identical to a plain accessible table. |
| `virtual` | `Boolean` | `false` | | | Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table. |
| `estimateRowHeight` | `Number` | `40` | | | Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` | | | A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback. |

### Models (the twelve two-way slices)

Each slice is an independent, optional two-way `r-model` with its own uncontrolled fallback and its own change event (which fires **regardless** of whether the slice is bound). All twelve state transitions are funneled through table-core; the table always writes a **fresh** value (never an in-place mutation, which would be silently dropped on React/Solid/Angular/Lit). The first slice is `data` itself — a committed cell or row edit writes a fresh `data` array back; the remaining eleven are the table-state slices.

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `data` | `TData[]` | `data-change` | The row data. Two-way so committed cell/row edits flow back (uncontrolled fallback `dataDefault`). Always written as a fresh array, never mutated in place. |
| `sorting` | `[{ id, desc }]` | `sort-change` | The sort state (header click; shift-click adds a secondary sort). |
| `globalFilter` | `string` | `filter-change` | The global search string — narrows all columns. |
| `columnFilters` | `[{ id, value }]` | `filter-change` | Per-column filter values (gated by each column's `filterable`). |
| `pagination` | `{ pageIndex, pageSize }` | `page-change` | The current page index + size. |
| `rowSelection` | `{ [rowId]: true }` | `selection-change` | The selected-row set (checkbox-only). |
| `expanded` | `{ [rowId]: true } \| true` | `expand-change` | The expanded-row set (multi-expand; the `true` literal = all rows expanded). |
| `grouping` | `string[]` | `group-change` | The ordered grouping key list (multi-column → nested groups). `[]` is ungrouped. |
| `columnVisibility` | `{ [colId]: boolean }` | `visibility-change` | Per-column shown/hidden state. |
| `columnSizing` | `{ [colId]: number }` | `resize-change` | Per-column widths (live during a resize drag). |
| `columnOrder` | `string[]` | `reorder-change` | The full column order. |
| `columnPinning` | `{ left: string[], right: string[] }` | `pin-change` | Per-side pinned-column ids. |

### Events

Every change event fires **regardless** of whether the matching `r-model` slice is bound (the uncontrolled-fallback contract), so you can observe transitions without two-way binding. The payload is the fresh slice value (`filter-change` carries `{ globalFilter }` or `{ columnFilters }` depending on which filter changed).

| Event | Description |
| --- | --- |
| `sort-change` | Fired when the sort state changes (header click / shift-click multi-sort / a `sortColumn`/`clearSorting` call). Payload: the fresh `SortingState` `[{ id, desc }]`. |
| `filter-change` | Fired when a filter changes. Payload `{ globalFilter }` for the global search box or `{ columnFilters }` for a per-column filter — both surface through this one event. |
| `page-change` | Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload: the fresh `{ pageIndex, pageSize }`. |
| `selection-change` | Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload: the fresh `RowSelectionState`. |
| `expand-change` | Fired when the expanded-row set changes (an expander chevron toggle — click / Enter / Space — or a `toggleRowExpanded`/`expandAll`/`collapseAll` call). Fires exactly once per change. Payload: the fresh `ExpandedState` (`{ [rowId]: true }`, or the `true` literal after `expandAll` — pass through verbatim, never `Object.keys` without a `=== true` guard). Named `expand-change` (not `expanded-change`) so it does not collide with the `expanded` model's `onExpandedChange` callback on the React/Solid Props interface. |
| `group-change` | Fired when the grouping changes (a `#groupBar` apply/clear, mutating the `grouping` model, or an `applyGrouping`/`clearGrouping` call). Fires exactly once per change. Payload: the fresh `GroupingState` — an ordered `string[]` of column ids, or `[]` when cleared. Named `group-change` (not `grouping-change`) so it does not collide with the `grouping` model's `onGroupingChange` callback on the React/Solid Props interface. |
| `visibility-change` | Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload: the fresh `VisibilityState`. |
| `resize-change` | Fired live during a column resize drag (`columnResizeMode: 'onChange'`). Payload: the fresh `ColumnSizingState`. |
| `reorder-change` | Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload: the fresh `ColumnOrderState`. |
| `pin-change` | Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload: the fresh `ColumnPinningState`. |
| `activecell-change` | **Grid mode only.** Fired when the active cell moves (arrow-key navigation, a click-to-activate, or a `focusCell` call) — but **not** on a clamped no-op edge move. Payload: `{ rowIndex, colIndex }` (integer position over the visible model). See [Grid interaction mode](#grid-interaction-mode). |
| `cell-edit-commit` | Fired when an editable cell commits a new, **validated** value (Enter, a blur-commit, or a `commitEditing` call). Payload: `{ rowId, columnId, oldValue, newValue }`. **Not** fired on cancel (`Escape`) or a validation failure. See [Editable cells and full-row edit](#editable-cells-and-full-row-edit). |
| `row-edit-commit` | Fired when a full-row edit commits all its changes at once (Enter in row-edit mode or an `editRow` save). Payload: `{ rowId, changes }` where `changes` is `[{ columnId, oldValue, newValue }]` for the columns whose value actually changed. **Not** fired on `Escape` or a validation failure. |
| `range-change` | **Grid mode only.** Fired when the rectangular cell-range selection changes (extended via `Shift+Arrow` / `Shift+Click`). Payload: `{ anchor, focus }` — each corner a `{ rowIndex, colIndex }` index pair over the visible model, or `{ anchor: null, focus: null }` when no range is set. One-way (this event + the `getSelectedRange` verb), never a `model:true` slice. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism. Each verb drives `@tanstack/table-core` so the matching change event fires.

| Method | Description |
| --- | --- |
| `sortColumn` | Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Fires `sort-change`. |
| `clearSorting` | Clear all sorting — `clearSorting()`. Resets to the unsorted core row model. Fires `sort-change`. |
| `getColumnDefs` | Return the resolved `ColumnDef[]` (the id-keyed LWW union of the `:columns` array and the `<Column>` children). |
| `toggleAllRows` | Select or clear all (filtered) rows — `toggleAllRows(value)`. Fires `selection-change`. |
| `clearSelection` | Clear the row selection — `clearSelection()`. Fires `selection-change` with `{}`. |
| `getSelectedRows` | Return the original row data for the selected rows — `getSelectedRows()` → `unknown[]`. |
| `toggleRowExpanded` | Toggle one row's expanded state — `toggleRowExpanded(rowId)` (the data `id` field or the table-core row id; both resolve). Multi-expand (does not collapse other rows). Fires `expand-change`. |
| `expandAll` | Open every expandable row — `expandAll()`. Fires `expand-change` (payload may be the `true` literal). |
| `collapseAll` | Collapse every row — `collapseAll()`. Resets the expanded set to `{}`. Fires `expand-change`. |
| `getExpandedRows` | Return the original row data for the currently-expanded rows — `getExpandedRows()` → `unknown[]` (empty when nothing is expanded). |
| `applyGrouping` | Set the full grouping — `applyGrouping(cols)` where `cols` is an ordered `string[]` of column ids (multi-column → nested groups). Fires `group-change`. (Named `applyGrouping`, not `setGrouping`, to avoid colliding with React's auto-generated `grouping` model setter — ROZ524.) |
| `clearGrouping` | Clear all grouping — `clearGrouping()`. Resets to the ungrouped (flat) row model. Fires `group-change` with `[]`. |
| `setPage` | Go to a 0-based page index — `setPage(idx)`. Fires `page-change`. |
| `setRowsPerPage` | Set the page size — `setRowsPerPage(size)`. Fires `page-change`. |
| `toggleColumnVisibility` | Show/hide a column — `toggleColumnVisibility(colId)`. Fires `visibility-change`. |
| `applyColumnOrder` | Set the full column order — `applyColumnOrder(order)`. Fires `reorder-change`. (Named `applyColumnOrder`, not `setColumnOrder`, to avoid colliding with React's auto-generated `columnOrder` model setter — ROZ524.) |
| `resetColumnSizing` | Reset all column widths to their defaults — `resetColumnSizing()`. Fires `resize-change`. |
| `pinColumn` | Pin a column to a side or unpin it — `pinColumn(colId, side)` where `side` is `'left'` \| `'right'` \| `false`. Fires `pin-change`. |
| `getFacetedUniqueValues` | Return a column's **cross-filtered** distinct values — `getFacetedUniqueValues(colId)` → `unknown[]` (keys only; occurrence counts are not exposed). Reflects rows passing all *other* active column filters. Empty array when unavailable. Inert (the faceted models stay off-path) until this verb or the `#filter` slot reads a facet. See [Faceted filtering](#faceted-filtering). |
| `getFacetedMinMaxValues` | Return a numeric column's **cross-filtered** `[min, max]` range — `getFacetedMinMaxValues(colId)` → `[number, number] \| null`. `null` when unavailable or non-numeric. The read twin handed to the `#filter` slot for a numeric range slider. |
| `editCell` | **Editing.** Open the editor on a cell — `editCell(rowIndex, colIndex)` (index-addressed over the visible model; args coerced to integers + clamped). No-op on a non-editable cell. |
| `commitEditing` | **Editing.** Commit the open editor — `commitEditing()`. Runs the column validator; on success writes `r-model:data` and fires one `cell-edit-commit`; on a validation failure keeps the editor open. No-op when no cell is editing. |
| `editRow` | **Editing.** Enter full-row edit on a body row — `editRow(rowIndex)` (the API twin of `Shift+F2`): every editable cell in the row opens at once; a later save commits the whole row in one `r-model:data` write + one `row-edit-commit`. No-op on a row with no editable columns. |
| `getSelectedRange` | Return the current rectangular cell-range selection — `getSelectedRange()` → `{ anchor, focus }` (each corner a `{ rowIndex, colIndex }` index pair, or `{ anchor: null, focus: null }`). One-way (this verb + `range-change`), never a `model:true` slice. |
| `focusCell` | **Grid mode.** Move + DOM-focus the active cell by index — `focusCell(rowIndex, colIndex)` (coerced to integers and clamped to the visible model). Fires `activecell-change`. |
| `getActiveCell` | **Grid mode.** Return the current active-cell position — `getActiveCell()` → `{ rowIndex, colIndex }` (integers only; never a row object or DOM node). |
| `clearActiveCell` | **Grid mode.** Reset the roving position to the entry cell (`0,0`) and exit interaction mode — `clearActiveCell()`. Does not emit (a reset, not a navigation). |

### Slots

All slots live on the parent `<DataTable>` (a `<Column>` carries metadata only). The `cell` / `colHeader` slots are single renderers [dispatched by `columnId`](#cell-header-rendering-—-the-parent-cell-colheader-slot). On React/Solid these are render-prop props (`renderCell` / `renderColHeader` / `cellSlot` / `colHeaderSlot`) and on Lit the `.cell` / `.colHeader` properties — the one documented cross-framework divergence.

| Slot | Params | Description |
| --- | --- | --- |
| `cell` | `columnId, column, row, value` | Custom cell renderer — switch on `columnId` to vary per column. A column it does not render shows the plain accessor value. |
| `colHeader` | `columnId, column, label` | Custom header renderer — switch on `columnId`. Falls back to the plain `header` label. |
| `selectAll` | `checked, indeterminate, toggle` | Override the select-all header (only when `selectionMode="multiple"`). `indeterminate` is true on a partial selection. |
| `selectCell` | `row, checked, toggle` | Override the per-row select checkbox (only when `selectionMode="multiple"`). |
| `detail` | `row` | Custom expanded-row content rendered under an expanded row (only when `expandable` and no `getSubRows`). The React render-prop edge (documented divergence). |
| `groupBar` | `grouping, groupableColumns, applyGrouping, clearGrouping` | **Headless** group-bar (only when `groupable`). Receives the ordered `grouping` array, the `groupableColumns` (`[{ id, label }]`), and the `applyGrouping`/`clearGrouping` helpers so a consumer builds any bar/drag UI. The default render is a non-interactive styled-token reflection (empty when ungrouped); the component ships **no** drag affordance. The React render-prop edge (documented divergence). |
| `filter` | `columnId, uniqueValues, minMax, setFilter` | **Headless** faceted-filter UI (only when a column is `filterable`). `uniqueValues` is the cross-filtered distinct values (`unknown[]`, keys only); `minMax` is the cross-filtered numeric `[min, max]` (or `null`); `setFilter(columnId, value)` applies a column filter through the same funnel the built-in input uses (`value` of `null`/`''` clears it). Build a checkbox list / range slider and call `setFilter` (or drive `columnFilters` directly) — the slot fires no event. See [Faceted filtering](#faceted-filtering). The React render-prop edge (documented divergence). Pair it with the [drop-in filter components](#drop-in-filter-components). |
| `editor` | `columnId, column, row, value, commit, cancel` | Custom cell editor (a column with `editor="custom"`, or to override the built-in editor). `value` is the current draft; `commit(newValue)` validates + commits (fires `cell-edit-commit`); `cancel()` closes without saving; `column`/`row` are opaque passthroughs. Pair it with the [drop-in editor components](#drop-in-editor-components). The React render-prop edge (documented divergence). |

## Theming

Every value the component renders is a `--rozie-data-table-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. The public `--rozie-data-table-*` tokens are wired by `themes/base.css` onto the short internal `--rdt-*` tokens the component's scoped `<style>` actually reads — so the table renders zero-config without any theme import, and a theme swap re-skins it without touching structure. Override tokens at any ancestor scope:

```css
.rozie-data-table {
  --rozie-data-table-header-bg: #f8fafc;
  --rozie-data-table-border: 1px solid #e2e8f0;
  --rozie-data-table-selection-accent: #6366f1;
  --rozie-data-table-sort-indicator-opacity: 0.8;
}
```

### Design-system bridges

Each package ships token presets that map the data-table tokens onto a known design system's published CSS variables — import `base.css` first, then a bridge:

```ts
import '@rozie-ui/data-table-react/themes/base.css';      // the documented default token set
import '@rozie-ui/data-table-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--muted…
import '@rozie-ui/data-table-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/data-table-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/themes/base.css). The structural rules (table layout, sticky-header positioning, pinned-column offsets, the resize-handle hit area) are behavior-critical and not consumer-overridable; only the cosmetic values flow through tokens.

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

Drive and observe it imperatively via the [`focusCell`](#imperative-handle) / `getActiveCell` / `clearActiveCell` handle verbs and the [`activecell-change`](#events) event. The exact behavioral contract is locked by a cross-framework VR matrix (`tests/visual-regression/specs/data-table-grid.spec.ts`) proving REQ-1..7 identically on all six targets.

## Editable cells and full-row edit

By default every cell is read-only. Mark a `<Column editable>` (and bind `r-model:data` to receive the writes) to make that column's cells editable — **the component owns the edit state**: the consumer binds the single `data` model and listens for the commit events, with no manual re-sync. A committed edit writes a **fresh** `data` array back (never an in-place mutation).

```rozie
<DataTable :data="$data.rows" r-model:data="$data.rows" interactionMode="grid"
  @cell-edit-commit="onCommit($event)">
  <Column field="name" header="Name" editable editor="text" />
  <Column field="qty" header="Qty" editable editor="number" :validate="(v) => Number(v) >= 0 || 'must be >= 0'" />
  <Column field="status" header="Status" editable editor="select" :editorOptions="$data.statusOptions" />
  <Column field="active" header="Active" editable editor="checkbox" />
</DataTable>
```

A cell enters edit mode on click, on a printable keypress (which seeds the editor with that character), on `F2`/`Enter` (seeds the current value), or via the [`editCell(rowIndex, colIndex)`](#imperative-handle) verb. `Enter` commits; `Escape` cancels.

**Built-in editor types** (the `editor` Column prop): `'text'` (default `<input type="text">`), `'number'`, `'select'` (populate `editorOptions` with `[{ value, label }]`), `'checkbox'`, and `'custom'` (no built-in editor — the `#editor` slot drives it).

**Validation.** The `validate` Column prop runs synchronously on commit: return `true`/falsy to accept, or a string to reject — the editor stays open and the message is announced via an aria-live region, and `cell-edit-commit` does **not** fire. Validators are defensively wrapped (a thrown error coerces to a generic message).

**Full-row edit.** `Shift+F2` on a row (or the [`editRow(rowIndex)`](#imperative-handle) verb) opens every editable cell in the row at once; `Tab`/`Shift+Tab` move between editors. `Enter` commits the whole row in one `r-model:data` write + one `row-edit-commit` (validated together — one failure blocks the commit); `Escape` reverts the row as a unit.

**The `#editor` scoped slot** (scope `{ columnId, column, row, value, commit, cancel }`) replaces the built-in editor for a column — dispatch by `columnId`. `commit(newValue)` validates + commits (firing `cell-edit-commit`); `cancel()` closes without saving. On React/Solid it is the `renderEditor` / `editorSlot` render prop and on Lit the `.editor` property (the documented divergence). See the [`#editor` usage examples](/components/data-table-usage).

## Drop-in editor components

The `#editor` slot is fully headless — you can render any control. For the common cases the package also ships **opt-in drop-in editor components** so you don't have to hand-roll the input wiring: `EditorText`, `EditorNumber`, `EditorSelect`, `EditorCheckbox`, and `EditorDate`. They are **additive named exports** alongside `DataTable` (which stays the headless **default** export — importing the editors is byte-identical-off if you never use them):

```ts
import { DataTable, Column, EditorText, EditorNumber, EditorSelect, EditorCheckbox, EditorDate }
  from '@rozie-ui/data-table-<target>';
// (Vue: `import DataTable, { Column, EditorText, … }` — DataTable is the default.
//  Lit: the single side-effect import registers the <rozie-editor-*> custom elements.)
```

Each drop-in takes the `#editor` slot scope as its props — `{ columnId, column, row, value, commit, cancel }` — and `EditorSelect` additionally takes `options: [{ value, label }]` (the same shape as `<Column editorOptions>`). Mark the column `editor="custom"` so the slot drives rendering, then dispatch by `columnId` inside `#editor` and forward the scope to the matching drop-in. Use them **as-is**, or fork one as a template for a bespoke editor. The full per-framework wiring is the [drop-in editor example](/components/data-table-usage) on the usage page.

| Component | Renders | Extra props |
| --- | --- | --- |
| `EditorText` | `<input type="text">` | — |
| `EditorNumber` | `<input type="number">` | — |
| `EditorSelect` | `<select>` | `options: [{ value, label }]` |
| `EditorCheckbox` | `<input type="checkbox">` | — |
| `EditorDate` | `<input type="date">` | — |

## Faceted filtering

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

The `#filter` scope is `{ columnId, uniqueValues, minMax, setFilter }`: `uniqueValues` is the **cross-filtered** distinct values (`unknown[]`, keys only — occurrence counts are deliberately not exposed), `minMax` is the cross-filtered numeric `[min, max]` (or `null`), and `setFilter(columnId, value)` applies a column filter through the same funnel the built-in per-column input uses (passing `null`/`''` clears that column's filter). "Cross-filtered" means each facet reflects the rows passing all *other* active column filters. The slot fires no event — call `setFilter` (or update `columnFilters` directly, shape `[{ id: columnId, value }]`) from your own UI. The same data is readable imperatively via [`getFacetedUniqueValues`](#imperative-handle) / `getFacetedMinMaxValues`. Faceting stays off-path (byte-identical-off) until the `#filter` slot or a faceted verb reads it.

## Drop-in filter components

The `#filter` slot is fully headless — you can render any facet UI. For the common cases the package also ships **opt-in drop-in filter components** so you don't have to hand-roll the input wiring: `FilterText`, `FilterNumberRange`, and `FilterSelect`. Like the [editor drop-ins](#drop-in-editor-components) they are **additive named exports** alongside `DataTable` (which stays the headless **default** export — importing the filters is byte-identical-off if you never use them):

```ts
import { DataTable, Column, FilterText, FilterNumberRange, FilterSelect }
  from '@rozie-ui/data-table-<target>';
// (Vue: `import DataTable, { Column, FilterText, … }` — DataTable is the default.
//  Lit: the single side-effect import registers the <rozie-filter-*> custom elements.)
```

Each drop-in takes the `#filter` slot scope as its props — `{ columnId, column, value, setFilter }` — and writes the column filter by calling `setFilter(columnId, value)`; `FilterSelect` additionally reads `uniqueValues` (the faceted keys) and `FilterNumberRange` additionally reads `minMax` (the faceted bounds), both of which already arrive in the slot scope. Mark the column `filterable` so the `#filter` slot renders, then dispatch by `columnId` and forward the scope to the matching drop-in. Use them **as-is**, or fork one as a template for a bespoke filter. The full per-framework wiring is the [drop-in filter example](/components/data-table-usage) on the usage page.

| Component | Renders | Writes | Extra scope read |
| --- | --- | --- | --- |
| `FilterText` | `<input type="text">` | `setFilter(columnId, draft)` (Enter / blur; Escape clears) | — |
| `FilterNumberRange` | two `<input type="number">` | `setFilter(columnId, [min, max])` (`inNumberRange` shape; both empty clears) | `minMax` |
| `FilterSelect` | `<select>` | `setFilter(columnId, value)` (leading "All" option clears) | `uniqueValues` |

## Expandable rows

Set `expandable` to opt into expandable rows: a leading chevron expander column auto-injects and `getExpandedRowModel` activates. The two-way `expanded` slice is **multi-expand** (`{ [rowId]: true }`, or the `true` literal after `expandAll`), so several rows stay open at once. There are two expand modes:

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

Drive expansion imperatively with [`toggleRowExpanded`](#imperative-handle) / `expandAll` / `collapseAll` / `getExpandedRows`, and observe it via the [`expand-change`](#events) event. When grouping is active and `expanded` is untouched, group subtrees auto-expand.

## Drop-in group bar + detail panel

The `#groupBar` and `#detail` slots are fully headless — you can render any group-bar UI or any detail panel. For the common cases the package also ships two **opt-in drop-in components** so you don't have to hand-roll the wiring: `GroupBar` and `DetailPanel`. Like the [editor](#drop-in-editor-components) / [filter](#drop-in-filter-components) drop-ins they are **additive named exports** alongside `DataTable` (which stays the headless **default** export — importing them is byte-identical-off if you never use them):

```ts
import { DataTable, Column, GroupBar, DetailPanel }
  from '@rozie-ui/data-table-<target>';
// (Vue: `import DataTable, { Column, GroupBar, DetailPanel }` — DataTable is the default.
//  Lit: the single side-effect import registers the <rozie-group-bar> / <rozie-detail-panel> custom elements.)
```

`GroupBar` fills the `#groupBar` slot with a working **drag-to-group** bar (native HTML5 drag-and-drop, zero extra deps): drag a column chip into the drop zone to add it to the grouping, click a token's × to remove it, and a "Clear" affordance resets. It holds **no** grouping source of truth — it always reads the `grouping` array and routes every change through `applyGrouping` / `clearGrouping`, exactly the headless `#groupBar` contract. `DetailPanel` fills the `#detail` slot with a forkable starter that renders the open row's own fields as a key/value definition list. Mark the table `groupable` (for the bar) and `expandable` (for the panel), then forward the slot scope to each drop-in. Use them **as-is**, or fork either as a template. The full per-framework wiring is the [drop-in group bar + detail panel example](/components/data-table-usage) on the usage page.

| Component | Renders | Slot | Scope read |
| --- | --- | --- | --- |
| `GroupBar` | draggable column chips + removable grouping tokens + clear | `#groupBar` | `grouping`, `groupableColumns`, `applyGrouping`, `clearGrouping` |
| `DetailPanel` | the row's fields as a `<dl>` key/value list | `#detail` | `row` |

## Accessibility

- Semantic ARIA table roles throughout: `role="table"` / `role="rowgroup"` / `role="row"` / `role="columnheader"` / `role="cell"`, with `aria-sort` (the string-safe `'ascending'` \| `'descending'` \| `'none'`) on sortable headers.
- **Every interactive control is a native, focusable element** with an accessible name — the sort buttons, the select-all + per-row checkboxes, the pagination prev/next + page-size `<select>`, the global + per-column filter inputs, the column-visibility `<details>` disclosure, the per-header pin buttons, and the edge resize handles. There is no div-with-click-only control.
- The keyboard / focus surface is the **table-oriented** default (Tab between the native controls). Opt into [`interactionMode="grid"`](#grid-interaction-mode) for the full WAI-ARIA **grid** pattern — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation — on top of the same accessible chrome.
- Select-all scopes to the filtered rows (the TanStack default) and shows the indeterminate state on a partial selection.

## See also

- [Data table comparison](/components/data-table-comparison) — how `@rozie-ui/data-table` stacks up against TanStack Table, AG Grid, PrimeVue, Material, and the per-framework grids.
- [DataTable — live demo](/components/data-table-demo) — the real Vue package running in the page, plus the one `.rozie` source and all six generated outputs.
- [`DataTable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/DataTable.rozie)
