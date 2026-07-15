import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'rozie-editor-checkbox',
  standalone: true,
  template: `

    <input class="rdt-cell-editor" type="checkbox" data-editing-cell="" [attr.aria-label]="columnId()" [checked]="!!value()" (change)="onChange($event)" (keydown)="onKeydown($event)" />

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
}

export default EditorCheckbox;
