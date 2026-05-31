// Phase 18 Plan 02 (Req 2) — producer-side two-way-write sigil `$model.X`
// lowering on the Lit target.
//
// `$model.X` writes a `model: true` prop. Wave 1 (18-01) taught core semantics
// to recognize `$model`; this suite locks Wave 2's Lit lowering: `$model.X`
// writes route to the IDENTICAL `_<name>Controllable.write(...)` setter the
// `$props.<modelProp>` form took (byte-identical emit — "reuse, not
// reimplement"; the producer's own write goes through the controllable, NOT the
// public property setter), and `$model.X` reads lower to the same `this.<name>`
// getter. Sites covered: <script> assignment/compound/++, <script> read, and
// template @event handlers (a separate rewrite file).

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../src/emitLit.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ModelSigil.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  return emitLit(lowered.ir, { filename: 'ModelSigil.rozie', source: src }).code;
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

describe('Lit $model producer-side two-way-write sigil', () => {
  it('$model.value writes/reads emit byte-identically to the $props.value model form', () => {
    expect(compile(fixture('$model'))).toBe(compile(fixture('$props')));
  });

  it('$model.value write (script) routes through the controllable write()', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('Controllable.write(');
  });

  it('$model.value read (script) lowers to the this.value getter', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('this.value');
  });

  it('template @click="$model.value += 1" lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('Controllable.write(');
  });

  it('no literal $model. reference survives in emitted output', () => {
    expect(compile(fixture('$model'))).not.toContain('$model');
  });

  it('emitted model fixture matches snapshot', () => {
    expect(compile(fixture('$model'))).toMatchSnapshot();
  });
});
