import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr } from '@rozie/runtime-lit';

@customElement('rozie-filter-number-range')
export default class FilterNumberRange extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  @property({ type: String, reflect: true }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  @property({ type: Function }) setFilter: ((...args: any[]) => any) | null = null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  @property({ type: Object }) minMax: unknown = null;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  @property({ type: String, reflect: true }) columnLabel: string = '';
  private _minDraft = signal('');
  private _maxDraft = signal('');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    // Seed both drafts once at setup from the incoming [min,max] tuple (setup-once).
    this._minDraft.value = Array.isArray(this.value) && this.value[0] != null ? String(this.value[0]) : '';
    this._maxDraft.value = Array.isArray(this.value) && this.value[1] != null ? String(this.value[1]) : '';
  }

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
<span style="display:flex; align-items: center" data-rozie-s-97b2c090>
  <input class="rdt-col-filter" part="col-filter" type="number" aria-label=${rozieAttr(this.a11yLabel() + ' min')} placeholder=${rozieAttr(this.minPlaceholder())} .value=${this._minDraft.value} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onMinInput($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur(); }} data-rozie-s-97b2c090 />
  <span data-rozie-s-97b2c090> - </span>
  <input class="rdt-col-filter" part="col-filter" type="number" aria-label=${rozieAttr(this.a11yLabel() + ' max')} placeholder=${rozieAttr(this.maxPlaceholder())} .value=${this._maxDraft.value} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onMaxInput($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur(); }} data-rozie-s-97b2c090 />
</span>
`;
  }

  // Untyped handler params neutralize to `any` (the global-filter idiom).
  // C-01 — the range used to commit from `@change`, which is NOT the same event across
  // targets for a text/number input: React maps `onChange` onto the native `input`
  // event, so on React it fired on EVERY keystroke, in the same tick as the `@input`
  // handler's `$data` write. `$data` is an async `useState` write there, so the commit
  // re-read the PREVIOUS keystroke's draft and the filter ran one keystroke behind (the
  // first keystroke cleared it). The other five use the real `change` event — blur or
  // Enter — and were already correct.
  //
  // Fixed by committing on the events that mean the same thing everywhere, Enter and
  // blur, which is also the contract FilterText already uses; and by making applyRange
  // take both drafts as arguments so it can never re-read a value written in its own
  // tick. That combination is target-independent rather than a React special case.
  onMinInput = (e: any) => {
  this._minDraft.value = e && e.target ? e.target.value : '';
};

  onMaxInput = (e: any) => {
  this._maxDraft.value = e && e.target ? e.target.value : '';
};

  // Commit the range on Enter or blur — the same commit-on-commit contract FilterText
  // uses, NOT per keystroke. Both read the drafts in a tick where nothing has just
  // written them, so every target reads the settled value.
  onKeydown = (e: any) => {
  if (e && e.key === 'Enter') this.applyRange(this._minDraft.value, this._maxDraft.value);
};

  onBlur = () => {
  this.applyRange(this._minDraft.value, this._maxDraft.value);
};

  // Plain string-coercion functions for the placeholders (NOT $computed — the
  // EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
  minPlaceholder = () => Array.isArray(this.minMax) && this.minMax[0] != null ? String(this.minMax[0]) : '';

  maxPlaceholder = () => Array.isArray(this.minMax) && this.minMax[1] != null ? String(this.minMax[1]) : '';

  // Convert a draft to a Number or undefined (empty string → undefined so a
  // one-sided range works). Both undefined → clear the filter.
  // Takes both drafts as ARGUMENTS — never re-reads $data — so it is correct on all six
  // targets regardless of when in the tick it runs. Callers that have just written a
  // draft pass the value they wrote.
  applyRange = (minDraft: any, maxDraft: any) => {
  const minNum = minDraft === '' ? undefined : Number(minDraft);
  const maxNum = maxDraft === '' ? undefined : Number(maxDraft);
  if (minNum === undefined && maxNum === undefined) {
    this.setFilter && this.setFilter(this.columnId, '');
  } else {
    this.setFilter && this.setFilter(this.columnId, [minNum, maxNum]);
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
