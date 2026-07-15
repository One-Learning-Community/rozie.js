import { Component, ViewEncapsulation, input, signal } from '@angular/core';

@Component({
  selector: 'rozie-editor-number',
  standalone: true,
  template: `

    <input class="rdt-cell-editor" type="number" data-editing-cell="" [attr.aria-label]="columnId()" [value]="draft()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

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
  draft = signal('');

  constructor() {
    // Seed the draft string once from the incoming value (setup-once).
    this.draft.set(this.value() != null ? String(this.value()) : '');
  }

  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
  };
  doCommit = () => {
    const __commit = this.commit();
    if (!__commit) return;
    const raw = this.draft();
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
}

export default EditorNumber;
