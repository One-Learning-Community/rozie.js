import { Component, DestroyRef, ElementRef, ViewEncapsulation, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-editor-number',
  standalone: true,
  template: `

    <input #inputEl class="rdt-cell-editor" type="number" data-editing-cell="" [attr.aria-label]="rozieAttr(a11yLabel())" [value]="draftValue()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
  styles: [`
    :host(rozie-editor-number) { display: contents; }
  `],
})
export class EditorNumber {
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
   * The current cell value the local draft string seeds from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
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

  // Seed the draft string once from the incoming value (setup-once).
  // ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
  // A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
  // places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
  // DEFAULT — Angular sets inputs after construction. Measured on the sibling EditorDate: it
  // opened EMPTY on angular for every row while vue and lit seeded correctly. Reading the prop
  // through a derived function is correct on all six by construction, with no flash of an empty
  // control on the fine-grained targets and no per-target branch — the pattern `FilterSelect`
  // already uses (`selectValue()`), which is why FilterSelect was the one drop-in unaffected.
  // `touched` keeps the live prop read from overwriting the user once they start typing.
  draftValue = () => this.touched() ? this.draft() : this.value() != null ? String(this.value()) : '';
  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
    this.touched.set(true);
  };
  // Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
  // commits null rather than NaN (Number('') === 0 is a silent footgun); a
  // non-numeric draft also commits null. Otherwise commit the coerced number.
  doCommit = () => {
    const __commit = this.commit();
    if (!__commit) return;
    const raw = this.draftValue();
    if (raw == null || String(raw).trim() === '') {
      __commit(null);
      return;
    }
    const n = Number(raw);
    __commit(Number.isNaN(n) ? null : n);
  };
  doCancel = () => {
    const __cancel = this.cancel();
    __cancel && __cancel();
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

export default EditorNumber;
