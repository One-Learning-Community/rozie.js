// Phase 18 Plan 03 (Req 2) — producer-side two-way-write sigil `$model.X`
// lowering on the Vue target.
//
// `$model.X` is the producer-side sigil for WRITING a `model: true` prop.
// Wave 1 (18-01) taught core semantics to recognize `$model` (reads normalize
// to SignalRef{scope:'props'}; non-model/non-existent `$model.X` is rejected
// pre-lowering via ROZ205/ROZ113; `$props.<modelProp>` writes are now ROZ204).
// This suite locks Vue's per-target lowering: `$model.X` writes route to the
// IDENTICAL Vue two-way setter (defineModel ref assignment / emit('update:x'))
// the `$props.<modelProp>` form took — byte-identical emit ("reuse, not
// reimplement") — and `$model.X` reads lower to the same getter as `$props.X`.
//
// Sites covered: <script> assignment/compound/++, <script> read, template
// @event handlers (rewriteTemplateExpression — a separate rewrite file), AND
// <listeners>-body inline handler writes (rewriteListenerExpression — the
// SEPARATE listener-body path on Vue, the easy-to-miss one per RESEARCH
// Pitfall 2 / Vue listener guard sites 80/120).

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitVue } from '../src/emitVue.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ModelSigil.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitVue(lowered.ir, {
    filename: 'ModelSigil.rozie',
    source: src,
  });
  return result.code;
}

// Twin fixtures: identical except the producer write/read sigil. `value` is a
// model prop, so BOTH `$model.value` (new sigil) and the historical
// `$props.value` model form must lower to the same setter / getter.
// Exercises ALL THREE rewrite contexts on Vue: <script>, template handler,
// and <listeners>-body inline handler.
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
<listeners>
{
  "document:keydown": {
    handler: () => { ${writeSigil}.value += 1 },
  },
}
</listeners>
<template>
  <button @click="${writeSigil}.value += 1">{{ ${writeSigil}.value }}</button>
</template>
</rozie>`;
}

describe('Vue $model producer-side two-way-write sigil', () => {
  it('$model.value writes/reads emit byte-identically to the $props.value model form (incl. <listeners>)', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
  });

  it('$model.value += 1 (script) lowers to the same Vue model setter as the $props form', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    // Whatever shape the $props model form lowers to, the $model form must
    // produce it identically — this is the SPEC Req 2 reuse proof.
    expect(modelOut).toBe(propsOut);
    // And the $props twin already contains the Vue model setter assignment.
    expect(propsOut).toContain('value.value');
  });

  it('$model.value read (script) lowers to the same getter as $props.value', () => {
    const out = compile(fixture('$model'));
    // Model read lowers to `value.value` (defineModel Ref<T>).
    expect(out).toContain('value.value * 2');
  });

  it('template @click="$model.value += 1" lowers via rewriteTemplateExpression', () => {
    const out = compile(fixture('$model'));
    expect(out).not.toContain('$model');
  });

  it('<listeners>-body inline handler writing $model.value lowers via the SEPARATE listener path', () => {
    // The <listeners> body routes through rewriteListenerExpression
    // (rewriteScriptExpression). A missed guard there would leave a literal
    // `$model.` in the emitted listener block — Pitfall 2.
    const out = compile(fixture('$model'));
    expect(out).not.toContain('$model');
  });

  it('no literal $model. reference survives in emitted output (script, template, OR listeners)', () => {
    const out = compile(fixture('$model'));
    expect(out).not.toContain('$model');
  });

  it('emitted model fixture matches snapshot', () => {
    expect(compile(fixture('$model'))).toMatchSnapshot();
  });
});
