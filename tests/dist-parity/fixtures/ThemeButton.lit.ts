import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_theme = createContext(Symbol.for("rozie:theme"));

@customElement('rozie-theme-button')
export default class ThemeButton extends SignalWatcher(LitElement) {
  static styles = css`
.theme-button[data-rozie-s-9f40a7ea] {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
`;

private __rozieCtxConsumer_theme = new ContextConsumer(this, { context: __rozieCtx_theme, subscribe: true });
private get theme() { return this.__rozieCtxConsumer_theme.value; }

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
<button class="theme-button" data-theme-button="" type="button" ${rozieSpread(this.$attrs)} @click=${($event: Event) => { this.theme && this.theme.cycle(); }} ${rozieListeners(this.$listeners)} data-rozie-s-9f40a7ea>
  ${rozieDisplay(this.theme && this.theme.color)}
</button>
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
