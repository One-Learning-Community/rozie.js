import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-editor-date')
export default class EditorDate extends SignalWatcher(LitElement) {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  @property({ type: String, reflect: true }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) row: unknown = null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
   */
  @property({ type: Function }) commit: ((...args: unknown[]) => unknown) | null = null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  @property({ type: Function }) cancel: ((...args: unknown[]) => unknown) | null = null;
  private _draft = signal('');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    // Seed the draft once from the incoming value (setup-once). A native date input
    // only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
    this._draft.value = this.value != null ? String(this.value) : '';
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
<input class="rdt-cell-editor" type="date" data-editing-cell="" aria-label=${this.columnId} .value=${this._draft.value} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput($event); }} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onChange($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur(); }} data-rozie-s-7abe1a56 />
`;
  }

  onInput = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
};

  doCommit = () => {
  // commit the ISO date string the native control already produced.
  this.commit && this.commit(this._draft.value);
};

  doCancel = () => {
  this.cancel && this.cancel();
};

  onChange = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
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
}
