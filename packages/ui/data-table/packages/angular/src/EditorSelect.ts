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
  selector: 'rozie-editor-select',
  standalone: true,
  template: `

    <select class="rdt-cell-editor" data-editing-cell="" [attr.aria-label]="columnId()" [value]="value()" (change)="onChange($event)" (keydown)="onKeydown($event)">
      @for (opt of options(); track opt.value) {
    <option [attr.value]="rozieAttr(opt.value)">{{ rozieDisplay(opt.label) }}</option>
    }
    </select>

  `,
})
export class EditorSelect {
  columnId = input<string>('');
  column = input<(unknown) | null>(null);
  row = input<(unknown) | null>(null);
  value = input<(unknown) | null>(null);
  commit = input<((...args: unknown[]) => unknown) | null>(null);
  cancel = input<((...args: unknown[]) => unknown) | null>(null);
  options = input<any[]>((() => [])());

  onChange = (e: any) => {
    const __commit = this.commit();
    __commit && __commit(e && e.target ? e.target.value : '');
  };
  onKeydown = (e: any) => {
    const __cancel = this.cancel();
    if (e && e.key === 'Escape') {
      e.preventDefault();
      __cancel && __cancel();
    }
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default EditorSelect;
