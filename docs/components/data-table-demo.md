---
title: DataTable — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import {
  DataTable,
  Column,
  EditorText,
  EditorSelect,
  FilterText,
  FilterSelect,
  FilterNumberRange,
  GroupBar,
  DetailPanel,
} from '@rozie-ui/data-table-vue';
import '@rozie-ui/data-table-vue/themes/base.css';

// Showcase dataset for the batteries-included drop-ins. One TEXT column (name),
// one categorical/SELECT column (role, a small fixed value set), and one NUMERIC
// column (level) — so each of the three filter drop-ins has a natural home.
const TEAM = [
  { id: 1, name: 'Ada Lovelace',      role: 'Engineering', level: 6, location: 'London' },
  { id: 2, name: 'Alan Turing',       role: 'Research',    level: 7, location: 'Bletchley' },
  { id: 3, name: 'Grace Hopper',      role: 'Engineering', level: 7, location: 'Arlington' },
  { id: 4, name: 'Katherine Johnson', role: 'Research',    level: 6, location: 'Hampton' },
  { id: 5, name: 'Margaret Hamilton', role: 'Engineering', level: 5, location: 'Cambridge' },
  { id: 6, name: 'Edsger Dijkstra',   role: 'Research',    level: 6, location: 'Eindhoven' },
  { id: 7, name: 'Barbara Liskov',    role: 'Design',      level: 5, location: 'Cambridge' },
  { id: 8, name: 'Donald Knuth',      role: 'Research',    level: 7, location: 'Stanford' },
  { id: 9, name: 'Radia Perlman',     role: 'Engineering', level: 6, location: 'Seattle' },
  { id: 10, name: 'Frances Allen',    role: 'Design',      level: 4, location: 'Croton' },
];

// EditorSelect options for the categorical `role` column ([{ value, label }]).
const roleOptions = [
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Research',    label: 'Research' },
  { value: 'Design',      label: 'Design' },
];

// Two-way slices the drop-in showcase binds — visible in the readout below.
const grouping = ref([]);
const columnFilters = ref([]);
const expanded = ref({});

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

// A large dataset for the row-windowing demo — 50,000 synthetic rows. With
// `virtual`, only the visible slice renders inside the bounded scroll container.
const BIG_ROWS = Array.from({ length: 50_000 }, (_, i) => ({
  id: i + 1,
  name: `Row ${i + 1}`,
  email: `user${i + 1}@example.com`,
  status: i % 2 ? 'active' : 'away',
}));
</script>

# DataTable — live demo

This is the **real `@rozie-ui/data-table-vue` package** running on this page (VitePress is itself a Vue app). Click a header to sort (shift-click to add a secondary sort), type in the search box to filter, page through the rows, tick the checkboxes to select, drag a column edge to resize, or open the **Columns** menu to hide one — then watch the two-way bound state below update. Everything is driven by the same `DataTable.rozie` source that compiles to all six frameworks, built on `@tanstack/table-core` with **no per-framework adapter** and a tokenised skin that ships inside the component.

## Batteries included — the drop-in components

`DataTable` is **headless by default**: it owns state, filtering, grouping, sorting, and editing logic, but hands you the slots and lets you render the chrome. That's the right default for a design system — but it isn't the fastest way to get a good-looking table on screen. So the package **also ships opt-in, same-package drop-in components** — `FilterText`, `FilterSelect`, `FilterNumberRange`, `GroupBar`, `EditorText`, `EditorSelect`, `DetailPanel` — that fill the headless slots so you get filtering, grouping, inline editing, and detail rows with **zero custom code**. This is the shadcn-style "here's what you get out of the box" moment.

They're **tree-shakeable named exports from the same `@rozie-ui/data-table-vue` package** — not a separate `-defaults` package, not a heavier "batteries" build. Import only the drop-ins you use; the rest never enters your bundle. Each one is presentational only (no engine, no extra deps) and styles itself automatically from the descendant selectors already shipped in `themes/base.css`.

The table below is **one `<DataTable>`** on a small team dataset with every drop-in wired in: a drag-to-group `GroupBar`, per-column filter widgets (text / faceted select / numeric range), expandable detail rows, and custom cell editors.

