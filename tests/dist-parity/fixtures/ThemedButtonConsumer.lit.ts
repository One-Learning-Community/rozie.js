import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieSpread } from '@rozie/runtime-lit';
import './ThemedButton.rozie';
import './ThemedButtonManual.rozie';

@customElement('rozie-themed-button-consumer')
export default class ThemedButtonConsumer extends SignalWatcher(LitElement) {
  static styles = css`
.themed-button-consumer[data-rozie-s-14b8cbaa] {
  display: inline-flex;
  gap: 0.75rem;
  padding: 0.5rem;
}
.extra-variant[data-rozie-s-14b8cbaa] {
  font-weight: 600;
}
`;

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="themed-button-consumer" ${rozieSpread(this.$attrs)} data-rozie-s-14b8cbaa>
  <rozie-themed-button class="extra-variant" id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" style="--btn-bg: #ef4444" .label=${'Auto'} data-rozie-s-14b8cbaa></rozie-themed-button>

  <rozie-themed-button-manual class="extra-variant" id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" style="--btn-bg: #10b981" .label=${'Manual'} data-rozie-s-14b8cbaa></rozie-themed-button-manual>
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
