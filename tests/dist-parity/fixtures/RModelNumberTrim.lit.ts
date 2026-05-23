import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-r-model-number-trim')
export default class RModelNumberTrim extends SignalWatcher(LitElement) {
  static styles = css`
.rmodel-number-trim[data-rozie-s-dfdb7742] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo[data-rozie-s-dfdb7742] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
`;

  private _quantity = signal(0);

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="rmodel-number-trim" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-dfdb7742>
  <input type="text" placeholder="Enter a quantity" .value=${this._quantity.value} @input=${($event) => this._quantity.value = (Number.isNaN(Number.parseFloat(((($event.target as HTMLInputElement).value).trim()))) ? ((($event.target as HTMLInputElement).value).trim()) : Number.parseFloat(((($event.target as HTMLInputElement).value).trim())))} data-rozie-s-dfdb7742 />
  <p class="echo" data-rozie-s-dfdb7742>Quantity: ${this._quantity.value}</p>
</div>
`;
  }

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
