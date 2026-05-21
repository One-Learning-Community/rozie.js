// Cross-target compile gate for the Phase 11 r-match feature probes.
//
// D-06 mandates SEPARATE fixtures so a regression in one (comma →
// `.includes()`, literal-bool drop, hoist counter collision, lost
// real-element host) is INDEPENDENTLY detectable. This file declares the
// MATCH_EXAMPLES array — kept separate from ENGINE_WRAPPERS / ENGINE_DEMOS
// in engine-examples.compile.test.ts — and compiles each probe across all
// six targets, mirroring that file's describe.each matrix.
//
// SEQUENCING NOTE: per-target `TemplateMatch` emit delegates land in plans
// 11-03/11-04 (Wave 2). Until then this MATCH_EXAMPLES matrix is EXPECTED to
// be partially red — the test file is syntactically valid and discoverable
// now (11-02-PLAN.md verification §). The orchestrator does not block plan
// 11-02 on this matrix being fully green.
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
});
