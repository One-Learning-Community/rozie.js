// Phase 06.2 P2 — Vue composition + recursion emit-side tests.
//
// Drives 4 new whole-SFC snapshots:
//   - TreeNode (self-reference) — defineOptions({ name }) + verbatim <TreeNode>
//   - Card (wrapper composition) — import CardHeader + verbatim <CardHeader>
//   - CardHeader (leaf, no <components>) — no new imports / no defineOptions
//   - Modal-with-Counter (wrapper) — import Counter + verbatim <Counter />
//
// Per CONTEXT.md D-117/D-118 + RESEARCH Pitfall 2 (always emit
// defineOptions({ name }) when self-ref present — Vue's filename-based
// auto-name doesn't reliably propagate through path-virtual schemes).
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitVue } from '../emitVue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures/composition');

function compileVue(src: string, filename: string): string {
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
  const { code } = emitVue(ir, { filename, source: src });
  return code;
}

describe('emitVue — Phase 06.2 P2 composition + recursion', () => {
  it('TreeNode.vue.snap: self-reference emits defineOptions({ name }) + redundant import', async () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <span>{{ $props.label }}</span>
    <TreeNode :node="$props.children" />
  </li>
</template>
</rozie>`;
    const code = compileVue(src, 'TreeNode.rozie');
    expect(code).toMatch(/defineOptions\(\{ name: 'TreeNode' \}\)/);
    expect(code).toMatch(/<TreeNode /);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TreeNode.vue.snap'));
  });

  it('Card.vue.snap: wrapper composition emits import CardHeader, no defineOptions', async () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <div class="card">
    <CardHeader title="Hello" />
  </div>
</template>
</rozie>`;
    const code = compileVue(src, 'Card.rozie');
    expect(code).toMatch(/import CardHeader from '\.\/CardHeader\.vue';/);
    expect(code).toMatch(/<CardHeader /);
    expect(code).not.toMatch(/defineOptions/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Card.vue.snap'));
  });

  it('CardHeader.vue.snap: leaf component — no new imports, no defineOptions', async () => {
    const src = `<rozie name="CardHeader">
<props>{ title: { type: String } }</props>
<template>
  <div class="card-header">{{ $props.title }}</div>
</template>
</rozie>`;
    const code = compileVue(src, 'CardHeader.rozie');
    expect(code).not.toMatch(/defineOptions/);
    // No `import X from './X.vue'` from a <components> block.
    expect(code).not.toMatch(/import \w+ from '\.\/\w+\.vue'/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'CardHeader.vue.snap'));
  });

  it('Modal-with-Counter.vue.snap: wrapper composition emits import Counter', async () => {
    const src = `<rozie name="Modal">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <div class="modal">
    <Counter />
  </div>
</template>
</rozie>`;
    const code = compileVue(src, 'Modal-with-Counter.rozie');
    expect(code).toMatch(/import Counter from '\.\/Counter\.vue';/);
    expect(code).toMatch(/<Counter[\s>]/);
    expect(code).not.toMatch(/defineOptions/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal-with-Counter.vue.snap'));
  });
});
