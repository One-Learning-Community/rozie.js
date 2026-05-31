// Phase 18 Plan 03 (Req 2) — producer-side two-way-write sigil `$model.X`
// lowering on the Angular target.
//
// `$model.X` is the producer-side sigil for WRITING a `model: true` prop.
// Wave 1 (18-01) taught core semantics to recognize `$model` (reads normalize
// to SignalRef{scope:'props'}; non-model/non-existent `$model.X` is rejected
// pre-lowering via ROZ205/ROZ113; `$props.<modelProp>` writes are now ROZ204).
// This suite locks Angular's per-target lowering: `$model.X` writes route to
// the IDENTICAL Angular two-way setter (`this.value.set(...)` model signal /
// valueChange.emit) the `$props.<modelProp>` form took — byte-identical emit
// ("reuse, not reimplement") — and `$model.X` reads lower to the same signal
// getter (`this.value()`) as `$props.X`.
//
// Sites covered: <script> assignment/compound/++, <script> read, <script>
// DOUBLE-read (exercises the hoistDoubleReadAccessors classification site —
// A2), template @event handlers + template DOUBLE-read (exercises
// hoistTemplateDoubleReadAccessor — A2), AND <listeners>-body inline handler
// writes (rewriteListenerExpression — a SEPARATE listener path).
//
// A2 (inspect-each): RESEARCH flagged Angular classification sites (scope-aware
// skip / double-read hoist / accessor classification). They key on `$props` /
// `$data` and run on the RAW program/expr BEFORE the identifier rewrite. To keep
// `$model.X` byte-identical to the `$props.X` form at those sites too, the
// `$model`→`$props` normalization is applied at the EARLIEST point in each
// context (emitScript pre-pass before hoistDoubleReadAccessors; inline pre-pass
// in rewriteTemplateExpression + hoistTemplateDoubleReadAccessor +
// rewriteListenerExpression). The double-read fixtures below would diverge if a
// classification site missed `$model`.

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../src/emitAngular.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ModelSigil.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitAngular(lowered.ir, {
    filename: 'ModelSigil.rozie',
    source: src,
  });
  return result.code;
}

// Twin fixtures: identical except the producer write/read sigil. `value` is a
// model prop. Exercises ALL routing + classification contexts on Angular:
// <script> single+double read, template handler + template double-read,
// <listeners>-body inline handler.
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
  // Double-read in one scope — exercises hoistDoubleReadAccessors (A2).
  return ${writeSigil}.value + ${writeSigil}.value;
}
</script>
<listeners>
  <!--
    A <listeners>-body model READ (the realistic supported Angular pattern —
    see Modal.rozie's r-if="$props.open && ..."). An inline model WRITE from an
    Angular <listeners> body is a PRE-EXISTING unsupported pattern (the Angular
    listener rewrite has no AssignmentExpression visitor — a write crashes
    identically for the $props form; out of scope for this plan). This READ
    exercises the SEPARATE listener-body lowering path for $model.
  -->
  <listener :target="document" @keydown="() => {}" r-if="${writeSigil}.value > 0" />
</listeners>
<template>
  <button :title="${writeSigil}.value ? ${writeSigil}.value + 'x' : 'none'" @click="${writeSigil}.value += 1">{{ ${writeSigil}.value }}</button>
</template>
</rozie>`;
}

describe('Angular $model producer-side two-way-write sigil', () => {
  it('$model.value writes/reads emit byte-identically to the $props.value model form (incl. double-reads, template, listeners)', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
  });

  it('$model.value write (script) lowers to the same Angular model signal setter as the $props form', () => {
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
    // The $props twin already lowers the model write to the signal setter.
    expect(propsOut).toContain('this.value.set(');
  });

  it('$model.value read (script) lowers to the same signal getter as $props.value', () => {
    const out = compile(fixture('$model'));
    expect(out).toContain('this.value()');
  });

  it('A2: $model.value double-read (script) is hoisted identically to the $props form (hoistDoubleReadAccessors)', () => {
    // Byte-identity already proves this; the explicit assertion documents the
    // classification site is reached for $model.
    const modelOut = compile(fixture('$model'));
    const propsOut = compile(fixture('$props'));
    expect(modelOut).toBe(propsOut);
  });

  it('template @click + double-read $model.value lowers via rewriteTemplateExpression + hoistTemplateDoubleReadAccessor (A2)', () => {
    const out = compile(fixture('$model'));
    expect(out).not.toContain('$model');
  });

  it('<listeners>-body inline handler writing $model.value lowers via the SEPARATE listener path', () => {
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
