import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface ColumnProps {
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
  validate?: ((...args: unknown[]) => unknown) | null;
}

export default function Column(_props: ColumnProps): JSX.Element {
  const _merged = mergeProps({ id: '', field: '', header: '', sortable: false, filterable: false, pinned: '', width: '', expandable: false, editable: false, editor: 'text', editorOptions: (() => [])(), validate: null }, _props);
  const [local, attrs] = splitProps(_merged, ['id', 'field', 'header', 'sortable', 'filterable', 'pinned', 'width', 'expandable', 'editable', 'editor', 'editorOptions', 'validate']);

  const registry = useContext(rozieContext("data-table:columns"));
  onMount(() => {
    const _cleanup = (() => {
    // register this column's spec. On Lit the injected registry may still be undefined
    // here (REQ-30 async context); the $onUpdate below performs the registration once
    // the value arrives.
    if (reg && !registered) {
      registered = true;
      reg.registerColumn(colId(), buildSpec());
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (reg) reg.unregisterColumn(colId());
  });
  });
  createEffect(() => {
    if (registered) return;
    const live = registry;
    if (live == null) return;
    reg = live;
    registered = true;
    reg.registerColumn(colId(), buildSpec());
  });
  createEffect(on(() => (() => [local.id, local.field, local.header, local.sortable, local.filterable, local.pinned, local.width, local.expandable, local.editable, local.editor, local.editorOptions, local.validate])(), (v) => untrack(() => (() => {
    if (reg) reg.registerColumn(colId(), buildSpec());
  })()), { defer: true }));

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
  function colId() {
    return local.id !== '' ? local.id : local.field;
  }
  function buildSpec() {
    return {
      id: colId(),
      field: local.field !== '' ? local.field : colId(),
      header: local.header,
      sortable: local.sortable,
      filterable: local.filterable,
      pinned: local.pinned,
      width: local.width,
      // Expandable-rows reserved metadata (phase 50, D-04) — carried via the parent registry.
      expandable: local.expandable,
      // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
      // registry (the existing per-column metadata path; NO parallel registry).
      editable: local.editable,
      editor: local.editor,
      editorOptions: local.editorOptions,
      validate: local.validate
    };
  }

  return (
    <>

    <div class={"rozie-data-table-column"} style={{ display: "none" }} data-rozie-s-289f2d72="" />
    </>
  );
}
