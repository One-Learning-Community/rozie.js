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

  it('Quick 260515-u2b — WatchHook binds the getter value as the callback\'s first arg (when callback declares a param)', () => {
    // Callback declares a param `(v) => ...` so emit MUST bind `__watchVal` to
    // it; the zero-param variant is covered separately below to ensure the
    // svelte-check arity gate doesn't regress.
    const src = `<rozie name="WatchSynth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, (v) => { if (v) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchSynth.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const { scriptBlock } = emitScript(ir);
    // Getter is invoked into __watchVal; callback is invoked with that value
    // as its first argument. Preserves user-authored `(v) => ...` params so
    // `v` binds to the new value (regression: the bare `(cb)()` form left
    // `v` undefined — Svelte/Angular/Lit silent no-op, Solid ReferenceError).
    expect(scriptBlock).toMatch(/\$effect\(\(\) => \{\s*const __watchVal = \(\(\) => open\)\(\);\s*\(v => \{[\s\S]*?\}\)\(__watchVal\);\s*\}\);/);
  });

  it('Quick 260515-u2b — WatchHook with zero-param callback omits __watchVal (svelte-check arity gate)', () => {
    // Zero-param callbacks must NOT receive __watchVal — `(() => {...})(__watchVal)`
    // trips svelte-check "Expected 0 arguments, but got 1". Dropdown.rozie has
    // exactly this shape (callback closes over `open` directly).
    const src = `<rozie name="WatchSynthNoArg">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, () => { if ($props.open) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchSynthNoArg.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const { scriptBlock } = emitScript(ir);
    expect(scriptBlock).toMatch(/\$effect\(\(\) => \{\s*\(\(\) => open\)\(\);\s*\(\(\) => \{[\s\S]*?\}\)\(\);\s*\}\);/);
    expect(scriptBlock).not.toContain('__watchVal');
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

// Phase 07.3.1 D-SV-16 — Svelte producer reads consumer-emitted `snippets`
// prop and merges into named-snippet locals via `$derived`. The consumer-side
// emitter (emitSlotFiller.ts:174) emits `snippets={{ [expr]: __rozieDynSlot_N }}`
// for `<template #[dynamic]>` fills; without the producer-side merge the
// dynamic projection is silently dropped (the destructure only reads bare
// `header`, never `snippets.header`).
//
// These tests construct synthetic single-component .rozie sources via the
// parser path so the IR is hand-built end-to-end (no fixture coupling). They
// lock the contract at the @rozie/target-svelte level — independent of the
// shared snapshot suite which exercises the same code path implicitly via
// Modal/Dropdown/TodoList .svelte.snap re-blessings.
function emitScriptFromSrc(src: string, name: string): string {
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return emitScript(lowered.ir).scriptBlock;
}

describe('snippets-merge (Phase 07.3.1 D-SV-16)', () => {
  it('Props interface includes snippets?: Record<string, any>; when ir.slots is non-empty', () => {
    // Typed `Record<string, any>` (not `Record<string, Snippet<[any]>>`) so the
    // `const X = $derived(__XProp ?? snippets?.X)` merge preserves the per-slot
    // Snippet signature from `__XProp`. A more specific Snippet<...> would
    // force the union into the strict-arity shape and surface as
    // "Expected 1 arguments, but got 0" at every `{@render X?.()}` callsite
    // for zero-param slots (Card.children, TodoList.empty) under svelte-check.
    const src = `<rozie name="SlottedTwo">
<template>
  <div>
    <slot name="header" />
    <slot />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedTwo');
    expect(scriptBlock).toContain('snippets?: Record<string, any>;');
  });

  it('Props destructure renames slot entries and appends snippets + emits $derived merge per slot', () => {
    const src = `<rozie name="SlottedHeader">
<template>
  <div>
    <slot name="header" />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedHeader');
    // Rename in destructure.
    expect(scriptBlock).toContain('header: __headerProp');
    // snippets entry appended to destructure.
    expect(scriptBlock).toMatch(/\bsnippets\b[,\s}]/);
    // $derived merge line spliced after the destructure.
    expect(scriptBlock).toContain(
      'const header = $derived(__headerProp ?? snippets?.header);',
    );
  });

  it('static-named header wins over snippets?.header via `??` left-precedence (T-07.3.1-14)', () => {
    // The threat-model precedence rule: `__headerProp ?? snippets?.header`
    // makes the statically-named consumer fill the more specific binding.
    const src = `<rozie name="SlottedHeader">
<template>
  <div>
    <slot name="header" />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedHeader');
    // Specifically assert __headerProp comes BEFORE snippets?.header in the
    // expression — coalesce evaluates left-to-right.
    const match = scriptBlock.match(
      /const header = \$derived\(__headerProp \?\? snippets\?\.header\);/,
    );
    expect(match).not.toBeNull();
  });

  it('default-slot lowers to `children` and gets the same merge treatment', () => {
    const src = `<rozie name="SlottedDefault">
<template>
  <div>
    <slot />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedDefault');
    expect(scriptBlock).toContain('children: __childrenProp');
    expect(scriptBlock).toContain(
      'const children = $derived(__childrenProp ?? snippets?.children);',
    );
  });

  it('no snippets merge when ir.slots is empty — Counter byte-equivalent shape', () => {
    // Counter has props + state + computed but NO slots. The fix must not
    // touch it at all — no snippets field, no rename, no $derived merge.
    const scriptBlock = emitScript(lowerExample('Counter')).scriptBlock;
    expect(scriptBlock).not.toContain('snippets?: Record<string');
    expect(scriptBlock).not.toMatch(/__\w+Prop\b/);
    // Counter's $computed legitimately uses $derived — guard the assertion
    // against false-positives by checking the slot-merge-specific pattern.
    expect(scriptBlock).not.toMatch(/\$derived\(__\w+Prop \?\? snippets/);
  });
});
