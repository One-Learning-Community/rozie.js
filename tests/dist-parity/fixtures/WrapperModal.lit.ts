import { LitElement, css, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty } from '@rozie/runtime-lit';
import './Modal.rozie';

@customElement('rozie-wrapper-modal')
export default class WrapperModal extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  @property({ type: String, reflect: true }) title: string = 'Wrapped';
  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });

  @state() private _hasSlotBrand = false;
  @queryAssignedElements({ slot: 'brand', flatten: true }) private _slotBrandElements!: Element[];
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @state() private _hasSlotActions = false;
  @queryAssignedElements({ slot: 'actions', flatten: true }) private _slotActionsElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="brand"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotBrand = this._slotBrandElements.length > 0; };
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

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="actions"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotActions = this._slotActionsElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotBrand = Array.from(this.children).some((el) => el.getAttribute('slot') === 'brand');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotActions = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'open') this._openControllable.notifyAttributeChange(value !== null);
  }

  render() {
    return html`
<rozie-modal .open=${this.open} @open-change=${($event: CustomEvent) => { this.open = $event.detail; }} .title=${this.title} data-rozie-s-1efe6192><slot name="brand" slot="header">
      <h2 data-rozie-s-1efe6192>${this.title}</h2>
    </slot><slot name="actions" slot="footer"></slot><slot></slot></rozie-modal>
`;
  }

  get open(): boolean { return this._openControllable.read(); }
  set open(v: boolean) { this._openControllable.notifyPropertyWrite(v); }
}
