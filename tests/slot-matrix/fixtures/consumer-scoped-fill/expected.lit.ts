import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { observeRozieSlotCtx } from '@rozie/runtime-lit';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
  private _headerCtx?: { close: unknown };
  private _slotCtxWired_header = false;

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    // Phase 07.2: wire ctx capture for scoped slot fill "header".

    // Phase 07.3.1 Blocker #3 (D-03) — tryWire + microtask retry for producer-upgrade race.

    {

      const tryWire = () => {

        const producer = this.shadowRoot?.querySelector('[slot="header"]')?.parentElement;

        const slotEl = producer?.shadowRoot?.querySelector('slot[name="header"]');

        if (slotEl) {

          const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this._headerCtx = c as { close: unknown }; this.requestUpdate(); });

          this._disconnectCleanups.push(unsubscribe);

          this._slotCtxWired_header = true;

        }

      };

      tryWire();

      queueMicrotask(() => { if (!this._slotCtxWired_header) tryWire(); });

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
    // Phase 07.3.1 Blocker #3 (D-03) — re-attempt wiring for "header" on each update until producer's slot appears.
    if (!this._slotCtxWired_header) {
      const producer = this.shadowRoot?.querySelector('[slot="header"]')?.parentElement;
      const slotEl = producer?.shadowRoot?.querySelector('slot[name="header"]');
      if (slotEl) {
        const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this._headerCtx = c as { close: unknown }; this.requestUpdate(); });
        this._disconnectCleanups.push(unsubscribe);
        this._slotCtxWired_header = true;
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
    this._slotCtxWired_header = false;
  }

  render() {
    return html`
<rozie-producer><button @click=${(e) => (e.currentTarget as EventTarget).dispatchEvent(new CustomEvent('rozie-header-close', { detail: e, bubbles: true, composed: true }))} slot="header">×</button>
  Body text
</rozie-producer>
`;
  }
}
