import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextProvider, createContext } from '@lit/context';

const __rozieCtx_themeL = createContext(Symbol.for("rozie:themeL"));

@customElement('rozie-inline-equiv-host-l')
export default class InlineEquivHostL extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  @property({ type: Number, reflect: true }) base: number = 1;
private __rozieCtxProvider_themeL = new ContextProvider(this, { context: __rozieCtx_themeL, initialValue: {
  v: 1
} });

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
<div class="partial-inline-host" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-6bfa9f0a>
  <span class="echo" data-rozie-s-6bfa9f0a>${rozieDisplay(this.verbL(1))}</span>
  <span class="echo" data-rozie-s-6bfa9f0a>${rozieDisplay(this.verb2L(1))}</span>
</div>
`;
  }

  headL = () => this.base + 1;

  verbL = (n: number): number => this.headL() + n;

  verb2L = (n: number): number => this.verbL(n) + 1;

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
    const __skip = new Set<string>(['base']);
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
