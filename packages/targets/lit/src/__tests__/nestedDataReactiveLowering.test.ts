// quick 260718-uvq — ROZ207 partial nested-$data reactive lowering (Lit).
//
// For the COVERED subset (statement-context depth-2 literal-key member write,
// depth-2 numeric-literal index write, and depth-1 push/pop/shift/unshift/splice
// on `$data.key`), Lit reassigns the settable `this._key.value` signal-ref (the
// `.value` setter triggers requestUpdate) with an immutable replacement instead
// of a silent in-place mutation of `this._key.value`.
//
// Non-covered shapes stay non-reactive here (ROZ207 owns fail-loud in core).
//
// Drives emitLit DIRECTLY (parse → lowerToIR → emitLit) — ROZ207 is an error and
// `compile()` gates emit on errors while the validator narrowing lands LAST
// (coherence invariant); the IR survives ROZ207 (a diagnostic).

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

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
  return emitLit(ir!, { filename, source }).code;
}

describe('Lit nested-$data reactive lowering (covered subset)', () => {
  it('CW-MEMBER: `$data.obj.field = 5` → `this._obj.value = { ...this._obj.value, field: 5 }`', () => {
    const code = emit('{ obj: { field: 0 } }', '$data.obj.field = 5;');
    expect(code).toMatch(/this\._obj\.value = \{/);
    expect(code).toContain('...this._obj.value');
    expect(code).toMatch(/field: 5/);
    expect(code).not.toMatch(/this\._obj\.value\.field\s*=\s*5/);
  });

  it('CW-INDEX: `$data.arr[0] = 9` → `this._arr.value = this._arr.value.map(`', () => {
    const code = emit('{ arr: [1, 2] }', '$data.arr[0] = 9;');
    expect(code).toContain('this._arr.value = this._arr.value.map(');
    expect(code).toMatch(/=== 0 \?/);
    expect(code).not.toMatch(/this\._arr\.value\[0\]\s*=\s*9/);
  });

  it('CW-ARRAY push: `$data.items.push(2)` → `this._items.value = [...this._items.value, 2]`', () => {
    const code = emit('{ items: [1] }', '$data.items.push(2);');
    expect(code).toContain('this._items.value = [...this._items.value, 2]');
    expect(code).not.toMatch(/this\._items\.value\.push\(2\)/);
  });

  it('CW-ARRAY pop: `$data.items.pop()` → `this._items.value = this._items.value.slice(0, -1)`', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.pop();');
    expect(code).toContain('this._items.value = this._items.value.slice(0, -1)');
    expect(code).not.toMatch(/this\._items\.value\.pop\(\)/);
  });

  it('CW-ARRAY splice: `$data.items.splice(0, 1)` → immutable slice-concat', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.splice(0, 1);');
    expect(code).toMatch(/this\._items\.value = \[/);
    expect(code).toContain('...this._items.value.slice(0, 0)');
    expect(code).toContain('...this._items.value.slice(0 + 1)');
    expect(code).not.toMatch(/this\._items\.value\.splice\(/);
  });

  // quick 260830-m30 — CW-DYNKEY / CW-DYNDELETE + the D2 initializer gate.
  // Lit's write is expression-shaped (`this._k.value = …`), so the delete
  // replaces the PARENT ExpressionStatement with a bare BlockStatement. The
  // `.value` SETTER is what triggers requestUpdate, so the write-back is what
  // makes the delete reactive.
  it('CW-DYNKEY object: `$data.reg[id] = 5` -> `this._reg.value = { ...this._reg.value, [id]: 5 }`', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;');
    expect(code).toMatch(/this\._reg\.value = \{/);
    expect(code).toContain('...this._reg.value');
    expect(code).toMatch(/\[id\]: 5/);
    expect(code).not.toMatch(/this\._reg\.value\[id\]\s*=\s*5/);
  });

  it('CW-DYNKEY string key: `$data.reg["k"] = 5` -> computed-key spread', () => {
    const code = emit('{ reg: {} }', '$data.reg["k"] = 5;');
    expect(code).toMatch(/this\._reg\.value = \{/);
    expect(code).toContain('...this._reg.value');
    expect(code).toMatch(/\["k"\]: 5/);
  });

  it('CW-DYNKEY array: `$data.arr[i] = 9` -> `this._arr.value = this._arr.value.map(`', () => {
    const code = emit('{ arr: [1, 2] }', 'const i = 1; $data.arr[i] = 9;');
    expect(code).toContain('this._arr.value = this._arr.value.map(');
    expect(code).toMatch(/=== i \?/);
    expect(code).not.toMatch(/this\._arr\.value\[i\]\s*=\s*9/);
  });

  it('CW-INDEX RETROFIT: `$data.obj[0] = 9` with `obj: {}` takes the OBJECT lowering', () => {
    const code = emit('{ obj: {} }', '$data.obj[0] = 9;');
    expect(code).toMatch(/this\._obj\.value = \{/);
    expect(code).toContain('...this._obj.value');
    expect(code).toMatch(/\[0\]: 9/);
    expect(code).not.toContain('.map(');
  });

  it('CW-DYNDELETE: `delete $data.reg[id]` -> clone-then-delete + `.value` write-back', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; delete $data.reg[id];');
    expect(code).toContain('const __next = {');
    expect(code).toContain('...this._reg.value');
    expect(code).toContain('delete __next[id]');
    expect(code).toContain('this._reg.value = __next');
    expect(code).not.toMatch(/delete this\._reg\.value\[id\]/);
  });

  // NEGATIVE — stay non-reactive (ROZ207 fail-loud owns them).
  it('NEGATIVE array delete `delete $data.arr[i]` is NOT lowered (hole semantics)', () => {
    const code = emit('{ arr: [] }', 'const i = 0; delete $data.arr[i];');
    expect(code).not.toContain('__next');
    expect(code).toContain('delete this._arr.value[i]');
  });

  it('NEGATIVE impure key `$data.reg[k()] = 5` is NOT lowered', () => {
    const code = emit('{ reg: {} }', 'function k(){ return "a"; } $data.reg[k()] = 5;');
    expect(code).not.toMatch(/this\._reg\.value = \{ \.\.\.this\._reg\.value/);
    expect(code).not.toMatch(/this\._reg\.value = this\._reg\.value\.map/);
  });

  it('NEGATIVE non-literal initializer `{ reg: null }` + `$data.reg[0] = 5` is NOT lowered', () => {
    const code = emit('{ reg: null }', '$data.reg[0] = 5;');
    expect(code).not.toMatch(/this\._reg\.value = \{ \.\.\.this\._reg\.value/);
    expect(code).not.toMatch(/this\._reg\.value = this\._reg\.value\.map/);
  });

  it('NEGATIVE expression-context delete is NOT lowered (D4 statement-context only)', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; const ok = delete $data.reg[id]; void ok;');
    expect(code).not.toContain('__next');
  });

  it('NEGATIVE depth-3 `$data.a.b.c = 1` is NOT lowered', () => {
    const code = emit('{ a: { b: { c: 0 } } }', '$data.a.b.c = 1;');
    expect(code).not.toMatch(/this\._a\.value = \{ \.\.\.this\._a\.value/);
  });

  it('NEGATIVE Set mutator `$data.set.add(1)` is NOT lowered', () => {
    const code = emit('{ set: new Set() }', '$data.set.add(1);');
    expect(code).not.toMatch(/this\._set\.value = \[/);
  });
});
