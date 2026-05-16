import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { observeRozieSlotCtx } from '@rozie/runtime-lit';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
  private _headerCtx?: { close: unknown };

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
<rozie-producer><button @click=${this._headerCtx?.close} slot="header">×</button>
  Body text
</rozie-producer>
`;
  }
}
