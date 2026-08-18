// Phase 80 Plan 07 (Task 2) — T-80-01 verification. A hand-written host
// binding the marker directive to a caller-controlled key (via a signal
// input, driven per-test with `fixture.componentRef.setInput('dangerKey',
// ...)`), so one component covers all three dangerous keys
// (`__proto__`, `constructor`, `prototype`) without needing three files.
// Real `RozieSlot` import from `@rozie/runtime-angular`.
import { Component, input } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';
import { ProducerRecordPath } from '../fixtures/ProducerRecordPath';

@Component({
  selector: 'prototype-guard-host',
  standalone: true,
  imports: [RozieSlot, ProducerRecordPath],
  template: `
    <rozie-producer-record-path>
      <ng-template [rozieSlot]="dangerKey()">DANGER-FILL</ng-template>
    </rozie-producer-record-path>
  `,
})
export class PrototypeGuardHost {
  dangerKey = input.required<string>();
}
