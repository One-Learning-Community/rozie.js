import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-dialog')
export default class Dialog extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-dialog[data-rozie-s-2a679072] {
  margin: auto; /* centers in the top layer */
  padding: 0;
  width: var(--rozie-dialog-width, auto);
  max-width: var(--rozie-dialog-max-width, min(32rem, calc(100vw - 2rem)));
  max-height: var(--rozie-dialog-max-height, calc(100vh - 2rem));
  border: var(--rozie-dialog-border, none);
  border-radius: var(--rozie-dialog-radius, 0.75rem);
  background: var(--rozie-dialog-bg, #fff);
  color: var(--rozie-dialog-color, inherit);
  box-shadow: var(--rozie-dialog-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
  overflow: auto;
}
.rozie-dialog[data-rozie-s-2a679072]::backdrop {
  background: var(--rozie-dialog-backdrop-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--rozie-dialog-backdrop-filter, none);
}
.rozie-dialog-panel[data-rozie-s-2a679072] {
  padding: var(--rozie-dialog-padding, 1.5rem);
  font: var(--rozie-dialog-font, inherit);
}
.rozie-dialog[data-rozie-s-2a679072] {
    transition: opacity var(--rozie-dialog-transition, 0.15s ease), transform var(--rozie-dialog-transition, 0.15s ease), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
    opacity: 1;
    transform: translateY(0) scale(1);
  }
.rozie-dialog[data-rozie-s-2a679072]:not([open][data-rozie-s-2a679072]) {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.98);
  }
.rozie-dialog[open][data-rozie-s-2a679072] {
      opacity: 0;
      transform: translateY(0.5rem) scale(0.98);
    }
.rozie-dialog[data-rozie-s-2a679072]::backdrop {
    transition: opacity var(--rozie-dialog-transition, 0.15s ease), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
    opacity: 1;
  }
.rozie-dialog[data-rozie-s-2a679072]:not([open][data-rozie-s-2a679072])::backdrop {
    opacity: 0;
  }
.rozie-dialog[open][data-rozie-s-2a679072]::backdrop {
      opacity: 0;
    }
`;

  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) disableBackdropClose: boolean = false;
  @property({ type: Boolean, reflect: true }) disableEscapeClose: boolean = false;
  @property({ type: Boolean, reflect: true }) disableScrollLock: boolean = false;
  @property({ type: String, reflect: true }) ariaLabel: string = null;
  @property({ type: String, reflect: true }) ariaLabelledby: string = null;
  @query('[data-rozie-ref="panelEl"]') private _refPanelEl!: HTMLElement;
private __rozieWatchInitial_0 = true;

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

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.open)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      this.sync(isOpen);
    })(__watchVal); }); }));

    this.sync(this.open);
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
<dialog class="rozie-dialog" aria-label=${this.ariaLabel} aria-labelledby=${this.ariaLabelledby} ${rozieSpread(this.$attrs)} @cancel=${($event: Event) => { this.onCancel($event); }} @click=${($event: Event) => { this.onClick($event); }} ${rozieListeners(this.$listeners)} data-rozie-s-2a679072>
  
  <div class="rozie-dialog-panel" data-rozie-ref="panelEl" data-rozie-s-2a679072>
    <slot></slot>
  </div>
</dialog>
`;
  }

  applyScrollLock = (lock: any) => {
  if (this.disableScrollLock) return;
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root) root.style.overflow = lock ? 'hidden' : '';
};

  sync = (isOpen: any) => {
  const panel = this._refPanelEl;
  const el = (panel && panel.parentElement) as HTMLDialogElement | null;
  if (!el) return;
  if (isOpen) {
    if (!el.open) el.showModal();
    this.applyScrollLock(true);
  } else {
    if (el.open) el.close();
    this.applyScrollLock(false);
  }
};

  closeWith = (reason: any) => {
  this._openControllable.write(false);
  this.dispatchEvent(new CustomEvent("close", {
    detail: {
      reason
    },
    bubbles: true,
    composed: true
  }));
};

  onCancel = (e: any) => {
  if (e) e.preventDefault();
  if (this.disableEscapeClose) return;
  this.closeWith('escape');
};

  onClick = (e: any) => {
  if (this.disableBackdropClose) return;
  const panel = this._refPanelEl;
  const el = panel && panel.parentElement;
  if (e && el && e.target === el) this.closeWith('backdrop');
};

  show = () => {
  this._openControllable.write(true);
};

  hide = () => {
  this.closeWith('programmatic');
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
    const __skip = new Set<string>(['open', 'disable-backdrop-close', 'disablebackdropclose', 'disable-escape-close', 'disableescapeclose', 'disable-scroll-lock', 'disablescrolllock', 'aria-label', 'arialabel', 'aria-labelledby', 'arialabelledby']);
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
