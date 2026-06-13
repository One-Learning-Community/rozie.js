// Phase 45 Plan 45-06 (gap-closure WR-01) — core `validateClone` test.
//
// `$clone(value)` is the Phase 45 author-surface sigil that deep-clones a
// reactive object cross-target-safely: per-target lowering emits
// `structuredClone(toRaw(x))` (Vue), `$state.snapshot(x)` (Svelte), or bare
// `structuredClone(x)` (React/Solid/Angular/Lit). The lowering hard-codes the
// single-argument shape — anything else (wrong count OR a spread) cannot be
// mechanically interpreted and would emit a DANGLING `$clone` identifier
// (runtime ReferenceError, zero compile signal).
//
// This file tests the IR-side arity validator (D-01):
//   - ROZ136 CLONE_BAD_ARITY — arity != 1 OR the single arg is a SpreadElement.
//
// At most ONE diagnostic per call site. The validator runs in `lowerToIR` so the
// same chokepoint covers compile() and @rozie/unplugin entrypoints; target
// choice is irrelevant for these validator-side tests — vue is the simplest
// stable choice.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const CLONE_BAD_ARITY = RozieErrorCode.CLONE_BAD_ARITY; // ROZ136 — D-01

/**
 * Compile an inline `.rozie` source through the Vue target (any target works —
 * `validateClone` runs in `lowerToIR`, shared by all six) and return the
 * collected diagnostics. Wrapped so a thrown compile would surface as a test
 * failure (proves the validator never aborts lowering, D-08).
 */
function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'CloneValidation.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

/** A `.rozie` source with a single `$clone` call in `<script>` carrying the
 *  given argument-list expression text verbatim. */
function scriptProbe(argExpr: string): string {
  return `<rozie name="CloneValidation">

<data>
{ graph: { nodes: [] } }
</data>

<script>
$onMount(() => { const snap = $clone(${argExpr}); $data.graph = snap; })
</script>

<template>
<ul><li :data-n="$data.graph.nodes.length">x</li></ul>
</template>

</rozie>
`;
}

/** A `.rozie` source with a single `$clone` call in a TEMPLATE interpolation
 *  carrying the given argument-list expression text verbatim. */
function templateProbe(argExpr: string): string {
  return `<rozie name="CloneValidation">

<data>
{ graph: { nodes: [] } }
</data>

<template>
<ul><li>{{ $clone(${argExpr}) }}</li></ul>
</template>

</rozie>
`;
}

function cloneArityErrors(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter(
    (d) => d.code === CLONE_BAD_ARITY && d.severity === 'error',
  );
}

describe('validateClone [Phase 45]', () => {
  it('D-01 / ROZ136: zero args is a compile error', () => {
    const diags = compileDiagnostics(scriptProbe(''));
    expect(
      cloneArityErrors(diags),
      'expected a ROZ136 error for $clone()',
    ).toHaveLength(1);
  });

  it('D-01 / ROZ136: two args is a compile error', () => {
    const diags = compileDiagnostics(scriptProbe('$data.graph, {}'));
    expect(
      cloneArityErrors(diags),
      'expected a ROZ136 error for $clone(a, b)',
    ).toHaveLength(1);
  });

  it('D-01 / ROZ136: a spread argument is a compile error', () => {
    const diags = compileDiagnostics(scriptProbe('...[$data.graph]'));
    expect(
      cloneArityErrors(diags),
      'expected a ROZ136 error for $clone(...x)',
    ).toHaveLength(1);
  });

  it('valid: $clone(x) (single bare identifier) compiles with no $clone error', () => {
    const diags = compileDiagnostics(scriptProbe('x'));
    expect(
      cloneArityErrors(diags),
      'a valid unary $clone call must not error',
    ).toEqual([]);
  });

  it('valid: $clone($data.graph) (single member) compiles with no $clone error', () => {
    const diags = compileDiagnostics(scriptProbe('$data.graph'));
    expect(
      cloneArityErrors(diags),
      'a valid unary $clone($data.graph) must not error',
    ).toEqual([]);
  });

  it('D-01 / ROZ136: bad arity in a TEMPLATE expression is a compile error (proves template coverage)', () => {
    // Two member args (NOT an object literal `{}`, which the `{{ }}` matcher
    // mis-pairs into a ROZ051 unmatched-interpolation parse error before the
    // call ever reaches the validator).
    const diags = compileDiagnostics(templateProbe('$data.graph, $data.graph'));
    expect(
      cloneArityErrors(diags),
      'expected a ROZ136 error for {{ $clone(a, b) }} in template',
    ).toHaveLength(1);
  });

  it('D-08: a malformed $clone never throws during compile (diagnostics collected, not thrown)', () => {
    // Each of these compiles must return normally (diagnostics array), never
    // throw — the validator pushes ROZ136 and continues.
    expect(() => compileDiagnostics(scriptProbe(''))).not.toThrow();
    expect(() => compileDiagnostics(scriptProbe('a, b, c'))).not.toThrow();
    expect(() => compileDiagnostics(scriptProbe('...[a]'))).not.toThrow();
    expect(() => compileDiagnostics(templateProbe(''))).not.toThrow();
  });

  it('per-call: each $clone call emits at most ONE ROZ136', () => {
    const diags = compileDiagnostics(scriptProbe('a, b'));
    expect(cloneArityErrors(diags)).toHaveLength(1);
  });
});
