// Phase 80 Plan 07 (Task 2) — R2's bare-attribute contract: `<ng-template
// rozieSlot>` with no bound value at all (neither `[rozieSlot]="expr"` nor
// `rozieSlot="literal"`) leaves the `input.required<string>()` field
// genuinely unset, so Angular's own NG0950 required-input error is the
// documented, deliberate contract at first read — not a rough edge to
// soften. Real `RozieSlot` import from `@rozie/runtime-angular`.
import { Component } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';
import { ProducerRecordPath } from '../fixtures/ProducerRecordPath';

@Component({
  selector: 'bare-attribute-host',
  standalone: true,
  imports: [RozieSlot, ProducerRecordPath],
  template: `
    <rozie-producer-record-path>
      <ng-template rozieSlot>BARE-FILL</ng-template>
    </rozie-producer-record-path>
  `,
})
export class BareAttributeHost {}
