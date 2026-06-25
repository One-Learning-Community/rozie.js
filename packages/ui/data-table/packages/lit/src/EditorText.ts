import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-editor-text')
export default class EditorText extends SignalWatcher(LitElement) {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
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
   * The current cell value the editor seeds its local draft from (setup-once).
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
   */
  @property({ type: Function }) commit: ((...args: unknown[]) => unknown) | null = null;
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  @property({ type: Function }) cancel: ((...args: unknown[]) => unknown) | null = null;
  private _draft = signal('');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    // Seed the draft once at setup from the incoming value (setup-once, NOT in the
    // template). Normalize null/undefined to '' so the input value binds to a string.
    this._draft.value = this.value != null ? String(this.value) : '';

    // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
    // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
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
<input class="rdt-cell-editor" type="text" data-editing-cell="" aria-label=${this.columnId} .value=${this._draft.value} @input=${($event: Event) => { this.onInput($event); }} @keydown=${($event: Event) => { this.onKeydown($event); }} @blur=${($event: Event) => { this.onBlur(); }} data-rozie-s-0d17f43a />
`;
  }

  onInput = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
};

  doCommit = () => {
  this.commit && this.commit(this._draft.value);
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
}
