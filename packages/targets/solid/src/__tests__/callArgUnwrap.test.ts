/**
 * Phase 16 R2 / D-03 — Solid call-arg accessor unwrap regression test.
 *
 * Compiles `tests/regressions/fixtures/SolidCallArgUnwrap.rozie` against the
 * Solid target and asserts that the bare `index` alias passed as a call
 * argument inside an `r-for` event handler is rewritten to `index()` —
 * matching the value-passing semantics already present on React / Vue /
 * Svelte / Angular / Lit (which pass `index` as a bare number natively).
 *
 * The fixture's canary expression is `$data.log = [...$data.log, idx + 1]`
 * inside the handler — if `idx` is the bare accessor function, `idx + 1`
 * coerces the function to a string instead of producing a number. The fix
 * is the 4-line ctx thread (`EmitEventCtx.invokeAccessors` →
 * `renderHandler` → `rewriteTemplateExpression`); the actual
 * `Identifier` visitor in `rewriteTemplateExpression.ts` already handles
 * call-arg context correctly.
 *
 * Task 1 of Plan 16-02 — this test FAILS until Task 2 lands the ctx thread.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');
const FIXTURE = resolve(ROOT, 'tests/regressions/fixtures/SolidCallArgUnwrap.rozie');

function compileFor(target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit'): string {
  const source = readFileSync(FIXTURE, 'utf8');
  const result = compile(source, {
    target,
    filename: 'SolidCallArgUnwrap.rozie',
    sourceMap: false,
  });
  const errs = result.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length > 0) {
    throw new Error(
      `compile(target=${target}) returned errors: ${errs.map((d) => d.message).join('; ')}`,
    );
  }
  return result.code;
}

describe('Phase 16 R2 — Solid call-arg accessor unwrap [r-for index]', () => {
  it('Solid emit lowers @keydown="onRowKeyDown($event, index)" to invoke the index accessor — onRowKeyDown($event, index())', () => {
    const code = compileFor('solid');
    // The fix-target shape: index is invoked at the call-arg site.
    expect(code).toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\(\)\s*\)/);
  });

  // Other 5 targets pass `index` as a bare number natively — verify the
  // emit is unchanged on those targets so Plan 16-02's fix does not regress
  // any non-Solid target (RESEARCH §Pitfall 3 invariant).

  it('React emit passes index bare — onRowKeyDown($event, index)', () => {
    const code = compileFor('react');
    expect(code).toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\s*\)/);
    // Negative — React does NOT wrap index in a call.
    expect(code).not.toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\(\)\s*\)/);
  });

  it('Vue emit passes index bare — onRowKeyDown($event, index)', () => {
    const code = compileFor('vue');
    expect(code).toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\s*\)/);
    expect(code).not.toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\(\)\s*\)/);
  });

  it('Svelte emit passes index bare — onRowKeyDown($event, index)', () => {
    const code = compileFor('svelte');
    expect(code).toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\s*\)/);
    expect(code).not.toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\(\)\s*\)/);
  });

  it('Angular emit passes index bare — onRowKeyDown($event, index)', () => {
    const code = compileFor('angular');
    expect(code).toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\s*\)/);
    expect(code).not.toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\(\)\s*\)/);
  });

  it('Lit emit passes index bare — onRowKeyDown($event, index)', () => {
    const code = compileFor('lit');
    expect(code).toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\s*\)/);
    expect(code).not.toMatch(/onRowKeyDown\(\s*\$event\s*,\s*index\(\)\s*\)/);
  });
});
