import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-editor-select')
export default class EditorSelect extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
   */
  @property({ type: String, reflect: true, attribute: 'column-id' }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) row: unknown = null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  @property({ type: Function }) commit: ((...args: any[]) => any) | null = null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  @property({ type: Function }) cancel: ((...args: any[]) => any) | null = null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  @property({ type: Array }) options: any[] = [];
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  @property({ type: String, reflect: true, attribute: 'column-label' }) columnLabel: string = '';
  private _draft = signal('');
  private _touched = signal(false);
  @query('[data-rozie-ref="selectEl"]') private _refSelectEl!: HTMLElement;
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    if (this.autofocus) this._refSelectEl?.focus();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('autofocus'))) { const __watchVal = (() => this.autofocus)(); ((v: any) => {
      if (v) this._refSelectEl?.focus();
    })(__watchVal); }
    this.__rozieFirstUpdateDone = true;
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
<select class="rdt-cell-editor" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @change=${($event: Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onChange($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onKeydown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onBlur(); }} data-rozie-ref="selectEl" data-rozie-s-117f1a16>
  ${repeat<any>(this.options, (opt, _idx) => opt.value, (opt, _idx) => html`<option value=${rozieAttr(opt.value)} ?selected=${opt.value === this.draftValue()} data-rozie-s-117f1a16>${rozieDisplay(opt.label)}</option>`)}
</select>
`;
  }

  // Seed the draft once from the incoming value (setup-once). Normalize null/undefined
  // to '' so the <select> binds to a string.
  // ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
  // A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
  // places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
  // DEFAULT — Angular sets inputs after construction. Measured on the sibling EditorDate: it
  // opened EMPTY on angular for every row while vue and lit seeded correctly. Reading the prop
  // through a derived function is correct on all six by construction, with no flash of an empty
  // control on the fine-grained targets and no per-target branch — the pattern `FilterSelect`
  // already uses (`selectValue()`), which is why FilterSelect was the one drop-in unaffected.
  // `touched` keeps the live prop read from overwriting the user once they start typing.
  draftValue = () => this._touched.value ? this._draft.value : this.value != null ? String(this.value) : '';

  // Picking/arrow-cycling an option updates the draft only — no commit.
  onChange = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
  this._touched.value = true;
};

  // commit/cancel are Function props (default null) — guard before calling.
  doCommit = () => {
  this.commit && this.commit(this.draftValue());
};

  doCancel = () => {
  this.cancel && this.cancel();
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    this.doCommit();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    this.doCancel();
  }
};

  onBlur = () => {
  this.doCommit();
};

  // C-11 — the accessible name must be the column's HUMAN header, not its internal id.
  // `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
  // reading an implementation detail aloud. table-core keeps the authored header on
  // `column.columnDef.header`, which is a string for every declarative `<Column header>`;
  // a header rendered by a function has no static text, so fall back to the id rather
  // than invent one.
  a11yLabel = () => {
  if (typeof this.columnLabel === 'string' && this.columnLabel !== '') return this.columnLabel;
  return this.columnId;
};
}
