// Item 1 (pure-literal component-prop hoist) — the Lit emitter hoists an inline
// Array/Object literal bound to a CHILD component prop to a per-instance,
// render-stable class field (`private _rozieLit0 = [...]`) and binds the field
// (`.prop=${this._rozieLit0}`), so lit-html dedups the binding by reference.
//
// Without this, `.prop=${[-77, 37.5]}` re-evaluates a fresh array each render;
// a `model:true` child's `Object.is` change guard then re-dispatches every pass
// → SignalWatcher re-entrancy → infinite render loop (the MapLibre-lit class).
//
// Scope: ONLY Array/Object literals on a component/self prop. Primitive literals
// (lit-html value-dedups them), identifiers/member/call expressions (reactive),
// and plain-element attributes are left inline. No-op on the other 5 targets.
import { describe, it, expect } from 'vitest';
import { compile } from '../index.js';

const SRC = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<script>const reactiveArr = [1, 2]</script>
<template>
  <Child
    :center="[-77, 37.5]"
    :nested="{ a: [1, 2], b: 'x' }"
    :zoom="4"
    :reactive="reactiveArr"
  />
</template>
</rozie>
`;

describe('Lit pure-literal component-prop hoist (Item 1)', () => {
  it('hoists Array + Object literals to per-instance fields; leaves primitives/identifiers inline', async () => {
    const out = await compile(SRC, { target: 'lit', filename: 'Parent.rozie' });
    // The two pure literals are hoisted to deterministic per-instance fields.
    expect(out.code).toContain('private _rozieLit0 = [-77, 37.5];');
    expect(out.code).toContain("private _rozieLit1 = { a: [1, 2], b: 'x' };");
    // …and the bindings reference the fields (reference-stable → lit-html dedups).
    expect(out.code).toContain('.center=${this._rozieLit0}');
    expect(out.code).toContain('.nested=${this._rozieLit1}');
    // A bare primitive literal is NOT hoisted (lit-html value-dedups it).
    expect(out.code).toContain('.zoom=${4}');
    // An identifier expression is NOT hoisted (it is reactive — must re-eval).
    expect(out.code).toContain('.reactive=${this.reactiveArr}');
    expect(out.code).not.toContain('_rozieLit2');
  });

  it('does NOT hoist on the other 5 targets (no _rozieLit fields)', async () => {
    for (const target of ['react', 'vue', 'svelte', 'angular', 'solid'] as const) {
      const out = await compile(SRC, { target, filename: 'Parent.rozie' });
      expect(out.code, `${target} should not hoist`).not.toContain('_rozieLit');
    }
  });
});
