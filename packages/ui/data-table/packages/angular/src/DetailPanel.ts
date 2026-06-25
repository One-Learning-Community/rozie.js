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
  selector: 'rozie-detail-panel',
  standalone: true,
  template: `

    <dl class="rdt-detail-panel">
      
      @for (pair of entries(); track pair.key) {
    <div class="rdt-detail-entry">
        <dt class="rdt-detail-key">{{ rozieDisplay(pair.key) }}</dt>
        <dd class="rdt-detail-value">{{ rozieDisplay(pair.value) }}</dd>
      </div>
    }
    </dl>

  `,
})
export class DetailPanel {
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  row = input<(unknown) | null>(null);

  entries = () => {
    const r = this.row();
    if (!r) return [];
    return Object.keys(r).map((key: any) => ({
      key,
      value: r[key] == null ? '' : String(r[key])
    }));
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default DetailPanel;
