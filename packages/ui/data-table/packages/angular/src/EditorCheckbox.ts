import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'rozie-editor-checkbox',
  standalone: true,
  template: `

    <input class="rdt-cell-editor" type="checkbox" data-editing-cell="" [attr.aria-label]="columnId()" [checked]="!!value()" (change)="onChange($event)" (keydown)="onKeydown($event)" />

  `,
})
export class EditorCheckbox {
  columnId = input<string>('');
  column = input<(unknown) | null>(null);
  row = input<(unknown) | null>(null);
  value = input<(unknown) | null>(null);
  commit = input<((...args: unknown[]) => unknown) | null>(null);
  cancel = input<((...args: unknown[]) => unknown) | null>(null);

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
