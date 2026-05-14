import { LitElement, html } from 'lit';
import { customElement, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-default-content-fallback-fixture')
export default class DefaultContentFallbackFixture extends SignalWatcher(LitElement) {
  @state() private _hasSlotStatus = false;
  @queryAssignedElements({ slot: 'status', flatten: true }) private _slotStatusElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="default-content-fallback-fixture">
  <slot name="status">
    <span class="fallback">No status provided.</span>
  </slot>
</div>
`;
  }
}
