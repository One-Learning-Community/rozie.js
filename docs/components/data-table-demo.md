---
title: DataTable — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import { DataTable, Column } from '@rozie-ui/data-table-vue';
import '@rozie-ui/data-table-vue/themes/base.css';

const ROWS = [
  { id: 1, name: 'Ada Lovelace',     email: 'ada@analytical.engine',  status: 'active', score: 98 },
  { id: 2, name: 'Alan Turing',      email: 'alan@bletchley.park',    status: 'active', score: 95 },
  { id: 3, name: 'Grace Hopper',     email: 'grace@navy.mil',         status: 'away',   score: 91 },
  { id: 4, name: 'Katherine Johnson', email: 'katherine@nasa.gov',    status: 'active', score: 99 },
  { id: 5, name: 'Margaret Hamilton', email: 'margaret@mit.edu',      status: 'away',   score: 97 },
  { id: 6, name: 'Edsger Dijkstra',  email: 'edsger@eindhoven.nl',    status: 'active', score: 93 },
  { id: 7, name: 'Barbara Liskov',   email: 'barbara@mit.edu',        status: 'active', score: 96 },
  { id: 8, name: 'Donald Knuth',     email: 'donald@stanford.edu',    status: 'away',   score: 94 },
];

const sorting = ref([]);
const globalFilter = ref('');
const rowSelection = ref({});
const pagination = ref({ pageIndex: 0, pageSize: 5 });

const tbl = ref();
</script>

# DataTable — live demo

This is the **real `@rozie-ui/data-table-vue` package** running on this page (VitePress is itself a Vue app). Click a header to sort (shift-click to add a secondary sort), type in the search box to filter, page through the rows, tick the checkboxes to select, drag a column edge to resize, or open the **Columns** menu to hide one — then watch the two-way bound state below update. Everything is driven by the same `DataTable.rozie` source that compiles to all six frameworks, built on `@tanstack/table-core` with **no per-framework adapter** and a tokenised skin that ships inside the component.

<ClientOnly>
<div class="dt-live">

  <div class="dt-live__head">
    <button @click="tbl?.toggleAllRows(true)">toggleAllRows(true)</button>
    <button @click="tbl?.clearSelection()">clearSelection()</button>
    <button @click="tbl?.clearSorting()">clearSorting()</button>
  </div>

  <DataTable
    ref="tbl"
    :data="ROWS"
    v-model:sorting="sorting"
    v-model:global-filter="globalFilter"
    v-model:row-selection="rowSelection"
    v-model:pagination="pagination"
    selection-mode="multiple"
    sticky-header
  >
    <Column field="name" header="Name" :sortable="true" :filterable="true" />
    <Column field="email" header="Email" :sortable="true" />
    <Column field="status" header="Status" :sortable="true">
      <template #cell="{ value }">
        <span class="dt-badge" :class="'dt-badge--' + value">{{ value }}</span>
      </template>
    </Column>
    <Column field="score" header="Score" :sortable="true" />
  </DataTable>

  <div class="dt-live__state">
    <code>sorting: {{ JSON.stringify(sorting) }}</code>
    <code>globalFilter: {{ JSON.stringify(globalFilter) }}</code>
    <code>rowSelection: {{ JSON.stringify(rowSelection) }}</code>
    <code>pagination: {{ JSON.stringify(pagination) }}</code>
  </div>

</div>
</ClientOnly>

Each `v-model:<slice>` is a two-way bind — the readout updates the instant you change the state, and a consumer write flows back in. The four slices bound here (`sorting`, `globalFilter`, `rowSelection`, `pagination`) are four of the [nine independent state slices](/components/data-table#models-the-nine-two-way-slices); bind a slice only when you want to own it. The header buttons drive the imperative handle (`toggleAllRows`, `clearSelection`, `clearSorting`) grabbed through Vue's `ref`. The **Status** column shows a per-column `#cell` template; the others render the plain accessor value (the fast path). See the [full API](/components/data-table) for every prop, slice, event, slot, and handle verb, plus the `<Column>` API, theming, and accessibility reference.

## One source, six outputs

You author the component **once** as a `.rozie` file (the parent `DataTable.rozie` plus the declarative `Column.rozie` child):

<<< ../../packages/ui/data-table/src/DataTable.rozie{html}[DataTable.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/data-table-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/data-table/packages/react/src/DataTable.tsx[React]
<<< ../../packages/ui/data-table/packages/vue/src/DataTable.vue[Vue]
<<< ../../packages/ui/data-table/packages/svelte/src/DataTable.svelte[Svelte]
<<< ../../packages/ui/data-table/packages/angular/src/DataTable.ts[Angular]
<<< ../../packages/ui/data-table/packages/solid/src/DataTable.tsx[Solid]
<<< ../../packages/ui/data-table/packages/lit/src/DataTable.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same nine two-way slices, same nine change events, same `<Column>` API, same scoped slots, same imperative handle — all from the one source above, built on `@tanstack/table-core` with no per-framework adapter behind it.

## See also

- [DataTable — showcase & API](/components/data-table) — install, quick start, the `<Column>` API, theming, and the full reference.
- [Data table comparison](/components/data-table-comparison) — how `@rozie-ui/data-table` stacks up against TanStack Table, AG Grid, PrimeVue, Material, and the per-framework grids.

<style scoped>
.dt-live {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.dt-live__head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.dt-live__head button {
  font: inherit;
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.dt-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.dt-live__state {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.dt-live__state code {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
.dt-badge {
  display: inline-block;
  padding: 0.1em 0.5em;
  border-radius: 999px;
  font-size: 0.78em;
  font-weight: 600;
  text-transform: capitalize;
}
.dt-badge--active {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}
.dt-badge--away {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}
</style>
