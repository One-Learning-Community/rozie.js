// quick 260718-uvq — ROZ207 partial nested-$data reactive lowering (React).
//
// For the statically-analyzable COVERED subset (statement-context depth-2
// literal-key member write `$data.obj.field = x`; depth-2 numeric-literal index
// write `$data.arr[0] = x`; and depth-1 array mutators push/pop/shift/unshift/
// splice on `$data.key`), React must emit a REACTIVE immutable-replace of the
// top-level `$data` key using its functional-updater setter idiom
// (`setKey(prev => …)`) instead of a silent in-place mutation.
//
// Every NOT-covered shape (dynamic/computed index `$data.reg[id]`, depth ≥ 3,
// Map/Set mutators) stays non-reactive here (ROZ207 owns fail-loud in core).
//
// NOTE: we drive the React emitter DIRECTLY (parse → lowerToIR → emitReact)
// rather than through core `compile()`. ROZ207 is an error-severity diagnostic
// and `compile()` gates emit on any error (returns `code: ''`); because the
// coherence invariant requires ROZ207 to stay fail-loud until it is narrowed
// LAST (core task), the covered subset would produce empty `.code` through
// `compile()` at this point. The direct-emit path observes the emitter's real
// output (the IR survives ROZ207 — it is a diagnostic, not IR-nulling).

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

