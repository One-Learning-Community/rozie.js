/**
 * Phase 61 Plan 08 (SC-2, Svelte leg) — the RUNTIME-ONLY collision tier.
 *
 * Svelte's deadliest collision class has NO typecheck net: svelte-check passes,
 * tsdown/oxc dts does NOT body-typecheck, and the @rozie-ui svelte leaves ship
 * raw source with no ng-packagr-equivalent body gate. Two variants reach
 * production with zero compile signal:
 *
 *   1. SLOT-PARAM SHADOW (collision-svelte §3 risk 1). A consumer fill
 *      `<template #body="{ node }">` whose snippet param `node` shadows an
 *      enclosing `{#each rows as node}` loop var. The emitted `{#snippet body({
 *      node })}` reads the wrong `node` at runtime. `findRForSlotNameCollisions`
 *      handles the producer-slot-NAME variant but NOT this consumer slot-PARAM
 *      variant. FIX: rename the snippet param binding (+ its body reads) to
 *      `node$$slot`.
 *
 *   2. LOOP-VAR == HELPER (collision-svelte §3 risk 2). `{#each rows as toggle}`
 *      where `const toggle = (x) => …` is a top-level `<script>` helper CALLED
 *      `{toggle(toggle)}` inside the loop. The compiled `{#each rows as toggle}`
 *      shadows the helper, so `toggle(...)` invokes the loop ITEM (a string) →
 *      runtime "toggle is not a function". FIX: rename the helper binding (+ the
 *      loop-body CALL site) to `toggle$helper`, leaving the loop var + the
 *      loop-item read untouched.
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
 *   4. helper == emitter-generated name (risk 5): a helper/data named
 *      `getContext`/`portals`/`onMount`/`untrack`/`children`/`snippets` etc.
 *      auto-renames via a Svelte `{ kind: 'binding' }` deconflict group.
 *
 * RED-first: this file is authored BEFORE the Task-2 emitter change. The
 * `describe('RED baseline …')` blocks pin the BROKEN pre-fix output (the
 * shadowing binding present). Task 2 flips them to the GREEN assertions below.
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

// ── RED baseline (RUNTIME-ONLY — no typecheck catches the shadow) ───────────
describe('RED baseline — slot-param shadow (risk 1, runtime-only)', () => {
  it('emits the unrenamed snippet param `node` shadowing the loop var', () => {
    const code = compileSvelte(SLOT_PARAM_SHADOW);
    // Loop var `node` and snippet param `node` are BOTH bare → the snippet body
    // reads the snippet param, shadowing the loop item. RUNTIME-ONLY: svelte-check
    // is silent. The shadowing `{#snippet body({ node })}` is the bug.
    expect(code).toContain('{#each rows as node (node.id)}');
    expect(code).toContain('{#snippet body({ node })}');
    expect(code).not.toContain('node$$slot');
  });
});

describe('RED baseline — loop-var == helper (risk 2, runtime-only)', () => {
  it('emits the loop var `toggle` shadowing the `const toggle` helper call', () => {
    const code = compileSvelte(LOOP_VAR_HELPER);
    // The helper `const toggle` stays bare AND the loop var is `toggle` → inside
    // the loop `toggle(toggle)` calls the loop ITEM (a string). RUNTIME-ONLY.
    expect(code).toContain('const toggle = (x: any)');
    expect(code).toContain('{#each rows as toggle (toggle.id)}');
    expect(code).toContain('toggle(toggle)');
    expect(code).not.toContain('toggle$helper');
  });
});
