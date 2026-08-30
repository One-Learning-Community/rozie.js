// quick 260718-uvq — ROZ207 partial nested-$data reactive lowering (Solid).
//
// For the COVERED subset (statement-context depth-2 literal-key member write,
// depth-2 numeric-literal index write, and depth-1 push/pop/shift/unshift/splice
// on `$data.key`), Solid emits a REACTIVE getter-read immutable-replace via its
// createSignal setter idiom (`setKey({ ...key(), field: x })`) — NOT a `prev =>`
// arrow (dodges solid/reactivity lint, mirroring the existing `setX(x() + rhs)`
// compound form). Stays on createSignal immutable-spread (no createStore).
//
// Non-covered shapes stay non-reactive here (ROZ207 owns fail-loud in core).
//
// Drives the Solid emitter DIRECTLY (parse → lowerToIR → emitSolid) — ROZ207 is
// an error and `compile()` gates emit on errors while the validator narrowing
// lands LAST (coherence invariant); the IR survives ROZ207 (a diagnostic).

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

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
  return emitSolid(ir!, { filename, source }).code;
}

describe('Solid nested-$data reactive lowering (covered subset)', () => {
  it('CW-MEMBER: `$data.obj.field = 5` → `setObj({ ...obj(), field: 5 })`', () => {
    const code = emit('{ obj: { field: 0 } }', '$data.obj.field = 5;');
    expect(code).toMatch(/setObj\(\{/);
    expect(code).toContain('...obj()');
    expect(code).toMatch(/field: 5/);
    expect(code).not.toMatch(/obj\(\)\.field\s*=\s*5/);
  });

  it('CW-INDEX: `$data.arr[0] = 9` → `setArr(arr().map(`', () => {
    const code = emit('{ arr: [1, 2] }', '$data.arr[0] = 9;');
    expect(code).toContain('setArr(arr().map(');
    expect(code).toMatch(/=== 0 \?/);
    expect(code).not.toMatch(/arr\(\)\[0\]\s*=\s*9/);
  });

  it('CW-ARRAY push: `$data.items.push(2)` → `setItems([...items(), 2])`', () => {
    const code = emit('{ items: [1] }', '$data.items.push(2);');
    expect(code).toContain('setItems([...items(), 2])');
    expect(code).not.toMatch(/items\(\)\.push\(2\)/);
  });

  it('CW-ARRAY pop: `$data.items.pop()` → `setItems(items().slice(0, -1))`', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.pop();');
    expect(code).toContain('setItems(items().slice(0, -1))');
    expect(code).not.toMatch(/items\(\)\.pop\(\)/);
  });

  it('CW-ARRAY splice: `$data.items.splice(0, 1)` → immutable slice-concat', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.splice(0, 1);');
    expect(code).toContain('setItems([');
    expect(code).toContain('...items().slice(0, 0)');
    expect(code).toContain('...items().slice(0 + 1)');
    expect(code).not.toMatch(/items\(\)\.splice\(/);
  });

  // quick 260830-m30 — CW-DYNKEY / CW-DYNDELETE + the D2 initializer gate.
  // Solid keeps its VALUE-form setter with a getter read (no `prev =>` arrow),
  // and the delete lowers to a bare BlockStatement replacing the parent
  // ExpressionStatement so the clone-then-delete statements have a home.
  it('CW-DYNKEY object: `$data.reg[id] = 5` -> `setReg({ ...reg(), [id]: 5 })`', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;');
    expect(code).toMatch(/setReg\(\{/);
    expect(code).toContain('...reg()');
    expect(code).toMatch(/\[id\]: 5/);
    expect(code).not.toMatch(/reg\(\)\[id\]\s*=\s*5/);
  });

  it('CW-DYNKEY string key: `$data.reg["k"] = 5` -> computed-key spread', () => {
    const code = emit('{ reg: {} }', '$data.reg["k"] = 5;');
    expect(code).toMatch(/setReg\(\{/);
    expect(code).toContain('...reg()');
    expect(code).toMatch(/\["k"\]: 5/);
  });

  it('CW-DYNKEY array: `$data.arr[i] = 9` -> `setArr(arr().map(`', () => {
    const code = emit('{ arr: [1, 2] }', 'const i = 1; $data.arr[i] = 9;');
    expect(code).toContain('setArr(arr().map(');
    expect(code).toMatch(/=== i \?/);
    expect(code).not.toMatch(/arr\(\)\[i\]\s*=\s*9/);
  });

  it('CW-INDEX RETROFIT: `$data.obj[0] = 9` with `obj: {}` takes the OBJECT lowering', () => {
    const code = emit('{ obj: {} }', '$data.obj[0] = 9;');
    expect(code).toMatch(/setObj\(\{/);
    expect(code).toContain('...obj()');
    expect(code).toMatch(/\[0\]: 9/);
    expect(code).not.toContain('.map(');
  });

  it('CW-DYNDELETE: `delete $data.reg[id]` -> clone-then-delete + `setReg(__next)`', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; delete $data.reg[id];');
    expect(code).toContain('const __next = {');
    expect(code).toContain('...reg()');
    expect(code).toContain('delete __next[id]');
    expect(code).toContain('setReg(__next)');
    expect(code).not.toMatch(/delete reg\(\)\[id\]/);
  });

  // NEGATIVE — stay non-reactive (ROZ207 fail-loud owns them).
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
    expect(code).not.toMatch(/setA\(/);
  });

  it('NEGATIVE Set mutator `$data.set.add(1)` is NOT lowered', () => {
    const code = emit('{ set: new Set() }', '$data.set.add(1);');
    expect(code).not.toMatch(/setSet\(/);
  });
});
