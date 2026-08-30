import { Component, ViewEncapsulation, input } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

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
  styles: [`
    :host(rozie-detail-panel) { display: contents; }
  `],
})
export class DetailPanel {
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  row = input<(unknown) | null>(null);

  // Plain setup-once helper (NOT $computed — a $computed can't be aliased; the
  // EditorSelect plain-function lesson). Build `[{ key, value }]` from the row's own
  // enumerable keys, String-coercing each value. A null row yields an empty list.
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
