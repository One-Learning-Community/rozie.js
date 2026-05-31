// Phase 18 Plan 02 (Req 2) — producer-side two-way-write sigil `$model.X`
// lowering on the Solid target.
//
// `$model.X` writes a `model: true` prop. Wave 1 (18-01) taught core semantics
// to recognize `$model`; this suite locks Wave 2's Solid lowering: `$model.X`
// writes route to the IDENTICAL createControllableSignal setter the
// `$props.<modelProp>` form took (byte-identical emit — "reuse, not
// reimplement"), and `$model.X` reads lower to the same `value()` accessor.
// Sites covered: <script> assignment/compound/++, <script> read, and template
// @event handlers (a separate rewrite file).
//
// NOTE: lives under src/__tests__/ (Solid's vitest `include` is src/**, not
// tests/**), not the tests/ dir the plan template names.

import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ModelSigil.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  return emitSolid(lowered.ir, { filename: 'ModelSigil.rozie', source: src }).code;
}

function fixture(writeSigil: '$model' | '$props'): string {
  return `<rozie name="ModelSigil">
<props>
{
  value: { type: Number, default: 0, model: true }
}
</props>
<script>
function bump() {
  ${writeSigil}.value += 1;
}
function reset() {
  ${writeSigil}.value = 0;
}
function step() {
  ${writeSigil}.value++;
}
function doubled() {
  return ${writeSigil}.value * 2;
}
</script>
<template>
  <button @click="${writeSigil}.value += 1">{{ ${writeSigil}.value }}</button>
</template>
</rozie>`;
}

describe('Solid $model producer-side two-way-write sigil', () => {
  it('$model.value writes/reads emit byte-identically to the $props.value model form', () => {
    expect(compile(fixture('$model'))).toBe(compile(fixture('$props')));
  });

  it('$model.value += 1 (script) lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('setValue(');
  });

  it('$model.value read (script) lowers to the value() accessor', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('value()');
  });

  it('template @click="$model.value += 1" lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('setValue(');
  });

  it('no literal $model. reference survives in emitted output', () => {
    expect(compile(fixture('$model'))).not.toContain('$model');
  });

  it('emitted model fixture matches snapshot', () => {
    expect(compile(fixture('$model'))).toMatchSnapshot();
  });
});
