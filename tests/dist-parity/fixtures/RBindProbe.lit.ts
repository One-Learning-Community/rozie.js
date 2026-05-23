import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-rbind-probe')
export default class RBindProbe extends SignalWatcher(LitElement) {
  static styles = css`
.rbind-probe[data-rozie-s-8e2458d6] {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.a[data-rozie-s-8e2458d6] { color: #1f2937; }
.b[data-rozie-s-8e2458d6] { font-weight: 700; }
`;

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="rbind-probe" data-rozie-s-8e2458d6>
  <span class="${('a')}" ${rozieSpread({ class: 'b', id: 'x' })} data-rozie-s-8e2458d6>canonical</span>
  <span class="${('a')}" ${rozieSpread({ class: 'b', id: 'y' })} data-rozie-s-8e2458d6>reordered</span>
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
}
