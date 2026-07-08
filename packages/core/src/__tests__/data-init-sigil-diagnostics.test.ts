// Spike-012 R9 — ROZ208 DATA_INIT_SIGIL_NOT_LOWERED.
//
// A member-access `$`-sigil ($props/$data/$refs/$slots) inside a `<data>`
// INITIALIZER (`data: { count: $props.initial }` — the idiomatic Vue-port
// derived-initial pattern) is carried into the emit verbatim with no
// sigil-lowering pass, so it leaks a raw free identifier on ALL SIX targets
// (`useState($props.initial)` / `ref($props.initial)` / `signal($props.initial)`)
// → TS2304 + runtime ReferenceError, SILENTLY. Bare whole-object sigils are
// ROZ978's concern; this is the member-access complement it does not cover. The
// fix emits a loud ROZ208 steering the author to seed derived state in `$onMount`
// (the corpus idiom), which works on all six targets.
//
// Target-agnostic diagnostic (fires regardless of compile target), so a single
// target suffices. Mirrors data-nested-mutation-diagnostics.test.ts.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'react',
    filename: 'DataInitSigil.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

function rozie(dataBody: string, props = `{ initial: { type: Number, default: 0 } }`): string {
  return `<rozie name="DataInitSigil">
<props>
${props}
</props>
<data>
${dataBody}
</data>
<script lang="ts">
function noop(): void {}
</script>
<template>
<button @click="noop()">Go</button>
</template>
</rozie>
`;
}

function roz208(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.code === RozieErrorCode.DATA_INIT_SIGIL_NOT_LOWERED);
}

describe('data-init sigil diagnostics (Spike-012 R9 raw-sigil-leak in <data>)', () => {
  const FLAGGED: Array<[string, string]> = [
    ['$props member access', '{ count: $props.initial }'],
    ['$props in an expression', "{ label: $props.initial + 1 }"],
    ['$props in a ternary', "{ n: $props.initial > 0 ? $props.initial : 0 }"],
    ['$data self-reference', '{ a: 1, b: $data.a }'],
    ['$refs member access', '{ el: $refs.box }'],
    ['$slots member access', '{ s: $slots.header }'],
    ['computed $props member', "{ v: $props['initial'] }"],
    ['$props nested in an array literal', '{ list: [$props.initial] }'],
    ['$props nested in an object literal', '{ o: { x: $props.initial } }'],
    ['$props inside an arrow-valued field', '{ get: () => $props.initial }'],
  ];

  for (const [label, dataBody] of FLAGGED) {
    it(`flags ${label}`, () => {
      const hits = roz208(compileDiagnostics(rozie(dataBody)));
      expect(hits.length, `expected ≥1 ROZ208; got ${JSON.stringify(hits)}`).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.severity).toBe('error');
    });
  }

  it('fires once per offending sigil access (two accesses → two diagnostics)', () => {
    // `$props.initial > 0 ? $props.initial : 0` has two member accesses.
    const hits = roz208(compileDiagnostics(rozie("{ n: $props.initial > 0 ? $props.initial : 0 }")));
    expect(hits.length).toBe(2);
  });

  const CLEAN: Array<[string, string]> = [
    ['plain literal', '{ count: 0 }'],
    ['a sigil-free expression', '{ x: 1 + 2 * 3 }'],
    ['a TS-cast literal (no sigil)', '{ sel: null as number | null }'],
    ['a member access on a NON-sigil object', '{ x: Math.PI }'],
  ];

  for (const [label, dataBody] of CLEAN) {
    it(`does NOT flag ${label}`, () => {
      expect(roz208(compileDiagnostics(rozie(dataBody))).length, `unexpected ROZ208`).toBe(0);
    });
  }

  it('does NOT fire on a BARE whole-object $props (that is ROZ978, not ROZ208)', () => {
    // `{ p: $props }` — bare sigil, not a member access. ROZ208 must not claim it.
    const hits = roz208(compileDiagnostics(rozie('{ p: $props }')));
    expect(hits.length).toBe(0);
  });
});
