import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieClass, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-class-norm-shapes')
export default class ClassNormShapes extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) variant: string = 'primary';
  @property({ type: Array }) arr: any[] = [];
  @property({ type: Object }) flags: any = {};
  private _cond = signal(true);

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
  <div ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-8915b51f>
    <span class="static-a static-b ${('lit-a lit-b')}" data-rozie-s-8915b51f>string literal</span>
    <span class="${(this.variant)}" data-rozie-s-8915b51f>string-typed prop</span>
    <span class="${(rozieClass(['arr-a', this.variant]))}" data-rozie-s-8915b51f>array literal</span>
    <span class="${Object.entries({ active: this._cond.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" data-rozie-s-8915b51f>object literal</span>
    <span class="${(rozieClass(this.arr))}" data-rozie-s-8915b51f>array via prop</span>
    <span class="${(rozieClass(this.flags))}" data-rozie-s-8915b51f>object via prop</span>
    <span class="base ${(rozieClass(this.arr))}" data-rozie-s-8915b51f>static + dynamic merge</span>
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
    const __skip = new Set<string>(['variant', 'arr', 'flags']);
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
