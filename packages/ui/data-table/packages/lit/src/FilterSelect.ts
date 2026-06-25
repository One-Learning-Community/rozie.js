import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-filter-select')
export default class FilterSelect extends SignalWatcher(LitElement) {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
   */
  @property({ type: String, reflect: true }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The current column filter value the select seeds from (String-coerced).
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
   */
  @property({ type: Function }) setFilter: ((...args: unknown[]) => unknown) | null = null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  @property({ type: Array }) uniqueValues: any[] = [];

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
<select class="rdt-col-filter" aria-label=${this.columnId} .value=${this.selectValue()} @change=${($event: Event) => { this.onChange($event); }} data-rozie-s-d75b42b2>
  <option value="" data-rozie-s-d75b42b2>All</option>
  ${repeat<any>(this.uniqueValues, (opt, _idx) => opt, (opt, _idx) => html`<option key=${rozieAttr(opt)} value=${rozieAttr(opt)} data-rozie-s-d75b42b2>${rozieDisplay(opt)}</option>`)}
</select>
`;
  }

  selectValue = () => this.value != null ? String(this.value) : '';

  onChange = (e: any) => {
  const v = e && e.target ? e.target.value : '';
  if (v === '') {
    this.setFilter && this.setFilter(this.columnId, '');
  } else {
    this.setFilter && this.setFilter(this.columnId, v);
  }
};
}
