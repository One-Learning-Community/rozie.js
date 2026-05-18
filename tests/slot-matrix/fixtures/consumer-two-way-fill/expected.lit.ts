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
  private _slotCtxWired_footer = false;

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    // Phase 07.2: wire ctx capture for scoped slot fill "footer".

    // Phase 07.3.1 Blocker #3 (D-03) — tryWire + microtask retry for producer-upgrade race.

    {

      const tryWire = () => {

        const producer = this.shadowRoot?.querySelector('[slot="footer"]')?.parentElement;

        const slotEl = producer?.shadowRoot?.querySelector('slot[name="footer"]');

        if (slotEl) {

          const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this._footerCtx = c as { close: unknown }; this.requestUpdate(); });

          this._disconnectCleanups.push(unsubscribe);

          this._slotCtxWired_footer = true;

        }

      };

      tryWire();

      queueMicrotask(() => { if (!this._slotCtxWired_footer) tryWire(); });

    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this._armListeners();
  }

  firstUpdated(): void {
    this._armListeners();
  }

  updated(changedProperties: Map<string, unknown>): void {
    // Phase 07.3.1 Blocker #3 (D-03) — re-attempt wiring for "footer" on each update until producer's slot appears.
    if (!this._slotCtxWired_footer) {
      const producer = this.shadowRoot?.querySelector('[slot="footer"]')?.parentElement;
      const slotEl = producer?.shadowRoot?.querySelector('slot[name="footer"]');
      if (slotEl) {
        const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this._footerCtx = c as { close: unknown }; this.requestUpdate(); });
        this._disconnectCleanups.push(unsubscribe);
        this._slotCtxWired_footer = true;
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
    this._slotCtxWired_footer = false;
  }

  render() {
    return html`
<rozie-producer .open=${this._outerOpen.value} @open-change=${(e: CustomEvent) => { this._outerOpen.value = e.detail; }}><rozie-inner .open=${this._outerOpen.value} @open-change=${(e: CustomEvent) => { this._outerOpen.value = e.detail; }} slot="footer"></rozie-inner>
    <button @click=${(e) => (e.currentTarget as EventTarget).dispatchEvent(new CustomEvent('rozie-footer-close', { detail: e, bubbles: true, composed: true }))} slot="footer">×</button></rozie-producer>
`;
  }
}
