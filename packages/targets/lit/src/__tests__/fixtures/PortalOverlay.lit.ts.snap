import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { RoziePortalController, injectGlobalStyles } from '@rozie/runtime-lit';

@customElement('rozie-portal-overlay')
export default class PortalOverlay extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-portal-overlay-backdrop[data-rozie-s-56b9c1c8] {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--rozie-portal-overlay-z, 3000);
}
.rozie-portal-overlay-box[data-rozie-s-56b9c1c8] {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 16rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
`;

  @property({ type: Boolean, reflect: true }) open: boolean = false;
  @property({ type: Boolean }) to: boolean | string = false;

  @query('[data-rozie-ref="__roziePortal0"]', true) private __roziePortal0!: HTMLElement;
  private __roziePortal0Controller = new RoziePortalController(this, () => this.__roziePortal0, () => (this.resolveTo(this.to)));

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

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

  render() {
    return html`
${this.open ? html`<div class="rozie-portal-overlay-backdrop" data-rozie-ref="__roziePortal0" data-rozie-s-56b9c1c8>
  <div class="rozie-portal-overlay-box" data-rozie-s-56b9c1c8>
    <slot>Portalled content</slot>
  </div>
</div>` : nothing}`;
  }

  resolveTo(to: any) {
    if (!to) return null;
    if (typeof document === 'undefined') return null;
    if (to === true || to === 'body') return document.body;
    return document.querySelector(to);
  }
}

injectGlobalStyles('rozie-portal-overlay-global', `
:root {
  --rozie-portal-overlay-z: 3000;
}
.rozie-portal-overlay-backdrop[data-rozie-s-56b9c1c8] {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--rozie-portal-overlay-z, 3000);
}
.rozie-portal-overlay-box[data-rozie-s-56b9c1c8] {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 16rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
`);
