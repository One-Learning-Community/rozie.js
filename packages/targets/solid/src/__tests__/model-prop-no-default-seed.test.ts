/**
 * model-prop-no-default-seed.test.ts — regression for quick task 260521-oao.
 *
 * Two Rule-1 emit bugs surfaced by the `required` prop work, neither covered by
 * a prior fixture:
 *
 *  1. No-default `model: true` prop — `createControllableSignal`'s
 *     `defaultFallback` is typed non-optional `T`. A no-default model prop
 *     seeded it with `undefined`, which is not assignable to `T`. Fix: seed the
 *     builtin zero-value for the prop's type (`false` / `0` / `''`).
 *
 *  2. `_props as Record<string, unknown>` cast — once the props interface
 *     carries a non-optional field (a `required: true` prop), the direct cast
 *     fails TS2352 ("neither type sufficiently overlaps the other"). An
 *     all-optional interface cast cleanly, so this never tripped before.
 *     Fix: route through `unknown` — `_props as unknown as Record<string,
 *     unknown>`, the cast TS itself suggests — applied universally (no
 *     detection guard).
 *
 * The per-target lint/tsc gate on examples/typed/PropsRequired.rozie is the
 * end-to-end backstop; these tests pin the emit shapes directly.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

function compileSolid(src: string): string {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  const out = emitSolid(lowered.ir, { filename: 'inline.rozie', source: src });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.code;
}

describe('Solid no-default model prop — createControllableSignal seed (260521-oao regression)', () => {
  it('seeds the third arg with the builtin zero-value, never `undefined`', () => {
    const code = compileSolid(`<rozie name="SeedProbe">
<props>
{
  flag: { type: Boolean, model: true },
  count: { type: Number, model: true },
}
</props>
<template><div>{{ $props.flag }}{{ $props.count }}</div></template>
</rozie>`);
    // Boolean model prop → zero-value `false`; Number → `0`.
    expect(code).toContain("'flag', false)");
    expect(code).toContain("'count', 0)");
    // The pre-fix bug: the seed arg was `undefined` against a non-optional `T`.
    expect(code).not.toContain(', undefined)');
  });
});

describe('Solid _props cast — non-optional props interface (260521-oao regression)', () => {
  it('routes the Record cast through `unknown` so a required prop does not trip TS2352', () => {
    const code = compileSolid(`<rozie name="CastProbe">
<props>
{
  label: { type: String, required: true },
  value: { type: Number, model: true },
}
</props>
<template><div>{{ $props.label }}{{ $props.value }}</div></template>
</rozie>`);
    // The props interface carries a non-optional `label: string` (required).
    expect(code).toContain('label: string;');
    // The createControllableSignal cast must go through `unknown` first —
    // a direct `_props as Record<string, unknown>` is the TS2352 regression.
    expect(code).toContain('_props as unknown as Record<string, unknown>');
    expect(code).not.toContain('_props as Record<string, unknown>');
  });
});
