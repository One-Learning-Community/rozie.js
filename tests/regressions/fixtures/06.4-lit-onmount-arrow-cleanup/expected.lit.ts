import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-on-mount-arrow-cleanup')
export default class OnMountArrowCleanup extends SignalWatcher(LitElement) {
  static styles = css`
.ticker[data-rozie-s-722b58d1] { font-variant-numeric: tabular-nums; }
`;

  private _ticks = signal(0);
  private _running = signal(true);

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._disconnectCleanups.push((() => window.removeEventListener('resize', this.onResize)));

    window.addEventListener('resize', this.onResize);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="ticker" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-722b58d1>${this._ticks.value}</div>
`;
  }

  onResize = () => {
  this._ticks.value += 1;
};

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   */
  private get $attrs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) out[a.name] = a.value;
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
