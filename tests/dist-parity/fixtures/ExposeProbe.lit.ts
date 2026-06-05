import { LitElement, css, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-expose-probe')
export default class ExposeProbe extends SignalWatcher(LitElement) {
  static styles = css`
.expose-probe[data-rozie-s-dd2b93b0] { display: inline-flex; align-items: center; gap: 0.5rem; }
input[data-rozie-s-dd2b93b0] { padding: 0.25rem 0.5rem; }
.echo[data-rozie-s-dd2b93b0] { font-variant-numeric: tabular-nums; color: rgba(0, 0, 0, 0.6); }
`;

  private _value = signal('');
  @query('[data-rozie-ref="field"]') private _refField!: HTMLElement;

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
<div class="expose-probe" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-dd2b93b0>
  <input type="text" placeholder="Type something" .value=${this._value.value} @input=${($event) => this._value.value = ($event.target as HTMLInputElement).value} data-rozie-ref="field" data-rozie-s-dd2b93b0 />
  <span class="echo" data-rozie-s-dd2b93b0>${this._value.value}</span>
</div>
`;
  }

  reset(): void {
    this._value.value = '';
  }

  focus(): void {
    this._refField.focus();
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
