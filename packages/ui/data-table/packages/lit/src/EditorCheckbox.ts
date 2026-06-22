import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-editor-checkbox')
export default class EditorCheckbox extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) columnId: string = '';
  @property({ type: Object }) column: unknown = null;
  @property({ type: Object }) row: unknown = null;
  @property({ type: Object }) value: unknown = null;
  @property({ type: Function }) commit: ((...args: unknown[]) => unknown) | null = null;
  @property({ type: Function }) cancel: ((...args: unknown[]) => unknown) | null = null;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

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
<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" aria-label=${this.columnId} ?checked=${!!this.value} @change=${($event: Event) => { this.onChange($event); }} @keydown=${($event: Event) => { this.onKeydown($event); }} data-rozie-s-3d792482 />
`;
  }

  onChange = (e: any) => {
  this.commit && this.commit(!!(e && e.target ? e.target.checked : false));
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    this.cancel && this.cancel();
  }
};
}
