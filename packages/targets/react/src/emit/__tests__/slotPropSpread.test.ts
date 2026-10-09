/**
 * Quick 261008-mmu Task 1 — the component's OWN slot props must never reach the
 * root DOM spread (React).
 *
 * `emitPropsInterface.ts` declares `render<Name>?` (+ `children?` for a
 * declared default slot) and the `slots?:` record on the props interface for
 * every slot the component declares, but the `attrs` IIFE's `declaredNames`
 * skip list never learned them, so they fell into the rest bucket that is
 * spread onto the root element.
 *
 * Third member of one class — props first, emit handlers second (Quick
 * 260802-v1v seam 1, emitHandlerSpread.test.ts), slot members here.
 *
 * Invariants only (spike REQ-33): membership in the PARSED destructure list and
 * in the `void` chain, never a whole-line golden string.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitReact(ir, { filename: 'Test.rozie', source: rozieSrc }).code;
}

interface AttrsBucket {
  /** Names destructured ahead of `...rest`; null when the shortcut cast is used. */
  destructured: string[] | null;
  /** Names in the `void a; void b;` chain. */
  voided: string[];
}

function attrsBucket(code: string): AttrsBucket {
  const m = /const\s*\{([^}]*?)\s*,?\s*\.\.\.rest\s*\}\s*=/.exec(code);
  if (m === null) {
    expect(code).toContain('const attrs = props as Record<string, unknown>;');
    return { destructured: null, voided: [] };
  }
  const destructured = m[1]!
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  const voidMatch = /\n\s*void\s+([^\n]*);\n\s*return rest;/.exec(code);
  const voided =
    voidMatch === null
      ? []
      : voidMatch[1]!
          .split(/;\s*void\s+/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
  return { destructured, voided };
}

describe('emitScript (React) — slot props never fall into the root DOM spread (Quick 261008-mmu)', () => {
  it('(a) a scoped named slot + a default slot: the destructure skips renderRow, children and slots (and voids them)', () => {
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
    const { destructured, voided } = attrsBucket(code);
    expect(destructured).not.toBeNull();
    for (const name of ['label', 'renderRow', 'children', 'slots']) {
      expect(destructured).toContain(name);
      expect(voided).toContain(name);
    }
  });

  it('(b) control: a slot-free component destructures exactly the declared prop (no slots, no children)', () => {
    const code = compile(`<rozie name="Test">
<props>
  { label: { type: String, default: '' } }
</props>
<template>
  <div>{{ $props.label }}</div>
</template>
</rozie>`);
    const { destructured } = attrsBucket(code);
    expect(destructured).toEqual(['label']);
  });

  it('(c) record-only: a lone dynamic-name slot adds no render<Name> and no children, but slots IS skipped', () => {
    const code = compile(`<rozie name="OnlyDynamic">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>`);
    const { destructured } = attrsBucket(code);
    expect(destructured).not.toBeNull();
    expect(destructured).not.toContain('children');
    expect(destructured!.filter((k) => k.startsWith('render'))).toEqual([]);
    expect(destructured).toContain('slots');
  });

  it('(d) a zero-prop, zero-emit component with one named slot takes the IIFE branch and emits a well-formed destructure', () => {
    const code = compile(`<rozie name="Bare">
<template>
  <div><slot name="row"></slot></div>
</template>
</rozie>`);
    // CR-01 shapes: never an empty binding list, never a bare `void ;`.
    expect(code).not.toContain('const { , ...rest }');
    expect(code).not.toContain('void ;');
    const { destructured, voided } = attrsBucket(code);
    expect(destructured).not.toBeNull();
    expect(destructured).toContain('renderRow');
    expect(destructured).toContain('slots');
    expect(voided).toContain('renderRow');
    expect(voided).toContain('slots');
  });

  it('(e) non-regression: a slot AND an $emit — the on<Event> handler is still skipped (slot names are pinned by (a))', () => {
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
    const { destructured } = attrsBucket(code);
    expect(destructured).toContain('label');
    expect(destructured).toContain('onChange');
  });
});
