/**
 * quick 261019-9g1 (add-on C) — the Numberish ARIA names `aria-colspan`,
 * `aria-rowspan`, `aria-posinset` and `aria-setsize` join the numeric nullable
 * list. `@vue/runtime-dom` 3.5 types each `Numberish | undefined` (never
 * `| null`), so a nullable-number binding bound RAW is a vue-tsc TS2322; they
 * wrap as `(expr) ?? undefined` like `aria-rowindex` / `aria-colcount` already do.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'Test.rozie' });
  if (!result.ast)
    throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

function emitFor(attr: string, expr: string): string {
  const ir = lowerInline(`<rozie name="Test">
<props>{ n: { type: Number, default: null } }</props>
<template>
  <div :${attr}="${expr}"></div>
</template>
</rozie>`);
  const { template, diagnostics } = emitTemplate(ir, REGISTRY);
  expect(diagnostics).toEqual([]);
  return template;
}

describe('emitTemplateAttribute (Vue) — Numberish ARIA names (add-on C)', () => {
  for (const name of ['aria-colspan', 'aria-rowspan', 'aria-posinset', 'aria-setsize']) {
    it(`${name} bound to a nullable number wraps as (expr) ?? undefined`, () => {
      expect(emitFor(name, '$props.n')).toContain(`:${name}="(props.n) ?? undefined"`);
    });
    it(`${name} bound to a provably non-null binary stays RAW`, () => {
      const template = emitFor(name, '$props.n + 1');
      expect(template).toContain(`:${name}="props.n + 1"`);
      expect(template).not.toContain('?? undefined');
    });
  }

  it('NO-REGRESS: aria-colcount (the existing member) still wraps', () => {
    expect(emitFor('aria-colcount', '$props.n')).toContain(':aria-colcount="(props.n) ?? undefined"');
  });
});
