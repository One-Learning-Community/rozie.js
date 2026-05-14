import { LitElement, html } from 'lit';
import { customElement, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-nested-slots-fixture')
export default class NestedSlotsFixture extends SignalWatcher(LitElement) {
  @state() private _hasSlotWrapper = false;
  @queryAssignedElements({ slot: 'wrapper', flatten: true }) private _slotWrapperElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="wrapper"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotWrapper = this._slotWrapperElements.length > 0; };
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
<div class="nested-slots-fixture">
  <slot name="wrapper">
    <div class="wrapper-fallback">
      <slot name="inner"></slot>
    </div>
  </slot>
</div>
`;
  }
}
