// Spike-012 R9 — ROZ208 DATA_INIT_SIGIL_NOT_LOWERED.
// SCOPED DOWN by quick 260717-uvl: `$props`/`$data` member reads in a `<data>`
// INITIALIZER (`data: { count: $props.initial }` — the idiomatic Vue-port
// derived-initial pattern) are now sigil-lowered per target (routed through
// each target's existing rewriteTemplateExpression) and no longer flag.
// `$refs`/`$slots` remain flagged — neither is meaningful at `<data>`-
// initializer time (nothing has mounted yet), so a `$refs.x`/`$slots.x`
// member access in a `<data>` initializer is still a loud ROZ208 steering the
// author to seed from `$refs`/`$slots` in `$onMount` instead. Bare
// whole-object sigils are ROZ978's concern; this is the member-access
// complement it does not cover.
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

describe('data-init sigil diagnostics (Spike-012 R9, scoped to $refs/$slots by 260717-uvl)', () => {
  const FLAGGED: Array<[string, string]> = [
    ['$refs member access', '{ el: $refs.box }'],
    ['$slots member access', '{ s: $slots.header }'],
    ['$refs nested in an array literal', '{ list: [$refs.box] }'],
    ['$refs nested in an object literal', '{ o: { x: $refs.box } }'],
    ['$refs inside an arrow-valued field', '{ get: () => $refs.box }'],
  ];

  for (const [label, dataBody] of FLAGGED) {
    it(`flags ${label}`, () => {
      const hits = roz208(compileDiagnostics(rozie(dataBody)));
      expect(hits.length, `expected ≥1 ROZ208; got ${JSON.stringify(hits)}`).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.severity).toBe('error');
    });
  }

  it('fires once per offending sigil access (two accesses → two diagnostics)', () => {
    // `$refs.box ? $refs.box : null` has two member accesses.
    const hits = roz208(compileDiagnostics(rozie('{ n: $refs.box ? $refs.box : null }')));
    expect(hits.length).toBe(2);
  });

  // 260717-uvl (make-it-work) — `$props`/`$data` member reads in a `<data>`
  // initializer are now sigil-lowered per target (routed through each
  // target's existing rewriteTemplateExpression), so ROZ208 must NOT flag
  // them. This is the flip side of the make-it-work fix in
  // data-init-sigil-lowering.test.ts, which asserts the emitted per-target
  // lowered read; this suite only asserts the diagnostic no longer fires.
  const NOT_FLAGGED_PROPS_DATA: Array<[string, string]> = [
    ['$props member access', '{ count: $props.initial }'],
    ['$props in an expression', "{ label: $props.initial + 1 }"],
    ['$props in a ternary', "{ n: $props.initial > 0 ? $props.initial : 0 }"],
    ['$data self-reference', '{ a: 1, b: $data.a }'],
    ['computed $props member', "{ v: $props['initial'] }"],
    ['$props nested in an array literal', '{ list: [$props.initial] }'],
    ['$props nested in an object literal', '{ o: { x: $props.initial } }'],
    ['$props inside an arrow-valued field', '{ get: () => $props.initial }'],
  ];

  for (const [label, dataBody] of NOT_FLAGGED_PROPS_DATA) {
    it(`does NOT flag ${label} (sigil-lowered per target)`, () => {
      expect(roz208(compileDiagnostics(rozie(dataBody))).length, `unexpected ROZ208`).toBe(0);
    });
  }

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
