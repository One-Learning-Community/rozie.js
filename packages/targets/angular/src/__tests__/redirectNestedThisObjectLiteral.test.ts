/**
 * Quick task 260830-cfi — `redirectNestedThis` object-literal `this` gap.
 *
 * The class emitters lower promoted top-level bindings to `this.<name>`, and
 * `redirectNestedThis` repairs every `this` that would rebind by redirecting it
 * to a `const __rozieSelf = this;` alias. Its early-return
 *
 *   if (!na || !na.getFunctionParent()) return;
 *
 * assumed that ANY top-level non-arrow function is a promoted class method whose
 * `this` is the component. That is false for a non-arrow function that is a
 * MEMBER OF AN OBJECT LITERAL: a top-level `const api = { ... }` becomes a class
 * FIELD, so `api`'s methods are "top-level" by that test, yet their `this` is
 * `api` — not the component. The write lands on `api.<name>` and the component
 * never updates: silent, zero-diagnostic, and only on the 2 class targets
 * (React/Vue/Svelte/Solid close over the binding instead).
 *
 * Shapes S1/S3/S4/S6 below are the gap. S2 and S5 are the forms that were
 * already correct and are locked here as regression guards — S2 in particular is
 * the proof the fix relies on: an ARROW member of a class-field initializer
 * object already resolves `this` to the instance, which is why the fix can host
 * the alias in an arrow IIFE around that initializer.
 *
 * Mirrored byte-identically (in logic) in the Lit target, matching the
 * `redirectNestedThis.ts` / `scopeAwareSkip.ts` mirroring convention.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

const TARGET = 'angular' as const;

/**
 * Drives the REAL emitter entrypoint from SOURCE (parse -> lowerToIR -> emitAngular).
 * `compile()` from `@rozie/core` resolves to the BUILT dist, which inlines a
 * snapshot of the target emitters — it cannot see an in-tree emitter edit.
 */
function emit(script: string): string {
  const source = `<rozie name="Probe">
<template><div>{{ tally }}</div></template>
<script lang="ts">
let tally = 'idle'
${script}
$onMount(() => { go() })
</script>
</rozie>`;
  const parsed = parse(source, { filename: 'Probe.rozie' });
  if (!parsed.ast) throw new Error(`parse failed: ${JSON.stringify(parsed.diagnostics)}`);
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  const errors = [...parsed.diagnostics, ...lowered.diagnostics].filter(
    (d) => d.severity === 'error',
  );
  expect(errors.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
  return emitAngular(lowered.ir, { filename: 'Probe.rozie' }).code;
}

describe(`${TARGET} — redirectNestedThis across object-literal members`, () => {
  it('S1 object METHOD with a nested arrow callback redirects to __rozieSelf', () => {
    const out = emit(`
const api = { load() { Promise.resolve(1).then(() => { tally = 'a' }) } }
function go() { api.load() }`);
    expect(out).toContain('const __rozieSelf = this;');
    expect(out).toContain("__rozieSelf.tally = 'a'");
    expect(out).not.toContain("this.tally = 'a'");
  });

  it('S3 object METHOD writing directly redirects to __rozieSelf', () => {
    const out = emit(`
const api = { load() { tally = 'c' } }
function go() { api.load() }`);
    expect(out).toContain('const __rozieSelf = this;');
    expect(out).toContain("__rozieSelf.tally = 'c'");
    expect(out).not.toContain("this.tally = 'c'");
  });

  it('S4 object GETTER redirects to __rozieSelf', () => {
    const out = emit(`
const api = { get cur() { return tally } }
function go() { tally = api.cur }`);
    expect(out).toContain('const __rozieSelf = this;');
    expect(out).toContain('return __rozieSelf.tally');
    expect(out).not.toMatch(/get cur\(\)\s*\{\s*return this\.tally/);
  });

  it('S6 object FUNCTION-EXPRESSION property redirects to __rozieSelf', () => {
    const out = emit(`
const api = { load: function () { tally = 'f' } }
function go() { api.load() }`);
    expect(out).toContain('const __rozieSelf = this;');
    expect(out).toContain("__rozieSelf.tally = 'f'");
    expect(out).not.toContain("this.tally = 'f'");
  });

  it('S7 a $provide payload getter is left to emitContext.bindProvidedValue', () => {
    // `bindProvidedValue` wraps the payload in a host-capturing IIFE and keys its
    // reactivity bridge on finding the raw `this`. Redirecting it here would
    // silently drop that bridge, so this pass must not touch provide payloads.
    const out = emit(`
function cycle() { tally = tally === 'a' ? 'b' : 'a' }
$provide('theme', { get cur() { return tally }, cycle })`);
    expect(out).not.toContain('__rozieSelf');
    expect(out).toContain('__rozieCtxHost');
  });
  // ── Regression locks: the two shapes that were already correct ───────────────

  it('S2 object ARROW property keeps plain `this` and gains no alias', () => {
    const out = emit(`
const api = { load: () => { Promise.resolve(1).then(() => { tally = 'b' }) } }
function go() { api.load() }`);
    // An arrow member of a class-field initializer already sees the instance.
    expect(out).toContain("this.tally = 'b'");
    expect(out).not.toContain('__rozieSelf');
  });

  it('S5 nested plain function still redirects to __rozieSelf', () => {
    const out = emit(`
function go() { function inner() { tally = 'e' } inner() }`);
    expect(out).toContain('const __rozieSelf = this;');
    expect(out).toContain("__rozieSelf.tally = 'e'");
  });
});
