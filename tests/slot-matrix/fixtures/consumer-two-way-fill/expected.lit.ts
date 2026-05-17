import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { observeRozieSlotCtx } from '@rozie/runtime-lit';
import './producer.rozie';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
  private _outerOpen = signal(true);
  private _innerVal = signal('hello');

  private _footerCtx?: { close: unknown };

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
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
<rozie-producer .open=${this._outerOpen.value} @open-change=${(e: CustomEvent) => { this._outerOpen.value = e.detail; }}><div slot="footer">
    <rozie-inner .open=${this._outerOpen.value} @open-change=${(e: CustomEvent) => { this._outerOpen.value = e.detail; }}></rozie-inner>
    <button @click=${this._footerCtx?.close}>×</button>
  </div></rozie-producer>
`;
  }
}
