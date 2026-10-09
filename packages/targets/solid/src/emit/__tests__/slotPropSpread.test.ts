/**
 * Quick 261008-mmu Task 1 — the component's OWN slot props must never reach the
 * root DOM spread (Solid).
 *
 * `emitPropsInterface.ts` declares `<name>Slot?` (+ `children?`) and the
 * `slots?:` record on the props interface for every slot the component
 * declares, but the `splitProps(...)` key list never learned them, so they
 * fell into the `attrs` rest bucket that is spread onto the root element. Solid
 * writes an unknown spread key with `setAttribute`, which stringifies a
 * function: a consumer's `toastSlot` became a `toastslot="({toast:e})=>..."`
 * DOM attribute holding the render function's source.
 *
 * Third member of one class — props first, emit handlers second (Quick
 * 260802-v1v seam 1, emitHandlerSpread.test.ts), slot members here.
 *
 * Invariants only (spike REQ-33): membership in the PARSED key list, never a
 * whole-line golden string.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../../emitSolid.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitSolid(ir, { filename: 'Test.rozie', source: rozieSrc }).code;
}

/** The parsed `splitProps(<target>, [keys])` key list, quotes stripped. */
function splitPropsKeys(code: string): string[] {
  const line = code.split('\n').find((l) => l.includes('splitProps('));
  if (line === undefined) throw new Error('no splitProps(...) line in emitted Solid code');
  const m = /splitProps\([^,]+,\s*\[([^\]]*)\]\)/.exec(line);
  if (m === null) throw new Error(`could not parse the splitProps key list from: ${line}`);
  return m[1]!
    .split(',')
    .map((k) => k.trim().replace(/^'|'$/g, ''))
    .filter((k) => k.length > 0);
}

describe('emitSolid — slot props never fall into the root DOM spread (Quick 261008-mmu)', () => {
  it('(a) a scoped named slot + a default slot: the key list skips rowSlot, children and slots', () => {
    const code = compile(`<rozie name="Test">
<props>
  { label: { type: String, default: '' } }
</props>
<template>
  <div>
    <slot name="row" :label="$props.label"></slot>
    <slot></slot>
  </div>
</template>
</rozie>`);
    const keys = splitPropsKeys(code);
    expect(keys).toContain('label');
    expect(keys).toContain('children');
    expect(keys).toContain('rowSlot');
    expect(keys).toContain('slots');
  });

  it('(b) control: a slot-free component keeps exactly the declared prop in the key list', () => {
    const code = compile(`<rozie name="Test">
<props>
  { label: { type: String, default: '' } }
</props>
<template>
  <div>{{ $props.label }}</div>
</template>
</rozie>`);
    expect(splitPropsKeys(code)).toEqual(['label']);
  });

  it('(c) record-only: a lone dynamic-name slot adds no named key and no children, but slots IS skipped', () => {
    const code = compile(`<rozie name="OnlyDynamic">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>`);
    const keys = splitPropsKeys(code);
    expect(keys).not.toContain('children');
    expect(keys.filter((k) => k.endsWith('Slot'))).toEqual([]);
    expect(keys).toContain('slots');
  });

  it('(e) non-regression: a slot AND an $emit — the on<Event> handler key is still skipped (slot keys are pinned by (a))', () => {
    const code = compile(`<rozie name="Test">
<props>
  { label: { type: String, default: '' } }
</props>
<template>
  <div>
    <slot name="row" :label="$props.label"></slot>
  </div>
</template>
<script>
function commit(next) {
  $emit('change', next)
}
</script>
</rozie>`);
    const keys = splitPropsKeys(code);
    expect(keys).toContain('label');
    expect(keys).toContain('onChange');
  });
});
