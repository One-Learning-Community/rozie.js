// Phase 18 follow-up — inline model/data WRITES inside a <listeners> body.
//
// Pre-existing Angular-only gap: rewriteListenerExpression's read-rewrite
// traversal turned `$props.X` / `$data.X` into a `this.X()` signal GETTER call
// UNCONDITIONALLY, including when the member was an assignment LHS or update
// argument. With no AssignmentExpression / UpdateExpression visitor to
// intercept the WRITE shape, the LHS became `this.X()` and Babel rejected
// `this.X() = false` at emit:
//   "Property left of AssignmentExpression expected node to be of a type
//    [LVal,OptionalMemberExpression] but instead got CallExpression".
//
// This is NOT $model-specific — `$data` writes crashed identically. The fix
// ports rewriteScript.ts's buildAngularSetterCall + Assignment/Update visitors
// into the listener path so listener-body writes lower to the SAME signal
// setter the <script> path emits (`this.open.set(false)`,
// `this.n.set(this.n() + 1)`). The other 5 targets already handle this fine.

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../src/emitAngular.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'ListenerWrite.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitAngular(lowered.ir, {
    filename: 'ListenerWrite.rozie',
    source: src,
  });
  return result.code;
}

describe('Angular <listeners>-body inline WRITES lower to signal .set()', () => {
  it('inline model WRITE (@keydown.escape="$model.open = false") does not throw and emits this.open.set(false)', () => {
    const src = `<rozie name="ListenerModelWrite">
<props>
{
  open: { type: Boolean, default: false, model: true }
}
</props>
<listeners>
  <listener :target="document" @keydown.escape="$model.open = false" />
</listeners>
<template>
  <div>{{ $props.open }}</div>
</template>
</rozie>`;
    let out!: string;
    expect(() => { out = compile(src); }).not.toThrow();
    expect(out).toContain('this.open.set(false)');
    // No raw signal-getter LHS, no leftover sigils.
    expect(out).not.toContain('this.open() =');
    expect(out).not.toContain('$model');
    expect(out).not.toContain('$props.open');
  });

  it('inline data WRITE (@resize="$data.n = $data.n + 1") does not throw; RHS read still lowers to this.n()', () => {
    const src = `<rozie name="ListenerDataWrite">
<data>
{
  n: 0
}
</data>
<listeners>
  <listener :target="window" @resize="$data.n = $data.n + 1" />
</listeners>
<template>
  <div>{{ $data.n }}</div>
</template>
</rozie>`;
    let out!: string;
    expect(() => { out = compile(src); }).not.toThrow();
    expect(out).toContain('this.n.set(this.n() + 1)');
    expect(out).not.toContain('this.n() =');
    expect(out).not.toContain('$data.n');
  });

  it('inline data UPDATE (@resize="$data.n++") lowers to this.n.set(this.n() + 1)', () => {
    const src = `<rozie name="ListenerDataUpdate">
<data>
{
  n: 0
}
</data>
<listeners>
  <listener :target="window" @resize="$data.n++" />
</listeners>
<template>
  <div>{{ $data.n }}</div>
</template>
</rozie>`;
    let out!: string;
    expect(() => { out = compile(src); }).not.toThrow();
    expect(out).toContain('this.n.set(this.n() + 1)');
    expect(out).not.toContain('$data.n');
  });

  it('inline model UPDATE (@keydown="$model.count--") lowers to this.count.set(this.count() - 1)', () => {
    const src = `<rozie name="ListenerModelUpdate">
<props>
{
  count: { type: Number, default: 0, model: true }
}
</props>
<listeners>
  <listener :target="document" @keydown="$model.count--" />
</listeners>
<template>
  <div>{{ $props.count }}</div>
</template>
</rozie>`;
    let out!: string;
    expect(() => { out = compile(src); }).not.toThrow();
    expect(out).toContain('this.count.set(this.count() - 1)');
    expect(out).not.toContain('$model');
  });

  it('inline compound model WRITE (@keydown="$model.count += 2") lowers to this.count.set(this.count() + 2)', () => {
    const src = `<rozie name="ListenerModelCompound">
<props>
{
  count: { type: Number, default: 0, model: true }
}
</props>
<listeners>
  <listener :target="document" @keydown="$model.count += 2" />
</listeners>
<template>
  <div>{{ $props.count }}</div>
</template>
</rozie>`;
    let out!: string;
    expect(() => { out = compile(src); }).not.toThrow();
    expect(out).toContain('this.count.set(this.count() + 2)');
    expect(out).not.toContain('$model');
  });

  it('listener-body model READ (the previously-supported pattern) does NOT regress', () => {
    const src = `<rozie name="ListenerModelRead">
<props>
{
  open: { type: Boolean, default: false, model: true }
}
</props>
<listeners>
  <listener :target="document" @keydown="() => {}" r-if="$props.open" />
</listeners>
<template>
  <div>{{ $props.open }}</div>
</template>
</rozie>`;
    let out!: string;
    expect(() => { out = compile(src); }).not.toThrow();
    // Read still lowers to the signal getter inside the listener guard.
    expect(out).toContain('this.open()');
    expect(out).not.toContain('$props.open');
  });
});
