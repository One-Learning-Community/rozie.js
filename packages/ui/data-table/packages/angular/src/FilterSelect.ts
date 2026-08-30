import { Component, ViewEncapsulation, input } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-filter-select',
  standalone: true,
  template: `

    <select class="rdt-col-filter" part="col-filter" [attr.aria-label]="columnId()" [value]="selectValue()" (change)="onChange($event)">
      <option value="">All</option>
      @for (opt of uniqueValues(); track opt) {
    <option [attr.value]="rozieAttr(opt)">{{ rozieDisplay(opt) }}</option>
    }
    </select>

  `,
  styles: [`
    :host(rozie-filter-select) { display: contents; }
  `],
})
export class FilterSelect {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The current column filter value the select seeds from (String-coerced).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
   */
  setFilter = input<((...args: any[]) => any) | null>(null);
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues = input<any[]>((() => [])());

  // The <select> value binding coerced to a string. $props.value is typed `unknown`
  // (opaque slot-scope), which the strict bundled-leaf tsc rejects against the native
  // select `value` type on React/Solid — the fix is a plain function returning a
  // string (uniform ×6, NOT a $computed; the EditorSelect/listbox value lesson).
  selectValue = () => this.value() != null ? String(this.value()) : '';
  // Immediate-apply-on-change: read the selected value the global-filter way. An
  // empty value (the leading "All" option) clears the column filter.
  onChange = (e: any) => {
    const __setFilter = this.setFilter();
    const __columnId = this.columnId();
    const v = e && e.target ? e.target.value : '';
    if (v === '') {
      __setFilter && __setFilter(__columnId, '');
    } else {
      __setFilter && __setFilter(__columnId, v);
    }
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default FilterSelect;
