import { Component, DestroyRef, ElementRef, ViewEncapsulation, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-editor-date',
  standalone: true,
  template: `

    <input #inputEl class="rdt-cell-editor" type="date" data-editing-cell="" [attr.aria-label]="rozieAttr(a11yLabel())" [value]="draft()" (input)="onInput($event)" (change)="onChange($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

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
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private __rozieWatchInitial_0 = true;

  constructor() {
    // Seed the draft once from the incoming value (setup-once). A native date input
    // only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
    this.draft.set(this.value() != null ? String(this.value()) : '');
    effect(() => { const __watchVal = (() => this.autofocus())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (v) this.inputEl()?.nativeElement?.focus();
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    if (this.autofocus()) this.inputEl()?.nativeElement?.focus();
  }

  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
  };
  doCommit = () => {
    const __commit = this.commit();
    // commit the ISO date string the native control already produced.
    __commit && __commit(this.draft());
  };
  doCancel = () => {
    const __cancel = this.cancel();
    __cancel && __cancel();
  };
  onChange = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
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
