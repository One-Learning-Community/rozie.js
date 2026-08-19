// Quick task 260818-okc — see RetimedDiagnosticsProbe.ts for the full
// rationale. Five standalone hosts exercising the three probe shapes.
import { Component } from '@angular/core';
import {
  RetimedMixedProbe,
  RetimedRecordOnlyProbe,
  RetimedIdentifierOnlyProbe,
} from './RetimedDiagnosticsProbe';
import { RozieSlot } from './RozieSlotProbe';

/**
 * The FALSE-POSITIVE scenario on the MIXED shape: fills ONLY the
 * identifier-named `header` slot, correctly, via the static
 * `<ng-template #header>` path. Projects nothing else. This is the
 * `CorrectHeaderOnlyHost` shape from the o2v falsification, re-proven here
 * against the RETIMED observation points.
 */
@Component({
  selector: 'retimed-correct-header-only-host',
  standalone: true,
  imports: [RetimedMixedProbe],
  template: `
    <retimed-mixed-probe>
      <ng-template #header>HEADER-FILL</ng-template>
    </retimed-mixed-probe>
  `,
})
export class RetimedCorrectHeaderOnlyHost {}

/**
 * The GENUINE "forgot RozieSlot for the record-path slot" scenario on the
 * MIXED shape: fills `header` correctly via the static path, PLUS projects
 * one additional, UNMARKED `<ng-template>` that was clearly meant for the
 * record-path `cell-status` slot but never got a `[rozieSlot]` marker. The
 * counting form must keep warning on this shape after any fix.
 */
@Component({
  selector: 'retimed-header-plus-stray-host',
  standalone: true,
  imports: [RetimedMixedProbe],
  template: `
    <retimed-mixed-probe>
      <ng-template #header>HEADER-FILL</ng-template>
      <ng-template>STRAY-CONTENT</ng-template>
    </retimed-mixed-probe>
  `,
})
export class RetimedHeaderPlusStrayHost {}

/**
 * Models `EmptyFillMapHost` (`tests/angular-runtime/hosts/EmptyFillMapHost.ts`)
 * against the RECORD-ONLY probe shape: one unmarked `<ng-template>`
 * projected, no static ref exists on the producer at all, so `claimed` is
 * always 0 and `projected > claimed` degenerates to the current bare
 * `projected > 0` comparison — proving shipped-shape parity.
 */
@Component({
  selector: 'retimed-record-only-stray-host',
  standalone: true,
  imports: [RetimedRecordOnlyProbe],
  template: `
    <retimed-record-only-probe>
      <ng-template>UNMARKED-CONTENT</ng-template>
    </retimed-record-only-probe>
  `,
})
export class RetimedRecordOnlyStrayHost {}

/**
 * The correctly-filled RECORD-ONLY scenario: one `<ng-template [rozieSlot]>`
 * fill, correctly marked. `fills > 0`, so no warning under either the bare
 * or the counting form.
 */
@Component({
  selector: 'retimed-record-only-marked-host',
  standalone: true,
  imports: [RetimedRecordOnlyProbe, RozieSlot],
  template: `
    <retimed-record-only-probe>
      <ng-template [rozieSlot]="'cell-status'">MARKED-CONTENT</ng-template>
    </retimed-record-only-probe>
  `,
})
export class RetimedRecordOnlyMarkedHost {}

/**
 * The IDENTIFIER-ONLY scenario: one `<ng-template #header>` fill into the
 * probe shape that has no diagnostics query at all — models the producer
 * class the emitter must keep leaving alone (no lifecycle diagnostics
 * method, no warning of any kind).
 */
@Component({
  selector: 'retimed-identifier-only-host',
  standalone: true,
  imports: [RetimedIdentifierOnlyProbe],
  template: `
    <retimed-identifier-only-probe>
      <ng-template #header>HEADER-FILL</ng-template>
    </retimed-identifier-only-probe>
  `,
})
export class RetimedIdentifierOnlyHost {}
