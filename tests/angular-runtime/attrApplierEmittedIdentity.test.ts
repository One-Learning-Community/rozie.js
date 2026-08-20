/**
 * Quick task 260819-sg9 (Tier 2) Task 2 — the DI-identity guard (SPEC
 * requirement 6 / R6). Proves, through the REAL compiled `.rozie` output —
 * not a hand-authored stand-in — both halves of the caller-injects
 * contract:
 *
 *   1. Emitted TEXT: the component calls
 *      `createRozieAttrApplier(inject(Renderer2))` in the field position
 *      the inlined IIFE used to occupy (`compileAngular`, no Vite
 *      involved — same technique `prohibitions.test.ts` uses for its
 *      text-level assertions).
 *   2. Mounted DOM: the component, AOT-built and mounted in TestBed,
 *      actually lands its spread attributes and merged class on the real
 *      DOM using an applier the runtime package constructed from the
 *      CONSUMER-injected `Renderer2` — proving the split-instance hazard
 *      (71dff1d5) cannot bite the caller-injects design.
 *
 * This file goes RED before the emitter change (Task 2 STEP 1) because the
 * emitter still inlines the IIFE at that point — text assertion (1) fails
 * immediately; DOM assertion (2) still passes (the inlined body works too)
 * until the emitter swap, at which point (1) turns green.
 *
 * Ambient globals (`describe`, `it`, `expect`) per setup-vitest.ts — do NOT
 * `import { describe, it, expect } from 'vitest'` in this package.
 */
import { TestBed } from '@angular/core/testing';
import { compileAngular } from './compileAngular';
import { ensureTestBedInit } from './testBedInit';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttrApplierSpread } from './fixtures/AttrApplierSpread.rozie';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.rozie`), 'utf8');
}

describe('attrApplierEmittedIdentity — the caller-injects factory-call shape, text and mounted DOM', () => {
  it('emitted TEXT calls createRozieAttrApplier(inject(Renderer2)) in the field position the IIFE occupied; no IIFE body survives', () => {
    const code = compileAngular(readFixture('AttrApplierSpread'), 'AttrApplierSpread.rozie');
    expect(code).toContain(
      'private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));',
    );
    expect(code).not.toContain('prevKeysByElement');
    expect(code).toContain("import { createRozieAttrApplier } from '@rozie/runtime-angular';");
  });

  it('mounted DOM: the spread lands its plain attribute and merges class (wrapper class survives, spread class token added)', async () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AttrApplierSpread] });
    const fixture = TestBed.createComponent(AttrApplierSpread);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.getAttribute('id')).toBe('spread-id');
    expect(button!.classList.contains('btn')).toBe(true);
    expect(button!.classList.contains('spread-class')).toBe(true);

    fixture.destroy();
  });
});
