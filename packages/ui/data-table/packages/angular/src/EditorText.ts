import { Component, ViewEncapsulation, input, signal } from '@angular/core';

@Component({
  selector: 'rozie-editor-text',
  standalone: true,
  template: `

    <input class="rdt-cell-editor" type="text" data-editing-cell="" [attr.aria-label]="columnId()" [value]="draft()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
})
export class EditorText {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
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
   * The current cell value the editor seeds its local draft from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
   */
  commit = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  cancel = input<((...args: unknown[]) => unknown) | null>(null);
  draft = signal('');

  constructor() {
    // Seed the draft once at setup from the incoming value (setup-once, NOT in the
    // template). Normalize null/undefined to '' so the input value binds to a string.
    this.draft.set(this.value() != null ? String(this.value()) : '');

    // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
    // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  }

  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
  };
  doCommit = () => {
    const __commit = this.commit();
    __commit && __commit(this.draft());
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

export default EditorText;
