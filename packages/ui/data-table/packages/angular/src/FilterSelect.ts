import { Component, ViewEncapsulation, input } from '@angular/core';

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
  setFilter = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues = input<any[]>((() => [])());

  selectValue = () => this.value() != null ? String(this.value()) : '';
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
