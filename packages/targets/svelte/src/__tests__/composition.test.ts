// Phase 06.2 P2 — Svelte composition + recursion emit-side tests.
//
// Drives 4 new whole-SFC snapshots:
//   - TreeNode (self-reference) — self-import idiom per updated D-117
//     (NO `<svelte:self>` rewrite; same path as wrapper composition)
//   - Card (wrapper composition) — `import CardHeader from './CardHeader.svelte';`
//   - CardHeader (leaf, no <components>) — no new imports
//   - Modal-with-Counter (wrapper) — `import Counter from './Counter.svelte';`
//
// Per CONTEXT.md D-117 (UPDATED 2026-05-07): Svelte 5 self-reference uses
// the self-import idiom — `import Self from './Self.svelte';` — NOT the
// legacy `<svelte:self>` element. Wrapper-composition + self-reference
// share one code path.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSvelte } from '../emitSvelte.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures/composition');

function compileSvelte(src: string, filename: string): string {
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
  const { code } = emitSvelte(ir, { filename, source: src });
  return code;
}

describe('emitSvelte — Phase 06.2 P2 composition + recursion', () => {
  it('TreeNode.svelte.snap: self-reference uses self-import idiom (NOT <svelte:self>)', async () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <span>{{ $props.label }}</span>
    <TreeNode :node="$props.children" />
  </li>
</template>
</rozie>`;
    const code = compileSvelte(src, 'TreeNode.rozie');
    expect(code).toMatch(/import TreeNode from '\.\/TreeNode\.svelte';/);
    expect(code).toMatch(/<TreeNode[\s/>]/);
    // CRITICAL: D-117 — no legacy <svelte:self>
    expect(code).not.toMatch(/svelte:self/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TreeNode.svelte.snap'));
  });

  it('Card.svelte.snap: wrapper composition emits import CardHeader.svelte', async () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <div class="card">
    <CardHeader title="Hello" />
  </div>
</template>
</rozie>`;
    const code = compileSvelte(src, 'Card.rozie');
    expect(code).toMatch(/import CardHeader from '\.\/CardHeader\.svelte';/);
    expect(code).toMatch(/<CardHeader[\s/>]/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Card.svelte.snap'));
  });

  it('CardHeader.svelte.snap: leaf component — no new imports', async () => {
    const src = `<rozie name="CardHeader">
<props>{ title: { type: String } }</props>
<template>
  <div class="card-header">{{ $props.title }}</div>
</template>
</rozie>`;
    const code = compileSvelte(src, 'CardHeader.rozie');
    expect(code).not.toMatch(/import \w+ from '\.\/\w+\.svelte'/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'CardHeader.svelte.snap'));
  });

  it('Modal-with-Counter.svelte.snap: wrapper composition emits import Counter.svelte', async () => {
    const src = `<rozie name="Modal">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <div class="modal">
    <Counter />
  </div>
</template>
</rozie>`;
    const code = compileSvelte(src, 'Modal-with-Counter.rozie');
    expect(code).toMatch(/import Counter from '\.\/Counter\.svelte';/);
    expect(code).toMatch(/<Counter[\s/>]/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal-with-Counter.svelte.snap'));
  });
});
