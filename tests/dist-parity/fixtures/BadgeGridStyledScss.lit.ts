import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-badge-grid-styled-scss')
export default class BadgeGridStyledScss extends SignalWatcher(LitElement) {
  static styles = css`
.badge[data-rozie-s-44801268] {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  font-weight: 600;
}
.badge-grid[data-rozie-s-44801268] {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.badge[data-rozie-s-44801268] {
  padding: 2px 8px;
}
.badge--neutral[data-rozie-s-44801268] {
  color: #ffffff;
  background: #6b7280;
}
.badge--success[data-rozie-s-44801268] {
  color: #ffffff;
  background: #16a34a;
}
.badge--warning[data-rozie-s-44801268] {
  color: #ffffff;
  background: #d97706;
}
.badge--danger[data-rozie-s-44801268] {
  color: #ffffff;
  background: #dc2626;
}
.badge-grid--gap-1[data-rozie-s-44801268] {
  gap: 4px;
}
.badge-grid--gap-2[data-rozie-s-44801268] {
  gap: 8px;
}
.badge-grid--gap-3[data-rozie-s-44801268] {
  gap: 12px;
}
`;

  @property({ type: Array }) badges: any[] = [];

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="badge-grid" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-44801268>
  ${repeat<any>(this.badges, (badge, _idx) => badge, (badge, _idx) => html`<span class="badge badge--neutral" key=${badge} data-rozie-s-44801268>
    ${badge}
  </span>`)}
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
    const __skip = new Set<string>(['badges']);
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
