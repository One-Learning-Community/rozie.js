// Phase 80 Plan 07 (Task 2) — the "consumer forgot to add RozieSlot to its
// imports: array" shape the empty-fill-map warning exists to catch. This
// host projects a PLAIN `<ng-template>` (no `rozieSlot` attribute at all)
// into the producer. Deliberately does NOT import `RozieSlot` — a plain
// `<ng-template>` never matches the directive's selector
// (`ng-template[rozieSlot]`), so no `RozieSlot` instance is ever
// constructed here, which also means this host is NOT affected by OPEN
// RISK R-80-NG0203 (the cross-package RozieSlot-construction crash) — the
// producer's SECOND content query (`contentChildren(TemplateRef, {
// descendants: true })`) still finds this plain template and its count
// mismatch against the (empty) keyed-fill count is exactly what the
// warning detects.
import { Component } from '@angular/core';
import { ProducerRecordPath } from '../fixtures/ProducerRecordPath';

@Component({
  selector: 'empty-fill-map-host',
  standalone: true,
  imports: [ProducerRecordPath],
  template: `
    <rozie-producer-record-path>
      <ng-template>UNMARKED-CONTENT</ng-template>
    </rozie-producer-record-path>
  `,
})
export class EmptyFillMapHost {}
