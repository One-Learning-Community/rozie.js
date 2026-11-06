import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieNumberOrStringAttr } from '@rozie/runtime-lit';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_data_table_columns = createContext(Symbol.for("rozie:data-table:columns"));

@customElement('rozie-column')
export default class Column extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
   */
  @property({ type: String, reflect: true }) id: string = '';
  /**
   * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
   * @example
   * <rozie-column field="email" header="Email"></rozie-column>
   */
  @property({ type: String, reflect: true }) field: string = '';
  /**
   * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
   */
  @property({ type: String, reflect: true }) header: string = '';
  /**
   * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
   */
  @property({ type: Boolean, reflect: true }) sortable: boolean = false;
  /**
   * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
   */
  @property({ type: Boolean, reflect: true }) filterable: boolean = false;
  /**
   * Initial pin side: `''` (unpinned) | `'left'` | `'right'`. Applied once as the table's starting `columnPinning` state, so `getIsPinned()` reports it and the column joins the matching sticky rail — which also reorders it, since visible cells are ordered `[left-pinned, center, right-pinned]`. Ignored if the consumer has already pinned something; an interactive unpin is never re-applied.
   */
  @property({ type: String, reflect: true }) pinned: string = '';
  /**
   * Optional fixed/initial column width, applied as the column's starting size — a px number (`120`) or a px string (`'120px'`). Column sizing is numeric px, so other CSS lengths (`'12rem'`, `'20%'`, `'auto'`) have no px value to apply and are ignored; the column keeps the default width. An interactive resize overrides this.
   */
  @property({ converter: { fromAttribute: rozieNumberOrStringAttr } }) width: string | number = '';
  /**
   * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
   */
  @property({ type: Boolean, reflect: true }) expandable: boolean = false;
  /**
   * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
   */
  @property({ type: Boolean, reflect: true }) groupable: boolean = true;
  /**
   * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
   */
  @property({ type: String, attribute: 'aggregation-fn' }) aggregationFn: string | (((...args: any[]) => any) | null) = null;
  /**
   * The table-core filter rule for this column. Either a built-in name string (e.g. `'arrIncludesSome'`, `'equalsString'`) or a custom function `(value, filterValue, row) => boolean`, where `row` is the original data object. Null → table-core's auto rule for the column's value type.
   */
  @property({ type: String, attribute: 'filter-fn' }) filterFn: string | (((...args: any[]) => any) | null) = null;
  /**
   * The table-core sort rule for this column. Either a built-in name string (e.g. `'alphanumeric'`, `'basic'`) or a custom ascending comparator `(a, b, rowA, rowB) => number` over the cell values, with the original data objects as `rowA` / `rowB`. Null → table-core's auto rule for the column's value type.
   */
  @property({ type: String, attribute: 'sorting-fn' }) sortingFn: string | (((...args: any[]) => any) | null) = null;
  /**
   * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
   */
  @property({ type: Boolean, reflect: true }) editable: boolean = false;
  /**
   * Editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'` (built-in inputs), or `'custom'` to hand rendering to the `#editor` scoped slot (or a per-column `editor-<columnId>` fill). Default `'text'`. **`'custom'` is the gate:** a column left on a built-in type ignores any `#editor` fill and renders the built-in input. Requires `editable: true` — and, for any pointer or keyboard edit entry, `interactionMode="grid"` on the table.
   */
  @property({ type: String, reflect: true }) editor: string = 'text';
  /**
   * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
   */
  @property({ type: Array, attribute: 'editor-options' }) editorOptions: any[] = [];
  /**
   * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
   */
  @property({ type: Function }) validate: ((...args: any[]) => any) | null = null;
