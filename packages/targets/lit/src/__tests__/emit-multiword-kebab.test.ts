/**
 * emit-multiword-kebab.test.ts — Lit target.
 *
 * Quick task 260811-nre (D-01) — proves the multi-word `$emit()` dispatch
 * fix at BOTH lowering sites: `rewriteScript.ts` ($emit as a statement) and
 * `rewriteTemplateExpression.ts` ($emit in template/listener position).
 *
 * Root cause (`.planning/todos/pending/lit-multiword-emit-kebab-camelcase-mismatch.md`):
 * on the Lit target, a plain `$emit('regionIn', …)` dispatched the RAW
 * camelCase source name verbatim, while the consumer's `@region-in="…"`
 * template binding kept the literal hyphenated string. `addEventListener`
 * is case-sensitive, so the listener never fires.
 *
 * D-01 (Dan, 2026-08-11): normalize the DISPATCH side using the SAME
 * `toKebabCase` helper the two-way model path already uses (re-exported as
 * `kebabize` from `emit/resolveLitSetterText.ts`), not a fresh
 * `/[A-Z]/g` rewrite — see that file's byte-equal-contract prose. The
 * listener side (`emitTemplate.ts`) is NOT touched.
 */

import _generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { IRComponent } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { kebabize } from '../emit/resolveLitSetterText.js';
import { rewriteScript } from '../rewrite/rewriteScript.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : (_generate as unknown as { default: GenerateFn }).default;

function buildIR(overrides: Partial<IRComponent> = {}): IRComponent {
  const scriptProgram = t.file(t.program([]));
  return {
    type: 'IRComponent',
    name: 'TestComponent',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      portalRules: [],
      engineRules: [],
      sourceLoc: { start: 0, end: 0 },
    },
    components: [],
    setupBody: { type: 'SetupBody', scriptProgram, annotations: [] },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  } as IRComponent;
}

describe('$emit multi-word kebab dispatch — script path (rewriteScript.ts)', () => {
  function rewrite(src: string, ir: IRComponent): string {
    const file = babelParse(src, { sourceType: 'module' });
    const { program } = rewriteScript(file, ir);
    return generate(program).code;
  }

  it("two-word camelCase emit name → hyphenated dispatch string ('regionIn' → 'region-in')", () => {
    const ir = buildIR();
    const out = rewrite("$emit('regionIn', payload);", ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("region-in"');
    expect(out).not.toContain('"regionIn"');
  });

  it("adjacent-capital name uses toKebabCase, not naive per-capital split ('reInit' → 're-init', NOT 'reinit')", () => {
    const ir = buildIR();
    const out = rewrite("$emit('reInit', payload);", ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("re-init"');
    expect(out).not.toContain('"reinit"');
    expect(out).not.toContain('"reInit"');
  });

  it('already-hyphenated emit name is idempotent (unchanged)', () => {
    const ir = buildIR();
    const out = rewrite("$emit('region-in', payload);", ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("region-in"');
  });

  it('single lowercase-word emit name is a no-op (the invariant guarding the other 22 families)', () => {
    const ir = buildIR();
    const out = rewrite("$emit('ready', payload);", ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("ready"');
  });
});

describe('$emit multi-word kebab dispatch — template/listener path (rewriteTemplateExpression.ts)', () => {
  function rewrite(expr: t.Expression, ir: IRComponent): string {
    return rewriteTemplateExpression(expr, ir);
  }

  it("two-word camelCase emit name → hyphenated dispatch string ('regionIn' → 'region-in')", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('regionIn'),
      t.identifier('payload'),
    ]);
    const out = rewrite(expr, ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("region-in"');
    expect(out).not.toContain('"regionIn"');
  });

  it("adjacent-capital name uses toKebabCase ('reInit' → 're-init')", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('reInit'),
      t.identifier('payload'),
    ]);
    const out = rewrite(expr, ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("re-init"');
    expect(out).not.toContain('"reinit"');
  });

  it('already-hyphenated emit name is idempotent (unchanged)', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('region-in'),
      t.identifier('payload'),
    ]);
    expect(rewrite(expr, ir)).toContain('this.dispatchEvent(new CustomEvent("region-in"');
  });

  it('single lowercase-word emit name is a no-op', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('ready'),
      t.identifier('payload'),
    ]);
    expect(rewrite(expr, ir)).toContain('this.dispatchEvent(new CustomEvent("ready"');
  });

  it('the two lowerings never drift: script path and template path produce byte-identical event strings', () => {
    const ir = buildIR();
    const scriptOut = (() => {
      const file = babelParse("$emit('regionMouseEnter', payload);", { sourceType: 'module' });
      const { program } = rewriteScript(file, ir);
      return generate(program).code;
    })();
    const templateExpr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('regionMouseEnter'),
      t.identifier('payload'),
    ]);
    const templateOut = rewriteTemplateExpression(templateExpr, ir);

    const scriptMatch = /new CustomEvent\("([^"]+)"/.exec(scriptOut);
    const templateMatch = /new CustomEvent\("([^"]+)"/.exec(templateOut);
    expect(scriptMatch?.[1]).toBeDefined();
    expect(scriptMatch?.[1]).toBe(templateMatch?.[1]);
  });
});

describe('$emit dispatch — byte-parity with the two-way model path helper', () => {
  it('the plain-emit result equals kebabize() for the same stem (same helper, cannot diverge)', () => {
    const ir = buildIR();
    const names = ['regionIn', 'reInit', 'regionMouseEnter', 'ready', 'region-in'];
    for (const name of names) {
      const expected = kebabize(name);
      const expr = t.callExpression(t.identifier('$emit'), [
        t.stringLiteral(name),
        t.identifier('payload'),
      ]);
      const out = rewriteTemplateExpression(expr, ir);
      expect(out).toContain(`this.dispatchEvent(new CustomEvent("${expected}"`);
    }
  });
});
