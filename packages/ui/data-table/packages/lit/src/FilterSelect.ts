import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-filter-select')
export default class FilterSelect extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

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
  @property({ type: Function }) setFilter: ((...args: any[]) => any) | null = null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  @property({ type: Array }) uniqueValues: any[] = [];
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  @property({ type: String, reflect: true }) columnLabel: string = '';

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
<select class="rdt-col-filter" part="col-filter" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.selectValue()} @change=${($event: Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement }) => { this.onChange($event); }} data-rozie-s-d75b42b2>
  <option value="" data-rozie-s-d75b42b2>All</option>
  ${repeat<any>(this.uniqueValues, (opt, _idx) => opt, (opt, _idx) => html`<option value=${rozieAttr(opt)} ?selected=${opt === this.selectValue()} data-rozie-s-d75b42b2>${rozieDisplay(opt)}</option>`)}
</select>
`;
  }

  // The <select> value binding coerced to a string. $props.value is typed `unknown`
  // (opaque slot-scope), which the strict bundled-leaf tsc rejects against the native
  // select `value` type on React/Solid — the fix is a plain function returning a
  // string (uniform ×6, NOT a $computed; the EditorSelect/listbox value lesson).
  selectValue = () => this.value != null ? String(this.value) : '';

  // Immediate-apply-on-change: read the selected value the global-filter way. An
  // empty value (the leading "All" option) clears the column filter.
  onChange = (e: any) => {
  const v = e && e.target ? e.target.value : '';
  if (v === '') {
    this.setFilter && this.setFilter(this.columnId, '');
  } else {
    this.setFilter && this.setFilter(this.columnId, v);
  }
};

  // C-11 — the accessible name must be the column's HUMAN header, not its internal id.
  // `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
  // reading an implementation detail aloud. table-core keeps the authored header on
  // `column.columnDef.header`, which is a string for every declarative `<Column header>`;
  // a header rendered by a function has no static text, so fall back to the id rather
  // than invent one.
  a11yLabel = () => {
  if (typeof this.columnLabel === 'string' && this.columnLabel !== '') return this.columnLabel;
  return this.columnId;
};
}
