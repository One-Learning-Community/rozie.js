import { Component, ViewEncapsulation, effect, input, signal, untracked } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-filter-text',
  standalone: true,
  template: `

    <input class="rdt-col-filter" part="col-filter" type="text" [attr.aria-label]="rozieAttr(a11yLabel())" [value]="draftValue()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
  styles: [`
    :host(rozie-filter-text) { display: contents; }
  `],
})
export class FilterText {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  setFilter = input<((...args: any[]) => any) | null>(null);
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel = input<string>('');
  draft = signal('');
  touched = signal(false);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.value())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.touched.set(false);
    })(); }); });
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
  draftValue = () => this.touched() ? this.draft() : this.value() != null ? String(this.value()) : '';
  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
    this.touched.set(true);
  };
  // setFilter is a Function prop (default null) — guard before calling.
  applyFilter = () => {
    const __setFilter = this.setFilter();
    __setFilter && __setFilter(this.columnId(), this.draftValue());
  };
  clearFilter = () => {
    const __setFilter = this.setFilter();
    this.draft.set('');
    this.touched.set(false);
    __setFilter && __setFilter(this.columnId(), '');
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
    const __columnLabel = this.columnLabel();
    if (typeof __columnLabel === 'string' && __columnLabel !== '') return __columnLabel;
    return this.columnId();
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default FilterText;
