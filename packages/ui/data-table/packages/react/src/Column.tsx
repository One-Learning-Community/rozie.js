import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface ColumnProps {
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
  aggregationFn?: (string | ((...args: any[]) => any)) | null;
  /**
   * The table-core filter rule for this column. Either a built-in name string (e.g. `'arrIncludesSome'`, `'equalsString'`) or a custom function `(value, filterValue) => boolean`. Null → table-core's auto rule for the column's value type.
   */
  filterFn?: (string | ((...args: any[]) => any)) | null;
  /**
   * The table-core sort rule for this column. Either a built-in name string (e.g. `'alphanumeric'`, `'basic'`) or a custom comparator `(a, b) => number`. Null → table-core's auto rule for the column's value type.
   */
  sortingFn?: (string | ((...args: any[]) => any)) | null;
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
}

export default function Column(_props: ColumnProps): JSX.Element {
  const registry = useContext(rozieContext("data-table:columns"));
  const __defaultEditorOptions = useState(() => (() => [])())[0];
  const props: Omit<ColumnProps, 'id' | 'field' | 'header' | 'sortable' | 'filterable' | 'pinned' | 'width' | 'expandable' | 'groupable' | 'aggregationFn' | 'filterFn' | 'sortingFn' | 'editable' | 'editor' | 'editorOptions' | 'validate'> & { id: string; field: string; header: string; sortable: boolean; filterable: boolean; pinned: string; width: string | number; expandable: boolean; groupable: boolean; aggregationFn: (string | ((...args: any[]) => any)) | null; filterFn: (string | ((...args: any[]) => any)) | null; sortingFn: (string | ((...args: any[]) => any)) | null; editable: boolean; editor: string; editorOptions: any[]; validate: ((...args: any[]) => any) | null } = {
    ..._props,
    id: _props.id ?? '',
    field: _props.field ?? '',
    header: _props.header ?? '',
    sortable: _props.sortable ?? false,
    filterable: _props.filterable ?? false,
    pinned: _props.pinned ?? '',
    width: _props.width ?? '',
    expandable: _props.expandable ?? false,
    groupable: _props.groupable ?? true,
    aggregationFn: _props.aggregationFn ?? null,
    filterFn: _props.filterFn ?? null,
    sortingFn: _props.sortingFn ?? null,
    editable: _props.editable ?? false,
    editor: _props.editor ?? 'text',
    editorOptions: _props.editorOptions ?? __defaultEditorOptions,
    validate: _props.validate ?? null,
  };
  const reg = useRef<any>(null);
  const registered = useRef(false);
  const latestFilterFn = useRef<any>(null);
  const latestSortingFn = useRef<any>(null);
  const _watch0First = useRef(true);

  reg.current = registry;

  // idempotency flag so a reactive late-context registration (Lit async first paint,
  // REQ-30) and the $onMount registration never double-register the column.

  // Stable trampolines for custom filterFn/sortingFn. An inline arrow is a new identity every
  // consumer render; registering it directly would defeat the registerColumn equivalence guard
  // (a function compares by source, but table-core would hold a stale closure). The spec holds
  // ONE trampoline per column that always calls the latest function, refreshed in the re-register
  // watch below BEFORE the equivalence check. A mutable top-level `let` (a ref on React).
  // table-core reads `autoRemove` / `resolveFilterValue` OFF the filter function itself, so the
  // filter trampoline carries stable forwarders that read the CURRENT latestFilterFn (absent on
  // the consumer's fn => table-core's own defaults: never auto-remove, value passes through).
  const filterTrampoline = useMemo(() => Object.assign((...args: any[]) => typeof latestFilterFn.current === 'function' ? latestFilterFn.current(...args) : true, {
    autoRemove: (value: any, column: any) => typeof latestFilterFn.current === 'function' && typeof latestFilterFn.current.autoRemove === 'function' ? latestFilterFn.current.autoRemove(value, column) : false,
    resolveFilterValue: (value: any) => typeof latestFilterFn.current === 'function' && typeof latestFilterFn.current.resolveFilterValue === 'function' ? latestFilterFn.current.resolveFilterValue(value) : value
  }), []);
  function sortingTrampoline(...args: any[]) {
    return typeof latestSortingFn.current === 'function' ? latestSortingFn.current(...args) : 0;
  }

  // the column SPEC builder — shared by the $onMount register and the late-context
  // $onUpdate below. Carries METADATA ONLY (no cell/header render callbacks — D-A moved
  // per-cell rendering to the parent's #cell/#header scoped slot, dispatched by columnId).
  const colId = useCallback(() => props.id !== '' ? props.id : props.field, [props.field, props.id]);
  const buildSpec = useCallback(() => {
    // Seed the trampolines' targets at first registration (Lit props may not exist earlier).
    latestFilterFn.current = props.filterFn;
    latestSortingFn.current = props.sortingFn;
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
  }, [colId, props.aggregationFn, props.editable, props.editor, props.editorOptions, props.expandable, props.field, props.filterFn, props.filterable, props.groupable, props.header, props.pinned, props.sortable, props.sortingFn, props.validate, props.width, sortingTrampoline]);

  const _buildSpecRef = useRef(buildSpec);
  _buildSpecRef.current = buildSpec;
  const _colIdRef = useRef(colId);
  _colIdRef.current = colId;
  useEffect(() => {
    // register this column's spec. On Lit the injected registry may still be undefined
    // here (REQ-30 async context); the $onUpdate below performs the registration once
    // the value arrives.
    if (reg.current && !registered.current) {
      registered.current = true;
      reg.current.registerColumn(_colIdRef.current(), _buildSpecRef.current());
    }
    return () => {
      if (reg.current) reg.current.unregisterColumn(_colIdRef.current());
    };
  }, []);
  useEffect(() => {
    if (registered.current) return;
    const live = registry;
    if (live == null) return;
    reg.current = live;
    registered.current = true;
    reg.current.registerColumn(colId(), buildSpec());
  }, [buildSpec, colId, reg, registered, registry]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    latestFilterFn.current = props.filterFn;
    latestSortingFn.current = props.sortingFn;
    if (reg.current) reg.current.registerColumn(colId(), buildSpec());
  }, [props.aggregationFn, props.editable, props.editor, props.editorOptions, props.expandable, props.field, props.filterFn, props.filterable, props.groupable, props.header, props.id, props.pinned, props.sortable, props.sortingFn, props.validate, props.width]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>

    <div className={"rozie-data-table-column"} style={{ display: "none" }} data-rozie-s-289f2d72="" />
    </>
  );
}
