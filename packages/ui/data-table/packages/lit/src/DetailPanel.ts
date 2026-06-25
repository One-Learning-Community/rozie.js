import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-detail-panel')
export default class DetailPanel extends SignalWatcher(LitElement) {
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  @property({ type: Object }) row: unknown = null;

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
<dl class="rdt-detail-panel" data-rozie-s-8f65bdaa>
  
  ${repeat<any>(this.entries(), (pair, _idx) => pair.key, (pair, _idx) => html`<div class="rdt-detail-entry" key=${rozieAttr(pair.key)} data-rozie-s-8f65bdaa>
    <dt class="rdt-detail-key" data-rozie-s-8f65bdaa>${rozieDisplay(pair.key)}</dt>
    <dd class="rdt-detail-value" data-rozie-s-8f65bdaa>${rozieDisplay(pair.value)}</dd>
  </div>`)}
</dl>
`;
  }

  entries = () => {
  const r = this.row;
  if (!r) return [];
  return Object.keys(r).map((key: any) => ({
    key,
    value: r[key] == null ? '' : String(r[key])
  }));
};
}
