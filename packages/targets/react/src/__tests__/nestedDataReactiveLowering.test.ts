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
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
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
    expect(code).toContain('setObj(prev => ({ ...prev, field: 5 }))');
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

  // NEGATIVE — these stay non-reactive (ROZ207 fail-loud owns them); no reactive
  // setter form is synthesized.
  it('NEGATIVE dynamic index `$data.reg[id] = 5` is NOT lowered', () => {
    const code = emit('{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;');
    expect(code).not.toMatch(/setReg\(prev =>/);
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
