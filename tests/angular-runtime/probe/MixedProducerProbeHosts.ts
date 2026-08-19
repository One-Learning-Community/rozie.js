// Quick task 260818-o2v — see MixedProducerProbe.ts for the full
// rationale. Two standalone hosts, neither importing `RozieSlot` — a
// consumer that only fills the identifier-named `header` slot via the
// ordinary `<ng-template #header>` static path has no reason to import the
// marker directive at all, exactly like a real hand-authored or emitted
// consumer of an identifier-only slot.
import { Component } from '@angular/core';
import { MixedProducerProbe } from './MixedProducerProbe';

/**
 * The FALSE-POSITIVE scenario: fills ONLY the identifier-named `header` slot,
 * correctly, via the static `<ng-template #header>` path. Projects nothing
 * else. Today's bare `this.__rozieProjectedTpls().length > 0` comparison
 * fires the empty-fill-map warning here even though this consumer did
 * everything right — that is the bug this quick task closes.
 */
@Component({
  selector: 'correct-header-only-host',
  standalone: true,
  imports: [MixedProducerProbe],
  template: `
    <mixed-producer-probe>
      <ng-template #header>HEADER-FILL</ng-template>
    </mixed-producer-probe>
  `,
})
export class CorrectHeaderOnlyHost {}

/**
 * The GENUINE "forgot RozieSlot for the record-path slot" scenario: fills
 * `header` correctly via the static path, PLUS projects one additional,
 * UNMARKED `<ng-template>` that was clearly meant for the record-path
 * `cell-status` slot but never got a `[rozieSlot]` marker. This must keep
 * warning after the fix — the counting form (`projected > claimed`) is
 * chosen specifically because a plainer "every static ref is also empty"
 * form would wrongly suppress this case (see 260818-o2v-PLAN.md
 * `<candidate_selection>`).
 */
@Component({
  selector: 'header-plus-stray-host',
  standalone: true,
  imports: [MixedProducerProbe],
  template: `
    <mixed-producer-probe>
      <ng-template #header>HEADER-FILL</ng-template>
      <ng-template>STRAY-CONTENT</ng-template>
    </mixed-producer-probe>
  `,
})
export class HeaderPlusStrayHost {}
