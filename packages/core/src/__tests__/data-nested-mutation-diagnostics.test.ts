// Spike-012 R8 — ROZ207 DATA_NESTED_MUTATION_NOT_REACTIVE.
//
// An in-place mutation of NESTED `$data` state (`$data.obj.field = …`,
// `$data.arr[i] = …`, `$data.arr.push(…)`) is SILENTLY non-reactive on
// React/Solid/Angular/Lit — the mutation persists but no re-render fires (React
// mutates the useState value without a setter; Solid/Angular read a signal then
// mutate its object; Lit skips requestUpdate). Vue/Svelte work (deep reactivity).
// The shallow `$data.x = y` write DOES lower to a reactive setter — only nested /
// method mutation escapes. The fix emits a loud ROZ207 steering the author to a
// whole-object-replace of the top-level key, which works on all six targets.
//
// This is a target-agnostic diagnostic (fires regardless of compile target), so a
// single target suffices for the assertions. Mirrors
// `event-handler-not-expression-diagnostics.test.ts`.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'react',
    filename: 'DataNestedMutation.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

function rozie(data: string, scriptBody: string): string {
  return `<rozie name="DataNestedMutation">
<data>
${data}
</data>
<script lang="ts">
function go(): void {
${scriptBody}
}
</script>
<template>
<button @click="go()">Go</button>
</template>
</rozie>
`;
}

function roz207(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.code === RozieErrorCode.DATA_NESTED_MUTATION_NOT_REACTIVE);
}

describe('nested-$data-mutation diagnostics (Spike-012 R8 silent reactivity break)', () => {
  const FLAGGED: Array<[string, string, string]> = [
    ['nested member assignment', '{ obj: { field: 0 } }', '$data.obj.field = 5;'],
    ['indexed assignment', '{ arr: [1, 2] }', '$data.arr[0] = 9;'],
    ['compound nested assignment', '{ obj: { n: 0 } }', '$data.obj.n += 1;'],
    ['UpdateExpression on a nested member', '{ obj: { n: 0 } }', '$data.obj.n++;'],
    ['mutating array method (push)', '{ items: [1] }', '$data.items.push(2);'],
    ['mutating array method (splice)', '{ items: [1, 2] }', '$data.items.splice(0, 1);'],
    ['deep member assignment', '{ a: { b: { c: 0 } } }', '$data.a.b.c = 1;'],
  ];

  for (const [label, data, body] of FLAGGED) {
    it(`flags ${label} with exactly one ROZ207 error`, () => {
      const hits = roz207(compileDiagnostics(rozie(data, body)));
      expect(hits.length, `expected one ROZ207; got ${JSON.stringify(hits)}`).toBe(1);
      expect(hits[0]!.severity).toBe('error');
    });
  }

  const CLEAN: Array<[string, string, string]> = [
    ['shallow reassignment', '{ obj: { field: 0 } }', '$data.obj = { ...$data.obj, field: 5 };'],
    ['whole-object-replace (registry pattern)', '{ reg: {} }', "$data.reg = { ...$data.reg, k: 1 };"],
    ['shallow compound assignment', '{ n: 0 }', '$data.n += 1;'],
    ['shallow UpdateExpression', '{ n: 0 }', '$data.n++;'],
    ['mutation through a local alias', '{ obj: { field: 0 } }', 'const o = $data.obj; o.field = 5;'],
    ['non-mutating array method read', '{ items: [1] }', 'const x = $data.items.map((v) => v + 1); void x;'],
  ];

  for (const [label, data, body] of CLEAN) {
    it(`does NOT flag ${label}`, () => {
      expect(roz207(compileDiagnostics(rozie(data, body))).length, `unexpected ROZ207`).toBe(0);
    });
  }

  it('does not flag a nested write to an UNDECLARED key (deferred to ROZ106)', () => {
    const src = rozie('{ known: 0 }', '$data.unknown.field = 5;');
    expect(roz207(compileDiagnostics(src)).length).toBe(0);
  });
});
