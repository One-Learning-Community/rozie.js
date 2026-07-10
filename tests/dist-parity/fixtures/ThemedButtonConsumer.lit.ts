import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import './ThemedButton.rozie';
import './ThemedButtonManual.rozie';
import './ThemedButtonListenersManual.rozie';
import './ThemedButtonAllManual.rozie';

@customElement('rozie-themed-button-consumer')
export default class ThemedButtonConsumer extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.themed-button-consumer[data-rozie-s-14b8cbaa] {
  display: inline-flex;
  gap: 0.75rem;
  padding: 0.5rem;
}
.extra-variant[data-rozie-s-14b8cbaa] {
  font-weight: 600;
}
`;

  private _onClick = signal(() => {});
  private _onMouseEnter = signal(() => {});

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
<div class="themed-button-consumer" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-14b8cbaa>
  <rozie-themed-button class="extra-variant" id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" style="--btn-bg: #ef4444" .label=${'Auto'} @click=${($event: Event) => ((this._onClick.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} @mouseenter=${($event: Event) => ((this._onMouseEnter.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} data-rozie-s-14b8cbaa></rozie-themed-button>

  <rozie-themed-button-manual class="extra-variant" id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" style="--btn-bg: #10b981" .label=${'Manual'} @click=${($event: Event) => ((this._onClick.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} @mouseenter=${($event: Event) => ((this._onMouseEnter.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} data-rozie-s-14b8cbaa></rozie-themed-button-manual>

  <rozie-themed-button-listeners-manual class="extra-variant" id="listeners-manual-btn" type="button" aria-label="Listeners-manual fallthrough button" data-testid="listeners-manual-themed-button" style="--btn-bg: #f59e0b" .label=${'Listeners Manual'} @click=${($event: Event) => ((this._onClick.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} @mouseenter=${($event: Event) => ((this._onMouseEnter.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} data-rozie-s-14b8cbaa></rozie-themed-button-listeners-manual>

  <rozie-themed-button-all-manual class="extra-variant" id="all-manual-btn" type="button" aria-label="All-manual fallthrough button" data-testid="all-manual-themed-button" style="--btn-bg: #8b5cf6" .label=${'All Manual'} @click=${($event: Event) => ((this._onClick.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} @mouseenter=${($event: Event) => ((this._onMouseEnter.value) as (...args: any[]) => any)($event instanceof CustomEvent ? $event.detail : $event)} data-rozie-s-14b8cbaa></rozie-themed-button-all-manual>
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
