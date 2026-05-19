import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';

@customElement('rozie-modal')
export default class Modal extends SignalWatcher(LitElement) {
  static styles = css`
.modal-backdrop[data-rozie-s-fc45feb2] {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog[data-rozie-s-fc45feb2] {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header[data-rozie-s-fc45feb2], footer[data-rozie-s-fc45feb2] { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header[data-rozie-s-fc45feb2] { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header[data-rozie-s-fc45feb2] h2[data-rozie-s-fc45feb2] { flex: 1; margin: 0; font-size: 1.1rem; }
footer[data-rozie-s-fc45feb2] { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body[data-rozie-s-fc45feb2] { padding: 1rem; overflow: auto; }
.close-btn[data-rozie-s-fc45feb2] { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }
`;

  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) closeOnEscape: boolean = true;
  @property({ type: Boolean, reflect: true }) closeOnBackdrop: boolean = true;
  @property({ type: Boolean, reflect: true }) lockBodyScroll: boolean = true;
  @property({ type: String, reflect: true }) title: string = '';
  @query('[data-rozie-ref="backdropEl"]') private _refBackdropEl!: HTMLElement;
  @query('[data-rozie-ref="dialogEl"]') private _refDialogEl!: HTMLElement;

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @property({ attribute: false }) header?: (scope: { close: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @property({ attribute: false }) __rozieDefaultSlot__?: (scope: { close: unknown }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];
  @property({ attribute: false }) footer?: (scope: { close: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    const _lh0 = (e: KeyboardEvent) => { if (!(this.open && this.closeOnEscape)) return; if (e.key !== 'Escape') return; ((this.close) as (...args: any[]) => any)(e); };
    document.addEventListener('keydown', _lh0, undefined);
    this._disconnectCleanups.push(() => document.removeEventListener('keydown', _lh0, undefined));

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

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="footer"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFooter = this._slotFooterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotFooter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    super.connectedCallback();
    if (this.hasUpdated) this._armListeners();
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((this.unlockScroll));

    this.lockScroll();

    this._refDialogEl?.focus();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'open') this._openControllable.notifyAttributeChange(value !== null);
  }

  render() {
    return html`
${this.open ? html`<div class="modal-backdrop" @click=${(e: MouseEvent) => { if (e.target !== e.currentTarget) return; this.closeOnBackdrop && this.close(); }} data-rozie-ref="backdropEl" data-rozie-s-fc45feb2>
  <div class="modal-dialog" role="dialog" aria-modal="true" aria-label=${this.title || undefined} tabindex="-1" data-rozie-ref="dialogEl" data-rozie-s-fc45feb2>
    ${this.title || this._hasSlotHeader || this.header !== undefined ? html`<header data-rozie-s-fc45feb2>
      ${this.header !== undefined ? this.header({close: this.close}) : html`<slot name="header" @rozie-header-close=${(e: CustomEvent) => ((this.close) as (...args: any[]) => any)(e.detail)}>
        <h2 data-rozie-s-fc45feb2>${this.title}</h2>
      </slot>`}
      <button class="close-btn" aria-label="Close" @click=${this.close} data-rozie-s-fc45feb2>×</button>
    </header>` : nothing}<div class="modal-body" data-rozie-s-fc45feb2>
      ${this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({close: this.close}) : html`<slot @rozie-default-close=${(e: CustomEvent) => ((this.close) as (...args: any[]) => any)(e.detail)}></slot>`}
    </div>

    ${this._hasSlotFooter || this.footer !== undefined ? html`<footer data-rozie-s-fc45feb2>
      ${this.footer !== undefined ? this.footer({close: this.close}) : html`<slot name="footer" @rozie-footer-close=${(e: CustomEvent) => ((this.close) as (...args: any[]) => any)(e.detail)}></slot>`}
    </footer>` : nothing}</div>
</div>` : nothing}`;
  }

  close = () => {
  this.open = false;
  this.dispatchEvent(new CustomEvent("close", {
    detail: undefined,
    bubbles: true,
    composed: true
  }));
};

  savedBodyOverflow = '';

  lockScroll = () => {
  if (!this.lockBodyScroll) return;
  this.savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
};

  unlockScroll = () => {
  if (!this.lockBodyScroll) return;
  document.body.style.overflow = this.savedBodyOverflow;
};

  get open(): boolean { return this._openControllable.read(); }
  set open(v: boolean) { this._openControllable.write(v); }
}

injectGlobalStyles('rozie-modal-global', `
:root {
  --rozie-modal-z: 2000;
}
`);
