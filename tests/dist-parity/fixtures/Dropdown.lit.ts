import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { attachOutsideClickListener, createLitControllableProperty, injectGlobalStyles, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

interface RozieTriggerSlotCtx {
  open: unknown;
  toggle: unknown;
}

@customElement('rozie-dropdown')
export default class Dropdown extends SignalWatcher(LitElement) {
  static styles = css`
.dropdown[data-rozie-s-6d6bd882] { position: relative; display: inline-block; }
.dropdown-panel[data-rozie-s-6d6bd882] {
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
private __rozieFirstUpdateDone = false;

  @state() private _hasSlotTrigger = false;
  @queryAssignedElements({ slot: 'trigger', flatten: true }) private _slotTriggerElements!: Element[];
  @property({ attribute: false }) trigger?: (scope: { open: unknown; toggle: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @property({ attribute: false }) __rozieDefaultSlot__?: (scope: { close: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    const _u0 = attachOutsideClickListener([() => this._refTriggerEl, () => this._refPanelEl], ($event) => {  ((this.close) as (...args: any[]) => any)($event); }, () => (this.open && this.closeOnOutsideClick));
    this._disconnectCleanups.push(_u0);

    const _lh1 = ($event: KeyboardEvent) => { if (!(this.open && this.closeOnEscape)) return; if ($event.key !== 'Escape') return; ((this.close) as (...args: any[]) => any)($event); };
    document.addEventListener('keydown', _lh1, undefined);
    this._disconnectCleanups.push(() => document.removeEventListener('keydown', _lh1, undefined));

    const _lh2 = (() => { let last = 0; return ($event: Event) => { if (!(this.open)) return; const now = Date.now(); if (now - last < 100) return; last = now; ((this.reposition) as (...args: any[]) => any)($event); }; })();
    window.addEventListener('resize', _lh2, { passive: true });
    this._disconnectCleanups.push(() => window.removeEventListener('resize', _lh2, undefined));

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
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotTrigger = Array.from(this.children).some((el) => el.getAttribute('slot') === 'trigger');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated) this._armListeners();
  }

  firstUpdated(): void {
    this._armListeners();

    // Initial reposition only if the panel is open at mount time.
    if (this.open) this.reposition();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('open'))) { const __watchVal = (() => this.open)(); (() => {
      if (this.open) this.reposition();
    })(); }
    this.__rozieFirstUpdateDone = true;
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
<div class="dropdown" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-6d6bd882>
  <div @click=${this.toggle} data-rozie-ref="triggerEl" data-rozie-s-6d6bd882>
    ${this.trigger !== undefined ? this.trigger({open: this.open, toggle: this.toggle}) : html`<slot name="trigger" data-rozie-params=${(() => { try { return JSON.stringify({open: this.open}); } catch { return '{}'; } })()} @rozie-trigger-toggle=${($event: CustomEvent) => ((this.toggle) as (...args: any[]) => any)($event.detail)}></slot>`}
  </div>

  ${this.open ? html`<div class="dropdown-panel" role="menu" data-rozie-ref="panelEl" data-rozie-s-6d6bd882>
    ${this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({close: this.close}) : html`<slot @rozie-default-close=${($event: CustomEvent) => ((this.close) as (...args: any[]) => any)($event.detail)}></slot>`}
  </div>` : nothing}</div>
`;
  }

  toggle = () => {
  this._openControllable.write(!this.open);
};

  close = () => {
  this._openControllable.write(false);
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
  set open(v: boolean) { this._openControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['open', 'close-on-outside-click', 'closeonoutsideclick', 'close-on-escape', 'closeonescape']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}

injectGlobalStyles('rozie-dropdown-global', `
:root {
  --rozie-dropdown-z: 1000;
}
`);
