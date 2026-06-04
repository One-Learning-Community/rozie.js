// safeInterpolation.test.ts — Phase 26 Plan 06 (D-15 opt-out byte-identity).
//
// Mirrors the cva.test.ts test-shape precedent: compile a fixture with the
// option toggled and assert the emit shape. Here the toggle is the GLOBAL
// `safeInterpolation` opt-out (D-11) and the per-component
// `<rozie safe-interpolation="…">` envelope override (D-12).
//
// What this proves (D-13/D-15):
//   - safeInterpolation:false → raw per-target emit on the five non-Vue
//     targets: NO `rozieDisplay` import/wrap (react/solid/svelte/lit) and NO
//     inlined `__rozieDisplay` / delegating class method (angular).
//   - the option OMITTED (default ON) → the wrap IS present (default-ON proven).
//   - precedence (D-12): a `<rozie safe-interpolation="true">` envelope under a
//     GLOBAL safeInterpolation:false still WRAPS (force-ON > global); a
//     `<rozie safe-interpolation="false">` envelope under the global default-ON
//     does NOT wrap (force-OFF > default).
//
// NOT asserted here: ROZ978 (the bare-sigil rejection diagnostic) is always-on
// and independent of safeInterpolation (D-14) — out of scope for this file.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { compile, type CompileTarget } from '../compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// examples/ObjectInterp.rozie is the D-08 dedicated object-interpolation
// fixture: an untyped <data> object interpolated in a text node, a :data-x
// attribute binding, and a class interpolation — so the D-06/D-07 gate WRAPs
// all three positions when safeInterpolation is on.
const OBJECT_INTERP = resolve(__dirname, '../../../../examples/ObjectInterp.rozie');

// The five targets that receive the `rozieDisplay` wrap. Vue is deliberately
// excluded — its native toDisplayString already JSON-prints plain objects, so
// it is never wrapped (and the flag is a no-op there).
const NON_VUE_TARGETS: readonly CompileTarget[] = [
  'react',
  'solid',
  'svelte',
  'lit',
  'angular',
];

// Any reference to the helper — the named import/free-call form (`rozieDisplay`)
// on react/solid/svelte/lit, or the inlined/delegating form (`__rozieDisplay`)
// on angular. Both contain the substring `rozieDisplay`, so a single regex
// detects "wrap present" across all five targets.
const WRAP_RE = /rozieDisplay/;

function compileFor(
  src: string,
  target: CompileTarget,
  safeInterpolation?: boolean,
): string {
  const result = compile(src, {
    target,
    filename: 'ObjectInterp.rozie',
    ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
  });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `compile(${target}) emitted errors: ${errors.map((d) => d.code).join(', ')}`,
    );
  }
  return result.code;
}

const objectInterpSrc = readFileSync(OBJECT_INTERP, 'utf8');

// ---------------------------------------------------------------------------
// D-15 — opt-out reverts to raw per-target emit (no wrap) on all 5 non-Vue.
// ---------------------------------------------------------------------------
describe('safeInterpolation:false — raw per-target emit (D-13/D-15)', () => {
  for (const target of NON_VUE_TARGETS) {
    it(`${target}: emits NO rozieDisplay wrap when safeInterpolation:false`, () => {
      const off = compileFor(objectInterpSrc, target, false);
      expect(off).not.toMatch(WRAP_RE);
    });
  }
});

// ---------------------------------------------------------------------------
// default-ON — omitting the option wraps (proves the wrap IS the default).
// ---------------------------------------------------------------------------
describe('safeInterpolation omitted — default-ON wraps (D-11)', () => {
  for (const target of NON_VUE_TARGETS) {
    it(`${target}: emits the rozieDisplay wrap when the option is omitted`, () => {
      const on = compileFor(objectInterpSrc, target);
      expect(on).toMatch(WRAP_RE);
    });
  }

  it('omitting the option is byte-identical to passing safeInterpolation:true', () => {
    // The conditional-spread contract: omission must thread NOTHING, and the
    // lowerer default (`?? true`) must equal an explicit true. Byte-identical.
    for (const target of NON_VUE_TARGETS) {
      const omitted = compileFor(objectInterpSrc, target);
      const explicitTrue = compileFor(objectInterpSrc, target, true);
      expect(omitted).toBe(explicitTrue);
    }
  });
});

// ---------------------------------------------------------------------------
// Precedence (D-12) — envelope attr > global option > default true.
// ---------------------------------------------------------------------------

// Same object-interpolation body as the fixture, but with an explicit
// `safe-interpolation` envelope attribute so we can exercise the override.
function envelopeSrc(attr: string): string {
  return `<rozie name="ObjectInterp" ${attr}>
<data>
{
  obj: { a: 1, b: [2, 3] },
}
</data>
<template>
<div class="object-interp">
  <p class="card--{{ $data.obj }}" :data-x="$data.obj">{{ $data.obj }}</p>
</div>
</template>
</rozie>`;
}

describe('safe-interpolation envelope precedence (D-12)', () => {
  for (const target of NON_VUE_TARGETS) {
    it(`${target}: envelope safe-interpolation="true" FORCES ON under global :false`, () => {
      // Global says off, the per-component envelope says on → wrap wins (force-ON).
      const src = envelopeSrc('safe-interpolation="true"');
      const code = compileFor(src, target, false);
      expect(code).toMatch(WRAP_RE);
    });

    it(`${target}: envelope safe-interpolation="false" FORCES OFF under global default-ON`, () => {
      // Global default is on, the per-component envelope says off → no wrap (force-OFF).
      const src = envelopeSrc('safe-interpolation="false"');
      const code = compileFor(src, target); // option omitted → global default ON
      expect(code).not.toMatch(WRAP_RE);
    });

    it(`${target}: envelope safe-interpolation="FALSE" (case-insensitive, WR-05) FORCES OFF`, () => {
      const src = envelopeSrc('safe-interpolation="FALSE"');
      const code = compileFor(src, target);
      expect(code).not.toMatch(WRAP_RE);
    });
  }
});
