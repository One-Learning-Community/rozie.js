# Quick start

Get a working `DataTable` on the page in one block: pass a `data` array, declare columns (either as `<Column>` children or via the `:columns` config array), and bind whichever state slices you want to control. Everything works **uncontrolled** out of the box — bind a slice only when you want to own it.

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

## Per-framework code

The idiomatic consumption snippet for each of the six targets is on the [usage page](/components/data-table-usage#columns-as-a-config-array).

## Next steps

- [Columns](/components/data-table-columns) — the declarative `<Column>` API, the `:columns` escape hatch, and custom cell/header rendering.
- [API reference](/components/data-table-api) — every prop, two-way slice, event, slot, and imperative-handle verb.
