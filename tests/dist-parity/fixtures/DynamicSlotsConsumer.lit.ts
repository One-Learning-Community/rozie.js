import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { adoptConsumerStyles, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
import './DynamicSlots.rozie';

@customElement('rozie-dynamic-slots-consumer')
export default class DynamicSlotsConsumer extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  private _dynamicFillKey = signal('freeform');

  private _rozieLit0 = [{ key: 'status' }, { key: 'score' }];
  private _rozieLit1 = { status: 'Active', score: 42 };

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
<div class="dynamic-slots-consumer" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-e638f506>
  <rozie-dynamic-slots .columns=${this._rozieLit0} .row=${this._rozieLit1} .total=${7} data-rozie-s-e638f506 .headerCell=${(scope: { title: any }) => html`
      <h2 data-rozie-s-e638f506>${rozieDisplay(scope.title)}</h2>
    `} .rozieSlots=${{ 'cell-status': (scope: { row: any; value: any }) => html`
      <span class="status" data-rozie-s-e638f506>${rozieDisplay(scope.value)}</span>
    `, 'cell-score': (scope: { row: any; value: any }) => html`
      <span class="score" data-rozie-s-e638f506>${rozieDisplay(scope.value)}</span>
    `, 'cell-total': (scope: { value: any }) => html`
      <strong data-rozie-s-e638f506>${rozieDisplay(scope.value)}</strong>
    `, [this._dynamicFillKey.value]: (scope: { label: any }) => html`
      <em data-rozie-s-e638f506>${rozieDisplay(scope.label)}</em>
    ` }} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}></rozie-dynamic-slots>
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
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref']);
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
