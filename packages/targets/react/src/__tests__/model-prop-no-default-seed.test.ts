/**
 * model-prop-no-default-seed.test.ts — regression for quick task 260521-oao.
 *
 * Rule-1 emit bug, surfaced by the `required` prop work (no prior fixture had a
 * no-default `model: true` prop, so this latent React-emit bug was never
 * exercised): `useControllableState`'s `UseControllableStateOpts.defaultValue`
 * is typed non-optional `T`. A no-default model prop emitted
 * `defaultValue: props.defaultX ?? undefined` — and `undefined` is not
 * assignable to `T`, a latent tsc error in the emitted React code.
 *
 * Fix: a no-default model prop seeds the controllable-state option with the
 * builtin zero-value for its type (`false` / `0` / `''`), never `undefined`.
 *
 * The per-target typecheck gate on examples/typed/PropsRequired.rozie (which
 * carries a required+model prop) is the end-to-end backstop; this test pins the
 * emit shape directly so a regression names the bug instead of surfacing as a
 * confusing tsc error in a fixture.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../emitReact.js';

function compileReact(src: string): string {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return emitReact(lowered.ir, { filename: 'inline.rozie', source: src }).code;
}

const SRC = `<rozie name="SeedProbe">
<props>
{
  flag: { type: Boolean, model: true },
  count: { type: Number, model: true },
}
</props>
<template><div>{{ $props.flag }}{{ $props.count }}</div></template>
</rozie>`;

describe('React no-default model prop — useControllableState seed (260521-oao regression)', () => {
  it('seeds defaultValue with the builtin zero-value, never `?? undefined`', () => {
    const code = compileReact(SRC);
    // Boolean model prop → zero-value `false`.
    expect(code).toContain('defaultValue: props.defaultFlag ?? false');
    // Number model prop → zero-value `0`.
    expect(code).toContain('defaultValue: props.defaultCount ?? 0');
    // The pre-fix bug: `?? undefined` seeded against a non-optional `T` option.
    expect(code).not.toContain('?? undefined');
  });
});
