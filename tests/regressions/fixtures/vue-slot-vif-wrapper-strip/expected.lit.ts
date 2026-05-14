import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-presence-slot-fallback')
export default class PresenceSlotFallback extends SignalWatcher(LitElement) {
  static styles = css`
.panel { border: 1px solid rgba(0, 0, 0, 0.1); }
`;

  @property({ type: String, reflect: true }) title: string = '';

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="header"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHeader = this._slotHeaderElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
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
<section class="panel">
  ${this._hasSlotHeader || this.title ? html`<header>
    
    <slot name="header">${this.title}</slot>
  </header>` : nothing}<div class="body">
    <slot></slot>
  </div>
</section>
`;
  }
}
