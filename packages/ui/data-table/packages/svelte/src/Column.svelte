<script lang="ts">
import { getContext, onMount, untrack } from 'svelte';

interface Props {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
  expandable?: boolean;
  editable?: boolean;
  editor?: string;
  editorOptions?: any[];
  validate?: ((...args: any[]) => any) | null;
}

let __defaultEditorOptions = (() => [])();

let {
  id = '',
  field = '',
  header = '',
  sortable = false,
  filterable = false,
  pinned = '',
  width = '',
  expandable = false,
  editable = false,
  editor = 'text',
  editorOptions = __defaultEditorOptions,
  validate = null
}: Props = $props();

const registry = getContext('data-table:columns');

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
const colId = () => id !== '' ? id : field;
const buildSpec = () => ({
  id: colId(),
  field: field !== '' ? field : colId(),
  header: header,
  sortable: sortable,
  filterable: filterable,
  pinned: pinned,
  width: width,
  // Expandable-rows reserved metadata (phase 50, D-04) — carried via the parent registry.
  expandable: expandable,
  // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
  // registry (the existing per-column metadata path; NO parallel registry).
  editable: editable,
  editor: editor,
  editorOptions: editorOptions,
  validate: validate
});

onMount(() => {
  // register this column's spec. On Lit the injected registry may still be undefined
  // here (REQ-30 async context); the $onUpdate below performs the registration once
  // the value arrives.
  if (reg && !registered) {
    registered = true;
    reg.registerColumn(colId(), buildSpec());
  }
  return () => {
    if (reg) reg.unregisterColumn(colId());
  };
});
$effect(() => (() => {
  if (registered) return;
  const live = registry;
  if (live == null) return;
  reg = live;
  registered = true;
  reg.registerColumn(colId(), buildSpec());
})());

let __rozieWatchInitial_0 = true;
$effect(() => { (() => [id, field, header, sortable, filterable, pinned, width, expandable, editable, editor, editorOptions, validate])(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (reg) reg.registerColumn(colId(), buildSpec());
})(); }); });
</script>

<div class="rozie-data-table-column" style="display:none" data-rozie-s-289f2d72></div>
