import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr } from '@rozie/runtime-lit';

@customElement('rozie-filter-text')
export default class FilterText extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  @property({ type: String, reflect: true, attribute: 'column-id' }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  @property({ type: Function, attribute: 'set-filter' }) setFilter: ((...args: any[]) => any) | null = null;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  @property({ type: String, reflect: true, attribute: 'column-label' }) columnLabel: string = '';
  private _draft = signal('');
  private _touched = signal(false);
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('value'))) { const __watchVal = (() => this.value)(); (() => {
      this._touched.value = false;
    })(); }
    this.__rozieFirstUpdateDone = true;
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
<input class="rdt-col-filter" part="col-filter" type="text" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur(); }} data-rozie-s-18cbb44e />
`;
  }

  // ── C-08 + N-04: the draft is DERIVED from `$props.value`, with a `touched` latch ────────
  //
  // C-08 — this component mounts once per rendered filter row and is NOT remounted when the
  // filter changes, and its draft was seeded setup-once. So a programmatic reset (a "Clear
  // filters" button, `setFilter(id, '')` from another control, a consumer writing
  // `columnFilters` directly) moved the real filter while this input went on displaying the old
  // text: the UI stated a filter that was no longer applied. `FilterSelect` was never affected —
  // it reads `$props.value` live through `selectValue()`, which is the pattern adopted here.
  //
  // N-04 — the setup-once seed was ALSO wrong on Angular from the start: the emitter places
  // setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
  // DEFAULT, because Angular sets inputs after construction. Measured on the sibling EditorDate,
  // which opened empty on angular for every row while vue and lit seeded correctly. A derived
  // read is correct on all six by construction, with no flash and no per-target branch.
  //
  // `touched` is what stops the live read from overwriting the user mid-type; the watch clears
  // it, so an OUTSIDE change always wins and the input follows it. `@input` never moves
  // `$props.value` (nothing is applied until Enter/blur), so the two can never fight.
  draftValue = () => this._touched.value ? this._draft.value : this.value != null ? String(this.value) : '';

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  onInput = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
  this._touched.value = true;
};

  // setFilter is a Function prop (default null) — guard before calling.
  applyFilter = () => {
  this.setFilter && this.setFilter(this.columnId, this.draftValue());
};

  clearFilter = () => {
  this._draft.value = '';
  this._touched.value = false;
  this.setFilter && this.setFilter(this.columnId, '');
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    this.applyFilter();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    this.clearFilter();
  }
};

  onBlur = () => {
  this.applyFilter();
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
