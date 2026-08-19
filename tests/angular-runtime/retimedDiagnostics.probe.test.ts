// Quick task 260818-okc — design-validation gate for candidate D (the
// RETIMED empty-fill-map diagnostic) before any emitter code changes. See
// probe/RetimedDiagnosticsProbe.ts and probe/RetimedDiagnosticsProbeHosts.ts
// for the full rationale, and mixedProducerDiagnostics.probe.test.ts for the
// candidate-A falsification this plan does NOT revisit.
//
// This package's baseline is 186 (181 pre-existing + 5 from the o2v
// falsification probe); the new total is 186 plus the count added here; all
// 186 must remain green. Nothing here is deleted or renumbered to preserve
// the old total.
//
// Ambient globals (`describe`, `it`, `expect`) per setup-vitest.ts — do NOT
// `import { describe, it, expect } from 'vitest'` here, which would bypass
// the AnalogJS zone-testing patch.
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Type } from '@angular/core';
import { ensureTestBedInit } from './testBedInit';
import {
  RetimedMixedProbe,
  RetimedRecordOnlyProbe,
  RetimedIdentifierOnlyProbe,
} from './probe/RetimedDiagnosticsProbe';
import {
  RetimedCorrectHeaderOnlyHost,
  RetimedHeaderPlusStrayHost,
  RetimedRecordOnlyStrayHost,
  RetimedRecordOnlyMarkedHost,
  RetimedIdentifierOnlyHost,
} from './probe/RetimedDiagnosticsProbeHosts';

function mountAndGetProbe<P>(hostType: Type<unknown>, probeType: Type<P>) {
  ensureTestBedInit();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [hostType] });
  const fixture = TestBed.createComponent(hostType);
  fixture.detectChanges();
  const probeDebugEl = fixture.debugElement.query(By.directive(probeType));
  const probe = probeDebugEl.componentInstance as P;
  return { fixture, probe };
}

