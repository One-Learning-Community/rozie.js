<template>


<div class="rozie-data-table-column" style="display:none"></div>

</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, onUpdated, watch } from 'vue';

const props = withDefaults(
  defineProps<{ id?: string; field?: string; header?: string; sortable?: boolean; filterable?: boolean; pinned?: string; width?: string | number; expandable?: boolean; groupable?: boolean; aggregationFn?: string | ((...args: any[]) => any) | null; editable?: boolean; editor?: string; editorOptions?: any[]; validate?: ((...args: any[]) => any) | null }>(),
  { id: '', field: '', header: '', sortable: false, filterable: false, pinned: '', width: '', expandable: false, groupable: true, aggregationFn: null, editable: false, editor: 'text', editorOptions: () => [], validate: null }
);

const registry = inject('data-table:columns');

// $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
// STRICT BUNDLED-LEAF tsc rejects on `.registerColumn(...)` (TS2339). The .rozie-native
// fix is the null-let → `any` typeNeutralize idiom: alias the injected API through a
// MODULE-SCOPE `let reg = null` (typeNeutralize types it `any`). Module-scope (not
// hook-local) so the alias is in scope from the Solid teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure. ZERO emitter
// change.
let reg: any = null;
reg = registry;

// idempotency flag so a reactive late-context registration (Lit async first paint,
// REQ-30) and the $onMount registration never double-register the column.
// idempotency flag so a reactive late-context registration (Lit async first paint,
// REQ-30) and the $onMount registration never double-register the column.
let registered = false;

// the column SPEC builder — shared by the $onMount register and the late-context
// $onUpdate below. Carries METADATA ONLY (no cell/header render callbacks — D-A moved
// per-cell rendering to the parent's #cell/#header scoped slot, dispatched by columnId).
// the column SPEC builder — shared by the $onMount register and the late-context
// $onUpdate below. Carries METADATA ONLY (no cell/header render callbacks — D-A moved
// per-cell rendering to the parent's #cell/#header scoped slot, dispatched by columnId).
const colId = () => props.id !== '' ? props.id : props.field;
const buildSpec = () => ({
  id: colId(),
  field: props.field !== '' ? props.field : colId(),
  header: props.header,
  sortable: props.sortable,
  filterable: props.filterable,
  pinned: props.pinned,
  width: props.width,
  // Expandable-rows reserved metadata (phase 50, D-04) — carried via the parent registry.
  expandable: props.expandable,
  // Grouping + aggregation metadata (phase 50, reqs 4-7, D-05) — carried via the parent
  // registry; the parent resolves aggregationFn onto the ColumnDef (defensive-wrapping a
  // custom fn) and filters groupableColumns by `groupable`.
  groupable: props.groupable,
  aggregationFn: props.aggregationFn,
  // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
  // registry (the existing per-column metadata path; NO parallel registry).
  editable: props.editable,
  editor: props.editor,
  editorOptions: props.editorOptions,
  validate: props.validate
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // register this column's spec. On Lit the injected registry may still be undefined
  // here (REQ-30 async context); the $onUpdate below performs the registration once
  // the value arrives.
  if (reg && !registered) {
    registered = true;
    reg.registerColumn(colId(), buildSpec());
  }
  _cleanup_0 = () => {
    if (reg) reg.unregisterColumn(colId());
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });
onUpdated(() => {
  if (registered) return;
  const live = registry;
  if (live == null) return;
  reg = live;
  registered = true;
  reg.registerColumn(colId(), buildSpec());
});

watch(() => [props.id, props.field, props.header, props.sortable, props.filterable, props.pinned, props.width, props.expandable, props.groupable, props.aggregationFn, props.editable, props.editor, props.editorOptions, props.validate], () => {
  if (reg) reg.registerColumn(colId(), buildSpec());
});
</script>
