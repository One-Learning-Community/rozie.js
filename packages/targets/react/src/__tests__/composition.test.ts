// Phase 06.2 P2 — React composition + recursion emit-side tests.
//
// Drives 4 new whole-module snapshots:
//   - TreeNode (self-reference) — named-function declaration handles self-ref
//     natively (Pitfall 7); self-entry skipped via localName !== ir.name
//   - Card (wrapper composition) — `import CardHeader from './CardHeader';`
//     (NO extension — TS resolver picks up `.tsx` from dist)
//   - CardHeader (leaf, no <components>) — no new imports
//   - Modal-with-Counter (wrapper) — `import Counter from './Counter';`
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReact } from '../emitReact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures/composition');

function compileReact(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitReact(ir, { filename, source: src });
  return code;
}

describe('emitReact — Phase 06.2 P2 composition + recursion', () => {
  it('TreeNode.tsx.snap: self-reference resolves via named-function declaration; self-entry skipped', async () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <span>{{ $props.label }}</span>
    <TreeNode :node="$props.children" />
  </li>
</template>
</rozie>`;
    const code = compileReact(src, 'TreeNode.rozie');
    // Pitfall 7 — named-function declaration in shell.ts:180 supports self-ref.
    expect(code).toMatch(/export default function TreeNode/);
    // JSX inside body must reference the enclosing function declaration.
    expect(code).toMatch(/<TreeNode[\s/>]/);
    // Self-entry MUST be skipped — no `import TreeNode from './TreeNode'` line.
    expect(code).not.toMatch(/import TreeNode from '\.\/TreeNode'/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TreeNode.tsx.snap'));
  });

  it('Card.tsx.snap: wrapper composition emits import CardHeader (no ext)', async () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <div class="card">
    <CardHeader title="Hello" />
  </div>
</template>
</rozie>`;
    const code = compileReact(src, 'Card.rozie');
    // Extension OMITTED — bundler/TS resolver picks up the actual `.tsx` from dist.
    expect(code).toMatch(/import CardHeader from '\.\/CardHeader';/);
    expect(code).not.toMatch(/import CardHeader from '\.\/CardHeader\.tsx'/);
    expect(code).toMatch(/<CardHeader[\s/>]/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Card.tsx.snap'));
  });

  it('CardHeader.tsx.snap: leaf component — no new component imports', async () => {
    const src = `<rozie name="CardHeader">
<props>{ title: { type: String } }</props>
<template>
  <div class="card-header">{{ $props.title }}</div>
</template>
</rozie>`;
    const code = compileReact(src, 'CardHeader.rozie');
    // No PascalCase-leading component imports synthesized.
    expect(code).not.toMatch(/import [A-Z]\w+ from '\.\/[A-Z]\w+'/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'CardHeader.tsx.snap'));
  });

  it('Modal-with-Counter.tsx.snap: wrapper composition emits import Counter (no ext)', async () => {
    const src = `<rozie name="Modal">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <div class="modal">
    <Counter />
  </div>
</template>
</rozie>`;
    const code = compileReact(src, 'Modal-with-Counter.rozie');
    expect(code).toMatch(/import Counter from '\.\/Counter';/);
    expect(code).not.toMatch(/import Counter from '\.\/Counter\.tsx'/);
    expect(code).toMatch(/<Counter[\s/>]/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal-with-Counter.tsx.snap'));
  });
});

// Keyed-remount codegen, Task 2 — React `:key` on a composed component now
// lowers to `TemplateElementIR.remountKeyExpression` (Task 1, DONE) but React
// currently DROPS the raw `key`/`:key` binding via `isConsumedAttribute`
// (emitTemplateAttribute.ts:83-90) and emits NO key at all — meaning React
// silently never remounts on `:key` change (data-table-super-crosstarget-
// findings.md §3.1). Fix: emit `key={<expr>}` on the component call so
// React's native "key change → remount" behavior fires.
describe('emitReact — component :key emits key={expr} (keyed-remount codegen Task 2)', () => {
  it('component :key emits key={String(v)} on the component call', () => {
    const src = `<rozie name="KeyedHost">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ v: 0 }</data>
<template>
  <div>
    <MyComp :key="String($data.v)" />
  </div>
</template>
</rozie>`;
    const code = compileReact(src, 'KeyedHost.rozie');
    // THE fix — a real key={...} JSX attribute on the component invocation.
    expect(code).toMatch(/<MyComp[^/]*\bkey=\{String\(v\)\}/);
  });

  it('control: component WITHOUT :key emits no key attribute', () => {
    const src = `<rozie name="KeyedHostNoKey">
<components>{ MyComp: "./MyComp.rozie" }</components>
<template>
  <div>
    <MyComp />
  </div>
</template>
</rozie>`;
    const code = compileReact(src, 'KeyedHostNoKey.rozie');
    expect(code).not.toMatch(/\bkey=\{/);
  });

  it('control: r-for loop key on a component is emitted exactly as before (unaffected by remountKeyExpression)', () => {
    const src = `<rozie name="KeyedHostLoop">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ xs: [] }</data>
<template>
  <div>
    <MyComp r-for="x in $data.xs" :key="x.id" />
  </div>
</template>
</rozie>`;
    const code = compileReact(src, 'KeyedHostLoop.rozie');
    // Loop key still emitted via the pendingKey channel.
    expect(code).toMatch(/<MyComp[^/]*\bkey=\{x\.id\}/);
    // Exactly one key= on the component call (no duplicate from remount path).
    const matches = code.match(/\bkey=\{/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
