import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import './Modal.rozie';
import './WrapperModal.rozie';

@customElement('rozie-modal-consumer')
export default class ModalConsumer extends SignalWatcher(LitElement) {
  static styles = css`
.modal-consumer { display: flex; flex-direction: column; gap: 1rem; }
.close { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.dynamic-fill { font-weight: bold; }
`;

  @property({ type: String, reflect: true }) title: string = 'Confirm';
  private _open1 = signal(true);
  private _open2 = signal(true);
  private _open3 = signal(true);
  private _slotName = signal('header');

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="modal-consumer">
  <rozie-modal .open=${this._open1.value} @open-change=${(e: CustomEvent) => { this._open1.value = e.detail; }} .header=${(scope: { close: unknown }) => html`
      <h2>${this.title}</h2>
      <button class="close" @click=${scope.close}>×</button>
    `} .footer=${(scope: { close: unknown }) => html`
      <button @click=${scope.close}>Cancel</button>
      <button @click=${(e: Event) => { this.onConfirm(); }}>OK</button>
    `}>
    Are you sure you want to proceed?
    </rozie-modal>

  <rozie-modal .open=${this._open2.value} @open-change=${(e: CustomEvent) => { this._open2.value = e.detail; }}><div slot="${this._slotName.value}">
      <span class="dynamic-fill">Dynamic header via slotName</span>
    </div>
    Dynamic-name demo body
  </rozie-modal>

  <rozie-wrapper-modal .open=${this._open3.value} @open-change=${(e: CustomEvent) => { this._open3.value = e.detail; }} .title=${this.title}><h2 slot="brand">Re-projected brand</h2><button slot="actions">Wrapper action</button>
    Body via wrapper's default slot
    </rozie-wrapper-modal>
</div>
`;
  }

  onConfirm() {
    this._open1.value = false;
  }
}
