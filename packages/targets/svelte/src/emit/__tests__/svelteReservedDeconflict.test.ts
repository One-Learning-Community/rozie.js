/**
 * Phase 61 Plan 08 (SC-2, Svelte leg) — the RUNTIME-ONLY collision tier + the
 * compile-error tier with no Svelte guard.
 *
 * Svelte's deadliest collision class has NO typecheck net: svelte-check passes,
 * tsdown/oxc dts does NOT body-typecheck, and the @rozie-ui svelte leaves ship
 * raw source with no ng-packagr-equivalent body gate. Two variants reach
 * production with zero compile signal:
 *
 *   1. SLOT-PARAM SHADOW (collision-svelte §3 risk 1). A consumer fill
 *      `<template #body="{ node }">` whose snippet param `node` shadows an
 *      enclosing `{#each rows as node}` loop var. `findRForSlotNameCollisions`
 *      handles the producer-slot-NAME variant but NOT this consumer slot-PARAM
 *      variant. FIX: rename the snippet param binding (+ its body reads) to
 *      `node$$slot`.
 *
 *   2. LOOP-VAR == HELPER (collision-svelte §3 risk 2). `{#each rows as toggle}`
 *      where `const toggle = (x) => …` is a top-level `<script>` helper CALLED
 *      `{toggle(toggle)}` inside the loop. The compiled `{#each rows as toggle}`
 *      shadows the helper, so `toggle(...)` invokes the loop ITEM (a string) →
 *      runtime "toggle is not a function". FIX: rename the LOOP VAR (+ the
 *      loop-body item reads) to `toggle$loop`, leaving the helper CALL-callee
 *      bare so it resolves to the un-shadowed helper.
 *
 * NEITHER crash is caught by svelte-check / tsdown / the leaf typecheck — the
 * RENAME is the only guard. A structural assertion that the rename is present in
 * the emitted `{#each}`/`{#snippet}` output stands in for a runtime harness:
 * if the colliding binding survives, the component crashes at runtime.
 *
 * Plus the COMPILE-error tier (no runtime ambiguity, but no Svelte guard today):
 *   3. computed == slot (risk 4): a `$computed` named the same as a slot gets the
 *      `Slot` suffix on its `$derived` merge ident (portalSlotMergeName trigger
 *      widened from name∈props to name∈props∪data∪computed∪helpers).
 *   4. helper == emitter-generated name (risk 5): a helper/import named
 *      `getContext`/`portals`/`onMount`/`untrack`/`children`/`snippets` etc.
 *      auto-renames to `X$local` via a Svelte `{ kind: 'binding', programOnly }`
 *      deconflict group — a NESTED legal shadow is NOT renamed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../../emitSvelte.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../__tests__/fixtures');

function compileSvelte(src: string, filename = 'Test.rozie'): string {
  const { ast } = parse(src, { filename });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitSvelte(ir, { filename, source: src }).code;
}

const SLOT_PARAM_SHADOW = readFileSync(
  resolve(FIXTURES, 'SvelteSlotParamShadow.rozie'),
  'utf8',
);
const LOOP_VAR_HELPER = readFileSync(
  resolve(FIXTURES, 'SvelteLoopVarHelper.rozie'),
  'utf8',
);

// ── RUNTIME-ONLY risk 1: slot-param shadow ──────────────────────────────────
describe('Svelte slot-param shadow auto-fix (risk 1, runtime-only)', () => {
  const code = compileSvelte(SLOT_PARAM_SHADOW);

  it('renames the snippet param (`node` → `node$$slot`); loop var untouched', () => {
    // RUNTIME PROOF (no typecheck catches the shadow): the snippet param binding
    // is renamed and its body reads target the renamed binding.
    expect(code).toContain('{#snippet body({ node: node$$slot })}');
    expect(code).toContain('node$$slot.label');
    // The author's loop var stays bare `node` — the loop still iterates rows.
    expect(code).toContain('{#each rows as node (node.id)}');
    // No bare snippet-param `node` survives inside the snippet body.
    expect(code).not.toContain('{#snippet body({ node })}');
  });
});

// ── RUNTIME-ONLY risk 2: loop-var == helper ─────────────────────────────────
describe('Svelte loop-var == helper auto-fix (risk 2, runtime-only)', () => {
  const code = compileSvelte(LOOP_VAR_HELPER);

  it('renames the loop var (`toggle` → `toggle$loop`); helper call resolves to helper', () => {
    // The helper declaration is UNTOUCHED (it is the contract the call resolves to).
    expect(code).toContain('const toggle = (x: any)');
    // RUNTIME PROOF: the loop var + its item reads are renamed, but the helper
    // CALL-callee stays bare → `toggle(toggle$loop)` calls the helper with the
    // loop item, instead of the pre-fix `toggle(toggle)` which calls the item.
    expect(code).toContain('{#each rows as toggle$loop (toggle$loop.id)}');
    expect(code).toContain('toggle(toggle$loop)');
    // The pre-fix self-call shape is gone.
    expect(code).not.toContain('{#each rows as toggle (toggle.id)}');
    expect(code).not.toMatch(/toggle\(toggle\)/);
  });
});

// ── COMPILE-error risk 4: computed == slot ──────────────────────────────────
describe('Svelte computed == slot — `Slot` suffix (risk 4)', () => {
  it('suffixes the `$derived` slot-merge ident when a $computed shares the slot name', () => {
    const src = `<rozie name="ComputedSlot">
<data>{ n: 1 }</data>
<script>
const header = $computed(() => $data.n + 1);
</script>
<template>
  <div>
    <span class="c">{{ header }}</span>
    <slot name="header">fallback</slot>
  </div>
</template>
</rozie>`;
    const code = compileSvelte(src);
    // The slot-merge `const header` would collide with the `$computed` `const
    // header = $derived(...)` → suffix the slot merge `headerSlot`.
    expect(code).toContain('const headerSlot = $derived(__headerProp ?? snippets?.header);');
    // The {@render} site references the suffixed merge.
    expect(code).toContain('headerSlot');
  });

  it('keeps the bare merge ident when no binding collides (byte-identical)', () => {
    const src = `<rozie name="PlainSlot">
<template>
  <div><slot name="footer">x</slot></div>
</template>
</rozie>`;
    const code = compileSvelte(src);
    expect(code).toContain('const footer = $derived(__footerProp ?? snippets?.footer);');
    expect(code).not.toContain('footerSlot');
  });
});

// ── COMPILE-error risk 5: helper == emitter-generated name ───────────────────
describe('Svelte helper == emitter-generated name — `$local` rename (risk 5)', () => {
  it('renames a top-level helper named `getContext` to `getContext$local`', () => {
    const src = `<rozie name="HelperGen">
<data>{ n: 0 }</data>
<script>
const getContext = () => $data.n + 1;
const show = () => getContext();
</script>
<template>
  <button @click="show">{{ getContext() }}</button>
</template>
</rozie>`;
    const code = compileSvelte(src);
    // The helper duplicate-binds / shadows the folded `getContext` svelte import
    // → rename the user binding + its reads.
    expect(code).toContain('getContext$local');
    expect(code).not.toMatch(/const getContext\s*=/);
  });

  it('does NOT rename a NESTED legal shadow (programOnly — no over-application)', () => {
    // A function PARAM named `getContext` is a legal nested shadow, never a
    // top-level collision → must stay bare (the over-application class 61-07 fixed).
    const src = `<rozie name="NestedShadow">
<data>{ n: 0 }</data>
<script>
const run = (getContext) => getContext + $data.n;
</script>
<template>
  <button @click="run(1)">{{ $data.n }}</button>
</template>
</rozie>`;
    const code = compileSvelte(src);
    expect(code).toContain('const run = (getContext');
    expect(code).not.toContain('getContext$local');
  });
});
