// Cross-target compile gate for the Phase 11 r-match feature probes.
//
// D-06 mandates SEPARATE fixtures so a regression in one (comma →
// `.includes()`, literal-bool drop, hoist counter collision, lost
// real-element host) is INDEPENDENTLY detectable. This file declares the
// MATCH_EXAMPLES array — kept separate from ENGINE_WRAPPERS / ENGINE_DEMOS
// in engine-examples.compile.test.ts — and compiles each probe across all
// six targets, mirroring that file's describe.each matrix.
//
// SEQUENCING (closed): per-target `TemplateMatch` emit delegates landed in
// plans 11-03/11-04 (Wave 2) and the hoist path in 11-05/11-06 (Wave 3). As
// of plan 11-07 (Wave 4) this whole matrix is GREEN — see the explicit R2
// completion gate at the bottom of this file.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');

const TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// The four r-match feature probes (D-06 — separate from the engine arrays).
//   - CommaAlternatives  — comma-alternative r-case (R3)
//   - PredicateChain     — literal-true predicate mode (R4)
//   - ExpensiveDiscriminant — CallExpression-hoist + nested match (R5)
//   - RealElementHost    — real-element host + multi-root <template r-case> (R8)
const MATCH_EXAMPLES = [
  'match/CommaAlternatives.rozie',
  'match/PredicateChain.rozie',
  'match/ExpensiveDiscriminant.rozie',
  'match/RealElementHost.rozie',
] as const;

describe('r-match feature probes — cross-target compile gate (R2/R10)', () => {
  describe.each(MATCH_EXAMPLES)('%s', (file) => {
    const path = resolve(EXAMPLES_DIR, file);
    const source = readFileSync(path, 'utf8');
    it.each(TARGETS)('compiles to %s with zero errors', (target) => {
      const result = compile(source, { target, filename: path });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  });
});

// Explicit R8 assertion block — independently-detectable coverage that the
// real-element host wrapper AND the <template r-case> multi-root branch
// survive emission, distinct from the generic zero-error compile check.
describe('r-match R8 — real-element host + multi-root branch survive emission', () => {
  const path = resolve(EXAMPLES_DIR, 'match/RealElementHost.rozie');
  const source = readFileSync(path, 'utf8');

  it.each(TARGETS)('retains the real-element host wrapper on %s', (target) => {
    const result = compile(source, { target, filename: path });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    // The `<div r-match="$data.status" class="status-host">` host is kept as
    // a rendered wrapper — its `status-host` class survives to every target's
    // emitted code (a <template r-match> host would NOT render a wrapper).
    expect(result.code).toContain('status-host');
  });

  it.each(TARGETS)('retains both multi-root branch children on %s', (target) => {
    const result = compile(source, { target, filename: path });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    // The `<template r-case="'loading'">` branch emits BOTH children with no
    // wrapper — the `status-label` span and the `status-bar` progress.
    expect(result.code).toContain('status-label');
    expect(result.code).toContain('status-bar');
  });

  // CR-01 — the `<template r-case="'loading'">` branch must emit its two
  // children with NO inert HTML `<template>` wrapper. Asserting the
  // `status-label`/`status-bar` substrings above is NOT sufficient: with the
  // CR-01 bug those substrings still appeared, trapped inside a dead
  // `<template>…</template>` element that 5/6 targets render but never
  // display. This block locks the rendered SHAPE: no `<template>` tag may
  // survive emission. Vue is exempt — Vue's `<template>` is the native
  // non-rendering group and legitimately appears in emitted Vue SFCs.
  const NON_VUE_TARGETS = TARGETS.filter((t) => t !== 'vue');
  it.each(NON_VUE_TARGETS)(
    'emits no inert <template> tag for the multi-root branch on %s',
    (target) => {
      const result = compile(source, { target, filename: path });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      // `/<template[\s>]/` matches an opening `<template>` or `<template …>`
      // tag — it must NOT appear in non-Vue emitted code.
      expect(result.code).not.toMatch(/<template[\s>]/);
    },
  );
});

// R11 dogfood anchor — `examples/demos/TableDemo.rozie`'s `#cell` slot was
// converted from an `r-if`/`r-else-if`/`r-else` ladder to `r-match` (D-08).
// TableDemo was previously in NO compile-matrix array (RESEARCH Open Question
// 3); this DOGFOOD block gives the motivating-example conversion a CI anchor.
// TableDemo imports `Table` via a <components> block, so compilation needs
// `resolverRoot: EXAMPLES_DIR` — exactly as the engine-examples VR_DEMOS block.
const DOGFOOD = ['demos/TableDemo.rozie'] as const;
describe('r-match R11 dogfood — TableDemo #cell slot uses r-match', () => {
  describe.each(DOGFOOD)('%s', (file) => {
    const path = resolve(EXAMPLES_DIR, file);
    const source = readFileSync(path, 'utf8');
    it.each(TARGETS)('compiles to %s with zero errors', (target) => {
      const result = compile(source, {
        target,
        filename: path,
        resolverRoot: EXAMPLES_DIR,
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// R2 COMPLETION GATE — Wave 4
//
// SPEC R2: a 3-branch match compiles with zero errors on all six targets.
// R2 could NOT be fully gated before Wave 4: the hoist-mode
// `ExpensiveDiscriminant` fixture stayed red on every target until the Wave 3
// hoist plans (11-05/11-06) merged. The earlier `describe.each(MATCH_EXAMPLES)`
// block above asserts the same matrix per-fixture; this block is the EXPLICIT,
// intentionally-named R2 checkpoint so a reader and the verifier can see R2 is
// gated and closed HERE — every `MATCH_EXAMPLES` fixture (CommaAlternatives,
// PredicateChain, ExpensiveDiscriminant including the hoist path, and
// RealElementHost) crossed with the full six-target `TARGETS` list, asserting
// zero error diagnostics AND non-empty emitted code.
// ───────────────────────────────────────────────────────────────────────────
describe('r-match R2 completion gate — full MATCH_EXAMPLES matrix, all six targets', () => {
  for (const file of MATCH_EXAMPLES) {
    const path = resolve(EXAMPLES_DIR, file);
    const source = readFileSync(path, 'utf8');
    it.each(TARGETS)(`R2: ${file} compiles error-free with non-empty code on %s`, (target) => {
      const result = compile(source, { target, filename: path });
      const errorDiagnostics = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errorDiagnostics).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  }
});
