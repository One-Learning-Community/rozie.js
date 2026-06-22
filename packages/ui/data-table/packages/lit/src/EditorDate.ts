import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-editor-date')
export default class EditorDate extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) columnId: string = '';
  @property({ type: Object }) column: unknown = null;
  @property({ type: Object }) row: unknown = null;
  @property({ type: Object }) value: unknown = null;
  @property({ type: Function }) commit: ((...args: unknown[]) => unknown) | null = null;
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
<input class="rdt-cell-editor" type="date" data-editing-cell="" aria-label=${this.columnId} .value=${this._draft.value} @input=${($event: Event) => { this.onInput($event); }} @change=${($event: Event) => { this.onChange($event); }} @keydown=${($event: Event) => { this.onKeydown($event); }} @blur=${($event: Event) => { this.onBlur(); }} data-rozie-s-7abe1a56 />
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
  this.doCommit();
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
