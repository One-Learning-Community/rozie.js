import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-rmodel-lazy')
export default class RModelLazy extends SignalWatcher(LitElement) {
  static styles = css`
.rmodel-lazy[data-rozie-s-34fe9f5a] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo[data-rozie-s-34fe9f5a] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
`;

  private _draft = signal('');

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="rmodel-lazy" ${rozieSpread(this.$attrs)} data-rozie-s-34fe9f5a>
  <input type="text" placeholder="Commit on blur" .value=${this._draft.value} @change=${($event) => this._draft.value = ($event.target as HTMLInputElement).value} data-rozie-s-34fe9f5a />
  <p class="echo" data-rozie-s-34fe9f5a>Committed: ${this._draft.value}</p>
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
