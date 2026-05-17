import { LitElement, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

interface RozieItemSlotCtx {
  value: unknown;
}

@customElement('rozie-scoped-params-fixture')
export default class ScopedParamsFixture extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) label: string = 'item';

  @state() private _hasSlotItem = false;
  @queryAssignedElements({ slot: 'item', flatten: true }) private _slotItemElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="item"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotItem = this._slotItemElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotItem = Array.from(this.children).some((el) => el.getAttribute('slot') === 'item');
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
<div class="scoped-params-fixture">
  <slot name="item" data-rozie-params=${(() => { try { return JSON.stringify({value: this.label}); } catch { return '{}'; } })()}></slot>
</div>
`;
  }
}
