import { LitElement, html } from 'lit';
import { customElement, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-default-content-fallback-fixture')
export default class DefaultContentFallbackFixture extends SignalWatcher(LitElement) {
  @state() private _hasSlotStatus = false;
  @queryAssignedElements({ slot: 'status', flatten: true }) private _slotStatusElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="status"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotStatus = this._slotStatusElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotStatus = Array.from(this.children).some((el) => el.getAttribute('slot') === 'status');
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
<div class="default-content-fallback-fixture" data-rozie-s-62104151>
  <slot name="status">
    <span class="fallback" data-rozie-s-62104151>No status provided.</span>
  </slot>
</div>
`;
  }
}
