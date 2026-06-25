import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject, input, untracked } from '@angular/core';

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-column',
  standalone: true,
  template: `


    <div class="rozie-data-table-column" style="display:none"></div>

  `,
})
export class Column {
  /**
   * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
   */
  id = input<string>('');
  /**
   * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
   * @example
   * <Column field="email" header="Email" />
   */
  field = input<string>('');
  /**
   * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
   */
  header = input<string>('');
  /**
   * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
   */
  sortable = input<boolean>(false);
  /**
   * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
   */
  filterable = input<boolean>(false);
  /**
   * Pin side: `''` (unpinned) | `'left'` | `'right'`. Reserved metadata carried into the parent's column pinning state.
   */
  pinned = input<string>('');
  /**
   * Optional fixed/initial column width — a CSS length string or a px number.
   */
  width = input<string | number>('');
  /**
   * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
   */
  expandable = input<boolean>(false);
  /**
   * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
   */
  groupable = input<boolean>(true);
  /**
   * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
   */
  aggregationFn = input<(string | ((...args: unknown[]) => unknown)) | null>(null);
  /**
   * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
   */
  editable = input<boolean>(false);
  /**
   * Built-in editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'`. Ignored when a custom `#editor` scoped slot handles the column. Default `'text'`.
   */
  editor = input<string>('text');
  /**
   * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
   */
  editorOptions = input<any[]>((() => [])());
  /**
   * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
   */
  validate = input<((...args: unknown[]) => unknown) | null>(null);
  registry = inject(rozieToken('data-table:columns'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;

  constructor() {
    this.reg = this.registry;

    // idempotency flag so a reactive late-context registration (Lit async first paint,
    // REQ-30) and the $onMount registration never double-register the column.
    effect(() => () => {
      if (this.registered) return;
      const live = this.registry;
      if (live == null) return;
      this.reg = live;
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    });
    effect(() => { const __watchVal = (() => [this.id(), this.field(), this.header(), this.sortable(), this.filterable(), this.pinned(), this.width(), this.expandable(), this.groupable(), this.aggregationFn(), this.editable(), this.editor(), this.editorOptions(), this.validate()])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
    })(); }); });
  }

  ngAfterViewInit() {
    // register this column's spec. On Lit the injected registry may still be undefined
    // here (REQ-30 async context); the $onUpdate below performs the registration once
    // the value arrives.
    if (this.reg && !this.registered) {
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.reg) this.reg.unregisterColumn(this.colId());
    });
  }

  reg: any = null;
  registered = false;
  colId = () => this.id() !== '' ? this.id() : this.field();
  buildSpec = () => ({
    id: this.colId(),
    field: this.field() !== '' ? this.field() : this.colId(),
    header: this.header(),
    sortable: this.sortable(),
    filterable: this.filterable(),
    pinned: this.pinned(),
    width: this.width(),
    // Expandable-rows reserved metadata (phase 50, D-04) — carried via the parent registry.
    expandable: this.expandable(),
    // Grouping + aggregation metadata (phase 50, reqs 4-7, D-05) — carried via the parent
    // registry; the parent resolves aggregationFn onto the ColumnDef (defensive-wrapping a
    // custom fn) and filters groupableColumns by `groupable`.
    groupable: this.groupable(),
    aggregationFn: this.aggregationFn(),
    // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
    // registry (the existing per-column metadata path; NO parallel registry).
    editable: this.editable(),
    editor: this.editor(),
    editorOptions: this.editorOptions(),
    validate: this.validate()
  });
}

export default Column;
