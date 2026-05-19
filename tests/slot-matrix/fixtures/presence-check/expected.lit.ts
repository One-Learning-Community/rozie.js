import { LitElement, html, nothing } from 'lit';
import { customElement, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-presence-check-fixture')
export default class PresenceCheckFixture extends SignalWatcher(LitElement) {
  @state() private _hasSlotAside = false;
  @queryAssignedElements({ slot: 'aside', flatten: true }) private _slotAsideElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="aside"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotAside = this._slotAsideElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotAside = Array.from(this.children).some((el) => el.getAttribute('slot') === 'aside');
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
<div class="presence-check-fixture" data-rozie-s-313bf282>
  ${this._hasSlotAside ? html`<aside data-rozie-s-313bf282>
    <slot name="aside"></slot>
  </aside>` : nothing}</div>
`;
  }
}
