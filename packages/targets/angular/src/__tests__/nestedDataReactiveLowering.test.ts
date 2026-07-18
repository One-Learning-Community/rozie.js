// quick 260718-uvq — ROZ207 partial nested-$data reactive lowering (Angular).
//
// For the COVERED subset (statement-context depth-2 literal-key member write,
// depth-2 numeric-literal index write, and depth-1 push/pop/shift/unshift/splice
// on `$data.key`), Angular emits a REACTIVE immutable-replace via the signal
// `.update` idiom (`this.key.update(o => ({ ...o, field: x }))`) instead of a
// silent in-place mutation of `this.key()`.
//
// Non-covered shapes stay non-reactive here (ROZ207 owns fail-loud in core).
//
// Drives emitAngular DIRECTLY (parse → lowerToIR → emitAngular) — ROZ207 is an
// error and `compile()` gates emit on errors while the validator narrowing lands
// LAST (coherence invariant); the IR survives ROZ207 (a diagnostic).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';

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
  return emitAngular(ir!, { filename, source }).code;
}

describe('Angular nested-$data reactive lowering (covered subset)', () => {
  it('CW-MEMBER: `$data.obj.field = 5` → `this.obj.update(o => ({ ...o, field: 5 }))`', () => {
    const code = emit('{ obj: { field: 0 } }', '$data.obj.field = 5;');
    expect(code).toMatch(/this\.obj\.update\(o =>/);
    expect(code).toContain('...o');
    expect(code).toMatch(/field: 5/);
    expect(code).not.toMatch(/this\.obj\(\)\.field\s*=\s*5/);
  });

  it('CW-INDEX: `$data.arr[0] = 9` → `this.arr.update(` … `.map(`', () => {
    const code = emit('{ arr: [1, 2] }', '$data.arr[0] = 9;');
    expect(code).toMatch(/this\.arr\.update\(/);
    expect(code).toContain('.map(');
    expect(code).toMatch(/=== 0 \?/);
    expect(code).not.toMatch(/this\.arr\(\)\[0\]\s*=\s*9/);
  });

  it('CW-ARRAY push: `$data.items.push(2)` → `this.items.update(a => [...a, 2])`', () => {
    const code = emit('{ items: [1] }', '$data.items.push(2);');
    expect(code).toContain('this.items.update(a => [...a, 2])');
    expect(code).not.toMatch(/this\.items\(\)\.push\(2\)/);
  });

  it('CW-ARRAY pop: `$data.items.pop()` → `this.items.update(a => a.slice(0, -1))`', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.pop();');
    expect(code).toContain('this.items.update(a => a.slice(0, -1))');
    expect(code).not.toMatch(/this\.items\(\)\.pop\(\)/);
  });

  it('CW-ARRAY splice: `$data.items.splice(0, 1)` → immutable slice-concat', () => {
    const code = emit('{ items: [1, 2] }', '$data.items.splice(0, 1);');
    expect(code).toMatch(/this\.items\.update\(a =>/);
    expect(code).toContain('...a.slice(0, 0)');
    expect(code).toContain('...a.slice(0 + 1)');
    expect(code).not.toMatch(/this\.items\(\)\.splice\(/);
  });

  // NEGATIVE — stay non-reactive (ROZ207 fail-loud owns them).
  it('NEGATIVE dynamic index `$data.reg[id] = 5` is NOT lowered', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;');
    expect(code).not.toMatch(/this\.reg\.update\(/);
  });

  it('NEGATIVE depth-3 `$data.a.b.c = 1` is NOT lowered', () => {
    const code = emit('{ a: { b: { c: 0 } } }', '$data.a.b.c = 1;');
    expect(code).not.toMatch(/this\.a\.update\(/);
  });

  it('NEGATIVE Set mutator `$data.set.add(1)` is NOT lowered', () => {
    const code = emit('{ set: new Set() }', '$data.set.add(1);');
    expect(code).not.toMatch(/this\.set\.update\(/);
  });
});
