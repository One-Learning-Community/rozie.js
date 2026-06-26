/**
 * findReprojectionSlotNameCollisions — unit cases for the re-projected-slot ==
 * child-fill-name collision detector (the Svelte5/Angular/Lit slot-shadow class
 * first exercised by the command-palette → vendored-listbox composition,
 * Phase 999.4).
 *
 * The detector is the scope-precise source of truth the per-target emitters
 * consult to decide which slot RESOLVERS to suffix-rename (`X$$slot`) so the
 * forwarded fill keeps the child-required name `X` without shadowing.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { findReprojectionSlotNameCollisions } from '../findReprojectionSlotNameCollisions.js';
import type { IRComponent } from '../types.js';

function lower(source: string, filename = 'Reproject.rozie'): IRComponent {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() null AST: ${diagnostics.map((d) => d.message).join(', ')}`);
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry(), filename });
  if (!ir) throw new Error('lowerToIR returned null ir');
  return ir;
}

describe('findReprojectionSlotNameCollisions', () => {
  it('flags a slot re-projected into a child fill of the SAME name', () => {
    const ir = lower(`
<rozie name="Reproject">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child>
    <template #option="{ option, index }">
      <slot name="option" :option="option" :index="index">
        <span>{{ option }}</span>
      </slot>
    </template>
  </Child>
</template>
</rozie>`);
    const set = findReprojectionSlotNameCollisions(ir);
    expect(set.has('option')).toBe(true);
    expect(set.size).toBe(1);
  });

  it('does NOT flag a slot re-projected into a child fill of a DIFFERENT name', () => {
    const ir = lower(`
<rozie name="Reproject">
<components>{ Inner: './Inner.rozie' }</components>
<template>
  <Inner>
    <template #header="{ close }">
      <slot name="title" :close="close" />
    </template>
  </Inner>
</template>
</rozie>`);
    const set = findReprojectionSlotNameCollisions(ir);
    expect(set.size).toBe(0);
  });

  it('does NOT flag a slot invocation outside any child fill', () => {
    const ir = lower(`
<rozie name="Reproject">
<template>
  <div>
    <slot name="option" />
  </div>
</template>
</rozie>`);
    const set = findReprojectionSlotNameCollisions(ir);
    expect(set.size).toBe(0);
  });

  it('returns an empty set when the template is null / has no slots', () => {
    const ir = lower(`
<rozie name="Reproject">
<template><div>plain</div></template>
</rozie>`);
    expect(findReprojectionSlotNameCollisions(ir).size).toBe(0);
  });
});
