import { Component, ViewEncapsulation, input, signal } from '@angular/core';

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

@Component({
  selector: 'rozie-editor-select',
  standalone: true,
  template: `

    <select class="rdt-cell-editor" data-editing-cell="" [attr.aria-label]="columnId()" [value]="draft()" (change)="onChange($event)" (keydown)="onKeydown($event)" (blur)="onBlur()">
      @for (opt of options(); track opt.value) {
    <option [attr.value]="rozieAttr(opt.value)">{{ rozieDisplay(opt.label) }}</option>
    }
    </select>

  `,
  styles: [`
    :host(rozie-editor-select) { display: contents; }
  `],
})
export class EditorSelect {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
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
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value = input<(unknown) | null>(null);
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  commit = input<((...args: any[]) => any) | null>(null);
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel = input<((...args: any[]) => any) | null>(null);
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  options = input<any[]>((() => [])());
  draft = signal('');

  constructor() {
    // Seed the draft once from the incoming value (setup-once). Normalize null/undefined
    // to '' so the <select> binds to a string.
    this.draft.set(this.value() != null ? String(this.value()) : '');

    // Picking/arrow-cycling an option updates the draft only — no commit.
  }

  onChange = (e: any) => {
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default EditorSelect;
