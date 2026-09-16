import { Component, DestroyRef, ElementRef, ViewEncapsulation, effect, inject, input, untracked, viewChild } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-editor-checkbox',
  standalone: true,
  template: `

    <input #inputEl class="rdt-cell-editor" type="checkbox" data-editing-cell="" [attr.aria-label]="rozieAttr(a11yLabel())" [checked]="!!value()" (change)="onChange($event)" (keydown)="onKeydown($event)" />

  `,
  styles: [`
    :host(rozie-editor-checkbox) { display: contents; }
  `],
})
export class EditorCheckbox {
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
   * The current cell value — coerced to a real boolean via `!!` to seed the checkbox `checked` state.
   */
  value = input<(unknown) | null>(null);
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the boolean checked state on `@change`. Null-guarded at call sites.
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

  // Immediate-commit-on-change: read .checked the global-filter way, coerce to a
  // real boolean, and commit it directly.
  onChange = (e: any) => {
    const __commit = this.commit();
    __commit && __commit(!!(e && e.target ? e.target.checked : false));
  };
  onKeydown = (e: any) => {
    const __cancel = this.cancel();
    if (e && e.key === 'Escape') {
      e.preventDefault();
      __cancel && __cancel();
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

export default EditorCheckbox;
