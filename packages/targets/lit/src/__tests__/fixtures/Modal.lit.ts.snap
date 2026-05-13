import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';
import './Counter.rozie';

interface RozieHeaderSlotCtx {
  close: unknown;
}

interface RozieDefaultSlotCtx {
  close: unknown;
}

interface RozieFooterSlotCtx {
  close: unknown;
}

@customElement('rozie-modal')
export default class Modal extends SignalWatcher(LitElement) {
  static styles = css`
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body { padding: 1rem; overflow: auto; }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }
`;

  @property({ type: Boolean, reflect: true, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) closeOnEscape: boolean = true;
  @property({ type: Boolean, reflect: true }) closeOnBackdrop: boolean = true;
  @property({ type: Boolean, reflect: true }) lockBodyScroll: boolean = true;
  @property({ type: String, reflect: true }) title: string = '';
  @query('[data-rozie-ref="backdropEl"]') private _refBackdropEl!: HTMLElement;
  @query('[data-rozie-ref="dialogEl"]') private _refDialogEl!: HTMLElement;

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    const _h0 = (e: Event) => { if (!(this.open && this.closeOnEscape)) return; if ((e as KeyboardEvent).key !== 'Escape') return; (this.close)(e); };
    document.addEventListener('keydown', _h0, undefined);
    this._disconnectCleanups.push(() => document.removeEventListener('keydown', _h0, undefined));

    this.addEventListener('rozie-header-close', (e) => { (this.close)((e as CustomEvent).detail); });

    this.addEventListener('rozie-default-close', (e) => { (this.close)((e as CustomEvent).detail); });

    this.addEventListener('rozie-footer-close', (e) => { (this.close)((e as CustomEvent).detail); });

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="header"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHeader = this._slotHeaderElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="footer"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFooter = this._slotFooterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        update();
      }
    }

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
${this.open ? html`<div class="modal-backdrop" @click=${(e: Event) => { if (e.target !== e.currentTarget) return; this.closeOnBackdrop && this.close(); }} data-rozie-ref="backdropEl">
  <div class="modal-dialog" role="dialog" aria-modal="true" aria-label=${this.title || undefined} tabindex="-1" data-rozie-ref="dialogEl">
    ${this.title || this._hasSlotHeader ? html`<header>
      <slot name="header">
        <h2>${this.title}</h2>
      </slot>
      <button class="close-btn" aria-label="Close" @click=${this.close}>×</button>
    </header>` : nothing}<div class="modal-body">
      <slot></slot>
      <rozie-counter></rozie-counter>
    </div>

    ${this._hasSlotFooter ? html`<footer>
      <slot name="footer"></slot>
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
