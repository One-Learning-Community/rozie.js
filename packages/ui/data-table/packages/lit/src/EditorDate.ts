import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr } from '@rozie/runtime-lit';
// C-07: the native `<input type="date">` accepts ONLY `YYYY-MM-DD` and renders BLANK for
// anything else, silently. The seed used to be `String($props.value)`, which is not the ISO
// coercion this component's own docs: string promises — so a `Date`, an ISO datetime string,
// an epoch number or a localised string all produced an empty editor. `toIsoDateString`
// (helpers/dateValue.ts) is the real coercion, pure and unit-tested.
import { toIsoDateString } from './helpers/dateValue';

// ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
// A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
// places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
// DEFAULT — Angular sets inputs after construction. Measured directly: this editor opened
// EMPTY on angular for every row, including one whose value was already `YYYY-MM-DD`, while
// vue and lit seeded correctly. That is why the shape of the incoming value (C-07) could not
// be the whole story, and why the existing EditorDate coverage never saw either problem: it
// fills the input before asserting anything.
//
// Reading the prop through a derived function instead is correct on all six by construction,
// with no flash of an empty control on the fine-grained targets and no per-target branch. It
// is the pattern `FilterSelect` in this same package already uses (`selectValue()`), which is
// exactly why FilterSelect was the one drop-in unaffected. `touched` is what keeps the user's
// typing from being overwritten by the live prop read once they have started editing.

@customElement('rozie-editor-date')
export default class EditorDate extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  @property({ type: String, reflect: true, attribute: 'column-id' }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) row: unknown = null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
   */
  @property({ type: Function }) commit: ((...args: any[]) => any) | null = null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  @property({ type: Function }) cancel: ((...args: any[]) => any) | null = null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  @property({ type: String, reflect: true, attribute: 'column-label' }) columnLabel: string = '';
  private _draft = signal('');
  private _touched = signal(false);
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    if (this.autofocus) this._refInputEl?.focus();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('autofocus'))) { const __watchVal = (() => this.autofocus)(); ((v: any) => {
      if (v) this._refInputEl?.focus();
    })(__watchVal); }
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
<input class="rdt-cell-editor" type="date" data-editing-cell="" aria-label=${rozieAttr(this.a11yLabel())} .value=${this.draftValue()} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput($event); }} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onChange($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur(); }} data-rozie-ref="inputEl" data-rozie-s-7abe1a56 />
`;
  }

  draftValue = () => this._touched.value ? this._draft.value : toIsoDateString(this.value);

  onInput = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
  this._touched.value = true;
};

  doCommit = () => {
  // commit the ISO date string the native control already produced.
  this.commit && this.commit(this.draftValue());
};

  doCancel = () => {
  this.cancel && this.cancel();
};

  onChange = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
  this._touched.value = true;
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    this.doCommit();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    this.doCancel();
  }
};

  onBlur = () => {
  this.doCommit();
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