function rozie(data: string, scriptBody: string): string {
  return `<rozie name="NestedData">
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

function emit(data: string, body: string): string {
  const filename = 'NestedData.rozie';
  const source = rozie(data, body);
  const { ast } = parse(source, { filename });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitReact(ir!, { filename, source }).code;
}

describe('React nested-$data reactive lowering (covered subset)', () => {
  it('CW-MEMBER: `$data.obj.field = 5` → functional-updater object spread', () => {
    const code = emit('{ obj: { field: 0 } }', '$data.obj.field = 5;');
    // Object literal pretty-prints multi-line; assert fragments, not whitespace.
    expect(code).toMatch(/setObj\(prev =>/);
    expect(code).toContain('...prev');
    expect(code).toMatch(/field: 5/);
    expect(code).not.toMatch(/\bobj\.field\s*=\s*5\b/);
  });

  it('CW-INDEX: `$data.arr[0] = 9` → functional-updater .map replace', () => {
    const code = emit('{ arr: [1, 2] }', '$data.arr[0] = 9;');
    expect(code).toContain('setArr(prev => prev.map(');
    expect(code).toMatch(/=== 0 \?/);
    expect(code).not.toMatch(/\barr\[0\]\s*=\s*9\b/);
  });

  it('CW-ARRAY push: `$data.items.push(2)` → `setItems(prev => [...prev, 2])`', () => {
    const code = emit('{ items: [1] }', '$data.items.push(2);');
    expect(code).toContain('setItems(prev => [...prev, 2])');
    expect(code).not.toMatch(/\bitems\.push\(2\)/);
  });

  it('CW-ARRAY pop: `$data.items.pop()` → `setItems(prev => prev.slice(0, -1))`', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.pop();');
    expect(code).toContain('setItems(prev => prev.slice(0, -1))');
    expect(code).not.toMatch(/\bitems\.pop\(\)/);
  });

  it('CW-ARRAY splice: `$data.items.splice(0, 1)` → immutable slice-concat', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.splice(0, 1);');
    expect(code).toContain('setItems(prev =>');
    expect(code).toContain('...prev.slice(0, 0)');
    expect(code).toContain('...prev.slice(0 + 1)');
    expect(code).not.toMatch(/\bitems\.splice\(/);
  });

  // quick 260830-m30 — CW-DYNKEY / CW-DYNDELETE + the initializer gate.
  //
  // A computed depth-2 write `$data.<key>[<pure-key>]` is now covered, gated on
  // the DECLARED `<data>` initializer kind (D2):
  //   object init -> `{ ...prev, [<key>]: rhs }`  (assign) / clone-then-delete
  //   array  init -> `prev.map(...)` (assign only; `delete arr[i]` leaves a hole)
  //   other  init -> NOT covered (this is what kills the latent `{}.map(...)`)
  // `<pure-key>` is exactly Identifier | StringLiteral | NumericLiteral (D1) —
  // side-effect-free, which is load-bearing for the per-element `.map` re-eval.
  //
  // React's FUNCTIONAL-UPDATER form is load-bearing for both new lowerings:
  // FlowCanvas relies on `setK(prev => ...)` merging across one React commit.
  it('CW-DYNKEY object: `$data.reg[id] = 5` -> functional-updater computed-key spread', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;');
    expect(code).toMatch(/setReg\(prev =>/);
    expect(code).toContain('...prev');
    expect(code).toMatch(/\[id\]: 5/);
    expect(code).not.toMatch(/\breg\[id\]\s*=\s*5\b/);
  });

  it('CW-DYNKEY string key: `$data.reg["k"] = 5` -> computed-key spread', () => {
    const code = emit('{ reg: {} }', '$data.reg["k"] = 5;');
    expect(code).toMatch(/setReg\(prev =>/);
    expect(code).toContain('...prev');
    expect(code).toMatch(/\["k"\]: 5/);
  });

  it('CW-DYNKEY array: `$data.arr[i] = 9` -> functional-updater .map replace', () => {
    const code = emit('{ arr: [1, 2] }', 'const i = 1; $data.arr[i] = 9;');
    expect(code).toContain('setArr(prev => prev.map(');
    expect(code).toMatch(/=== i \?/);
    expect(code).not.toMatch(/\barr\[i\]\s*=\s*9\b/);
  });

  it('CW-INDEX RETROFIT: `$data.obj[0] = 9` with `obj: {}` takes the OBJECT lowering', () => {
    const code = emit('{ obj: {} }', '$data.obj[0] = 9;');
    expect(code).toMatch(/setObj\(prev =>/);
    expect(code).toContain('...prev');
    expect(code).toMatch(/\[0\]: 9/);
    // The latent bug: an unconditional array lowering emitted `{}.map(...)`.
    expect(code).not.toContain('.map(');
  });

  it('CW-DYNDELETE: `delete $data.reg[id]` -> functional-updater clone-then-delete', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; delete $data.reg[id];');
    expect(code).toMatch(/setReg\(prev =>/);
    expect(code).toContain('const __next = {');
    expect(code).toContain('...prev');
    expect(code).toContain('delete __next[id]');
    expect(code).toContain('return __next');
    expect(code).not.toMatch(/delete reg\[id\]/);
  });

  // NEGATIVE — these stay non-reactive (ROZ207 fail-loud owns them); no reactive
  // setter form is synthesized.
  it('NEGATIVE array delete `delete $data.arr[i]` is NOT lowered (hole semantics)', () => {
    const code = emit('{ arr: [] }', 'const i = 0; delete $data.arr[i];');
    expect(code).not.toMatch(/setArr\(/);
  });

  it('NEGATIVE impure key `$data.reg[k()] = 5` is NOT lowered', () => {
    const code = emit('{ reg: {} }', 'function k(){ return "a"; } $data.reg[k()] = 5;');
    expect(code).not.toMatch(/setReg\(/);
  });

  it('NEGATIVE non-literal initializer `{ reg: null }` + `$data.reg[0] = 5` is NOT lowered', () => {
    const code = emit('{ reg: null }', '$data.reg[0] = 5;');
    expect(code).not.toMatch(/setReg\(/);
  });

  it('NEGATIVE expression-context delete is NOT lowered (D4 statement-context only)', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; const ok = delete $data.reg[id]; void ok;');
    expect(code).not.toMatch(/setReg\(/);
  });

  it('NEGATIVE depth-3 `$data.a.b.c = 1` is NOT lowered', () => {
    const code = emit('{ a: { b: { c: 0 } } }', '$data.a.b.c = 1;');
    expect(code).not.toMatch(/setA\(prev =>/);
  });

  it('NEGATIVE Set mutator `$data.set.add(1)` is NOT lowered', () => {
    const code = emit('{ set: new Set() }', '$data.set.add(1);');
    expect(code).not.toMatch(/setSet\(prev =>/);
  });
});
