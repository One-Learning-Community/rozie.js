// Quick task 260818-o2v — AOT runtime probe proving/falsifying candidate A's
// premise for closing deferred-items.md item 6 (Phase 80, the mixed-producer
// false positive on the `ngDevMode` empty-fill-map producer warning).
//
// THIS PROBE MUST PASS the premise assertion (assertion 3 in
// mixedProducerDiagnostics.probe.test.ts) — if it fails, candidate A is dead:
// STOP the plan and report the observation array verbatim. Do not improvise a
// workaround, do not fall back to another candidate on your own authority.
//
// Mirrors probe/ProbeProducer.ts's structure and comment discipline: a
// hand-written Angular component, no `.rozie` source, no `@rozie/unplugin`, no
// compiler involvement — this is a design-validation gate for real ngtsc AOT,
// not an emitter-output test.
//
// Member shape hand-transcribed from the emitted mixed-producer contract
// (packages/targets/angular/src/emit/emitScript.ts §6e.ter / the diagnostics
// effect just below it, and refineSlotTypes.ts's `buildSlotCtx`):
//   - `headerTpl` — the decorator `@ContentChild` static ref for the
//     identifier-named `header` slot.
//   - `__rozieFills` / `__rozieFillMap` — the signal content-query + pure
//     fold every keyed-fillable producer emits (Plan 04/10).
//   - `__rozieProjectedTpls` — the SECOND content query the diagnostics gate
//     uses to detect "something was projected but not collected via
//     RozieSlot" (Plan 04 Task 2, D-08).
//
// Instead of warning, this probe RECORDS: every `effect()` run pushes one
// observation capturing the exact state the emitted diagnostics effect would
// see at that instant. Every run is data — the effect never early-returns.
import {
  Component,
  ContentChild,
  TemplateRef,
  computed,
  contentChildren,
  effect,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
// See RozieSlotProbe.ts for why this uses a byte-shape-identical LOCAL copy
// of `RozieSlot` rather than importing it from `@rozie/runtime-angular` or
// its cross-package source path — the same cross-package NG0203 hazard
// documented there applies here unchanged.
import { RozieSlot } from './RozieSlotProbe';

export interface MixedProducerObservation {
  fills: number;
  projected: number;
  headerTplPresent: boolean;
}

@Component({
  selector: 'mixed-producer-probe',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div>
      @if ((headerTpl ?? __rozieFillMap()['header'])) {
        <ng-container *ngTemplateOutlet="(headerTpl ?? __rozieFillMap()['header'])" />
      } @else {
        <span>[HEADER-FALLBACK]</span>
      }
      @if ((__rozieFillMap()['cell-status'])) {
        <ng-container *ngTemplateOutlet="(__rozieFillMap()['cell-status'])" />
      } @else {
        <span>[CELL-FALLBACK]</span>
      }
    </div>
  `,
})
export class MixedProducerProbe {
  // The identifier-named static slot's decorator @ContentChild ref — the
  // field candidate A's counting form would read to compute
  // `claimedByStaticRefs`.
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<unknown>;

  // The record-path slot's keyed intake — same shape every keyed-fillable
  // producer emits.
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });

  // The diagnostics gate's second content query — bare TemplateRef, not the
  // RozieSlot-marker-filtered one above.
  __rozieProjectedTpls = contentChildren(TemplateRef, { descendants: true });

  // RECORDS instead of warning — one observation per effect run, capturing
  // `headerTpl`'s presence at that exact instant alongside both content-query
  // counts. Never early-returns: every run is data for the test to inspect.
  readonly observations: Array<MixedProducerObservation> = [];

  constructor() {
    effect(() => {
      const projected = this.__rozieProjectedTpls().length;
      const fills = this.__rozieFills().length;
      this.observations.push({
        fills,
        projected,
        headerTplPresent: this.headerTpl != null,
      });
    });
  }
}

export default MixedProducerProbe;
