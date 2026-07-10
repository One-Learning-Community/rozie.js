/**
 * Follow-up F (data-table beta) — Vue boolean-enumerated ARIA attrs drop via
 * `(expr) ?? undefined` (the `X | undefined` vue-tsc slot), for the WHOLE
 * Booleanish/tristate set.
 *
 * Vue sibling of the React/Solid fix. `:aria-selected="cond ? !!sel : null"` on
 * a `<tr>` bound RAW is a TS2322 against Vue's `aria-selected?: Booleanish`
 * (`X | undefined`, never `X | null`). `aria-expanded` was the only boolean ARIA
 * member of `NULLABLE_DOM_ATTR_SLOTS`; this expands it to the full WAI-ARIA
 * boolean set so a not-provably-non-nullish binding wraps as `(expr) ?? undefined`
 * (Vue treats `null` ≡ `undefined` for attribute presence — the faithful drop).
 *
 * Drives the full `emitTemplate` pipeline (mirrors the Vue `:style` test).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'Test.rozie' });
  if (!result.ast) throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

function emitFor(attr: string, expr: string): string {
  const ir = lowerInline(`<rozie name="Test">
<data>{ cond: true, sel: false }</data>
<template>
  <div :${attr}="${expr}"></div>
</template>
</rozie>`);
  const { template, diagnostics } = emitTemplate(ir, REGISTRY);
  expect(diagnostics).toEqual([]);
  return template;
}

describe('emitTemplateAttribute (Vue) — boolean-enumerated ARIA nullish-drop (follow-up F)', () => {
  it('the data-table binding `:aria-selected="cond ? !!sel : null"` wraps as `(expr) ?? undefined` (not raw → no TS2322)', () => {
    const template = emitFor('aria-selected', "$data.cond ? !!$data.sel : null");
    expect(template).toContain('aria-selected="(');
    expect(template).toContain(') ?? undefined"');
  });

  it('the whole Booleanish + tristate ARIA set wraps as `(expr) ?? undefined` on a nullish-branch boolean binding', () => {
    const booleanish = [
      'aria-atomic',
      'aria-busy',
      'aria-checked', // tristate
      'aria-disabled',
      'aria-grabbed',
      'aria-hidden',
      'aria-modal',
      'aria-multiline',
      'aria-multiselectable',
      'aria-pressed', // tristate
      'aria-readonly',
      'aria-required',
      'aria-selected',
    ];
    for (const name of booleanish) {
      const template = emitFor(name, '$data.cond ? !!$data.sel : null');
      expect(template, `${name} should wrap as (expr) ?? undefined`).toContain(`${name}="(`);
      expect(template, `${name} should include the ?? undefined drop`).toContain(') ?? undefined"');
    }
  });

  it('NO-REGRESS: aria-expanded (the original member) still wraps as `(expr) ?? undefined`', () => {
    const template = emitFor('aria-expanded', '$data.cond ? !!$data.sel : null');
    expect(template).toContain('aria-expanded="(');
    expect(template).toContain(') ?? undefined"');
  });

  it('NO-REGRESS: a provably-non-null `!!x` binding stays RAW (Vue proves non-null → no wrap, no TS2869)', () => {
    const template = emitFor('aria-selected', '!!$data.sel');
    expect(template).toContain('aria-selected="!!');
    expect(template).not.toContain(') ?? undefined"');
  });
});
