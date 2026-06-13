// computeExpressionDeps — STABLE_IDENTIFIERS dep-exclusion contract tests.
//
// WR-05 (Phase 45 code review) — `$clone` was added to STABLE_IDENTIFIERS in
// computeDeps.ts so the React/Solid dep collector never emits a bare `[$clone]`
// into a `useEffect` / `useMemo` dep array (the documented dangling-dep
// `ReferenceError` failure mode shared by `$snapshot` / `$classSelector` /
// `$restoreFocus`). The bare `$clone` identifier is matched by the `Identifier`
// visitor's STABLE_IDENTIFIERS skip BEFORE the CallExpression is rewritten away
// — load-bearing in a non-obvious way. This suite locks the contract so a
// future reorder of `$clone` lowering vs dep-compute cannot silently
// reintroduce the dangling-dep `ReferenceError`: assert that
// `computeExpressionDeps` over `$clone($data.x)` yields the `$data.x` data dep
// but NEVER a `closure::$clone` dep. Mirrors the assertion style in
// `semantic/validators/__tests__/cloneReservedSigil.test.ts`, placed here in
// the computeDeps suite per WR-05.
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { parse } from '../../parse.js';
import { collectAllDeclarations } from '../../semantic/bindings.js';
import { computeExpressionDeps } from '../computeDeps.js';

/**
 * Build a BindingsTable in which `x` is a known <data> field so that an
 * argument read of `$data.x` resolves to a `data` SignalRef.
 */
function dataXBindings() {
  const source = `<rozie name="CloneDepProbe">
<data>{ x: 0 }</data>
<template><div></div></template>
</rozie>`;
  const { ast } = parse(source, { filename: 'CloneDepProbe.rozie' });
  if (!ast) throw new Error('parse failed');
  return collectAllDeclarations(ast);
}

describe('computeExpressionDeps — STABLE_IDENTIFIERS exclusion', () => {
  it('$clone($data.x) tracks the $data.x argument read but NOT a bare $clone closure dep', () => {
    const bindings = dataXBindings();
    const expr = parseExpression('$clone($data.x)', { sourceType: 'module' });
    const deps = computeExpressionDeps(expr, bindings);

    // `$clone` is STABLE — it must NOT appear as a closure dependency. If a
    // future refactor moves `$clone` lowering EARLIER (so dep-compute runs on
    // un-lowered `$clone`) and this entry were dropped from STABLE_IDENTIFIERS,
    // the React/Solid emitter would push `[$clone]` into a dep array → runtime
    // `ReferenceError`. This assertion is the canary.
    const cloneClosure = deps.filter(
      (d) => d.scope === 'closure' && d.identifier === '$clone',
    );
    expect(
      cloneClosure,
      `$clone must be in STABLE_IDENTIFIERS so it never enters a dep array; got ${JSON.stringify(deps)}`,
    ).toEqual([]);

    // The ARGUMENT's reactive read IS still tracked — dep tracking happens on
    // the argument, not the sigil.
    const dataDep = deps.filter(
      (d) => d.scope === 'data' && d.path[0] === 'x',
    );
    expect(
      dataDep.length,
      `the $data.x argument read should still be tracked; got ${JSON.stringify(deps)}`,
    ).toBe(1);
  });

  it('a bare $clone call with a non-reactive argument yields ZERO deps (no dangling sigil)', () => {
    const bindings = dataXBindings();
    const expr = parseExpression('$clone(plainLocal)', { sourceType: 'module' });
    const deps = computeExpressionDeps(expr, bindings);

    // `$clone` itself is excluded; `plainLocal` is an unbound free identifier so
    // it surfaces as a closure dep, but `$clone` must NEVER appear.
    const cloneClosure = deps.filter(
      (d) => d.scope === 'closure' && d.identifier === '$clone',
    );
    expect(cloneClosure, JSON.stringify(deps)).toEqual([]);
  });
});
