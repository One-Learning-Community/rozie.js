import { Component, ViewEncapsulation, effect, input, signal, untracked } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-filter-number-range',
  standalone: true,
  template: `

    <span style="display:flex; align-items: center">
      <input class="rdt-col-filter" part="col-filter" type="number" [attr.aria-label]="rozieAttr(a11yLabel() + ' min')" [attr.placeholder]="rozieAttr(minPlaceholder())" [value]="minDraftValue()" (input)="onMinInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />
      <span> - </span>
      <input class="rdt-col-filter" part="col-filter" type="number" [attr.aria-label]="rozieAttr(a11yLabel() + ' max')" [attr.placeholder]="rozieAttr(maxPlaceholder())" [value]="maxDraftValue()" (input)="onMaxInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />
    </span>

  `,
  styles: [`
    :host(rozie-filter-number-range) { display: contents; }
  `],
})
export class FilterNumberRange {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  setFilter = input<((...args: any[]) => any) | null>(null);
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  minMax = input<(unknown) | null>(null);
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel = input<string>('');
  minDraft = signal('');
  maxDraft = signal('');
  touched = signal(false);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => Array.isArray(this.value()) ? String(this.value()[0]) + '\u0000' + String(this.value()[1]) : '')(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.touched.set(false);
    })(); }); });
  }

  // ── C-08 + N-04: both drafts are DERIVED from `$props.value`, with a `touched` latch ─────
  //
  // C-08 — this component mounts once per rendered filter row and is NOT remounted when the
  // filter changes, and both drafts were seeded setup-once. A programmatic reset or an external
  // `columnFilters` write moved the real filter while these two inputs went on displaying the
  // old numbers. See FilterText for the full reasoning; `FilterSelect` was never affected
  // because it reads `$props.value` live, which is the pattern adopted here.
  //
  // N-04 — the setup-once seed was ALSO wrong on Angular from the start: the emitter places
  // setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
  // DEFAULT. Measured on the sibling EditorDate.
  //
  // The watch clears `touched` rather than writing the drafts, so the derived readers pick the
  // new value up on their own. It is keyed on the TUPLE ELEMENTS, not the array identity: the
  // funnel writes a fresh `[min, max]` array for every apply, so an identity key would fire on
  // every apply, and a consumer mutating a tuple in place would be missed by it anyway. The key
  // is a joined STRING rather than an array — an array-returning watch getter is compared by
  // identity on Lit, so a fresh array every read means it can never report "unchanged" (measured:
  // the range half of the C-08 case stayed red on lit alone with an array key).
  minDraftValue = () => this.touched() ? this.minDraft() : Array.isArray(this.value()) && this.value()[0] != null ? String(this.value()[0]) : '';
  maxDraftValue = () => this.touched() ? this.maxDraft() : Array.isArray(this.value()) && this.value()[1] != null ? String(this.value()[1]) : '';
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
    this.minDraft.set(e && e.target ? e.target.value : '');
    this.touched.set(true);
  };
  onMaxInput = (e: any) => {
    this.maxDraft.set(e && e.target ? e.target.value : '');
    this.touched.set(true);
  };
  // Commit the range on Enter or blur — the same commit-on-commit contract FilterText
  // uses, NOT per keystroke. Both read the drafts in a tick where nothing has just
  // written them, so every target reads the settled value.
  onKeydown = (e: any) => {
    if (e && e.key === 'Enter') this.applyRange(this.minDraftValue(), this.maxDraftValue());
  };
  onBlur = () => {
    this.applyRange(this.minDraftValue(), this.maxDraftValue());
  };
  // Plain string-coercion functions for the placeholders (NOT $computed — the
  // EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
  minPlaceholder = () => Array.isArray(this.minMax()) && this.minMax()[0] != null ? String(this.minMax()[0]) : '';
  maxPlaceholder = () => Array.isArray(this.minMax()) && this.minMax()[1] != null ? String(this.minMax()[1]) : '';
  // Convert a draft to a Number or undefined (empty string → undefined so a
  // one-sided range works). Both undefined → clear the filter.
  // Takes both drafts as ARGUMENTS — never re-reads $data — so it is correct on all six
  // targets regardless of when in the tick it runs. Callers that have just written a
  // draft pass the value they wrote.
  applyRange = (minDraft: any, maxDraft: any) => {
    const __setFilter = this.setFilter();
    const __columnId = this.columnId();
    const minNum = minDraft === '' ? undefined : Number(minDraft);
    const maxNum = maxDraft === '' ? undefined : Number(maxDraft);
    if (minNum === undefined && maxNum === undefined) {
      __setFilter && __setFilter(__columnId, '');
    } else {
      __setFilter && __setFilter(__columnId, [minNum, maxNum]);
    }
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

export default FilterNumberRange;
