/**
 * range-complete-casing.test.ts — REQ-EVT / SC-6 guard.
 *
 * `rangeComplete` is the FIRST camelCase `$emit` in any shipped @rozie-ui family
 * (RESEARCH Pitfall 2). The emitter derives the consumer-facing event-prop name
 * per framework idiom, and the casing DIVERGES — most dangerously on Svelte,
 * which LOWERCASES the callback prop to `onrangecomplete` (a consumer binding
 * `onRangeComplete` in PascalCase would silently never fire). This fixture
 * documents-as-code the per-target lowering and guards it from regressing.
 *
 * Pure GLUE over the `@rozie/core` public `compile()` API (mirrors
 * surface.test.ts) — NO compiler/emitter/IR change. Tolerant substring/regex
 * assertions on `compile(source, { target }).code`.
 *
 * Per-target lowering asserted (RESEARCH §interfaces):
 *   React:   onRangeComplete              (capitalized on*)
 *   Solid:   onRangeComplete
 *   Svelte:  onrangecomplete              (LOWERCASED — the trap)
 *   Lit:     new CustomEvent("rangeComplete")   (case-preserved dispatch)
 *   Angular: rangeComplete = output()
 *   Vue:     emit('rangeComplete')
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'DatePicker.rozie');
const FILENAME = 'DatePicker.rozie';
const source = readFileSync(SRC, 'utf8');

function emit(target: string): string {
  const r = compile(source, { target, filename: FILENAME });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  expect(errs).toEqual([]);
  expect(r.code.length).toBeGreaterThan(0);
  return r.code;
}

describe('rangeComplete per-target consumer-prop casing (REQ-EVT)', () => {
  it('React capitalizes → onRangeComplete', () => {
    const code = emit('react');
    expect(code).toMatch(/onRangeComplete/);
  });

  it('Solid capitalizes → onRangeComplete', () => {
    const code = emit('solid');
    expect(code).toMatch(/onRangeComplete/);
  });

  it('Svelte LOWERCASES → onrangecomplete (NOT onRangeComplete — the trap)', () => {
    const code = emit('svelte');
    // The callback prop must be the lowercase form…
    expect(code).toMatch(/onrangecomplete/);
    // …and must NOT be the PascalCase form a consumer might wrongly expect.
    expect(code).not.toMatch(/onRangeComplete/);
  });

  it('Lit dispatches a case-preserved CustomEvent("rangeComplete")', () => {
    const code = emit('lit');
    expect(code).toMatch(/new CustomEvent\(\s*["']rangeComplete["']/);
  });

  it('Angular declares rangeComplete = output()', () => {
    const code = emit('angular');
    expect(code).toMatch(/rangeComplete\s*=\s*output\b/);
    expect(code).toMatch(/this\.rangeComplete\.emit\(/);
  });

  it('Vue emits the case-preserved rangeComplete', () => {
    const code = emit('vue');
    expect(code).toMatch(/emit\(\s*["']rangeComplete["']/);
  });
});
