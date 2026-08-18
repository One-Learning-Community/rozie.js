// Phase 80 Plan 14 — the runtime DOM half of the SECOND incomplete-widening
// proof (D-10).
//
// Reproduces, as real mounted-through-TestBed failures against the CURRENT
// (pre-Plan-14) emitter, the exact silent-content-loss bug D-10 describes:
// a consumer's dynamic `#[expr]` fill has nowhere to land when its target
// producer gates the WRAPPER ELEMENT itself on a slot-presence read — the
// wrapper never renders at all, distinct from (and one layer above) the
// outlet-only bug D-09/Plan 09 already proved and Plan 10 already fixed.
//
// Covers both real-world gate shapes:
//   - ConsumerGatedProducerHeader        — Modal's prop-OR-slot gate
//   - ConsumerGatedProducerTableFooter   — Table's slot-OR-slot gate (no prop)
//
// Asserts wrapper-element PRESENCE (by data-testid) separately from fill-
// TEXT presence, per the plan's explicit instruction — "wrapper absent" and
// "wrapper present but empty" are different failures, and the phase has
// already been bitten by conflating them (D-09's own RED-EVIDENCE.md notes).
//
// Do NOT "fix" this file. The emitter fix lands in Task 2
// (packages/targets/angular/src/rewrite/buildSlotsMerge.ts). Mirrors the
// mounting shape staticProducerKeyedFill.test.ts already establishes
// verbatim — same init guard, same reset, same detectChanges discipline,
// same fixture.destroy() cleanup. Ambient globals (`describe`, `it`,
// `expect`) per setup-vitest.ts — do NOT import them from vitest.
import { TestBed } from '@angular/core/testing';
import { ensureTestBedInit } from './testBedInit';

import { ConsumerGatedProducerHeader } from './fixtures/ConsumerGatedProducerHeader.rozie';
import { ConsumerGatedProducerTableFooter } from './fixtures/ConsumerGatedProducerTableFooter.rozie';

describe('angular-runtime — a structurally-gated wrapper never renders for a dynamic fill (Plan 14 RED, D-10)', () => {
  it('1. the prop-OR-slot gate (Modal shape) — the gated header wrapper element renders, and the dynamic fill text is present inside it', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerGatedProducerHeader] });
    const fixture = TestBed.createComponent(ConsumerGatedProducerHeader);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const wrapper = host.querySelector('[data-testid="gated-header-wrapper"]');

    // Wrapper-element presence is asserted SEPARATELY from text presence —
    // "absent" and "present but empty" are different failures (D-09's own
    // RED-EVIDENCE.md notes). Pre-fix, this is the exact confirmed symptom:
    // the wrapper element does not render at all.
    expect(wrapper).not.toBeNull();
    expect(wrapper?.textContent ?? '').toContain('GATED-HEADER-DYNAMIC-FILL');
    expect(wrapper?.textContent ?? '').not.toContain('[HEADER-GATE-FALLBACK]');

    fixture.destroy();
  });

  it('2. the slot-OR-slot gate (Table shape, no prop operand) — the gated footer wrapper renders, the filled slot shows its fill, the UNFILLED sibling slot shows its own fallback', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerGatedProducerTableFooter] });
    const fixture = TestBed.createComponent(ConsumerGatedProducerTableFooter);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const wrapper = host.querySelector('[data-testid="gated-footer-wrapper"]');

    expect(wrapper).not.toBeNull();
    const text = wrapper?.textContent ?? '';
    expect(text).toContain('GATED-FOOTER-SUMMARY-DYNAMIC-FILL');
    expect(text).not.toContain('[FOOTER-SUMMARY-GATE-FALLBACK]');
    // The sibling footerPagination slot was never filled — it must still
    // show its own fallback once the wrapper renders.
    expect(text).toContain('[FOOTER-PAGINATION-GATE-FALLBACK]');

    fixture.destroy();
  });
});
