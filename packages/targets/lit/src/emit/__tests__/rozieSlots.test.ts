/**
 * rozieSlots.test.ts — Phase 79 Plan 09 (R4/R5/R12), Lit producer-side
 * `rozieSlots` record intake — the Lit ❌ fix.
 *
 * Drives the REAL public `compile()` entrypoint (parse -> lowerToIR ->
 * threadParamTypes -> emitLit), NOT the bare `parse`/`lowerToIR`/`emitLit`
 * triple used by single-file fixture tests elsewhere in this package.
 * `threadParamTypes` (the pass that resolves `matchedFamily`,
 * `producerSlotParamCount`, `isPortal`, `paramTypes` onto each consumer
 * `SlotFillerDecl`) is a CROSS-FILE step that reads the producer `.rozie`
 * sibling off disk via `ProducerResolver` — `compile()` wires that
 * resolver; a bare `lowerToIR(ast, { modifierRegistry })` call does not,
 * and silently produces an IR where every filler looks unmatched (verified
 * empirically while authoring this test — the bare-lowerToIR path emits
 * `headerCell` through the pre-Plan-09 `observeRozieSlotCtx` fallback
 * instead of the intended `useFunctionPropPath`, because `producerSlotParamCount`
 * never got threaded).
 *
 * The `DynamicSlots` / `DynamicSlotsConsumer` fixture pair (parked at
 * `tests/fixtures/pending-79/` at this plan's authoring time; 79-13 Task 1
 * `git mv`'d the pair into `examples/` — D-10's final home, now that all six
 * targets compile it — and updated this file's fixture-path constant in the
 * SAME commit to avoid an ENOENT regression) exercises all four record-path
 * shapes at once: a non-identifier exact-match static slot (`cell-total`), a prefixed
 * dynamic family (`` `cell-${col.key}` ``, matched by `#cell-status` /
 * `#cell-score`), a no-prefix dynamic slot (`$data.freeSlotName`, matched by
 * the consumer's own dynamic fill `#[$data.dynamicFillKey]`), and a plain
 * identifier-named byte-identity control (`headerCell`).
 *
 * Task 1 covers `emitSlotFiller.ts`'s per-filler dispatch (the consumer
 * side — six behaviour cases). Task 2 covers `emitTemplate.ts`'s
 * accumulation into ONE `.rozieSlots=${{ ... }}` object literal. Task 3
 * covers the producer's three-step dispatch order in `emitTemplate.ts`'s
 * `emitSlot()`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';
import { beforeAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const DYNAMIC_SLOTS_DIR = resolve(HERE, '../../../../../../examples');
const LOCAL_FIXTURES = resolve(HERE, 'fixtures');

function compileFixture(dir: string, name: string): string {
  const filename = resolve(dir, `${name}.rozie`);
  const source = readFileSync(filename, 'utf8');
  const result = compile(source, { target: 'lit', filename, resolverRoot: dir });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `compile('${name}.rozie') produced error diagnostics: ${JSON.stringify(errors, null, 2)}`,
    );
  }
  return result.code;
}

const EXAMPLES = resolve(HERE, '../../../../../../examples');

let consumerCode: string;
let producerCode: string;
let plainScopedConsumerCode: string;
let modalConsumerCode: string;

beforeAll(() => {
  consumerCode = compileFixture(DYNAMIC_SLOTS_DIR, 'DynamicSlotsConsumer');
  producerCode = compileFixture(DYNAMIC_SLOTS_DIR, 'DynamicSlots');
  plainScopedConsumerCode = compileFixture(LOCAL_FIXTURES, 'PlainScopedConsumer');
  modalConsumerCode = compileFixture(EXAMPLES, 'ModalConsumer');
});

describe('Task 1 — emitSlotFiller: rozieSlots entry vs. legacy branches', () => {
  it('Behaviour 1: a matchedFamily fill (#cell-status) compiles into a rozieSlots entry, not a named property', () => {
    expect(consumerCode).toMatch(/rozieSlots=\$\{\{[\s\S]*?'cell-status':/);
    expect(consumerCode).not.toContain('.cell-status=${');
  });

  it('Behaviour 2: a non-identifier exact-match fill (#cell-total) compiles into a rozieSlots entry keyed on the quoted literal', () => {
    expect(consumerCode).toMatch(/rozieSlots=\$\{\{[\s\S]*?'cell-total':/);
    expect(consumerCode).not.toContain('.cell-total=${');
  });

  it('Behaviour 3: the dynamic-and-scoped fill (#[$data.dynamicFillKey]) compiles into a rozieSlots entry, not the light-DOM `<div slot="${expr}">` wrapper', () => {
    expect(consumerCode).toMatch(/rozieSlots=\$\{\{[\s\S]*?\[this\._dynamicFillKey\.value\]:/);
    expect(consumerCode).not.toMatch(/<div slot="\$\{this\._dynamicFillKey/);
  });

  it('Behaviour 4: the byte-identity control fill (#headerCell, identifier-named, scoped) keeps the ordinary named property attribute — NOT the record', () => {
    expect(consumerCode).toContain('.headerCell=${(scope: { title: any }) => html`');
    expect(consumerCode).not.toMatch(/rozieSlots=\$\{\{[\s\S]*?'headerCell':/);
  });

  it('Behaviour 5 (byte-identity control): an ordinary static identifier-named scoped fill on a plain (non-DynamicSlots) producer keeps the pre-Plan-09 named-property text verbatim', () => {
    expect(plainScopedConsumerCode).toContain('.header=${(scope: { title: any }) => html`');
    expect(plainScopedConsumerCode).not.toContain('rozieSlots=${{');
  });

  it('regression guard: a PARAMLESS dynamic fill (ModalConsumer\'s #[$data.slotName], no destructure) keeps the light-DOM `<div slot="${expr}">` wrapper — a dynamic filler\'s `.name` is the raw expression TEXT (lowerSlotFillers.ts), and running isSlotNameIdentifier against that text must NOT force it into the record path', () => {
    expect(modalConsumerCode).toContain('<div slot="${this._slotName.value}">');
    expect(modalConsumerCode).not.toContain('rozieSlots');
  });

  it('Behaviour 6: `grep -c observeRozieSlotCtx` in emitSlotFiller.ts is unchanged from its pre-Plan-09 value', () => {
    // Pre-Plan-09 value recorded via `git show HEAD:.../emitSlotFiller.ts | grep
    // -c observeRozieSlotCtx` before any Task 1 edit landed: 7 (all inside the
    // legacy scoped-static-fill branch this plan does not touch). Also
    // confirmed via `git diff` showing zero added/removed lines mentioning
    // the string.
    const fs = readFileSync(resolve(HERE, '../emitSlotFiller.ts'), 'utf8');
    const matches = fs.match(/observeRozieSlotCtx/g) ?? [];
    expect(matches.length).toBe(7);
  });
});

describe('Task 2 — emitTemplate: ONE accumulated rozieSlots object literal per open tag', () => {
  it('exactly one `.rozieSlots=${{` occurrence on the DynamicSlots consumer tag (four record-path fills merge into ONE binding)', () => {
    const matches = consumerCode.match(/\.rozieSlots=\$\{\{/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('all four record-path entries are present in the ONE object literal, in source order', () => {
    const start = consumerCode.indexOf('.rozieSlots=${{');
    expect(start).toBeGreaterThanOrEqual(0);
    const entries = consumerCode.slice(start);
    const iCellStatus = entries.indexOf("'cell-status'");
    const iCellScore = entries.indexOf("'cell-score'");
    const iCellTotal = entries.indexOf("'cell-total'");
    const iDynamic = entries.indexOf('[this._dynamicFillKey.value]');
    expect(iCellStatus).toBeGreaterThanOrEqual(0);
    expect(iCellScore).toBeGreaterThan(iCellStatus);
    expect(iCellTotal).toBeGreaterThan(iCellScore);
    expect(iDynamic).toBeGreaterThan(iCellTotal);
  });

  it('no doubled comma-space separator appears between joined entries', () => {
    expect(consumerCode).not.toMatch(/,\s*,/);
  });

  it('a producer/consumer pair with zero record-path fills emits an open tag with no rozieSlots binding at all', () => {
    expect(plainScopedConsumerCode).not.toContain('rozieSlots');
  });

  it('when a record-path fill and an ordinary named-property fill coexist on the same tag, both bindings appear on the same open tag', () => {
    // DynamicSlotsConsumer's <rozie-dynamic-slots> tag carries BOTH the
    // accumulated `.rozieSlots=` binding (cell-status/cell-score/cell-total/
    // dynamic) AND the ordinary `.headerCell=` named-property binding
    // (Behaviour 4) — on the SAME open tag.
    const openTagMatch = /<rozie-dynamic-slots\b[\s\S]*?<\/rozie-dynamic-slots>/.exec(consumerCode);
    expect(openTagMatch).not.toBeNull();
    const tag = openTagMatch![0]!;
    expect(tag).toContain('.rozieSlots=${{');
    expect(tag).toContain('.headerCell=${');
  });
});

describe('Task 3 — Lit producer dispatch order: record, then named prop, then slot fallback', () => {
  it('record lookup is evaluated BEFORE the named-property test in the emitted dispatch expression (AC-9 ordering)', () => {
    const iRecord = producerCode.indexOf('this.rozieSlots?.[');
    expect(iRecord).toBeGreaterThanOrEqual(0);
    const iNamedProp = producerCode.indexOf('this.headerCell !== undefined');
    expect(iNamedProp).toBeGreaterThan(iRecord);
  });

  it('a non-identifier static slot name (cell-total) dispatches through the record lookup keyed on the quoted literal, and mints no named function property for it', () => {
    expect(producerCode).toContain(
      "this.rozieSlots?.['cell-total'] !== undefined ? this.rozieSlots?.['cell-total']!({value: this.total})",
    );
    expect(producerCode).not.toMatch(/@property\([^)]*\)\s+'?cell-total'?\??:/);
  });

  it('a prefixed dynamic-name family slot (`cell-${col.key}`) dispatches through the record lookup keyed on the SAME rewritten expression rendered into the fallback <slot name="${expr}"> attribute', () => {
    expect(producerCode).toContain(
      'this.rozieSlots?.[`cell-${col.key}`] !== undefined ? this.rozieSlots?.[`cell-${col.key}`]!({row: this.row, value: this.row[col.key]}) : html`<slot name="${`cell-${col.key}`}"',
    );
  });

  it('a no-prefix dynamic-name slot ($data.freeSlotName) dispatches through the record lookup keyed on the rewritten signal-read expression', () => {
    expect(producerCode).toContain(
      'this.rozieSlots?.[this._freeSlotName.value] !== undefined ? this.rozieSlots?.[this._freeSlotName.value]!({label: this._freeSlotName.value}) : html`<slot name="${this._freeSlotName.value}"',
    );
  });

  it('an identifier-named slot (headerCell) keeps its pre-phase producer dispatch — the named-property ternary, unaffected by rozieSlots', () => {
    expect(producerCode).toContain(
      'this.headerCell !== undefined ? this.headerCell({title: this.heading}) : html`<slot name="headerCell"',
    );
  });

  it('with the record absent at runtime, dispatch falls through to the named function property, and with that absent too, to the slot element (AC-9/AC-N3)', () => {
    // headerCell's dispatch expression is untouched by this plan — its
    // fallthrough to `<slot name="headerCell">` is the pre-existing ternary
    // shape, proving the legacy path still resolves when no consumer sets
    // either the record or the named property.
    expect(producerCode).toMatch(
      /this\.headerCell !== undefined \? this\.headerCell\(\{[^}]*\}\) : html`<slot name="headerCell"/,
    );
  });

  it('grep -c isSlotNameIdentifier reports at least 1 in both emitTemplate.ts and emitSlotDecl.ts', () => {
    const templateFs = readFileSync(resolve(HERE, '../emitTemplate.ts'), 'utf8');
    const declFs = readFileSync(resolve(HERE, '../emitSlotDecl.ts'), 'utf8');
    expect((templateFs.match(/isSlotNameIdentifier/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((declFs.match(/isSlotNameIdentifier/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
