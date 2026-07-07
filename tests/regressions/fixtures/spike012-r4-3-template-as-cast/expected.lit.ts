import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-template-as-cast')
export default class TemplateAsCast extends SignalWatcher(LitElement) {
  private _q = signal('');
  private _n = signal(0);

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
<div class="r" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-18b4a8ad>
  <input @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this._q.value = ($event.currentTarget as HTMLInputElement).value; }} data-rozie-s-18b4a8ad />
  <span data-rozie-s-18b4a8ad>${rozieDisplay((this._n.value as number).toFixed(0))}</span>
</div>
`;
  }

  noop(): void {}

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
