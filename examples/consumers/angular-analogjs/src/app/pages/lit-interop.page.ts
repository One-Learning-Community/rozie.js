// Phase 06.4 P3 SC5 — Angular standalone consuming a compiled Lit custom
// element.
//
// Per RESEARCH.md Pattern 11 + Pitfall 9: Angular templates do not by default
// accept arbitrary custom-element tags. The narrow workaround is
// `CUSTOM_ELEMENTS_SCHEMA` on the standalone component — scoped to THIS
// component only, NOT applied to AppComponent.
//
// Property binding: `[value]="val"` (Angular bracket form).
// Event binding:    `(value-change)="onChange($event)"` — Angular paren form;
//                   $event is the CustomEvent dispatched by the element.
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';

import '../../lit-fixtures/Counter.lit';

@Component({
  selector: 'rozie-lit-interop-page',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div>
      <h2>Lit Interop (Angular)</h2>
      <p>
        Angular consuming compiled Lit
        <code>&lt;rozie-counter&gt;</code>.
      </p>
      <rozie-counter
        [value]="val()"
        [step]="1"
        [min]="-10"
        [max]="10"
        (value-change)="onChange($event)"
      ></rozie-counter>
      <p>
        Parent-tracked value:
        <span data-testid="parent-value">{{ val() }}</span>
      </p>
    </div>
  `,
})
export class LitInteropPageComponent {
  val = signal<number>(5);

  onChange(e: Event): void {
    const detail = (e as CustomEvent).detail as number;
    this.val.set(detail);
  }
}
