/**
 * r-for-loop-var == slot-name collision auto-fix (Svelte target).
 *
 * When a `<slot name="X">` is rendered INSIDE an `r-for` whose loop variable is
 * also `X`, the naive Svelte emit shadows the snippet binding: inside the
 * compiled `{#each … as X}` the bare `X` resolves to the loop ITEM (a
 * non-function), so `{@render X(...)}` crashes at runtime ("X is not a
 * function") — Svelte only. The other five targets keep loop scope and slot
 * invocation in distinct namespaces and are immune.
 *
 * The Svelte emitter auto-fixes this (superseding the retired ROZ980 warning):
 * it renames ONLY the emitter-generated snippet binding (and every `{@render}` /
 * `{#if}` reference) to the safe suffixed `X$$slot`. The author's loop var `X`
 * and the slot-arg VALUES (`{ X, … }` — the loop item passed to the slot) stay
 * exactly as-authored. CONDITIONAL: only colliding slots are renamed, so
 * non-colliding components emit byte-identical Svelte.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { findRForSlotNameCollisions } from '../../../../../core/src/ir/findRForSlotNameCollisions.js';
import { emitSvelte } from '../../emitSvelte.js';

function lower(rozieSrc: string) {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir, diagnostics } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return { ir, diagnostics };
}

function compileSvelte(rozieSrc: string): string {
  const { ir } = lower(rozieSrc);
  return emitSvelte(ir, { filename: 'Test.rozie', source: rozieSrc }).code;
}

// Loop var `toast` shadows `<slot name="toast">` rendered inside the loop.
const COLLIDING = `<rozie name="Toaster">
<data>{ items: [] }</data>
<template>
  <ul>
    <li r-for="toast in $data.items" :key="toast.id">
      <slot name="toast" :toast="toast">x</slot>
    </li>
  </ul>
</template>
</rozie>`;

// Loop var `t` differs from `<slot name="toast">` — no collision.
const NON_COLLIDING = `<rozie name="Toaster">
<data>{ items: [] }</data>
<template>
  <ul>
    <li r-for="t in $data.items" :key="t.id">
      <slot name="toast" :toast="t">x</slot>
    </li>
  </ul>
</template>
</rozie>`;

describe('findRForSlotNameCollisions — pure detector', () => {
  it('returns the colliding slot name when loop var == slot name rendered inside the loop', () => {
    const { ir } = lower(COLLIDING);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set(['toast']));
  });

  it('returns empty when the loop var differs from the slot name', () => {
    const { ir } = lower(NON_COLLIDING);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set());
  });

  it('returns empty when a same-named slot is rendered OUTSIDE the loop (disjoint scope)', () => {
    const { ir } = lower(`<rozie name="T">
<data>{ items: [] }</data>
<template>
  <div>
    <slot name="item">x</slot>
    <ul><li r-for="item in $data.items" :key="item.id">{{ item.id }}</li></ul>
  </div>
</template>
</rozie>`);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set());
  });

  it('no longer emits the retired ROZ980 warning', () => {
    const { diagnostics } = lower(COLLIDING);
    expect(diagnostics.filter((d) => d.code === 'ROZ980')).toHaveLength(0);
  });
});

describe('Svelte emitter — r-for/slot-name collision auto-fix', () => {
  it('renames the emitter-generated snippet binding + its {@render} site to `<name>$$slot`', () => {
    const code = compileSvelte(COLLIDING);

    // (a) the snippet binding is renamed.
    expect(code).toContain('const toast$$slot = $derived(__toastProp ?? snippets?.toast);');
    // (b) the render site references the renamed binding.
    expect(code).toContain('{@render toast$$slot(');
    expect(code).toContain('{#if toast$$slot}');
    // (c) the author's loop var is UNCHANGED.
    expect(code).toContain('{#each items as toast (toast.id)}');
    // (d) the slot-arg VALUE (the loop item passed to the slot) stays bare `toast`
    //     (shorthand `{ toast }` — the loop item passed into the renamed snippet).
    expect(code).toContain('{@render toast$$slot({ toast })}');
    // (e) no bare `{@render toast(` survives (that would render the loop item).
    expect(code).not.toContain('{@render toast(');
    expect(code).not.toContain('const toast = $derived(');
  });

  it('does NOT rename when the loop var differs (byte-identical bare binding)', () => {
    const code = compileSvelte(NON_COLLIDING);
    expect(code).toContain('const toast = $derived(__toastProp ?? snippets?.toast);');
    expect(code).not.toContain('toast$$slot');
  });
});
