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

// Keyed-remount codegen, Task 4 — Svelte `:key` on a composed component now
// lowers to `TemplateElementIR.remountKeyExpression` (Task 1, DONE) but
// Svelte currently FORWARDS the raw `key` binding as an inert reactive prop
// (`get key(){ ... }`) — the child component declares no `key` prop, so the
// binding does nothing and the component never remounts on change
// (data-table-super-crosstarget-findings.md §3.1). Fix: wrap the component
// invocation in `{#key <expr>}...{/key}` (Svelte 5's native destroy+recreate
// block) and stop forwarding `key` as a prop.
describe('emitSvelte — component :key wraps {#key expr}...{/key} (keyed-remount codegen Task 4)', () => {
  it('component :key wraps the invocation in {#key String(v)}...{/key} and drops the inert key prop', () => {
    const src = `<rozie name="KeyedHost">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ v: 0 }</data>
<template>
  <div>
    <MyComp :key="String($data.v)" />
  </div>
</template>
</rozie>`;
    const code = compileSvelte(src, 'KeyedHost.rozie');
    // THE fix — a real {#key expr}...{/key} block wrapping the component call.
    expect(code).toMatch(/\{#key String\(v\)\}<MyComp[^]*?\{\/key\}/);
    // The inert `key` prop/binding must NOT be forwarded onto the component anymore.
    expect(code).not.toMatch(/get key\(\)/);
    expect(code).not.toMatch(/<MyComp[^/]*\bkey=/);
  });

  it('control: component WITHOUT :key emits no {#key} wrap and no key prop', () => {
    const src = `<rozie name="KeyedHostNoKey">
<components>{ MyComp: "./MyComp.rozie" }</components>
<template>
  <div>
    <MyComp />
  </div>
</template>
</rozie>`;
    const code = compileSvelte(src, 'KeyedHostNoKey.rozie');
    expect(code).not.toMatch(/\{#key /);
    expect(code).not.toMatch(/get key\(\)/);
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
    const code = compileSvelte(src, 'KeyedHostLoop.rozie');
    // Loop key still emitted via the `{#each ... (key)}` directive, unchanged.
    expect(code).toMatch(/\{#each xs as x \(x\.id\)\}/);
    // No {#key} wrap and no inert `key` prop introduced by this task.
    expect(code).not.toMatch(/\{#key /);
    expect(code).not.toMatch(/get key\(\)/);
  });
});
