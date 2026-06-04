import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-prop-default-coercion')
export default class PropDefaultCoercion extends SignalWatcher(LitElement) {
  static styles = css`
.pdc[data-rozie-s-109e595c] {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem;
  font-family: ui-monospace, monospace;
}
.pdc[data-rozie-s-109e595c] pre[data-rozie-s-109e595c] {
  margin: 0;
}
`;

  @property({ type: Object }) a: any = null;
  @property({ type: Number, reflect: true }) b: number = 0;
  @property({ type: String, reflect: true }) c: string = '';
  @property({ type: Boolean, reflect: true }) d: boolean = false;
  @property({ type: Array }) e: any[] = [];
  @property({ type: Object }) f: any = {
  k: 1
};
  private _observed = signal(null);

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._observed.value = {
      a: this.a,
      b: this.b,
      c: this.c,
      d: this.d,
      e: this.e,
      f: this.f
    };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="pdc" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-109e595c>
  <pre data-rozie-pdc-output="" data-rozie-s-109e595c>${rozieDisplay(JSON.stringify(this._observed.value))}</pre>
  
  <span data-rozie-pdc-e-identity="" data-rozie-s-109e595c>${rozieDisplay(this.e === this.e ? 'true' : 'false')}</span>
  <span data-rozie-pdc-f-identity="" data-rozie-s-109e595c>${rozieDisplay(this.f === this.f ? 'true' : 'false')}</span>
</div>
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
    const __skip = new Set<string>(['a', 'b', 'c', 'd', 'e', 'f']);
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
