import { Component, ViewEncapsulation, input, signal } from '@angular/core';

@Component({
  selector: 'rozie-filter-text',
  standalone: true,
  template: `

    <input class="rdt-col-filter" type="text" [attr.aria-label]="columnId()" [value]="draft()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
})
export class FilterText {
  columnId = input<string>('');
  column = input<(unknown) | null>(null);
  value = input<(unknown) | null>(null);
  setFilter = input<((...args: unknown[]) => unknown) | null>(null);
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
  applyFilter = () => {
    const __setFilter = this.setFilter();
    __setFilter && __setFilter(this.columnId(), this.draft());
  };
  clearFilter = () => {
    const __setFilter = this.setFilter();
    this.draft.set('');
    __setFilter && __setFilter(this.columnId(), '');
  };
  onKeydown = (e: any) => {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      this.applyFilter();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      this.clearFilter();
    }
  };
  onBlur = () => {
    this.applyFilter();
  };
}

export default FilterText;
