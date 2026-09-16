import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-filter-text',
  standalone: true,
  template: `

    <input class="rdt-col-filter" part="col-filter" type="text" [attr.aria-label]="rozieAttr(a11yLabel())" [value]="draft()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
  styles: [`
    :host(rozie-filter-text) { display: contents; }
  `],
})
export class FilterText {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  setFilter = input<((...args: any[]) => any) | null>(null);
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel = input<string>('');
  draft = signal('');

  constructor() {
    // Seed the draft once at setup from the incoming value (setup-once, NOT in the
    // template). Normalize null/undefined to '' so the input value binds to a string.
    this.draft.set(this.value() != null ? String(this.value()) : '');
  }

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
  };
  // setFilter is a Function prop (default null) — guard before calling.
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

export default FilterText;
