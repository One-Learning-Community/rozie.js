import { LitElement, css, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import './CardHeader.rozie';

@customElement('rozie-card')
export default class Card extends SignalWatcher(LitElement) {
  static styles = css`
.card[data-rozie-s-a88c221e] { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body[data-rozie-s-a88c221e] { padding: 1rem; }
`;

  @property({ type: String, reflect: true }) title: string = '';
  @property({ type: Function }) onClose: ((...args: unknown[]) => unknown) | null = null;

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
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
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
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
<article class="card" data-rozie-s-a88c221e>
  <rozie-card-header .title=${this.title} .onClose=${this.onClose}></rozie-card-header>
  <div class="card__body" data-rozie-s-a88c221e>
    <slot></slot>
  </div>
</article>
`;
  }
}
