// Phase 5 Plan 02a Task 1 — emitScript behavior tests + 3 per-block fixture
// snapshots (Counter / SearchInput / Modal).
//
// Per CONTEXT D-46 the per-block snapshots live at
// packages/targets/svelte/fixtures/{Name}.script.snap and lock the script-side
// emitter output verbatim.
//
// Behavior tests assert the 7 must-haves from the plan:
//  1. Counter $props destructure with $bindable() for model:true
//  2. Counter $data → $state()
//  3. Counter $computed → $derived()
//  4. Counter (no $onMount in source) ⇒ no $effect lifecycle line
//  5. SearchInput $watch debounce → inline IIFE (no @rozie/runtime-svelte)
//  6. Modal D-19 paired-cleanup: ONE $effect block per $onMount/$onUnmount pair
//  7. console.log("hello from rozie") in <script> body survives byte-identical
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitScript } from '../emit/emitScript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string): IRComponent {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitScript — behavior (Plan 05-02a Task 1)', () => {
  it('Test 1: Counter $props destructure emits $bindable(0) for model:true value prop', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('value = $bindable(0)');
    expect(scriptBlock).toContain('step = 1');
    expect(scriptBlock).toContain('min = -Infinity');
    expect(scriptBlock).toContain('max = Infinity');
    expect(scriptBlock).toContain(': Props = $props();');
  });

  it('Test 2: Counter $data emits `let hovering = $state(false);`', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('let hovering = $state(false);');
  });

  it('Test 3: Counter $computed canIncrement/canDecrement emits $derived(...) with rewritten body', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toMatch(/const canIncrement = \$derived\(/);
    expect(scriptBlock).toMatch(/const canDecrement = \$derived\(/);
    // Body uses bare value/step/max — no `.value` suffix in Svelte (per Pattern 1).
    expect(scriptBlock).toMatch(/value \+ step <= max/);
    expect(scriptBlock).toMatch(/value - step >= min/);
  });

  it('Test 4: Counter has NO $effect line (no $onMount/$onUnmount in source)', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).not.toMatch(/\$effect\(/);
  });

  it('Test 5: SearchInput $onMount with cleanup-return emits ONE $effect with `return () => ...`', () => {
    const { scriptBlock } = emitScript(lowerExample('SearchInput'));
    expect(scriptBlock).toMatch(/\$effect\(\(\) => \{/);
    expect(scriptBlock).toContain('return () =>');
    // No external runtime-svelte import — A8/A9 RESOLVED.
    expect(scriptBlock).not.toContain("from '@rozie/runtime-svelte'");
  });

  it('Test 6: Modal D-19 paired-cleanup → ONE $effect block per $onMount/$onUnmount pair', () => {
    const { scriptBlock } = emitScript(lowerExample('Modal'));
    // The lockScroll/unlockScroll pair must merge into ONE $effect block:
    //   $effect(() => { lockScroll(); return () => unlockScroll(); });
    expect(scriptBlock).toMatch(
      /\$effect\(\(\) => \{[\s\S]*lockScroll\(\)[\s\S]*return \(\) => unlockScroll\(\)[\s\S]*\}\);/,
    );
    // The standalone `$onMount(() => { $refs.dialogEl?.focus() })` becomes
    // its OWN second $effect block.
    const effectMatches = scriptBlock.match(/\$effect\(/g) ?? [];
    expect(effectMatches.length).toBe(2);
  });

  it('Test 7: Counter console.log("hello from rozie") survives verbatim (DX-03 trust-erosion floor)', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('console.log("hello from rozie")');
  });

  it('Test 8: Counter Props interface includes value, step, min, max fields', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('interface Props {');
    expect(scriptBlock).toMatch(/value\?: number;/);
    expect(scriptBlock).toMatch(/step\?: number;/);
    expect(scriptBlock).toMatch(/min\?: number;/);
    expect(scriptBlock).toMatch(/max\?: number;/);
  });

  it('Test 9: Counter has NO Snippet import (no slots declared)', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).not.toContain('Snippet');
  });

  it('Test 10: TodoList includes `import type { Snippet } from \'svelte\';`', () => {
    const { scriptBlock } = emitScript(lowerExample('TodoList'));
    expect(scriptBlock).toContain("import type { Snippet } from 'svelte';");
  });

  it('Quick 260515-u2b — WatchHook emits `$effect(() => { (() => open)(); (() => { ... })(); });`', () => {
    const src = `<rozie name="WatchSynth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, () => { if ($props.open) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchSynth.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const { scriptBlock } = emitScript(ir);
    // The IIFE-invocation shape — both getter and callback wrapped in parens
    // and immediately invoked inside the $effect body.
    expect(scriptBlock).toMatch(/\$effect\(\(\) => \{\s*\(\(\) => open\)\(\);\s*\(\(\) => \{[\s\S]*?\}\)\(\);\s*\}\);/);
  });

  it('Quick 260515-u2b — Counter (no watchers) emits no extra $effect lines beyond lifecycle', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    // Counter has no $watch and no $onMount, so $effect should not appear.
    expect(scriptBlock).not.toMatch(/\$effect/);
  });
});

describe('emitScript — per-block fixture snapshots (Plan 05-02a Task 1)', () => {
  const SCRIPT_FIXTURE_NAMES = ['Counter', 'SearchInput', 'Modal'] as const;

  for (const name of SCRIPT_FIXTURE_NAMES) {
    it(`${name}.script.snap`, async () => {
      const { scriptBlock } = emitScript(lowerExample(name));
      await expect(scriptBlock).toMatchFileSnapshot(
        resolve(FIXTURES, `${name}.script.snap`),
      );
    });
  }
});
