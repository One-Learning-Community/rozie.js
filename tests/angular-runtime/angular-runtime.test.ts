// Phase 80 Plan 03 (Task 3) — the six R7 runtime tests, run against the
// CURRENT (pre-fix) emitter and committed in a deliberately RED state. SPEC
// R7 / D-07 (fail-first-proof-by-git-history): "a test never observed red
// does not satisfy this requirement." Do NOT "fix" this file — the fix
// lands in Plans 04/05, a later wave.
//
// Mounting shape (RESEARCH Pattern 4 / Pitfall 3, adapted for real AOT):
// each consumer fixture is compiled through the SAME
// `Rozie({ target: 'angular' }) + angular({ jit: false })` Vite pipeline
// vitest.config.ts wires for every other file in this package — a plain ES
// `import` of a `.rozie` specifier is enough; @rozie/unplugin's D-70
// disk-cache prebuild + cross-rozie shim (see fixtures.compile.test.ts's
// sibling comment and .gitignore) already resolves the consumer's emitted
// extension-less `./ProducerRecordPath` import to the separately compiled
// producer module, so there is no manual import-map wiring left to do —
// that whole mechanism belonged to the discarded JIT/eval harness (D-07b).
// Mount the CONSUMER only; a content query on a producer with nothing
// projected into it is always empty and would prove nothing.
import { TestBed } from '@angular/core/testing';
import { ensureTestBedInit } from './testBedInit';

import { ConsumerTopLevel } from './fixtures/ConsumerTopLevel.rozie';
import { ConsumerInsideIf } from './fixtures/ConsumerInsideIf.rozie';
import { ConsumerInsideFor } from './fixtures/ConsumerInsideFor.rozie';
import { ConsumerSiblingProducers } from './fixtures/ConsumerSiblingProducers.rozie';
import { ConsumerEmptyKeyFill } from './fixtures/ConsumerEmptyKeyFill.rozie';

describe('angular-runtime — R7 fail-first record-path slot-fill proof (pre-fix emitter)', () => {
  it('1. top-level fill — baseline, must pass BOTH pre-fix and post-fix', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerTopLevel] });
    const fixture = TestBed.createComponent(ConsumerTopLevel);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('TOP:alpha');
    expect(text).not.toContain('[DYN-FALLBACK]');

    fixture.destroy();
  });

  it('2. fill inside r-if — a static view query never resolves a reference inside an embedded view', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerInsideIf] });
    const fixture = TestBed.createComponent(ConsumerInsideIf);
    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('IF-FILL');
    expect(text).not.toContain('[DYN-FALLBACK]');

    fixture.destroy();
  });

  it('3. fill inside r-for — asserts the DESIRED post-fix behavior; see RED-EVIDENCE.md for the observed pre-fix failure', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerInsideFor] });
    const fixture = TestBed.createComponent(ConsumerInsideFor);
    // Observed pre-fix failure mode (RED-EVIDENCE.md): NOT the "returns
    // iteration zero" behavior anticipated in the plan prose — a harder
    // failure. The emitted `templates` getter is `{ [col.key]:
    // this.__dynSlot_0! }`, referencing `col` (the `@for` loop's own
    // template-local variable) from CLASS-LEVEL scope, where it does not
    // exist. `detectChanges()` throws `ReferenceError: col is not defined`
    // synchronously. These assertions are left as the DESIRED post-fix
    // behavior (unreachable pre-fix, since the exception above propagates
    // out of this `it()` body first) so this same test file becomes the
    // GREEN observation once Plans 04/05 land, with no rewrite needed.
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('FOR:alpha');
    expect(text).toContain('FOR:beta');
    expect(text).not.toContain('[DYN-FALLBACK]');

    fixture.destroy();
  });

  it('4. two sibling producers — dynIdx resets per producer tag, colliding template ref names', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerSiblingProducers] });
    const fixture = TestBed.createComponent(ConsumerSiblingProducers);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Assert the COUNTS, not mere presence. Observed pre-fix failure mode
    // (RED-EVIDENCE.md): `dynIdx` resets per producer tag, so both
    // producers' fills share the template ref name `__dynSlot_0`, AND the
    // `templates` getter only emits an entry for the FIRST producer's key
    // — the second producer's fill is silently dropped entirely (SIB-B
    // renders zero times), not duplicated. A presence-only assertion on
    // SIB-A alone would not catch this — SIB-A renders correctly by
    // coincidence (first-declared wins the duplicate-name ViewChild
    // query) while SIB-B silently vanishes.
    const sibACount = text.split('SIB-A').length - 1;
    const sibBCount = text.split('SIB-B').length - 1;
    expect(sibACount).toBe(1);
    expect(sibBCount).toBe(1);

    fixture.destroy();
  });

  it('5. late-arriving fill — an r-if that flips false to true', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerInsideIf] });
    const fixture = TestBed.createComponent(ConsumerInsideIf);
    fixture.detectChanges();

    const textBefore = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textBefore).not.toContain('IF-FILL');
    expect(textBefore).not.toContain('[DYN-FALLBACK]');

    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const textAfter = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textAfter).toContain('IF-FILL');

    fixture.destroy();
  });

  it("6. empty-string key resolves to the producer's DEFAULT slot (D-06)", () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerEmptyKeyFill] });
    const fixture = TestBed.createComponent(ConsumerEmptyKeyFill);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('EMPTY-FILL');
    expect(text).not.toContain('[DEFAULT-FALLBACK]');

    fixture.destroy();
  });
});
