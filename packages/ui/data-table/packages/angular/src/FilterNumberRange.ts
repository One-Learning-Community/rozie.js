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
  selector: 'rozie-filter-number-range',
  standalone: true,
  template: `

    <span style="display:flex; align-items: center">
      <input class="rdt-col-filter" part="col-filter" type="number" [attr.aria-label]="rozieAttr(columnId() + ' min')" [attr.placeholder]="rozieAttr(minPlaceholder())" [value]="minDraft()" (input)="onMinInput($event)" (change)="applyRange()" />
      <span> - </span>
      <input class="rdt-col-filter" part="col-filter" type="number" [attr.aria-label]="rozieAttr(columnId() + ' max')" [attr.placeholder]="rozieAttr(maxPlaceholder())" [value]="maxDraft()" (input)="onMaxInput($event)" (change)="applyRange()" />
    </span>

  `,
})
export class FilterNumberRange {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  setFilter = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  minMax = input<(unknown) | null>(null);
  minDraft = signal('');
  maxDraft = signal('');

  constructor() {
    // Seed both drafts once at setup from the incoming [min,max] tuple (setup-once).
    this.minDraft.set(Array.isArray(this.value()) && this.value()[0] != null ? String(this.value()[0]) : '');
    this.maxDraft.set(Array.isArray(this.value()) && this.value()[1] != null ? String(this.value()[1]) : '');

    // Untyped handler params neutralize to `any` (the global-filter idiom).
  }

  onMinInput = (e: any) => {
    this.minDraft.set(e && e.target ? e.target.value : '');
  };
  onMaxInput = (e: any) => {
    this.maxDraft.set(e && e.target ? e.target.value : '');
  };
  minPlaceholder = () => Array.isArray(this.minMax()) && this.minMax()[0] != null ? String(this.minMax()[0]) : '';
  maxPlaceholder = () => Array.isArray(this.minMax()) && this.minMax()[1] != null ? String(this.minMax()[1]) : '';
  applyRange = () => {
    const __minDraft = this.minDraft();
    const __maxDraft = this.maxDraft();
    const __setFilter = this.setFilter();
    const __columnId = this.columnId();
    const minNum = __minDraft === '' ? undefined : Number(__minDraft);
    const maxNum = __maxDraft === '' ? undefined : Number(__maxDraft);
    if (minNum === undefined && maxNum === undefined) {
      __setFilter && __setFilter(__columnId, '');
    } else {
      __setFilter && __setFilter(__columnId, [minNum, maxNum]);
    }
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default FilterNumberRange;
