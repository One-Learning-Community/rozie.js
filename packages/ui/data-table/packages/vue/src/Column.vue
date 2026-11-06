<template>


<div class="rozie-data-table-column" style="display:none"></div>

</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { inject, onBeforeUnmount, onMounted, onUpdated, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
     */
    id?: string;
    /**
     * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
     * @example
     * <Column field="email" header="Email" />
     */
    field?: string;
    /**
     * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
     */
    header?: string;
    /**
     * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
     */
    sortable?: boolean;
    /**
     * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
     */
    filterable?: boolean;
    /**
     * Initial pin side: `''` (unpinned) | `'left'` | `'right'`. Applied once as the table's starting `columnPinning` state, so `getIsPinned()` reports it and the column joins the matching sticky rail — which also reorders it, since visible cells are ordered `[left-pinned, center, right-pinned]`. Ignored if the consumer has already pinned something; an interactive unpin is never re-applied.
     */
    pinned?: string;
    /**
     * Optional fixed/initial column width, applied as the column's starting size — a px number (`120`) or a px string (`'120px'`). Column sizing is numeric px, so other CSS lengths (`'12rem'`, `'20%'`, `'auto'`) have no px value to apply and are ignored; the column keeps the default width. An interactive resize overrides this.
     */
    width?: string | number;
    /**
     * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
     */
    expandable?: boolean;
    /**
     * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
     */
    groupable?: boolean;
    /**
     * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
     */
    aggregationFn?: string | ((...args: any[]) => any) | null;
    /**
     * The table-core filter rule for this column. Either a built-in name string (e.g. `'arrIncludesSome'`, `'equalsString'`) or a custom function `(value, filterValue, row) => boolean`, where `row` is the original data object. Null → table-core's auto rule for the column's value type.
     */
    filterFn?: string | ((...args: any[]) => any) | null;
    /**
     * The table-core sort rule for this column. Either a built-in name string (e.g. `'alphanumeric'`, `'basic'`) or a custom ascending comparator `(a, b, rowA, rowB) => number` over the cell values, with the original data objects as `rowA` / `rowB`. Null → table-core's auto rule for the column's value type.
     */
    sortingFn?: string | ((...args: any[]) => any) | null;
    /**
     * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
     */
    editable?: boolean;
    /**
     * Editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'` (built-in inputs), or `'custom'` to hand rendering to the `#editor` scoped slot (or a per-column `editor-<columnId>` fill). Default `'text'`. **`'custom'` is the gate:** a column left on a built-in type ignores any `#editor` fill and renders the built-in input. Requires `editable: true` — and, for any pointer or keyboard edit entry, `interactionMode="grid"` on the table.
     */
    editor?: string;
    /**
     * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
     */
    editorOptions?: any[];
    /**
     * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
     */
    validate?: ((...args: any[]) => any) | null;
  }>(),
  { id: '', field: '', header: '', sortable: false, filterable: false, pinned: '', width: '', expandable: false, groupable: true, aggregationFn: null, filterFn: null, sortingFn: null, editable: false, editor: 'text', editorOptions: () => [], validate: null }
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
let registered = false;
// Stable trampolines for custom filterFn/sortingFn. An inline arrow is a new identity every
// consumer render; registering it directly would defeat the registerColumn equivalence guard
// (a function compares by source, but table-core would hold a stale closure). The spec holds
// ONE trampoline per column that always calls the latest function, refreshed in the re-register
// watch below BEFORE the equivalence check. A mutable top-level `let` (a ref on React).
// table-core reads `autoRemove` / `resolveFilterValue` OFF the filter function itself, so the
// filter trampoline carries stable forwarders that read the CURRENT latestFilterFn (absent on
// the consumer's fn => table-core's own defaults: never auto-remove, value passes through).
let latestFilterFn: any = null;
let latestSortingFn: any = null;
const filterTrampoline: any = Object.assign((...args: any[]) => typeof latestFilterFn === 'function' ? latestFilterFn(...args) : true, {
  autoRemove: (value: any, column: any) => typeof latestFilterFn === 'function' && typeof latestFilterFn.autoRemove === 'function' ? latestFilterFn.autoRemove(value, column) : false,
  resolveFilterValue: (value: any) => typeof latestFilterFn === 'function' && typeof latestFilterFn.resolveFilterValue === 'function' ? latestFilterFn.resolveFilterValue(value) : value
});
const sortingTrampoline = (...args: any[]) => typeof latestSortingFn === 'function' ? latestSortingFn(...args) : 0;
// the column SPEC builder — shared by the $onMount register and the late-context
// $onUpdate below. Carries METADATA ONLY (no cell/header render callbacks — D-A moved
// per-cell rendering to the parent's #cell/#header scoped slot, dispatched by columnId).
const colId = () => props.id !== '' ? props.id : props.field;
const buildSpec = () => {
  // Seed the trampolines' targets at first registration (Lit props may not exist earlier).
  latestFilterFn = props.filterFn;
  latestSortingFn = props.sortingFn;
  return {
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
    filterFn: typeof props.filterFn === 'function' ? filterTrampoline : props.filterFn,
    sortingFn: typeof props.sortingFn === 'function' ? sortingTrampoline : props.sortingFn,
    // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
    // registry (the existing per-column metadata path; NO parallel registry).
    editable: props.editable,
    editor: props.editor,
    editorOptions: props.editorOptions,
    validate: props.validate
  };
};

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

watch(() => [props.id, props.field, props.header, props.sortable, props.filterable, props.pinned, props.width, props.expandable, props.groupable, props.aggregationFn, props.filterFn, props.sortingFn, props.editable, props.editor, props.editorOptions, props.validate], () => {
  latestFilterFn = props.filterFn;
  latestSortingFn = props.sortingFn;
  if (reg) reg.registerColumn(colId(), buildSpec());
}, { flush: 'post' });
</script>
