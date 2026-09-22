import { Component, DestroyRef, ElementRef, ViewEncapsulation, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

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

@Component({
  selector: 'rozie-editor-date',
  standalone: true,
  template: `

    <input #inputEl class="rdt-cell-editor" type="date" data-editing-cell="" [attr.aria-label]="rozieAttr(a11yLabel())" [value]="draftValue()" (input)="onInput($event)" (change)="onChange($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
  styles: [`
    :host(rozie-editor-date) { display: contents; }
  `],
})
export class EditorDate {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row = input<(unknown) | null>(null);
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  value = input<(unknown) | null>(null);
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
   */
  commit = input<((...args: any[]) => any) | null>(null);
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel = input<((...args: any[]) => any) | null>(null);
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus = input<boolean>(false);
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel = input<string>('');
  draft = signal('');
  touched = signal(false);
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.autofocus())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (v) this.inputEl()?.nativeElement?.focus();
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    if (this.autofocus()) this.inputEl()?.nativeElement?.focus();
  }

  draftValue = () => this.touched() ? this.draft() : toIsoDateString(this.value());
  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
    this.touched.set(true);
  };
  doCommit = () => {
    const __commit = this.commit();
    // commit the ISO date string the native control already produced.
    __commit && __commit(this.draftValue());
  };
  doCancel = () => {
    const __cancel = this.cancel();
    __cancel && __cancel();
  };
  onChange = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
    this.touched.set(true);
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
    const __columnLabel = this.columnLabel();
    if (typeof __columnLabel === 'string' && __columnLabel !== '') return __columnLabel;
    return this.columnId();
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default EditorDate;
