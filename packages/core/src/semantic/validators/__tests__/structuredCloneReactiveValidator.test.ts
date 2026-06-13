// Phase 45 Plan 45-01 Task 2 — ROZ135 structuredClone(<reactive>) → $clone
// advisory validator (D-02).
//
// `structuredClone(x)` THROWS on a Vue reactive()/Svelte $state proxy — a
// silent, target-asymmetric footgun. ROZ135 (warning severity) fires when the
// argument is a member rooted at $props/$data/$model, steering the author to
// the new `$clone(x)` sigil. Conservative SYNTACTIC match: no dep-graph
// analysis → zero false positives (a legitimate structuredClone(plainLocal)
// still compiles clean). The validator NEVER throws on malformed input (D-08).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import { runStructuredCloneReactiveValidator } from '../structuredCloneReactiveValidator.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'clone.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function analyzeSource(source: string, filename = 'clone.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

const roz135 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.STRUCTURED_CLONE_REACTIVE);

describe('structuredCloneReactiveValidator — ROZ135 (Phase 45 D-02)', () => {
  it('fires warning on structuredClone($data.graph) in <script>', () => {
    const src = `<rozie name="X">
<data>{ graph: {} }</data>
<script>
$onMount(() => {
  const c = structuredClone($data.graph)
})
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.code).toBe('ROZ135');
    expect(hits[0]!.message).toContain('$clone');
    // IN-03 — the message names the resolved member path, not a bare ellipsis.
    expect(hits[0]!.message).toContain('structuredClone($data.graph)');
    // loc points at the call (non-zero, plausible offset).
    expect(hits[0]!.loc.start).toBeGreaterThan(0);
  });

  it('fires on structuredClone($props.x.y) (nested member root unwinds)', () => {
    const src = `<rozie name="X">
<props>{ x: { type: Object } }</props>
<script>
$onMount(() => {
  const c = structuredClone($props.x.y)
})
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('$props');
    // IN-03 — the full nested member path is rendered, not `$props.…`.
    expect(hits[0]!.message).toContain('structuredClone($props.x.y)');
  });

  it('falls back to the `<root>.…` form when the member is a computed access (IN-03 defensive)', () => {
    const src = `<rozie name="X">
<data>{ x: {}, k: 'graph' }</data>
<script>
$onMount(() => {
  const c = structuredClone($data[$data.k])
})
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    // A computed access can't render a precise dotted path → fall back to the
    // bare ellipsis form (never throws, D-08).
    expect(hits[0]!.message).toContain('structuredClone($data.…)');
  });

  it('fires on structuredClone($model.z)', () => {
    const src = `<rozie name="X">
<props>{ z: { type: Object, model: true } }</props>
<script>
$onMount(() => {
  $model.z = structuredClone($model.z)
})
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('$model');
    // IN-03 — names the member, not `$model.…`.
    expect(hits[0]!.message).toContain('structuredClone($model.z)');
  });

  it('does NOT fire on structuredClone(plainLocal) — zero false positives', () => {
    const src = `<rozie name="X">
<script>
$onMount(() => {
  const plainLocal = { a: 1 }
  const c = structuredClone(plainLocal)
})
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('fires on structuredClone($data.x) inside a <template> interpolation', () => {
    const src = `<rozie name="X">
<data>{ x: {} }</data>
<template>
<div>{{ structuredClone($data.x) }}</div>
</template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.loc.start).toBeGreaterThan(0);
  });

  it('fires on structuredClone($data.x) inside a :binding attribute expression', () => {
    const src = `<rozie name="X">
<data>{ x: {} }</data>
<template>
<div :data-snap="structuredClone($data.x)"></div>
</template>
</rozie>`;
    const hits = roz135(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
  });

  it('never throws on a malformed template fragment (D-08)', () => {
    const ast: RozieAST = parseOrThrow(`<rozie name="X">
<data>{ x: {} }</data>
<template>
<div :data-snap="structuredClone($data.x"></div>
</template>
</rozie>`);
    const diagnostics: Diagnostic[] = [];
    expect(() =>
      runStructuredCloneReactiveValidator(ast, diagnostics),
    ).not.toThrow();
  });
});
