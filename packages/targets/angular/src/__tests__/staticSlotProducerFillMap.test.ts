/**
 * Phase 80 Plan 09 — the source-level half of the D-09 regression proof.
 *
 * Reproduces, at the emitted-source level, the bug deferred-items.md #3
 * ("CONFIRMED REGRESSION (not fixed)") describes: a consumer's dynamic
 * `#[expr]` fill is silently dropped when the target producer's OWN slots
 * are all static identifier names. `emitScript.ts`'s
 * `hasRecordOnlySlot = ir.slots.some(isRecordOnlySlotDecl)` gate (~:1322)
 * decides whether a PRODUCER emits `contentChildren(RozieSlot)` +
 * `__rozieFillMap` — keyed ENTIRELY on the producer's OWN slot
 * declarations. `tests/angular-runtime/fixtures/ProducerIdentifierOnly.rozie`
 * declares two slots (`header`, `footer`), both plain identifier names, so
 * `isRecordOnlySlotDecl` is false for both and `hasRecordOnlySlot` is
 * false for the whole producer — even though `emitSlotFiller.ts` (the
 * CONSUMER side) emits a `[rozieSlot]="expr"` marker for ANY `#[expr]`
 * fill unconditionally, regardless of what the target producer's slots
 * look like (root cause, 80-CONTEXT.md D-09).
 *
 * This file asserts the OPPOSITE of `producerFillMap.test.ts`'s
 * "a producer with only identifier-named static slots emits none of the
 * three new members" case (lines 76-86 there) — that case is, and remains,
 * CORRECT for a producer nobody ever dynamically fills. This file's claim
 * is narrower and different: a static-identifier-only producer that a
 * consumer somewhere in the compilation DOES dynamically fill still needs
 * a collection path, and today it emits none. The Angular emitter compiles
 * one component at a time with no cross-file producer/consumer knowledge
 * (deferred-items.md #3's "Blast radius" section), so — until the real fix
 * lands in Plan 10 — this producer's own compiled output can never
 * distinguish "nobody dynamically fills me" from "ConsumerStaticProducer*
 * dynamically fills me" and unconditionally takes the narrower, wrong
 * path. These assertions describe the DESIRED post-fix state and are
 * expected to FAIL against the unmodified (pre-Plan-10) emitter — this is
 * the whole point of the plan (SPEC R7's fail-first contract). Do NOT
 * "fix" this file by loosening or removing an assertion; the fix lands in
 * emitScript.ts / emitSlotFiller.ts in Plan 10.
 *
 * Ambient ROOT-relative fixture read pattern per classSelector.test.ts.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compileAngular(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

/** The real fixture every ConsumerStaticProducer* .rozie file (Plan 09) targets. */
function compileStaticIdentifierOnlyProducer(): string {
  const filename = 'ProducerIdentifierOnly.rozie';
  const src = readFileSync(resolve(ROOT, `tests/angular-runtime/fixtures/${filename}`), 'utf8');
  return compileAngular(src, filename);
}

describe('Angular producer — static-identifier-only producer must still collect a keyed fill (Plan 09 RED, D-09)', () => {
  it('DESIRED POST-FIX: emits the content query member (__rozieFills over RozieSlot)', () => {
    const code = compileStaticIdentifierOnlyProducer();
    expect(code).toContain('__rozieFills = contentChildren(RozieSlot, { descendants: true });');
  });

  it('DESIRED POST-FIX: emits the fill-map computed member (__rozieFillMap)', () => {
    const code = compileStaticIdentifierOnlyProducer();
    expect(code).toContain('__rozieFillMap = computed(() => {');
  });

  it('DESIRED POST-FIX: emits the RozieSlot marker-directive runtime import', () => {
    const code = compileStaticIdentifierOnlyProducer();
    expect(code).toContain("import { RozieSlot } from '@rozie/runtime-angular';");
  });

  it("DESIRED POST-FIX: the 'header' slot's outlet resolution expression carries the fill-map tier ahead of the templates lookup", () => {
    const code = compileStaticIdentifierOnlyProducer();
    // Mirrors producerFillMap.test.ts's mixed-producer precedence-chain
    // assertion shape (Task 3, "an identifier-named slot resolves as
    // static content-child, then fill map, then templates input"): the
    // static @ContentChild capture (tier 1) still wins if present, THEN
    // the fill map (tier 2, new), THEN the templates input (tier 3).
    expect(code).toContain(
      "*ngTemplateOutlet=\"(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])\"",
    );
  });

  it("DESIRED POST-FIX: the 'footer' slot's outlet resolution expression carries the fill-map tier ahead of the templates lookup", () => {
    const code = compileStaticIdentifierOnlyProducer();
    expect(code).toContain(
      "*ngTemplateOutlet=\"(footerTpl ?? __rozieFillMap()['footer'] ?? templates()?.['footer'])\"",
    );
  });

  it('DESIRED POST-FIX: the keyed-fill intake gate is the SAME width as the templates-input gate — any producer that emits templates() also emits the fill map', () => {
    const code = compileStaticIdentifierOnlyProducer();
    // This producer has slots (ir.slots.length > 0), so it emits the
    // `templates` input today (the BROAD gate, unaffected by this bug).
    // The pinned relationship this plan's threat model and D-09 both
    // require: the KEYED-FILL intake gate (`hasRecordOnlySlot`) must not
    // be narrower than that broad gate — a producer with `templates()`
    // but no `__rozieFillMap()` is precisely the shape that lets a
    // dynamic consumer fill vanish silently.
    const hasTemplatesInput = code.includes(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
    expect(hasTemplatesInput).toBe(true);
    expect(code).toContain('__rozieFillMap');
  });
});
