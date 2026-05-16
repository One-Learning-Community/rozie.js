import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect } from '@lit-labs/preact-signals';
import { attachOutsideClickListener, createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';

interface RozieTriggerSlotCtx {
  open: unknown;
  toggle: unknown;
}

interface RozieDefaultSlotCtx {
  close: unknown;
}

@customElement('rozie-dropdown')
export default class Dropdown extends SignalWatcher(LitElement) {
  static styles = css`
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  position: fixed;
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
`;

  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) closeOnOutsideClick: boolean = true;
  @property({ type: Boolean, reflect: true }) closeOnEscape: boolean = true;
  @query('[data-rozie-ref="triggerEl"]') private _refTriggerEl!: HTMLElement;
  @query('[data-rozie-ref="panelEl"]') private _refPanelEl!: HTMLElement;

  @state() private _hasSlotTrigger = false;
  @queryAssignedElements({ slot: 'trigger', flatten: true }) private _slotTriggerElements!: Element[];
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    const _u0 = attachOutsideClickListener([() => this._refTriggerEl, () => this._refPanelEl], (e) => {  (this.close)(e); }, () => (this.open && this.closeOnOutsideClick));
    this._disconnectCleanups.push(_u0);

    const _lh1 = (e: KeyboardEvent) => { if (!(this.open && this.closeOnEscape)) return; if (e.key !== 'Escape') return; (this.close)(e); };
    document.addEventListener('keydown', _lh1, undefined);
    this._disconnectCleanups.push(() => document.removeEventListener('keydown', _lh1, undefined));

    const _lh2 = (() => { let last = 0; return (e: Event) => { if (!(this.open)) return; const now = Date.now(); if (now - last < 100) return; last = now; (this.reposition)(e); }; })();
    window.addEventListener('resize', _lh2, { passive: true });
    this._disconnectCleanups.push(() => window.removeEventListener('resize', _lh2, undefined));

    this.addEventListener('rozie-trigger-toggle', (e) => { (this.toggle)((e as CustomEvent).detail); });

    this.addEventListener('rozie-default-close', (e) => { (this.close)((e as CustomEvent).detail); });

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="trigger"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotTrigger = this._slotTriggerElements.length > 0; };
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

    this._disconnectCleanups.push(effect(() => { (() => this.open)(); (() => {
      if (this.open) this.reposition();
    })(); }));

    // Initial reposition only if the panel is open at mount time.
    if (this.open) this.reposition();
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
<div class="dropdown">
  <div @click=${this.toggle} data-rozie-ref="triggerEl">
    <slot name="trigger" data-rozie-params=${(() => { try { return JSON.stringify({open: this.open}); } catch { return '{}'; } })()}></slot>
  </div>

  ${this.open ? html`<div class="dropdown-panel" role="menu" data-rozie-ref="panelEl">
    <slot></slot>
  </div>` : nothing}</div>
`;
  }

  toggle = () => {
  this.open = !this.open;
};

  close = () => {
  this.open = false;
};

  reposition = () => {
  if (!this._refPanelEl || !this._refTriggerEl) return;
  const rect = this._refTriggerEl.getBoundingClientRect();
  Object.assign(this._refPanelEl.style, {
    top: `${rect.bottom}px`,
    left: `${rect.left}px`
  });
};

  get open(): boolean { return this._openControllable.read(); }
  set open(v: boolean) { this._openControllable.write(v); }
}

injectGlobalStyles('rozie-dropdown-global', `
:root {
  --rozie-dropdown-z: 1000;
}
`);