<ClientOnly>
<div class="dt-live">

  <DataTable
    :data="TEAM"
    groupable
    expandable
    v-model:grouping="grouping"
    v-model:column-filters="columnFilters"
    v-model:expanded="expanded"
    sticky-header
  >
    <Column field="name" header="Name" :sortable="true" :filterable="true" :editable="true" editor="custom" />
    <Column field="role" header="Role" :sortable="true" :filterable="true" :editable="true" editor="custom" />
    <Column field="level" header="Level" :sortable="true" :filterable="true" />
    <Column field="location" header="Location" :sortable="true" />

    <!-- #groupBar → the drag-to-group bar drop-in -->
    <template #groupBar="{ grouping, groupableColumns, applyGrouping, clearGrouping }">
      <GroupBar
        :grouping="grouping"
        :groupableColumns="groupableColumns"
        :applyGrouping="applyGrouping"
        :clearGrouping="clearGrouping"
      />
    </template>

    <!-- One #filter slot, dispatched by columnId to the matching filter drop-in -->
    <template #filter="{ columnId, uniqueValues, minMax, setFilter }">
      <FilterSelect
        v-if="columnId === 'role'"
        :columnId="columnId"
        :setFilter="setFilter"
        :uniqueValues="uniqueValues"
      />
      <FilterNumberRange
        v-else-if="columnId === 'level'"
        :columnId="columnId"
        :setFilter="setFilter"
        :minMax="minMax"
      />
      <FilterText
        v-else
        :columnId="columnId"
        :setFilter="setFilter"
      />
    </template>

    <!-- One #editor slot, dispatched by columnId to the matching editor drop-in -->
    <template #editor="{ columnId, column, row, value, commit, cancel }">
      <EditorSelect
        v-if="columnId === 'role'"
        :columnId="columnId"
        :column="column"
        :row="row"
        :value="value"
        :commit="commit"
        :cancel="cancel"
        :options="roleOptions"
      />
      <EditorText
        v-else
        :columnId="columnId"
        :column="column"
        :row="row"
        :value="value"
        :commit="commit"
        :cancel="cancel"
      />
    </template>

    <!-- #detail → the expandable-row starter panel drop-in -->
    <template #detail="{ row }">
      <DetailPanel :row="row" />
    </template>
  </DataTable>

  <p class="dt-live__hint">
    <strong>Try it:</strong> drag a column chip into the group bar to group rows; use the
    per-column filter widgets in the header (faceted <em>Role</em> select, <em>Level</em> numeric
    range, text search on <em>Name</em>); click a row's ▸ chevron to open its detail panel. To
    edit a cell, <strong>focus a <em>Name</em> or <em>Role</em> cell and press <kbd>Enter</kbd></strong>
    (or <kbd>F2</kbd>) — the custom <code>EditorText</code> / <code>EditorSelect</code> drop-in
    takes over; <kbd>Enter</kbd> commits, <kbd>Esc</kbd> cancels.
  </p>

  <div class="dt-live__state">
    <code>grouping: {{ JSON.stringify(grouping) }}</code>
    <code>columnFilters: {{ JSON.stringify(columnFilters) }}</code>
    <code>expanded: {{ JSON.stringify(expanded) }}</code>
  </div>

</div>
</ClientOnly>

Every widget above is a named export you opt into — bind a slice, drop the component into its slot, done. They're starters, not a wall: fork `DetailPanel` into a bespoke panel, swap `FilterSelect` for your own faceted control, keep the headless built-ins where you want them. See the [API reference](/components/data-table-api) for every slot scope and prop, and the [`<Column>` reference](/components/data-table-columns).

## Headless by default — the raw building blocks

The same package, now with **no drop-ins** — just the headless `<DataTable>` and a single `#cell` slot you render yourself. This is what you reach for when you want full control of the chrome.

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
    <Column field="status" header="Status" :sortable="true" />
    <Column field="score" header="Score" :sortable="true" />

    <!-- One #cell slot on <DataTable>, dispatched by columnId -->
    <template #cell="{ columnId, value }">
      <span v-if="columnId === 'status'" class="dt-badge" :class="'dt-badge--' + value">{{ value }}</span>
      <template v-else>{{ value }}</template>
    </template>
  </DataTable>

  <div class="dt-live__state">
    <code>sorting: {{ JSON.stringify(sorting) }}</code>
    <code>globalFilter: {{ JSON.stringify(globalFilter) }}</code>
    <code>rowSelection: {{ JSON.stringify(rowSelection) }}</code>
    <code>pagination: {{ JSON.stringify(pagination) }}</code>
  </div>

</div>
</ClientOnly>

Each `v-model:<slice>` is a two-way bind — the readout updates the instant you change the state, and a consumer write flows back in. The four slices bound here (`sorting`, `globalFilter`, `rowSelection`, `pagination`) are four of the [twelve independent state slices](/components/data-table-api#models-the-twelve-two-way-slices); bind a slice only when you want to own it. The header buttons drive the imperative handle (`toggleAllRows`, `clearSelection`, `clearSorting`) grabbed through Vue's `ref`. A single `#cell` slot on `<DataTable>`, dispatched by `columnId`, renders the **Status** badge; every other column falls through to the plain accessor value (the fast path). See the [API reference](/components/data-table-api) for every prop, slice, event, slot, and handle verb, plus the [`<Column>` API](/components/data-table-columns), [theming](/components/data-table-theming), and [accessibility](/components/data-table-grid-mode#accessibility) reference.

## Row windowing (virtualization)

The same real `@rozie-ui/data-table-vue` package, now over **50,000 rows** with `virtual` + `maxHeight="400px"`. Only the visible slice renders inside the bounded scroll container — scroll the table below and watch the row count stay tiny while the scrollbar spans the full 50,000-row height. Row windowing is GA on all six targets and [**tested to 100,000 rows**](/components/data-table-comparison#feature-matrix) by a DOM/behavioral VR matrix; the default `virtual="false"` is byte-identical to a non-virtual table.

<ClientOnly>
<div class="dt-live">

  <DataTable :data="BIG_ROWS" virtual max-height="400px">
    <Column field="name" header="Name" />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" />
  </DataTable>

</div>
</ClientOnly>

Set `virtual` to opt in; bound `maxHeight` (or the `--rozie-data-table-max-height` CSS custom property — the prop wins, the token is the fallback) sizes the scroll container, and `estimateRowHeight` seeds the row estimate before `measureElement` refines actual heights. Windowing runs over the full filtered + sorted (pre-pagination) model and suppresses the client pagination chrome. See the [comparison page](/components/data-table-comparison#what-rozie-defers) for the published support boundary (and the orthogonal pieces — column virtualization + dynamic auto-measure — that remain deferred).

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

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same twelve two-way slices, same fourteen change events, same `<Column>` API, same scoped slots, same imperative handle — all from the one source above, built on `@tanstack/table-core` with no per-framework adapter behind it.

## See also

- [DataTable — overview & install](/components/data-table) — the package install table and the section index linking quick start, the `<Column>` API, theming, and the full [API reference](/components/data-table-api).
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
.dt-live__hint {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.dt-live__hint kbd {
  font-size: 0.75rem;
  padding: 0.05em 0.4em;
  border: 1px solid var(--vp-c-divider);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
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
