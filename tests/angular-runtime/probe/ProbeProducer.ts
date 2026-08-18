// Phase 80 (D-07b) — design-validation gate.
//
// The exploration probe that settled this phase's design
// (probe-proposed-design.mjs) only ever proved the DECORATOR
// `@ContentChildren` form — the only form a hand-built JIT harness could
// express at the time it was written. The signal `contentChildren()` form
// is what the Angular emitter will actually generate (Plans 04/05), and it
// has NOT yet been proven to work under REAL ngtsc AOT compilation. This
// component — mounted by rozieSlotDesign.probe.test.ts — proves it BEFORE
// any downstream test or emitter change is built on top of the assumption.
//
// THIS PROBE MUST PASS. If it fails, STOP: the phase's design premise is
// falsified and the fix cannot be built on `contentChildren()` as planned —
// do not work around a failure here, escalate it.
import { Component, TemplateRef, computed, contentChildren } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
// See RozieSlotProbe.ts for why this uses a byte-shape-identical LOCAL copy
// of `RozieSlot` rather than importing it from `@rozie/runtime-angular` or
// its cross-package source path.
import { RozieSlot } from './RozieSlotProbe';

@Component({
  selector: 'probe-producer',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div>
      @if (__rozieFillMap()['a']) {
        <ng-container *ngTemplateOutlet="__rozieFillMap()['a']" />
      } @else {
        <span>[A-FALLBACK]</span>
      }
      @if (__rozieFillMap()['b']) {
        <ng-container *ngTemplateOutlet="__rozieFillMap()['b']" />
      } @else {
        <span>[B-FALLBACK]</span>
      }
      @if (__rozieFillMap()['c']) {
        <ng-container *ngTemplateOutlet="__rozieFillMap()['c']" />
      } @else {
        <span>[C-FALLBACK]</span>
      }
    </div>
  `,
})
export class ProbeProducer {
  // The SIGNAL form — what the real emitter (Plans 04/05) generates, not
  // the decorator `@ContentChildren` form the earlier exploration probe
  // used.
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map: Record<string, TemplateRef<unknown>> = {};
    for (const f of this.__rozieFills()) {
      map[f.rozieSlot()] = f.templateRef;
    }
    return map;
  });
}

export default ProbeProducer;
