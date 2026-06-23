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

    <span style="display:contents">
      <input class="rdt-col-filter" type="number" [attr.aria-label]="rozieAttr(columnId() + ' min')" [attr.placeholder]="rozieAttr(minPlaceholder())" [value]="minDraft()" (input)="onMinInput($event)" (change)="applyRange()" />
      <input class="rdt-col-filter" type="number" [attr.aria-label]="rozieAttr(columnId() + ' max')" [attr.placeholder]="rozieAttr(maxPlaceholder())" [value]="maxDraft()" (input)="onMaxInput($event)" (change)="applyRange()" />
    </span>

  `,
})
export class FilterNumberRange {
  columnId = input<string>('');
  column = input<(unknown) | null>(null);
  value = input<(unknown) | null>(null);
  setFilter = input<((...args: unknown[]) => unknown) | null>(null);
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
