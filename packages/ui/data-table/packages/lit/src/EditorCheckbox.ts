import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieAttr } from '@rozie/runtime-lit';

@customElement('rozie-editor-checkbox')
export default class EditorCheckbox extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
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
   * The current cell value — coerced to a real boolean via `!!` to seed the checkbox `checked` state.
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the boolean checked state on `@change`. Null-guarded at call sites.
   */
  @property({ type: Function }) commit: ((...args: any[]) => any) | null = null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  @property({ type: Function }) cancel: ((...args: any[]) => any) | null = null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  @property({ type: String, reflect: true, attribute: 'column-label' }) columnLabel: string = '';
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    if (this.autofocus) this._refInputEl?.focus();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('autofocus'))) { const __watchVal = (() => this.autofocus)(); ((v: any) => {
      if (v) this._refInputEl?.focus();
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
<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} ?checked=${!!this.value} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onChange($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} data-rozie-ref="inputEl" data-rozie-s-3d792482 />
`;
  }

  // Immediate-commit-on-change: read .checked the global-filter way, coerce to a
  // real boolean, and commit it directly.
  onChange = (e: any) => {
  this.commit && this.commit(!!(e && e.target ? e.target.checked : false));
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    this.cancel && this.cancel();
  }
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