describe('retimedDiagnostics probe — candidate D timing gate (real AOT)', () => {
  it('CONTROL — RetimedCorrectHeaderOnlyHost: the effect-tagged observation re-proves the o2v falsification (projected > 0, headerTplPresent === false)', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedCorrectHeaderOnlyHost, RetimedMixedProbe);

    const effectObs = probe.observations.filter((o) => o.timing === 'effect');
    expect(effectObs.length).toBeGreaterThan(0);
    expect(effectObs.some((o) => o.projected > 0 && o.headerTplPresent === false)).toBe(true);

    fixture.destroy();
  });

  it('THE GATE — RetimedCorrectHeaderOnlyHost: an afterContentInit-tagged observation exists and shows headerTplPresent === true (candidate D dies here if this fails)', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedCorrectHeaderOnlyHost, RetimedMixedProbe);

    const afterContentInitObs = probe.observations.filter((o) => o.timing === 'afterContentInit');
    if (afterContentInitObs.length === 0 || !afterContentInitObs.some((o) => o.headerTplPresent === true)) {
      throw new Error(
        `CANDIDATE D FALSIFIED — ngAfterContentInit does not observe a populated decorator ref. ` +
          `Full observation array: ${JSON.stringify(probe.observations)}`,
      );
    }
    expect(afterContentInitObs.length).toBeGreaterThan(0);
    expect(afterContentInitObs.some((o) => o.headerTplPresent === true)).toBe(true);

    fixture.destroy();
  });

  it('THE GATE, second half — RetimedCorrectHeaderOnlyHost: at the afterContentInit observation, projected === 1 and claimed === 1, so projected > claimed is FALSE (the false positive is suppressed at the new timing)', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedCorrectHeaderOnlyHost, RetimedMixedProbe);

    const obs = probe.observations.find((o) => o.timing === 'afterContentInit');
    if (!obs || obs.projected !== 1 || obs.claimed !== 1) {
      throw new Error(
        `CANDIDATE D FALSIFIED — the counting form does not suppress the false positive at ngAfterContentInit. ` +
          `Full observation array: ${JSON.stringify(probe.observations)}`,
      );
    }
    expect(obs.projected).toBe(1);
    expect(obs.claimed).toBe(1);
    expect(obs.projected > obs.claimed).toBe(false);

    fixture.destroy();
  });

  it('GENUINE CASE — RetimedHeaderPlusStrayHost: at its afterContentInit observation, projected === 2, claimed === 1, so projected > claimed is TRUE (the counting form still fires on the case the warning exists for)', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedHeaderPlusStrayHost, RetimedMixedProbe);

    const obs = probe.observations.find((o) => o.timing === 'afterContentInit');
    expect(obs).toBeDefined();
    expect(obs!.projected).toBe(2);
    expect(obs!.claimed).toBe(1);
    expect(obs!.projected > obs!.claimed).toBe(true);

    fixture.destroy();
  });

  it('ONE-SHOT — RetimedCorrectHeaderOnlyHost: exactly one afterContentInit-tagged observation exists per mount, and a second detectChanges() adds none', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedCorrectHeaderOnlyHost, RetimedMixedProbe);

    const countAfterFirst = probe.observations.filter((o) => o.timing === 'afterContentInit').length;
    expect(countAfterFirst).toBe(1);

    fixture.detectChanges();

    const countAfterSecond = probe.observations.filter((o) => o.timing === 'afterContentInit').length;
    expect(countAfterSecond).toBe(countAfterFirst);

    fixture.destroy();
  });

  it('ONE-SHOT (simulated shared flag): the retimed check and the effect region, sharing one warned-flag, produce at most one would-be warning for RetimedHeaderPlusStrayHost regardless of evaluation order', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedHeaderPlusStrayHost, RetimedMixedProbe);

    const afterContentInitObs = probe.observations.find((o) => o.timing === 'afterContentInit');
    expect(afterContentInitObs).toBeDefined();

    // Post-fix design (260818-okc-PLAN.md <the_shape_that_changes>): on a
    // MIXED producer, the constructor effect region keeps ONLY duplicate-key
    // detection — this host projects no duplicate `[rozieSlot]` keys at all
    // (it never imports RozieSlot), so the effect region's trigger is always
    // false here. The retimed region carries the counting-form empty-fill-map
    // check exclusively, and the GENUINE CASE assertion above already proved
    // it fires for this exact host.
    const wouldWarnEffectRegion = false;
    const wouldWarnRetimedRegion = afterContentInitObs!.projected > afterContentInitObs!.claimed;
    expect(wouldWarnRetimedRegion).toBe(true);

    function simulate(order: Array<'effect' | 'retimed'>): number {
      let warned = false;
      let warnings = 0;
      for (const region of order) {
        if (warned) continue;
        const trigger = region === 'effect' ? wouldWarnEffectRegion : wouldWarnRetimedRegion;
        if (trigger) {
          warned = true;
          warnings += 1;
        }
      }
      return warnings;
    }

    expect(simulate(['effect', 'retimed'])).toBe(1);
    expect(simulate(['retimed', 'effect'])).toBe(1);

    fixture.destroy();
  });

  it('SHIPPED-SHAPE PARITY — RetimedRecordOnlyStrayHost: claimed === 0 at the afterContentInit observation, so projected > claimed is arithmetically identical to the current bare comparison', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedRecordOnlyStrayHost, RetimedRecordOnlyProbe);

    const obs = probe.observations.find((o) => o.timing === 'afterContentInit');
    expect(obs).toBeDefined();
    expect(obs!.claimed).toBe(0);
    expect(obs!.projected > obs!.claimed).toBe(obs!.projected > 0);
    expect(obs!.projected > 0).toBe(true);

    fixture.destroy();
  });

  it('SHIPPED-SHAPE PARITY — RetimedRecordOnlyMarkedHost: fills > 0, so no warning under either form', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedRecordOnlyMarkedHost, RetimedRecordOnlyProbe);

    const obs = probe.observations.find((o) => o.timing === 'afterContentInit');
    expect(obs).toBeDefined();
    expect(obs!.fills).toBeGreaterThan(0);

    fixture.destroy();
  });

  it('IDENTIFIER-ONLY — RetimedIdentifierOnlyHost: headerTplPresent === true at its afterContentInit observation (informational — this shape gets no diagnostics method regardless)', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedIdentifierOnlyHost, RetimedIdentifierOnlyProbe);

    const obs = probe.observations.find((o) => o.timing === 'afterContentInit');
    expect(obs).toBeDefined();
    expect(obs!.headerTplPresent).toBe(true);

    fixture.destroy();
  });

  // MEASURED, NOT ASSUMED — the verifiability question in <proposed_timing>:
  // does `afterNextRender` fire at all under this repo's TestBed harness
  // (BrowserTestingModule/platformBrowserTesting, AOT-compiled fixtures,
  // ComponentFixture.detectChanges())? Measured empirically on 2026-08-18
  // under this exact harness: it DOES fire — exactly ONE `afterNextRender`-
  // tagged observation exists after a single `fixture.detectChanges()` call,
  // and a second `detectChanges()` call on the same fixture adds none (it is
  // genuinely a run-once-per-instance callback, matching its documented
  // contract). So `<proposed_timing>` reason 1 (verifiability) does NOT
  // distinguish the two candidates under THIS harness — both are exercisable
  // by `tests/angular-runtime`'s TestBed-based suite. This does not change
  // the plan's chosen timing: `<proposed_timing>` reasons 2 (SSR — the
  // diagnostic must also cover a server render, which `afterNextRender`
  // never does) and 3 (zero new `@angular/core` import surface vs. a new
  // named import that `prohibitions.test.ts` prohibition 4b's
  // `PERMITTED_CORE_ADDITIONS` allow-list would have to be argued into)
  // still favor `ngAfterContentInit`, and neither of those two reasons is
  // affected by this measurement — encoded here as a passing assertion of
  // the OBSERVED outcome, not a hypothesis.
  it('MEASURED, NOT ASSUMED — afterNextRender DOES fire under this TestBed harness within fixture.detectChanges(), exactly once per instance', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedCorrectHeaderOnlyHost, RetimedMixedProbe);

    const afterMount = probe.observations.filter((o) => o.timing === 'afterNextRender').length;
    expect(afterMount).toBe(1);

    fixture.detectChanges();

    const afterSecond = probe.observations.filter((o) => o.timing === 'afterNextRender').length;
    expect(afterSecond).toBe(1);

    fixture.destroy();
  });

  // Same treatment for ngAfterContentChecked (free data for the late-arrival
  // question in <accepted_residuals> item 1) — measured empirically on
  // 2026-08-18: Angular invokes `ngAfterContentChecked` once per completed
  // content-query refresh, so a single `fixture.detectChanges()` call
  // produces exactly ONE `afterContentChecked`-tagged observation (its FIRST
  // evaluation point is the same instant as `ngAfterContentInit`'s, as
  // `<proposed_timing>` states), and it fires again on every subsequent
  // `detectChanges()` call even with no template change — recording the
  // measured count, not an assumed one.
  it('MEASURED, NOT ASSUMED — ngAfterContentChecked fires once per detectChanges() call (including the mount pass), recording the observed count', () => {
    const { fixture, probe } = mountAndGetProbe(RetimedCorrectHeaderOnlyHost, RetimedMixedProbe);

    const afterMount = probe.observations.filter((o) => o.timing === 'afterContentChecked').length;
    expect(afterMount).toBe(1);

    fixture.detectChanges();

    const afterSecond = probe.observations.filter((o) => o.timing === 'afterContentChecked').length;
    expect(afterSecond).toBe(2);

    fixture.destroy();
  });
});
