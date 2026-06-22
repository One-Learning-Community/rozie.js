import { Component, ViewEncapsulation, input, signal } from '@angular/core';

@Component({
  selector: 'rozie-editor-number',
  standalone: true,
  template: `

    <input class="rdt-cell-editor" type="number" data-editing-cell="" [attr.aria-label]="columnId()" [value]="draft()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
})
export class EditorNumber {
  columnId = input<string>('');
  column = input<(unknown) | null>(null);
  row = input<(unknown) | null>(null);
  value = input<(unknown) | null>(null);
  commit = input<((...args: unknown[]) => unknown) | null>(null);
  cancel = input<((...args: unknown[]) => unknown) | null>(null);
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
