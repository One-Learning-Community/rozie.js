// Phase 80 Plan 07 (Task 2) authored this fixture under an assumption Plan
// 08 empirically falsified (see angular-runtime.test.ts's rewritten
// assertion for the full account): `<ng-template rozieSlot>` with no bound
// value is NOT "the required input left unset" — Angular's template binder
// treats a value-less attribute matching a directive input name as a
// STATIC binding of the empty string (equivalent to `rozieSlot=""`), which
// fully satisfies `input.required<string>()`. The directive's own selector
// (`ng-template[rozieSlot]`) requires the attribute to be present at all,
// so "present but genuinely unset" is not reachable through this syntax.
// The real, correct behavior is the D-06 fold: `''` normalizes to
// `'defaultSlot'`, so this fixture's `BARE-FILL` content fills the
// producer's DEFAULT slot. Real `RozieSlot` import from
// `@rozie/runtime-angular`.
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
