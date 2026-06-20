import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_data_table_columns = createContext(Symbol.for("rozie:data-table:columns"));

@customElement('rozie-column')
export default class Column extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id: string = '';
  @property({ type: String, reflect: true }) field: string = '';
  @property({ type: String, reflect: true }) header: string = '';
  @property({ type: Boolean, reflect: true }) sortable: boolean = false;
  @property({ type: Boolean, reflect: true }) filterable: boolean = false;
  @property({ type: String, reflect: true }) pinned: string = '';
  @property({ type: String }) width: string | number = '';
  @property({ type: Boolean, reflect: true }) expandable: boolean = false;
  @property({ type: Boolean, reflect: true }) groupable: boolean = true;
  @property({ type: String }) aggregationFn: string | (((...args: unknown[]) => unknown) | null) = null;
  @property({ type: Boolean, reflect: true }) editable: boolean = false;
  @property({ type: String, reflect: true }) editor: string = 'text';
  @property({ type: Array }) editorOptions: any[] = [];
  @property({ type: Function }) validate: ((...args: unknown[]) => unknown) | null = null;
private __rozieFirstUpdateDone = false;
private __rozieCtxConsumer_data_table_columns = new ContextConsumer(this, { context: __rozieCtx_data_table_columns, subscribe: true });
private get registry() { return this.__rozieCtxConsumer_data_table_columns.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.reg = this.registry;

    // idempotency flag so a reactive late-context registration (Lit async first paint,
    // REQ-30) and the $onMount registration never double-register the column.

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
    if (this.__rozieFirstUpdateDone && (changedProperties.has('id') || changedProperties.has('field') || changedProperties.has('header') || changedProperties.has('sortable') || changedProperties.has('filterable') || changedProperties.has('pinned') || changedProperties.has('width') || changedProperties.has('expandable') || changedProperties.has('groupable') || changedProperties.has('aggregationFn') || changedProperties.has('editable') || changedProperties.has('editor') || changedProperties.has('editorOptions') || changedProperties.has('validate'))) { const __watchVal = (() => [this.id, this.field, this.header, this.sortable, this.filterable, this.pinned, this.width, this.expandable, this.groupable, this.aggregationFn, this.editable, this.editor, this.editorOptions, this.validate])(); (() => {
      if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
    })(); }
    this.__rozieFirstUpdateDone = true;

    if (this.registered) return;
    const live = this.registry;
    if (live == null) return;
    this.reg = live;
    this.registered = true;
    this.reg.registerColumn(this.colId(), this.buildSpec());
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

  reg: any = null;

  registered = false;

  colId = () => this.id !== '' ? this.id : this.field;

  buildSpec = () => ({
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
  // Editable-cell config (Phase 51) — carried into ColumnDef.meta via the parent
  // registry (the existing per-column metadata path; NO parallel registry).
  editable: this.editable,
  editor: this.editor,
  editorOptions: this.editorOptions,
  validate: this.validate
});
}
