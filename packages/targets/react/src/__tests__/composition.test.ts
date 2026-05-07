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
