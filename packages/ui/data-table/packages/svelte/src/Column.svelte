<script lang="ts">
import { getContext, onMount, untrack } from 'svelte';

interface Props {
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
   * Pin side: `''` (unpinned) | `'left'` | `'right'`. Reserved metadata carried into the parent's column pinning state.
   */
  pinned?: string;
  /**
   * Optional fixed/initial column width — a CSS length string or a px number.
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
  aggregationFn?: (string | ((...args: any[]) => any)) | null;
  /**
   * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
   */
  editable?: boolean;
  /**
   * Built-in editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'`. Ignored when a custom `#editor` scoped slot handles the column. Default `'text'`.
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
  groupable = true,
  aggregationFn = null,
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
let registered = false;
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
  // Grouping + aggregation metadata (phase 50, reqs 4-7, D-05) — carried via the parent
  // registry; the parent resolves aggregationFn onto the ColumnDef (defensive-wrapping a
  // custom fn) and filters groupableColumns by `groupable`.
  groupable: groupable,
  aggregationFn: aggregationFn,
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
$effect(() => { (() => [id, field, header, sortable, filterable, pinned, width, expandable, groupable, aggregationFn, editable, editor, editorOptions, validate])(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (reg) reg.registerColumn(colId(), buildSpec());
})(); }); });
</script>

<div class="rozie-data-table-column" style="display:none" data-rozie-s-289f2d72></div>
