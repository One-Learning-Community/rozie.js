import { LitElement, css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-class-selector-probe')
export default class ClassSelectorProbe extends SignalWatcher(LitElement) {
  static styles = css`
.panel[data-rozie-s-899140be] {
  display: block;
  padding: 0.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}
.grip[data-rozie-s-899140be] {
  cursor: grab;
  user-select: none;
  color: rgba(0, 0, 0, 0.35);
}
`;

  private _ready = signal(false);

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._ready.value = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="panel" data-handle=${".panel"} data-grip=${this.gripSelector} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-899140be>
  <span class="grip" aria-hidden="true" data-rozie-s-899140be>⋮⋮</span>
  ${this._ready.value ? html`<span data-rozie-s-899140be>ready</span>` : nothing}</div>
`;
  }

  gripSelector = ".grip";

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
