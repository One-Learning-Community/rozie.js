<!--
  Consumer.vue — Layer 2 strict consumer-surface stub (quick task 260623-jwh).

  A real Vue consumer that imports the PUBLIC API of the sampled @rozie-ui Vue
  leaves BY PACKAGE NAME (resolved through each package's `.` exports map → the
  compiled dist/index.d.ts). Each import is used in a typed position so vue-tsc
  actually checks the imported component types instead of tree-shaking them.

  - data-table (MANDATORY): the heaviest leaf; its public surface references
    @tanstack/table-core peer types. If its dist .d.ts is type-broken under a
    strict consumer build, this stub fails vue-tsc (the 49-error regression class).
  - listbox: a pure-Rozie (no-engine) leaf.
  - sortable-list: an engine-wrapper leaf (sortablejs peer).

  This SFC is dropped into a tmpdir alongside the strict tsconfig and typechecked
  with `vue-tsc --noEmit` by vue-consumer-surface.test.ts.
-->
<script setup lang="ts">
import {
  DataTable,
  Column,
  EditorText,
  EditorNumber,
  EditorSelect,
  EditorCheckbox,
  EditorDate,
  FilterText,
  FilterNumberRange,
  FilterSelect,
  GroupBar,
  DetailPanel,
} from '@rozie-ui/data-table-vue';
import { Listbox } from '@rozie-ui/listbox-vue';
import { SortableList } from '@rozie-ui/sortable-list-vue';

// Use each import in a typed position so vue-tsc checks the component types
// rather than eliding the import. `typeof Import` resolves the component's
// declared type from its dist .d.ts; an `any`-typed or type-broken export would
// surface here under noImplicitAny:true.
const dataTable: typeof DataTable = DataTable;
const column: typeof Column = Column;
const editorText: typeof EditorText = EditorText;
const editorNumber: typeof EditorNumber = EditorNumber;
const editorSelect: typeof EditorSelect = EditorSelect;
const editorCheckbox: typeof EditorCheckbox = EditorCheckbox;
const editorDate: typeof EditorDate = EditorDate;
const filterText: typeof FilterText = FilterText;
const filterNumberRange: typeof FilterNumberRange = FilterNumberRange;
const filterSelect: typeof FilterSelect = FilterSelect;
const groupBar: typeof GroupBar = GroupBar;
const detailPanel: typeof DetailPanel = DetailPanel;
const listbox: typeof Listbox = Listbox;
const sortableList: typeof SortableList = SortableList;

// Reference the bindings so they are not reported as unused.
void [
  dataTable,
  column,
  editorText,
  editorNumber,
  editorSelect,
  editorCheckbox,
  editorDate,
  filterText,
  filterNumberRange,
  filterSelect,
  groupBar,
  detailPanel,
  listbox,
  sortableList,
];
</script>

<template>
  <!--
    No render usage here: rendering a component forces every required prop (e.g.
    DataTable's `data`), which is per-leaf and fragile. The `typeof Import`
    typed-position assignments in <script setup> already force vue-tsc to fully
    resolve + typecheck each imported component's type (props interface included)
    from its dist .d.ts — which is exactly the leaf-surface rigor this gate exists
    to enforce. An empty template keeps the SFC valid without inventing prop data.
  -->
  <div />
</template>
