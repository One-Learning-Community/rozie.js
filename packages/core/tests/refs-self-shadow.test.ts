/**
 * Regression — cross-target `$refs` lowering (debug `refs-lowering-cross-target`).
 *
 * Finding 1 — `$refs` self-shadow TDZ: a local `const X = $refs.X` (X == a `ref=`
 *   name) must NOT lower to a self-referential `const X = X(.current)` on
 *   React/Svelte (a `ReferenceError: Cannot access 'X' before initialization`
 *   TDZ at runtime). React keeps non-model props as member access so only the
 *   `$refs` bare-`.current` read collides; Svelte bare-lowers refs the same way
 *   `$props` lowers, so both targets are exposed. The deconflict pre-pass renames
 *   the local to `X$local`. Vue/Solid/Lit suffix/qualify the ref accessor, so they
 *   never collide; Angular qualifies with `this.X()`, also safe.
 *
 * Finding 2 — Angular `$refs.<childComponent>` must resolve to the COMPONENT
 *   INSTANCE (`this.X()` from `viewChild<Type>('X')`), which carries the $expose
 *   methods — NOT the host `ElementRef` (`this.X()?.nativeElement`). A ref on a
 *   plain DOM element keeps the `ElementRef`/`.nativeElement` lowering.
 */
import { describe, it, expect } from 'vitest';
import { compile, type CompileTarget } from '../src/index.js';

// `flow` is a ref on a CHILD COMPONENT and the local `const flow` shadows it
// (F1 self-shadow + F2 component-instance). `boxEl` is a ref on a plain DOM
// element, also self-shadowed by a like-named local (F1 for DOM refs).
const SRC = `
<rozie name="ProbeRefs">
<components>{ Child: './Child.rozie' }</components>
<script>
const go = () => {
  const flow = $refs.flow
  const r = flow && flow.doThing ? flow.doThing() : null
  const boxEl = $refs.boxEl
  if (boxEl && boxEl.getBoundingClientRect) boxEl.getBoundingClientRect()
  return r
}
</script>
<template>
<div>
  <div ref="boxEl">box</div>
  <Child ref="flow" />
  <button @click="go">go</button>
</div>
</template>
</rozie>
`;

const TARGETS: CompileTarget[] = ['react', 'svelte', 'angular', 'vue', 'solid', 'lit'];

function compileOk(target: CompileTarget): string {
  const r = compile(SRC, { target, filename: 'ProbeRefs.rozie' });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  expect(errs, `${target} compile errors: ${JSON.stringify(errs)}`).toHaveLength(0);
  expect(r.code).not.toBe('');
  return r.code;
}

describe('refs self-shadow + component-ref lowering (refs-lowering-cross-target)', () => {
  it('all six targets compile without error', () => {
    for (const target of TARGETS) compileOk(target);
  });

  it('Finding 1: React does not self-shadow a ref local (no `const flow = flow.current`)', () => {
    const code = compileOk('react');
    // The buggy lowering: `const flow = flow.current` (TDZ). The fix renames the
    // local to `flow$local` so the bare `flow` resolves to the useRef binding.
    expect(code).not.toMatch(/const\s+flow\s*=\s*flow\.current/);
    expect(code).toMatch(/const\s+flow\$local\s*=\s*flow\.current/);
    // DOM-element ref self-shadow is fixed the same way.
    expect(code).not.toMatch(/const\s+boxEl\s*=\s*boxEl\.current/);
    expect(code).toMatch(/const\s+boxEl\$local\s*=\s*boxEl\.current/);
  });

  it('Finding 1: Svelte does not self-shadow a ref local (no `const flow = flow`)', () => {
    const code = compileOk('svelte');
    expect(code).not.toMatch(/const\s+flow\s*=\s*flow\s*;/);
    expect(code).toMatch(/const\s+flow\$local\s*=\s*flow\s*;/);
    expect(code).toMatch(/const\s+boxEl\$local\s*=\s*boxEl\s*;/);
  });

  it('Finding 1: Angular qualifies refs with `this.X()` so it never self-shadows', () => {
    // Angular is structurally immune to the F1 TDZ (the `this.` qualifier breaks
    // the shadow) — assert the local keeps its source name (no `$local` rename
    // needed) and the read is `this.flow()`-qualified.
    const code = compileOk('angular');
    expect(code).toMatch(/const\s+flow\s*=\s*this\.flow\(\)/);
  });

  it('control: Vue/Solid/Lit keep their suffixed/qualified ref accessors (no self-shadow)', () => {
    expect(compileOk('vue')).toMatch(/const\s+flow\s*=\s*flowRef\.value/);
    expect(compileOk('solid')).toMatch(/const\s+flow\s*=\s*flowRef\s*;/);
    expect(compileOk('lit')).toMatch(/const\s+flow\s*=\s*this\._refFlow/);
  });
});
