// Quick task 260818-o2v — design-validation gate for closing deferred-items.md
// item 6 (Phase 80, mixed-producer false positive on the `ngDevMode`
// empty-fill-map producer warning). See probe/MixedProducerProbe.ts and
// probe/MixedProducerProbeHosts.ts for the full rationale.
//
// OUTCOME: CANDIDATE A IS FALSIFIED. This file was authored to prove or
// falsify the premise that a producer's decorator `@ContentChild` ref is
// already populated at the moment the constructor-registered diagnostics
// `effect()` observes a non-zero `__rozieProjectedTpls()` count — the load-
// bearing assumption behind 260818-o2v-PLAN.md's chosen fix (counting
// populated static refs against the projected-template count). It is not.
//
// Empirical finding (real ngtsc AOT, TestBed, `CorrectHeaderOnlyHost`): the
// diagnostics `effect()` fires EXACTLY ONCE per mount — Angular signal
// effects only re-run when a SIGNAL read inside them changes value, and
// neither `__rozieFills()` nor `__rozieProjectedTpls()` changes again after
// the initial content-query refresh, so there is no second run to "catch up"
// on. At that one and only run, `this.headerTpl` (the plain decorator field,
// not a signal — reading it establishes no reactive dependency) was
// EMPIRICALLY OBSERVED to be `undefined`, even though `__rozieProjectedTpls()`
// already reported a non-zero count in the SAME effect execution. Reading
// `probe.headerTpl` directly (outside the effect) immediately after
// `fixture.detectChanges()` returns confirms it IS populated (`true`) by
// then, and a second `fixture.detectChanges()` call changes nothing (the
// effect does not re-run, confirming the one-shot-per-signal-change
// semantics) — see 260818-o2v-SUMMARY.md for the full debug transcript. So
// the decorator ref genuinely does become populated during the SAME
// `detectChanges()` call, just not by the moment this constructor effect's
// first (and only) run reads it. Candidate A's counting form
// (`projected > claimedByStaticRefs`, computed inside that same effect run)
// would therefore compute `claimedByStaticRefs = 0` at the exact moment it
// matters and remain just as false-positive as the code it was meant to fix
// — the fix would be INERT for the scenario it exists to close.
//
// Per 260818-o2v-PLAN.md `<candidate_selection>`: "A falsified candidate
// with runtime evidence is a good outcome here." Tasks 2 and 3 (the
// counting-form emitter change) were NOT started. `deferred-items.md` item 6
// stays NOT FIXED, now with this additional, more specific falsification on
// record for whichever future plan attempts a fix — see that item's
// disposition note for candidate B/C status.
//
// This file adds tests to a package whose established baseline is 181 (see
// 260818-o2v-PLAN.md); the new total is 181 + the count added here, and all
// 181 pre-existing tests must remain green. Nothing here is deleted or
// renumbered to preserve the old total.
//
// Ambient globals (`describe`, `it`, `expect`) per setup-vitest.ts — do NOT
// `import { describe, it, expect } from 'vitest'` here, which would bypass
// the AnalogJS zone-testing patch.
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ensureTestBedInit } from './testBedInit';
import { MixedProducerProbe } from './probe/MixedProducerProbe';
import {
  CorrectHeaderOnlyHost,
  HeaderPlusStrayHost,
} from './probe/MixedProducerProbeHosts';

function mountAndGetProbe(hostType: typeof CorrectHeaderOnlyHost | typeof HeaderPlusStrayHost) {
  ensureTestBedInit();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [hostType] });
  const fixture = TestBed.createComponent(hostType);
  fixture.detectChanges();
  const probeDebugEl = fixture.debugElement.query(By.directive(MixedProducerProbe));
  const probe = probeDebugEl.componentInstance as MixedProducerProbe;
  return { fixture, probe };
}

describe('mixedProducerDiagnostics probe — candidate A premise + false-positive reproduction (real AOT)', () => {
  it('CorrectHeaderOnlyHost: the header fill genuinely renders (not a broken consumer)', () => {
    const { fixture, probe } = mountAndGetProbe(CorrectHeaderOnlyHost);
    void probe;
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('HEADER-FILL');
    expect(text).not.toContain('[HEADER-FALLBACK]');

    fixture.destroy();
  });

  it('CorrectHeaderOnlyHost: reproduces the runtime false positive — an observation exists where fills === 0 && projected > 0', () => {
    const { fixture, probe } = mountAndGetProbe(CorrectHeaderOnlyHost);

    expect(
      probe.observations.some((o) => o.fills === 0 && o.projected > 0),
    ).toBe(true);

    fixture.destroy();
  });

  it('CorrectHeaderOnlyHost: FALSIFICATION — an observation exists where projected > 0 but headerTplPresent is still false, disproving candidate A\'s premise', () => {
    const { fixture, probe } = mountAndGetProbe(CorrectHeaderOnlyHost);

    const premiseViolations = probe.observations.filter(
      (o) => o.projected > 0 && o.headerTplPresent !== true,
    );
    expect(
      premiseViolations.length,
      `Candidate A's premise held for every observation (unexpected — re-check the falsification write-up). Full observation array: ${JSON.stringify(probe.observations)}`,
    ).toBeGreaterThan(0);

    fixture.destroy();
  });

  it('CorrectHeaderOnlyHost: confirms headerTpl DOES populate by the time detectChanges() returns, read directly outside the effect — the falsification is a timing race inside the effect, not a query that never resolves', () => {
    const { fixture, probe } = mountAndGetProbe(CorrectHeaderOnlyHost);

    expect(probe.headerTpl != null).toBe(true);

    fixture.destroy();
  });

  it('CorrectHeaderOnlyHost: the effect never re-runs after a second detectChanges() with no signal-value change — confirms this is a one-shot-per-mount observation, not a transient startup race that a later effect run would self-correct', () => {
    const { fixture, probe } = mountAndGetProbe(CorrectHeaderOnlyHost);
    const countAfterFirst = probe.observations.length;

    fixture.detectChanges();

    expect(probe.observations.length).toBe(countAfterFirst);

    fixture.destroy();
  });
});
