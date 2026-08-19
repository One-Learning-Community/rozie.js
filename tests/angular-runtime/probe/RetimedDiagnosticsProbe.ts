// Quick task 260818-okc — AOT runtime probe measuring the RETIMED empty-
// fill-map diagnostic (candidate D) under real ngtsc AOT, BEFORE any
// emitter code changes. This EXTENDS the committed candidate-A falsification
// family (see probe/MixedProducerProbe.ts, probe/MixedProducerProbeHosts.ts,
// mixedProducerDiagnostics.probe.test.ts) — those three files are NOT
// edited, NOT rebuilt, and stay in the tree as the permanent record that
// candidate A (reading the decorator ref inside the constructor `effect()`)
// was empirically falsified at `275c1d64`.
//
// This probe answers a DIFFERENT, narrower question: given that the ref is
// NOT populated inside the constructor effect, IS it populated at
// `ngAfterContentInit()` — the timing 260818-okc-PLAN.md's `<proposed_timing>`
// proposes — and is the projected-template count correct at that same
// instant? It also records `ngAfterContentChecked()` (free data for the
// late-arrival question in `<accepted_residuals>` item 1) and an
// `afterNextRender()` callback (the verifiability question in
// `<proposed_timing>`: does it even fire under this repo's TestBed harness).
//
// THIS PROBE MUST PASS THE GATE (assertions 2 and 3 in
// retimedDiagnostics.probe.test.ts) — if it fails, candidate D is dead: STOP
// the plan and report the observation arrays verbatim. Do not improvise a
// fourth approach, do not silently switch to `afterNextRender` because it
// happened to measure better (that tradeoff is a user decision, not a
// mechanical fallback — see `<proposed_timing>`).
//
// Every probe RECORDS at every timing point; none ever warns or early-
// returns — every run is data.
import {
  Component,
  ContentChild,
  TemplateRef,
  afterNextRender,
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

export interface RetimedObservation {
  /** Which lifecycle point this observation was taken at. */
  timing: 'effect' | 'afterContentInit' | 'afterContentChecked' | 'afterNextRender';
  fills: number;
  projected: number;
  /** Count of the probe's own populated static refs at this instant. */
  claimed: number;
  headerTplPresent: boolean;
}

/**
 * The MIXED shape — mirrors the emitted mixed-producer contract exactly:
 * a decorator `@ContentChild('header', ...)` ref for the identifier-named
 * slot, the `__rozieFills`/`__rozieFillMap` keyed-fill intake, and the
 * `__rozieProjectedTpls` diagnostics query. Template resolves the header
 * slot through the ref then the fill map with a fallback branch, and the
 * record-path (`cell-status`) slot through the fill map with its own
 * fallback — mirroring the emitted resolution chain.
 */
@Component({
  selector: 'retimed-mixed-probe',
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
export class RetimedMixedProbe {
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<unknown>;

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

  __rozieProjectedTpls = contentChildren(TemplateRef, { descendants: true });

  readonly observations: RetimedObservation[] = [];

  private record(timing: RetimedObservation['timing']): void {
    this.observations.push({
      timing,
      fills: this.__rozieFills().length,
      projected: this.__rozieProjectedTpls().length,
      claimed: this.headerTpl != null ? 1 : 0,
      headerTplPresent: this.headerTpl != null,
    });
  }

  constructor() {
    effect(() => {
      this.record('effect');
    });
    afterNextRender(() => {
      this.record('afterNextRender');
    });
  }

  ngAfterContentInit(): void {
    this.record('afterContentInit');
  }

  ngAfterContentChecked(): void {
    this.record('afterContentChecked');
  }
}

/**
 * The RECORD-ONLY shape — same members as `RetimedMixedProbe` MINUS the
 * decorator ref. This models every producer shipping today (zero shipped
 * `@rozie-ui` leaf declares a record-only slot alongside an identifier
 * slot per Plan 80-06 Task 2, and `claimed` degenerates to a constant 0
 * for this shape since there is no static ref to populate at all — so its
 * observations must show the arithmetic degenerating to the current bare
 * `projected > 0` comparison).
 */
@Component({
  selector: 'retimed-record-only-probe',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div>
      @if ((__rozieFillMap()['cell-status'])) {
        <ng-container *ngTemplateOutlet="(__rozieFillMap()['cell-status'])" />
      } @else {
        <span>[CELL-FALLBACK]</span>
      }
    </div>
  `,
})
export class RetimedRecordOnlyProbe {
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

  __rozieProjectedTpls = contentChildren(TemplateRef, { descendants: true });

  readonly observations: RetimedObservation[] = [];

  private record(timing: RetimedObservation['timing']): void {
    this.observations.push({
      timing,
      fills: this.__rozieFills().length,
      projected: this.__rozieProjectedTpls().length,
      // No static ref exists on this producer shape at all — claimed is
      // always 0, which is what makes `projected > claimed` arithmetically
      // identical to today's bare `projected > 0` comparison for it.
      claimed: 0,
      headerTplPresent: false,
    });
  }

  constructor() {
    effect(() => {
      this.record('effect');
    });
    afterNextRender(() => {
      this.record('afterNextRender');
    });
  }

  ngAfterContentInit(): void {
    this.record('afterContentInit');
  }

  ngAfterContentChecked(): void {
    this.record('afterContentChecked');
  }
}

/**
 * The IDENTIFIER-ONLY shape — the decorator ref and fill map, but NO
 * diagnostics query (`__rozieProjectedTpls` does not exist on this class,
 * matching the emitter's narrow `isRecordOnlySlotDecl` diagnostics gate:
 * an identifier-only producer never emits diagnostics at all today, and
 * this plan does not widen that). `projected` is therefore not tracked and
 * always recorded as 0 — informational only. This probe's observations
 * answer whether the RETIMED point works for this shape too, which is what
 * makes "we chose not to emit for it" a policy statement rather than a
 * capability limit.
 */
@Component({
  selector: 'retimed-identifier-only-probe',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div>
      @if ((headerTpl ?? __rozieFillMap()['header'])) {
        <ng-container *ngTemplateOutlet="(headerTpl ?? __rozieFillMap()['header'])" />
      } @else {
        <span>[HEADER-FALLBACK]</span>
      }
    </div>
  `,
})
export class RetimedIdentifierOnlyProbe {
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<unknown>;

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

  readonly observations: RetimedObservation[] = [];

  private record(timing: RetimedObservation['timing']): void {
    this.observations.push({
      timing,
      fills: this.__rozieFills().length,
      // No diagnostics query exists on this producer shape — not tracked.
      projected: 0,
      claimed: this.headerTpl != null ? 1 : 0,
      headerTplPresent: this.headerTpl != null,
    });
  }

  constructor() {
    effect(() => {
      this.record('effect');
    });
    afterNextRender(() => {
      this.record('afterNextRender');
    });
  }

  ngAfterContentInit(): void {
    this.record('afterContentInit');
  }

  ngAfterContentChecked(): void {
    this.record('afterContentChecked');
  }
}
