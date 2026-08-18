// Phase 80 (D-07b) — see ProbeProducer.ts for the full design-validation
// rationale. This host projects three keyed `ng-template` fills into
// ProbeProducer — one at TOP LEVEL (a), one inside an `@if (true)` block
// (b), and one inside an `@for` block (c) — per RESEARCH Pattern 4 / Pitfall
// 3, mounting a producer+consumer PAIR (never the producer alone, whose
// content query would always be empty and prove nothing). `RozieSlot` is in
// its `imports:` array, as a real hand-author or emitted consumer would
// declare it.
import { Component } from '@angular/core';
// See RozieSlotProbe.ts for why this uses a byte-shape-identical LOCAL copy
// of `RozieSlot` rather than importing it from `@rozie/runtime-angular` or
// its cross-package source path.
import { RozieSlot } from './RozieSlotProbe';
import { ProbeProducer } from './ProbeProducer';

@Component({
  selector: 'probe-host',
  standalone: true,
  imports: [ProbeProducer, RozieSlot],
  template: `
    <probe-producer>
      <ng-template rozieSlot="a">TOP-FILL-A</ng-template>
      @if (true) {
        <ng-template rozieSlot="b">IF-FILL-B</ng-template>
      }
      @for (item of [1]; track item) {
        <ng-template rozieSlot="c">FOR-FILL-C</ng-template>
      }
    </probe-producer>
  `,
})
export class ProbeHost {}

export default ProbeHost;
