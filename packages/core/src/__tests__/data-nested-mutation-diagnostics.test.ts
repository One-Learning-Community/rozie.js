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
  // quick 260718-uvq — the COVERED subset (statement-context depth-2 literal-key
  // member write, depth-2 numeric-literal index write, and depth-1 push/pop/
  // shift/unshift/splice) now LOWERS reactively on React/Solid/Angular/Lit, so
  // ROZ207 no longer fires on it. Every OTHER nested/mutating shape STILL fires
  // fail-loud (the honesty rule — the compiler never silently ships a
  // non-reactive result for an uncovered shape).
  const FLAGGED: Array<[string, string, string]> = [
    // depth ≥ 3 — not statically single-key-replaceable.
    ['deep member assignment (depth-3)', '{ a: { b: { c: 0 } } }', '$data.a.b.c = 1;'],
    // quick 260830-m30 — the dynamic/computed-key ROW MOVED TO `CLEAN`: the D2
    // initializer gate resolves the array-vs-object ambiguity that used to be
    // the stated reason for excluding it, and all four targets now lower it.
    // compound / UpdateExpression on a nested member.
    ['compound nested assignment', '{ obj: { n: 0 } }', '$data.obj.n += 1;'],
    ['UpdateExpression on a nested member', '{ obj: { n: 0 } }', '$data.obj.n++;'],
    // in-place array mutators (no immutable single-expression equivalent).
    ['in-place array mutator (sort)', '{ items: [2, 1] }', '$data.items.sort();'],
    ['in-place array mutator (reverse)', '{ items: [1, 2] }', '$data.items.reverse();'],
    ['in-place array mutator (fill)', '{ items: [1, 2] }', '$data.items.fill(0);'],
    // Map/Set mutators.
    ['Map mutator (set)', '{ m: new Map() }', "$data.m.set('k', 1);"],
    ['Set mutator (add)', '{ s: new Set() }', '$data.s.add(1);'],
    ['Set mutator (delete)', '{ s: new Set() }', '$data.s.delete(1);'],
    ['Set mutator (clear)', '{ s: new Set() }', '$data.s.clear();'],
    // covered mutator used in EXPRESSION context — the return value is consumed,
    // so it is not statement-context-lowerable and stays flagged.
    ['expression-context covered mutator (pop return used)', '{ items: [1, 2] }', 'const removed = $data.items.pop(); void removed;'],
    // quick 260830-m30 — NEW diagnostics. Every one of these compiled CLEAN at
    // HEAD and was SILENTLY non-reactive on React/Solid/Angular/Lit, because the
    // validator had no `UnaryExpression` visitor at all.
    ['delete on an ARRAY-initialized key (hole semantics)', '{ arr: [] }', 'const i = 0; delete $data.arr[i];'],
    ['delete on a NON-LITERAL-initialized key', '{ reg: null }', 'const id = "k"; delete $data.reg[id];'],
    ['non-computed nested delete (D6)', '{ obj: { field: 1 } }', 'delete $data.obj.field;'],
    ['depth-3 delete', '{ a: { b: {} } }', 'const k = "x"; delete $data.a.b[k];'],
    ['expression-context delete (D4)', '{ reg: {} }', 'const id = "k"; const ok = delete $data.reg[id]; void ok;'],
    ['impure key expression (D1)', '{ reg: {} }', 'function k(){ return "a"; } $data.reg[k()] = 5;'],
    // The CW-INDEX RETROFIT narrowing: this row compiled CLEAN at HEAD and the
    // emitters produced `null.map(...)` — silently-wrong code inside the exempt
    // subset, strictly worse than a loud error.
    ['numeric index on a NON-LITERAL-initialized key', '{ reg: null }', '$data.reg[0] = 5;'],
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
    // quick 260718-uvq — COVERED subset now lowers reactively → no ROZ207.
    ['CW-MEMBER covered nested member write', '{ obj: { field: 0 } }', '$data.obj.field = 5;'],
    ['CW-INDEX covered numeric-literal index write', '{ arr: [1, 2] }', '$data.arr[0] = 9;'],
    ['CW-ARRAY covered push', '{ items: [1] }', '$data.items.push(2);'],
    ['CW-ARRAY covered pop', '{ items: [1, 2] }', '$data.items.pop();'],
    ['CW-ARRAY covered shift', '{ items: [1, 2] }', '$data.items.shift();'],
    ['CW-ARRAY covered unshift', '{ items: [1] }', '$data.items.unshift(2);'],
    ['CW-ARRAY covered splice', '{ items: [1, 2] }', '$data.items.splice(0, 1);'],
    // quick 260830-m30 — the dynamic-key registry PAIR, now lowered reactively
    // on all four targets (this is the narrowing; the first row MOVED here out
    // of FLAGGED).
    ['CW-DYNKEY identifier key on an object-initialized key', '{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;'],
    ['CW-DYNKEY string-literal key on an object-initialized key', '{ reg: {} }', '$data.reg["k"] = 5;'],
    ['CW-DYNKEY identifier index on an array-initialized key', '{ arr: [1, 2] }', 'const i = 1; $data.arr[i] = 9;'],
    ['CW-INDEX RETROFIT numeric literal on an object-initialized key', '{ obj: {} }', '$data.obj[0] = 9;'],
    ['CW-DYNDELETE on an object-initialized key', '{ reg: {} }', 'const id = "k"; delete $data.reg[id];'],
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

  it('does not flag a nested DELETE on an UNDECLARED key (deferred to ROZ106)', () => {
    const src = rozie('{ known: 0 }', 'const id = "k"; delete $data.unknown[id];');
    expect(roz207(compileDiagnostics(src)).length).toBe(0);
  });
});