private __rozieFirstUpdateDone = false;
private __rozieCtxConsumer_data_table_columns = new ContextConsumer(this, { context: __rozieCtx_data_table_columns, subscribe: true });
private get registry() { return this.__rozieCtxConsumer_data_table_columns.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.reg = this.registry;

    this._disconnectCleanups.push((() => {
      if (this.reg) this.reg.unregisterColumn(this.colId());
    }));

    // register this column's spec. On Lit the injected registry may still be undefined
    // here (REQ-30 async context); the $onUpdate below performs the registration once
    // the value arrives.
    if (this.reg && !this.registered) {
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('id') || changedProperties.has('field') || changedProperties.has('header') || changedProperties.has('sortable') || changedProperties.has('filterable') || changedProperties.has('pinned') || changedProperties.has('width') || changedProperties.has('expandable') || changedProperties.has('groupable') || changedProperties.has('aggregationFn') || changedProperties.has('filterFn') || changedProperties.has('sortingFn') || changedProperties.has('editable') || changedProperties.has('editor') || changedProperties.has('editorOptions') || changedProperties.has('validate'))) { const __watchVal = (() => [this.id, this.field, this.header, this.sortable, this.filterable, this.pinned, this.width, this.expandable, this.groupable, this.aggregationFn, this.filterFn, this.sortingFn, this.editable, this.editor, this.editorOptions, this.validate])(); (() => {
      this.latestFilterFn = this.filterFn;
      this.latestSortingFn = this.sortingFn;
      if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
    })(); }
    this.__rozieFirstUpdateDone = true;

    (() => {
      if (this.registered) return;
      const live = this.registry;
      if (live == null) return;
      this.reg = live;
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    })();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`

<div class="rozie-data-table-column" style="display:none" data-rozie-s-289f2d72></div>
`;
  }

  // $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
  // STRICT BUNDLED-LEAF tsc rejects on `.registerColumn(...)` (TS2339). The .rozie-native
  // fix is the null-let → `any` typeNeutralize idiom: alias the injected API through a
  // MODULE-SCOPE `let reg = null` (typeNeutralize types it `any`). Module-scope (not
  // hook-local) so the alias is in scope from the Solid teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure. ZERO emitter
  // change.
  reg: any = null;

  // idempotency flag so a reactive late-context registration (Lit async first paint,
  // REQ-30) and the $onMount registration never double-register the column.
  registered = false;

  // Stable trampolines for custom filterFn/sortingFn. An inline arrow is a new identity every
  // consumer render; registering it directly would defeat the registerColumn equivalence guard
  // (a function compares by source, but table-core would hold a stale closure). The spec holds
  // ONE trampoline per column that always calls the latest function, refreshed in the re-register
  // watch below BEFORE the equivalence check. A mutable top-level `let` (a ref on React).
  // table-core reads `autoRemove` / `resolveFilterValue` OFF the filter function itself, so the
  // filter trampoline carries stable forwarders that read the CURRENT latestFilterFn (absent on
  // the consumer's fn => table-core's own defaults: never auto-remove, value passes through).
  latestFilterFn: any = null;

  latestSortingFn: any = null;

  filterTrampoline: any = Object.assign((...args: any[]) => typeof this.latestFilterFn === 'function' ? this.latestFilterFn(...args) : true, {
  autoRemove: (value: any, column: any) => typeof this.latestFilterFn === 'function' && typeof this.latestFilterFn.autoRemove === 'function' ? this.latestFilterFn.autoRemove(value, column) : false,
  resolveFilterValue: (value: any) => typeof this.latestFilterFn === 'function' && typeof this.latestFilterFn.resolveFilterValue === 'function' ? this.latestFilterFn.resolveFilterValue(value) : value
});

  sortingTrampoline = (...args: any[]) => typeof this.latestSortingFn === 'function' ? this.latestSortingFn(...args) : 0;

  // the column SPEC builder — shared by the $onMount register and the late-context
  // $onUpdate below. Carries METADATA ONLY (no cell/header render callbacks — D-A moved
  // per-cell rendering to the parent's #cell/#header scoped slot, dispatched by columnId).
  colId = () => this.id !== '' ? this.id : this.field;

  buildSpec = () => {
  // Seed the trampolines' targets at first registration (Lit props may not exist earlier).
  this.latestFilterFn = this.filterFn;
  this.latestSortingFn = this.sortingFn;
  return {
    id: this.colId(),
    field: this.field !== '' ? this.field : this.colId(),
    header: this.header,
    sortable: this.sortable,
    filterable: this.filterable,
    pinned: this.pinned,
    width: this.width,
    // Expandable-rows reserved metadata (phase 50, D-04) — carried via the parent registry.
    expandable: this.expandable,
    // Grouping + aggregation metadata (phase 50, reqs 4-7, D-05) — carried via the parent
    // registry; the parent resolves aggregationFn onto the ColumnDef (defensive-wrapping a
    // custom fn) and filters groupableColumns by `groupable`.
    groupable: this.groupable,
    aggregationFn: this.aggregationFn,
    filterFn: typeof this.filterFn === 'function' ? this.filterTrampoline : this.filterFn,
    sortingFn: typeof this.sortingFn === 'function' ? this.sortingTrampoline : this.sortingFn,
    // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
    // registry (the existing per-column metadata path; NO parallel registry).
    editable: this.editable,
    editor: this.editor,
    editorOptions: this.editorOptions,
    validate: this.validate
  };
};
}
