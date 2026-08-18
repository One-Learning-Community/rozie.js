// Phase 80 Plan 09 — the runtime DOM half of the D-09 regression proof.
//
// Reproduces, as real mounted-through-TestBed failures against the CURRENT
// (pre-fix) emitter, the exact silent-content-loss bug
// deferred-items.md #3 describes: a consumer's dynamic `#[expr]` fill is
// dropped when the target producer's own slots are all static identifier
// names. Covers all three real-world shapes the Docker VR union run found
// (`dynamic-slot-name`, `ModalConsumer`, `TableDemo`'s toggled footer),
// reduced to the shared `ProducerIdentifierOnly` fixture, PLUS the
// embedded-view shape (a dynamic fill inside `r-if`, which is what
// TableDemo actually ships and which independently regresses via the
// bug this phase's own earlier plans already fixed for RECORD-path
// producers — this file proves the static-path producer never got that
// fix at all).
//
// Do NOT "fix" this file. The emitter fix lands in Plan 10. Mirrors the
// mounting shape angular-runtime.test.ts already establishes verbatim —
// same init guard, same reset, same detectChanges discipline, same
// fixture.destroy() cleanup. Ambient globals (`describe`, `it`, `expect`)
// per setup-vitest.ts — do NOT import them from vitest.
import { TestBed } from '@angular/core/testing';
import { ensureTestBedInit } from './testBedInit';

import { ConsumerStaticProducerTopLevel } from './fixtures/ConsumerStaticProducerTopLevel.rozie';
import { ConsumerStaticProducerToggle } from './fixtures/ConsumerStaticProducerToggle.rozie';
import { ConsumerStaticProducerInsideIf } from './fixtures/ConsumerStaticProducerInsideIf.rozie';
import { ConsumerStaticProducerSiblings } from './fixtures/ConsumerStaticProducerSiblings.rozie';

describe('angular-runtime — static-identifier-only producer silently drops a dynamic fill (Plan 09 RED, D-09)', () => {
  it('1. top-level fill (the ModalConsumer shape) — the marker renders in the filled slot, the OTHER slot keeps its own fallback', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerStaticProducerTopLevel] });
    const fixture = TestBed.createComponent(ConsumerStaticProducerTopLevel);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('TOPLEVEL-STATIC-FILL');
    expect(text).not.toContain('[HEADER-FALLBACK]');
    expect(text).toContain('[FOOTER-FALLBACK]');

    fixture.destroy();
  });

  it('2. toggle fill (the dynamic-slot-name / TableDemo-footer shape) — the SAME fill moves between two static-named slots at runtime', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerStaticProducerToggle] });
    const fixture = TestBed.createComponent(ConsumerStaticProducerToggle);
    fixture.detectChanges();

    const textInitial = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textInitial).toContain('TOGGLE-STATIC-FILL');
    expect(textInitial).not.toContain('[HEADER-FALLBACK]');
    expect(textInitial).toContain('[FOOTER-FALLBACK]');

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="toggle-static-slot-name"]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const textAfter = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textAfter).toContain('TOGGLE-STATIC-FILL');
    expect(textAfter).toContain('[HEADER-FALLBACK]');
    expect(textAfter).not.toContain('[FOOTER-FALLBACK]');

    fixture.destroy();
  });

  it('3. fill inside an embedded view (r-if true at mount) — the marquee table-demo shape', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerStaticProducerInsideIf] });
    const fixture = TestBed.createComponent(ConsumerStaticProducerInsideIf);
    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('IF-STATIC-FILL');
    expect(text).not.toContain('[HEADER-FALLBACK]');

    fixture.destroy();
  });

  it('4. fill inside an embedded view that flips false -> true after mount', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerStaticProducerInsideIf] });
    const fixture = TestBed.createComponent(ConsumerStaticProducerInsideIf);
    fixture.detectChanges();

    const textBefore = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textBefore).not.toContain('IF-STATIC-FILL');

    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const textAfter = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textAfter).toContain('IF-STATIC-FILL');
    expect(textAfter).not.toContain('[HEADER-FALLBACK]');

    fixture.destroy();
  });

  it('5. two sibling static-identifier-only producers, each with its own dynamic fill — neither leaks into the other', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerStaticProducerSiblings] });
    const fixture = TestBed.createComponent(ConsumerStaticProducerSiblings);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const sibACount = text.split('SIB-STATIC-A').length - 1;
    const sibBCount = text.split('SIB-STATIC-B').length - 1;
    expect(sibACount).toBe(1);
    expect(sibBCount).toBe(1);

    fixture.destroy();
  });
});
