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
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
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

  // NEGATIVE — stay non-reactive (ROZ207 fail-loud owns them).
  it('NEGATIVE dynamic index `$data.reg[id] = 5` is NOT lowered to an immutable replace', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;');
    expect(code).not.toMatch(/this\._reg\.value = \{ \.\.\.this\._reg\.value/);
    expect(code).not.toMatch(/this\._reg\.value = this\._reg\.value\.map/);
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
