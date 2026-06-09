import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieAttr, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_tabs = createContext(Symbol.for("rozie:tabs"));

@customElement('rozie-tab')
export default class Tab extends SignalWatcher(LitElement) {
  static styles = css`
.tab[data-rozie-s-18645a16] {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.tab.is-active[data-rozie-s-18645a16] {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
`;

  @property({ type: String, reflect: true }) label: string = '';
  @property({ type: Number, reflect: true }) index: number = 0;
private __rozieCtxConsumer_tabs = new ContextConsumer(this, { context: __rozieCtx_tabs, subscribe: true });
private get tabs() { return this.__rozieCtxConsumer_tabs.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

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
<button class="${Object.entries({ "tab": true, 'is-active': this.tabs && this.tabs.active === this.index }).filter(([, v]) => v).map(([k]) => k).join(' ')}" data-tab="" type="button" role="tab" data-active=${rozieAttr(this.tabs && this.tabs.active === this.index)} ${rozieSpread(this.$attrs)} @click=${($event: Event) => { this.tabs && this.tabs.setActive(this.index); }} ${rozieListeners(this.$listeners)} data-rozie-s-18645a16>
  ${this.label}
</button>
`;
  }

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
    const __skip = new Set<string>(['label', 'index']);
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
