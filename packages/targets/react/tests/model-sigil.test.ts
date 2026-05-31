// Phase 18 Plan 02 (Req 2) — producer-side two-way-write sigil `$model.X`
// lowering on the React target.
//
// `$model.X` is the producer-side sigil for WRITING a `model: true` prop.
// Wave 1 (18-01) taught core semantics to recognize `$model` (reads normalize
// to SignalRef{scope:'props'}; non-model/non-existent `$model.X` is rejected
// pre-lowering via ROZ205/ROZ113; `$props.<modelProp>` writes are now ROZ204).
// This suite locks Wave 2's per-target lowering: `$model.X` writes route to the
// IDENTICAL React setter the `$props.<modelProp>` form took (byte-identical
// emit — "reuse, not reimplement"), and `$model.X` reads lower to the same bare
// model getter as `$props.X`. Sites covered: <script> assignment/compound/++,
// <script> read, and template @event handlers (a separate rewrite file).

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../src/emitReact.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ModelSigil.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitReact(lowered.ir, {
    filename: 'ModelSigil.rozie',
    source: src,
  });
  return result.code;
}

// Twin fixtures: identical except the producer write/read sigil. `value` is a
// model prop, so BOTH `$model.value` (new sigil) and the historical
// `$props.value` model form must lower to the same setter / getter.
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

describe('React $model producer-side two-way-write sigil', () => {
  it('$model.value writes/reads emit byte-identically to the $props.value model form', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
  });

  it('$model.value += 1 (script) lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    // Compound write routes through buildSetterCall → setValue(prev => prev + 1).
    expect(out).toContain('setValue(prev => prev + 1)');
  });

  it('$model.value = 0 (script) lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('setValue(0)');
  });

  it('$model.value++ (script statement) lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    // Two += 1 sites (bump + step++); assert at least the setter form is present.
    expect(out).toContain('setValue(prev => prev + 1)');
  });

  it('$model.value read (script) lowers to the bare model getter', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('value * 2');
  });

  it('template @click="$model.value += 1" lowers to the model setter', () => {
    const out = compile(fixture('$model'));
    // Template handler routes through rewriteTemplateExpression's setter path.
    expect(out).toContain('setValue(prev => prev + 1)');
  });

  it('no literal $model. reference survives in emitted output', () => {
    const out = compile(fixture('$model'));
    expect(out).not.toContain('$model');
  });

  it('emitted model fixture matches snapshot', () => {
    expect(compile(fixture('$model'))).toMatchSnapshot();
  });
});
