import { Component, ViewEncapsulation, input, signal } from '@angular/core';

@Component({
  selector: 'rozie-editor-date',
  standalone: true,
  template: `

    <input class="rdt-cell-editor" type="date" data-editing-cell="" [attr.aria-label]="columnId()" [value]="draft()" (input)="onInput($event)" (change)="onChange($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

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
  commit = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel = input<((...args: unknown[]) => unknown) | null>(null);
  draft = signal('');

  constructor() {
    // Seed the draft once from the incoming value (setup-once). A native date input
    // only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
    this.draft.set(this.value() != null ? String(this.value()) : '');
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
}

export default EditorDate;
