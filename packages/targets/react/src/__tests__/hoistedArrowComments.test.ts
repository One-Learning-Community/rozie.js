/**
 * Quick task 260830-fwb — comment fidelity through React's two comment-losing
 * hoists. The two halves below MUST ship together; each alone is a regression.
 *
 * HALF 1 — `tryHoistArrowToFunction` (`emit/emitScript.ts`) rebuilds a top-level
 * `const f = () => {…}` as a `FunctionDeclaration` so the binding hoists (a real
 * TDZ fix). It returned the bare synthetic node, which carries no `loc` and no
 * comments, so `@babel/generator` dropped every leading comment on it. Solid's
 * identically-named function has always ended with `t.inherits(fn, stmt)` and
 * loses none — it is the live oracle asserted at the bottom of this file.
 *
 * HALF 2 — `rewrite/hoistModuleLet.ts` removes a module-`let` that became a
 * `useRef`. Quick 260829-j18 re-homed that statement's LEADING comments onto a
 * survivor but deliberately skipped the TRAILING side, reasoning that a removed
 * statement's trailing comments are the same objects Babel attached as the next
 * statement's leading comments. That is true only for an inline-authored
 * `<script>`. At a `.rzts` splice boundary the spliced successor comes from a
 * DIFFERENT parse with no comments attached, so such a comment lives ONLY on the
 * removed `let` and dies with it.
 *
 * Shipping HALF 1 alone makes the inline host print a boundary comment the
 * partial-inlined host cannot, breaking `dist-parity`'s multi-boundary
 * "DataTable-shaped permanent guard" (verified: it goes red). HALF 2 closes it.
 * That guard, not this file, is the authoritative test for the splice case —
 * it needs real `.rzts` partials on disk.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';
import { emitSolid } from '../../../solid/src/emitSolid.js';

const DOC = 'Build the entry list from the row own enumerable keys.';
const SECOND = 'A null row yields an empty list.';

const SRC = `<rozie name="Probe">
<template><div>{{ entries().length }}</div></template>
<script lang="ts">
// ${DOC}
// ${SECOND}
const entries = () => {
  return [1, 2, 3]
}
</script>
</rozie>`;

// A module-`let` that React hoists to `useRef` (it is written inside $onMount),
// carrying a comment BELOW it that documents the following declaration.
const TRAILING_SRC = `<rozie name="TrailProbe">
<template><div>{{ tail(1) }}</div></template>
<script lang="ts">
let editTransition = 1;
// documents the declaration below, authored after the hoisted let
const tail = (n: number): number => n + editTransition;
$onMount(() => {
  editTransition = 2;
});
</script>
</rozie>`;

function lower(src: string, filename: string): IRComponent {
  const parsed = parse(src, { filename });
  if (!parsed.ast) throw new Error(`parse failed: ${JSON.stringify(parsed.diagnostics)}`);
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry(), filename });
  if (!lowered.ir) throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  return lowered.ir;
}

const react = (src: string, f = 'Probe.rozie'): string =>
  emitReact(lower(src, f), { filename: f, source: src, modifierRegistry: createDefaultRegistry() })
    .code;

const solid = (src: string, f = 'Probe.rozie'): string =>
  emitSolid(lower(src, f), { filename: f, source: src, modifierRegistry: createDefaultRegistry() })
    .code;

describe('React — comments survive the arrow-const → function hoist', () => {
  it('the hoist still happens (a FunctionDeclaration, not a const arrow)', () => {
    const code = react(SRC);
    expect(code).toContain('function entries()');
    expect(code).not.toContain('const entries = () =>');
  });

  it('keeps every leading comment on the hoisted declaration', () => {
    const code = react(SRC);
    expect(code).toContain(DOC);
    expect(code).toContain(SECOND);
  });

  it('keeps the comment attached to the declaration it documents', () => {
    const code = react(SRC);
    const comment = code.indexOf(DOC);
    const decl = code.indexOf('function entries()');
    expect(comment).toBeGreaterThan(-1);
    expect(decl).toBeGreaterThan(-1);
    expect(comment).toBeLessThan(decl);
    expect(code.slice(comment, decl)).not.toContain('function ');
  });

  it('does not duplicate the comment (the ledger oscillation class)', () => {
    const code = react(SRC);
    expect(code.split(DOC).length - 1).toBe(1);
    expect(code.split(SECOND).length - 1).toBe(1);
  });

  it('matches Solid, which performs the identical rebuild and keeps its comments', () => {
    for (const code of [solid(SRC), react(SRC)]) {
      expect(code).toContain('function entries()');
      expect(code).toContain(DOC);
      expect(code).toContain(SECOND);
    }
  });
});

describe('React — a hoisted module-let does not take the following comment with it', () => {
  it('keeps a comment authored below a `let` that is hoisted to useRef', () => {
    const code = react(TRAILING_SRC, 'TrailProbe.rozie');
    // The `let` really is hoisted away...
    expect(code).toContain('useRef');
    expect(code).not.toMatch(/^\s*let editTransition = 1;/m);
    // ...and the comment documenting the NEXT declaration survives, exactly once.
    expect(code).toContain('documents the declaration below');
    expect(code.split('documents the declaration below').length - 1).toBe(1);
  });

  it('parity: Solid keeps the same comment', () => {
    expect(solid(TRAILING_SRC, 'TrailProbe.rozie')).toContain('documents the declaration below');
  });
});
