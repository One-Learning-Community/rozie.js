// Phase 80 (D-07b) — design-validation gate. See probe/ProbeProducer.ts and
// probe/ProbeHost.ts for the full rationale.
//
// Unlike the discarded JIT-era version of this file, ProbeProducer and
// ProbeHost are real, statically-imported .ts files — real ngtsc AOT
// compiles them as part of this package's TS Program (vitest.config.ts's
// `angular({ jit: false })`) before this test ever runs. There is no
// runtime compile step, no Babel decorator strip, no `new Function()` eval.
//
// Ambient globals (`describe`, `it`, `expect`) per setup-vitest.ts — do NOT
// `import { describe, it, expect } from 'vitest'` here, which would bypass
// the AnalogJS zone-testing patch.
import { ProbeHost } from './probe/ProbeHost';
import { ensureTestBedInit } from './testBedInit';
import { TestBed } from '@angular/core/testing';

describe('rozieSlotDesign probe — signal contentChildren() form (real AOT)', () => {
  it('collects fills at top level, inside @if, and inside @for, and folds them to templateRefs', () => {
    ensureTestBedInit();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ProbeHost] });
    const fixture = TestBed.createComponent(ProbeHost);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('TOP-FILL-A');
    expect(text).toContain('IF-FILL-B');
    expect(text).toContain('FOR-FILL-C');
    expect(text).not.toContain('[A-FALLBACK]');
    expect(text).not.toContain('[B-FALLBACK]');
    expect(text).not.toContain('[C-FALLBACK]');

    fixture.destroy();
  });
});
