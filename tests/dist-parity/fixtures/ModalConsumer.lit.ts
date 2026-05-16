import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { observeRozieSlotCtx } from '@rozie/runtime-lit';
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
  private _open = signal(true);
  private _slotName = signal('header');

  private _headerCtx?: { close: unknown };
  private _footerCtx?: { close: unknown };

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    // Phase 07.2: wire ctx capture for scoped slot fill "header".

    (() => {

      const producer = this.shadowRoot?.querySelector('[slot="header"]')?.parentElement;

      const slotEl = producer?.shadowRoot?.querySelector('slot[name="header"]');

      if (slotEl) {

        const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this._headerCtx = c as { close: unknown }; this.requestUpdate(); });

        this._disconnectCleanups.push(unsubscribe);

      }

    })();

    // Phase 07.2: wire ctx capture for scoped slot fill "footer".

    (() => {

      const producer = this.shadowRoot?.querySelector('[slot="footer"]')?.parentElement;

      const slotEl = producer?.shadowRoot?.querySelector('slot[name="footer"]');

      if (slotEl) {

        const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this._footerCtx = c as { close: unknown }; this.requestUpdate(); });

        this._disconnectCleanups.push(unsubscribe);

      }

    })();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this._armListeners();
  }

  firstUpdated(): void {
    this._armListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="modal-consumer">
  <rozie-modal .open=${this._open.value}><div slot="header">
      <h2>${this.title}</h2>
      <button class="close" @click=${this._headerCtx?.close}>×</button>
    </div><div slot="footer">
      <button @click=${this._footerCtx?.close}>Cancel</button>
      <button @click=${(e: Event) => { this.onConfirm(); }}>OK</button>
    </div>
    Are you sure you want to proceed?
    </rozie-modal>

  <rozie-modal .open=${this._open.value}><div slot="${this._slotName.value}">
      <span class="dynamic-fill">Dynamic header via slotName</span>
    </div>
    Dynamic-name demo body
  </rozie-modal>

  <rozie-wrapper-modal .title=${this.title}><h2 slot="title">Re-projected title</h2><button slot="actions">Wrapper action</button>
    Body via wrapper's default slot
    </rozie-wrapper-modal>
</div>
`;
  }

  onConfirm() {
    this._open.value = false;
  }
}
