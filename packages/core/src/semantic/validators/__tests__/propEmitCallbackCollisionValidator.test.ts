// Quick 260807-2qn (Task 1) — ROZ148 prop/emit callback-name collision
// validator.
//
// React and Solid both synthesize an `on<Pascal>(...)` callback field on the
// generated props interface for every declared `$emit`. If the author ALSO
// declares a `<props>` key that is EXACTLY that synthesized name, both fields
// land on the SAME props interface with different types — a hard TS2300
// duplicate-identifier break on every strict-TS consumer, on two of six
// targets, with no typecheck net at author time. Mirrors the ROZ127
// slot/prop collision precedent (dual-frame shape) but with a loc-less-emit
// message-only secondary reference, per D-04 (emits carry no sourceLoc).
//
// This is the RED-FIRST test (D-06): `runPropEmitCallbackCollisionValidator`
// and `RozieErrorCode.PROP_EMIT_CALLBACK_NAME_COLLISION` do not exist yet, so
// this file's import + the analyzeAST/compile() wiring fail until Task 1
// implements them. Each case pins the exact ROZ148 code, severity, loc, and
// message content, plus zero-false-positive guards including the
// deliberately-out-of-scope model-companion axis (D-05).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'propemit.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function analyzeSource(source: string, filename = 'propemit.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

function compileDiags(source: string, filename = 'propemit.rozie'): Diagnostic[] {
  return compile(source, { target: 'react', filename }).diagnostics ?? [];
}

const roz148 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.PROP_EMIT_CALLBACK_NAME_COLLISION);

/**
 * Builds a component whose <script> declares one $emit call (referenced from
 * the template so the parser's emit-discovery walk picks it up) and whose
 * <props> block carries the given body verbatim.
 */
function component(propsBody: string, emitName: string): string {
  return `<rozie name="X">
<props>{ ${propsBody} }</props>
<script>
function fire() { $emit('${emitName}') }
</script>
<template><div @click="fire"></div></template>
</rozie>`;
}

describe('propEmitCallbackCollisionValidator — ROZ148 prop/emit callback-name collision (Quick 260807-2qn)', () => {
  it('fires exactly ONE error when prop `onFoo` collides with declared emit `foo`', () => {
    const hits = roz148(analyzeSource(component('onFoo: { type: Function }', 'foo')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.code).toBe('ROZ148');
  });

  it('the loc equals the colliding prop declaration\'s sourceLoc, and the message names prop/emit/synthesized field', () => {
    const hits = roz148(analyzeSource(component('onFoo: { type: Function }', 'foo')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    const hit = hits[0]!;
    expect(hit.loc.start).toBeGreaterThan(0);
    expect(hit.message).toContain('onFoo');
    expect(hit.message).toContain('foo');
    expect(hit.hint, JSON.stringify(hit)).toBeTruthy();
  });

  it('normalizes a kebab-case emit `my-event` to collide with prop `onMyEvent`', () => {
    const hits = roz148(analyzeSource(component('onMyEvent: { type: Function }', 'my-event')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('onMyEvent');
  });

  it('normalizes a snake_case emit `my_event` to collide with prop `onMyEvent`', () => {
    const hits = roz148(analyzeSource(component('onMyEvent: { type: Function }', 'my_event')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('onMyEvent');
  });

  it('is case-sensitive: emit `foo` does NOT collide with prop `onfoo`', () => {
    const hits = roz148(analyzeSource(component('onfoo: { type: Function }', 'foo')));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire when prop `onFoo` exists with NO emits', () => {
    const src = `<rozie name="X">
<props>{ onFoo: { type: Function } }</props>
<template><div></div></template>
</rozie>`;
    expect(roz148(analyzeSource(src)).length).toBe(0);
  });

  it('does NOT fire when emit `foo` exists with no `on`-prefixed prop', () => {
    const src = `<rozie name="X">
<script>
function fire() { $emit('foo') }
</script>
<template><div @click="fire"></div></template>
</rozie>`;
    expect(roz148(analyzeSource(src)).length).toBe(0);
  });

  it('does NOT fire on the model-companion axis (D-05, deliberately out of scope): `defaultX`/`onXChange` beside a model prop `x`', () => {
    const src = `<rozie name="X">
<props>{
  x: { type: String, model: true },
  defaultX: { type: String },
  onXChange: { type: Function }
}</props>
<template><div></div></template>
</rozie>`;
    expect(roz148(analyzeSource(src)).length, 'ROZ148 must not widen to the model-companion axis in this task').toBe(0);
  });

  it('surfaces through the public compile() entrypoint, not only a direct analyzeAST() call', () => {
    const hits = roz148(compileDiags(component('onFoo: { type: Function }', 'foo')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });
});
