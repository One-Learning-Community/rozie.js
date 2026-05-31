// Phase 18 Plan 18-01 — `$model.` producer-side two-way-write sigil semantics.
//
// Wave 0 fixtures driving SPEC Req 1/3/4/5 at the core layer:
//   - Req 1: `$model.x` reads resolve against the model-prop set and feed the
//     React/Solid dep collector exactly as `$props.x` (SignalRef scope 'props').
//   - Req 3: writing `$props.<modelProp>` (`=` and `++`) is a hard ROZ204 error
//     naming `$model.<x>` as the fix. ROZ200 stays for non-model writes.
//   - Req 4: `$model.<nonModelProp>` is a clean ROZ205 error naming the prop.
//   - Req 5: `$model.<nonExistent>` is a clean ROZ113 error.
//
// All invalid-fixture compiles return collected diagnostics, never throw (D-08).
// Exactly one diagnostic per offending site (no double-emit across validators).
//
// RED on registration (Task 1): codes exist but validators are not yet wired.
// GREEN across Tasks 2-3.
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import { parse } from '../src/parse.js';
import { analyzeAST } from '../src/semantic/analyze.js';
import { collectAllDeclarations } from '../src/semantic/bindings.js';
import { computeExpressionDeps } from '../src/reactivity/computeDeps.js';
import type { SignalRef } from '../src/reactivity/signalRef.js';

function analyzeSource(source: string, filename = 'test.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return { src: source, ast, parseDiags, ...analyzeAST(ast) };
}

function filterByCode(diags: { code: string }[], code: string) {
  return diags.filter((d) => d.code === code);
}

describe('$model sigil — Req 3 ($props.<modelProp> write = ROZ204)', () => {
  it('`$props.open = false` where open is model → exactly 1 ROZ204 naming $model.open', () => {
    const src = `<rozie name="Modal">
<props>{ open: { type: Boolean, default: false, model: true } }</props>
<script>
const close = () => { $props.open = false }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src, 'Modal.rozie');
    const roz204 = filterByCode(diagnostics, 'ROZ204');
    expect(roz204.length).toBe(1);
    const d = roz204[0]!;
    expect(d.severity).toBe('error');
    expect(d.message).toContain('$model.open');
    // No double-emit: a model $props write must NOT also trip ROZ200.
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
    // Accurate byte-offset loc + related decl pointer.
    expect(d.loc.start).toBeGreaterThan(0);
    expect(d.loc.end).toBeGreaterThan(d.loc.start);
    expect(d.related).toBeDefined();
    expect(d.related!.length).toBe(1);
    expect(d.related![0]!.loc.start).toBeGreaterThan(0);
  });

  it('`$props.count++` where count is model → exactly 1 ROZ204', () => {
    const src = `<rozie name="Counter">
<props>{ count: { type: Number, default: 0, model: true } }</props>
<script>
const inc = () => { $props.count++ }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src, 'Counter.rozie');
    expect(filterByCode(diagnostics, 'ROZ204').length).toBe(1);
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });

  it('non-model `$props.step = 1` still emits ROZ200, NOT ROZ204', () => {
    const src = `<rozie name="X">
<props>{ step: { type: Number, default: 1 } }</props>
<script>
const f = () => { $props.step = 1 }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ200').length).toBe(1);
    expect(filterByCode(diagnostics, 'ROZ204')).toEqual([]);
  });

  // WR-01: the single overlap case. A CONSUMED model update (`const y =
  // $props.count++`) is two genuinely distinct authoring mistakes — an illegal
  // `$props` model-write (ROZ204) AND consuming an update-expression value
  // (ROZ203). Both legitimately fire; this is NOT a double-emit of one error.
  // Statement-context writes (above) stay exactly-one-ROZ204 (SPEC Req 3).
  it('consumed `const y = $props.count++` (model) co-emits ROZ204 + ROZ203', () => {
    const src = `<rozie name="Counter">
<props>{ count: { type: Number, default: 0, model: true } }</props>
<script>
const f = () => { const y = $props.count++; return y }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src, 'Counter.rozie');
    expect(filterByCode(diagnostics, 'ROZ204').length).toBe(1);
    expect(filterByCode(diagnostics, 'ROZ203').length).toBe(1);
    // Still no ROZ200 — count is a model prop.
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });
});

describe('$model sigil — Req 4 ($model.<nonModelProp> = ROZ205)', () => {
  it('`$model.step` where step lacks model: true → exactly 1 ROZ205 naming step', () => {
    const src = `<rozie name="X">
<props>{ step: { type: Number, default: 1 } }</props>
<script>
const f = () => { const x = $model.step }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz205 = filterByCode(diagnostics, 'ROZ205');
    expect(roz205.length).toBe(1);
    expect(roz205[0]!.severity).toBe('error');
    expect(roz205[0]!.message).toContain('step');
    // Must not leak through as an unknown-ref ROZ113 (it IS a declared prop).
    expect(filterByCode(diagnostics, 'ROZ113')).toEqual([]);
  });
});

describe('$model sigil — Req 5 ($model.<nonExistent> = ROZ113)', () => {
  it('`$model.bogus` (undeclared) → exactly 1 ROZ113', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0, model: true } }</props>
<script>
const f = () => { const x = $model.bogus }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz113 = filterByCode(diagnostics, 'ROZ113');
    expect(roz113.length).toBe(1);
    expect(roz113[0]!.severity).toBe('error');
    expect(filterByCode(diagnostics, 'ROZ205')).toEqual([]);
  });
});

describe('$model sigil — Req 1 (read dep semantics === $props)', () => {
  it('`$model.value` read produces a SignalRef with scope props, path [value]', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0, model: true } }</props>
<script></script>
</rozie>`;
    const { ast } = parse(src, { filename: 'X.rozie' });
    const bindings = collectAllDeclarations(ast!);
    const modelExpr = parseExpression('$model.value') as t.Expression;
    const propsExpr = parseExpression('$props.value') as t.Expression;
    const modelDeps: SignalRef[] = computeExpressionDeps(modelExpr, bindings);
    const propsDeps: SignalRef[] = computeExpressionDeps(propsExpr, bindings);
    // Byte-identical dep to `$props.value`: scope 'props', path ['value'].
    expect(modelDeps).toEqual(propsDeps);
    expect(modelDeps.length).toBe(1);
    const ref = modelDeps[0]!;
    expect(ref.scope).toBe('props');
    expect('path' in ref ? ref.path : undefined).toEqual(['value']);
  });

  it('a component reading `$model.value` (model) compiles with zero diagnostics', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0, model: true } }</props>
<script>
const doubled = () => $model.value * 2
</script>
<template><div>{{ value }}</div></template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
});

describe('$model sigil — D-08 (never throws)', () => {
  it('each invalid-fixture compile returns collected diagnostics, never throws', () => {
    const inputs = [
      `<rozie name="A"><props>{ open: { type: Boolean, model: true } }</props><script>const f = () => { $props.open = false }</script></rozie>`,
      `<rozie name="B"><props>{ step: { type: Number } }</props><script>const f = () => { const x = $model.step }</script></rozie>`,
      `<rozie name="C"><props>{ v: { type: Number, model: true } }</props><script>const f = () => { const x = $model.bogus }</script></rozie>`,
    ];
    for (const src of inputs) {
      const { ast } = parse(src, { filename: 'edge.rozie' });
      expect(ast).not.toBeNull();
      expect(() => analyzeAST(ast!)).not.toThrow();
    }
  });
});
