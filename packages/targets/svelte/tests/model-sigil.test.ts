// Phase 18 Plan 03 (Req 2) — producer-side two-way-write sigil `$model.X`
// lowering on the Svelte target.
//
// `$model.X` is the producer-side sigil for WRITING a `model: true` prop.
// Wave 1 (18-01) taught core semantics to recognize `$model` (reads normalize
// to SignalRef{scope:'props'}; non-model/non-existent `$model.X` is rejected
// pre-lowering via ROZ205/ROZ113; `$props.<modelProp>` writes are now ROZ204).
// This suite locks Svelte's per-target lowering: `$model.X` writes route to the
// IDENTICAL Svelte two-way path (the `$bindable` rune local assignment) the
// `$props.<modelProp>` form took — byte-identical emit ("reuse, not
// reimplement") — and `$model.X` reads lower to the same bare local as
// `$props.X`.
//
// A1 (trace-before-done): RESEARCH found NO `$props`-guard hits in Svelte's
// rewriteListenerExpression.ts. Inspection resolved A1 structurally — that file
// is a PURE RE-EXPORT of rewriteTemplateExpression
// (`export { rewriteTemplateExpression as rewriteListenerExpression }`), so a
// `<listeners>`-body model-write routes through rewriteTemplateExpression, NOT a
// separate listener path. The `<listeners>`-body fixture below proves this
// end-to-end (no literal `$model.` survives in the emitted listener block).

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../src/emitSvelte.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ModelSigil.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitSvelte(lowered.ir, {
    filename: 'ModelSigil.rozie',
    source: src,
  });
  return result.code;
}

// Twin fixtures: identical except the producer write/read sigil. `value` is a
// model prop. Exercises ALL routing contexts on Svelte: <script>, template
// handler, and <listeners>-body inline handler (which re-routes through
// rewriteTemplateExpression — the A1 conclusion).
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

describe('Svelte $model producer-side two-way-write sigil', () => {
  it('$model.value writes/reads emit byte-identically to the $props.value model form (incl. <listeners>)', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
  });

  it('$model.value write (script) lowers to the same Svelte model local as the $props form', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
    // The $props twin already lowers the model read/write to the bare `value`
    // local (destructured from $props() with $bindable).
    expect(propsOut).toContain('value += 1');
  });

  it('$model.value read (script) lowers to the same bare local as $props.value', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('value * 2');
  });

  it('template @click="$model.value += 1" lowers via rewriteTemplateExpression', () => {
    const out = compile(fixture('$model'));
    expect(out).not.toContain('$model');
  });

  it('A1: <listeners>-body inline handler writing $model.value lowers (routes through rewriteTemplateExpression re-export)', () => {
    // Svelte has NO separate listener-write path — rewriteListenerExpression.ts
    // re-exports rewriteTemplateExpression. A missed guard would leave a literal
    // `$model.` in the emitted $effect listener block.
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
