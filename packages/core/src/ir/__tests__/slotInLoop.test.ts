/**
 * SlotDecl.inLoop — derived by lowerSlots (Quick 260808-iyh, D5 Task 1).
 *
 * RED-FIRST: `inLoop` does not yet exist on SlotDecl / is not yet set by
 * lowerSlots, so every `inLoop === true` assertion below fails until the
 * implementation lands. The `toBeUndefined()` case is the back-compat guard —
 * it must stay green before AND after the change.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import type { IRComponent, SlotDecl } from '../types.js';

function lower(source: string, filename = 'SlotInLoop.rozie'): IRComponent {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() null AST: ${diagnostics.map((d) => d.message).join(', ')}`);
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry(), filename });
  if (!ir) throw new Error('lowerToIR returned null ir');
  return ir;
}

function findSlot(ir: IRComponent, name: string): SlotDecl {
  const slot = ir.slots.find((s) => s.name === name);
  if (!slot) throw new Error(`slot '${name}' not found among: ${ir.slots.map((s) => s.name).join(', ')}`);
  return slot;
}

describe('lowerSlots — SlotDecl.inLoop derivation (D5 gate input)', () => {
  it('sets inLoop === true for a <slot> nested directly under an r-for element', () => {
    const ir = lower(`
<rozie name="SlotInLoop">
<props>{ items: { type: Array, default: () => [] } }</props>
<template>
  <ul>
    <li r-for="item, i in $props.items" :key="i">
      <slot name="row" :item="item" />
    </li>
  </ul>
</template>
</rozie>`);
    expect(findSlot(ir, 'row').inLoop).toBe(true);
  });

  it('leaves inLoop undefined (NOT false) for a top-level slot with no r-for ancestor', () => {
    const ir = lower(`
<rozie name="SlotInLoop">
<template>
  <div>
    <slot name="header" />
  </div>
</template>
</rozie>`);
    expect(findSlot(ir, 'header').inLoop).toBeUndefined();
  });

  it('sets inLoop === true when r-for is on the <slot> element itself', () => {
    const ir = lower(`
<rozie name="SlotInLoop">
<props>{ n: { type: Number, default: 0 } }</props>
<template>
  <slot name="x" r-for="i in $props.n" :key="i" />
</template>
</rozie>`);
    expect(findSlot(ir, 'x').inLoop).toBe(true);
  });

  it('sets inLoop === true for a slot nested two levels below an r-for element', () => {
    const ir = lower(`
<rozie name="SlotInLoop">
<props>{ items: { type: Array, default: () => [] } }</props>
<template>
  <ul>
    <li r-for="item, i in $props.items" :key="i">
      <div>
        <span>
          <slot name="deep" :item="item" />
        </span>
      </div>
    </li>
  </ul>
</template>
</rozie>`);
    expect(findSlot(ir, 'deep').inLoop).toBe(true);
  });

  it('sets inLoop === true for a slot nested inside another slot\'s default content, under r-for, after flattening', () => {
    const ir = lower(`
<rozie name="SlotInLoop">
<props>{ items: { type: Array, default: () => [] } }</props>
<template>
  <ul>
    <li r-for="item, i in $props.items" :key="i">
      <slot name="row" :item="item">
        <slot name="inner" :item="item" />
      </slot>
    </li>
  </ul>
</template>
</rozie>`);
    expect(findSlot(ir, 'row').inLoop).toBe(true);
    expect(findSlot(ir, 'inner').inLoop).toBe(true);
  });
});
