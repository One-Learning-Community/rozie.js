/**
 * staticScopedRozieSlots.test.ts — a non-Rozie Lit consumer fills ANY scoped
 * slot through the `rozieSlots` record.
 *
 * `docs/parity.md` documents `el.rozieSlots = { '<name>': (scope) => html… }`
 * as the third-party fill API. Before this fix the producer consulted the
 * record only for dynamic and non-identifier slot names; an identifier-named
 * scoped slot (`row`) or the scoped default slot dispatched only through its
 * named function property (`this.row`, `this.__rozieDefaultSlot__`), so a
 * record entry was silently ignored. Now every static scoped slot tries
 * `this.rozieSlots?.['<name>']` first (`'default'` for the default slot),
 * then the named property (Rozie consumers), then the `<slot>` element.
 * Portal and paramless slots are unchanged.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '@rozie/core';

const SRC = `<rozie name="ScopedHost">
<props>
{
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
}
</props>
<template>
<div>
  <slot name="header"></slot>
  <slot name="caption" :title="$props.title"></slot>
  <ul>
    <li r-for="(item, index) in $props.items" :key="index"><slot :item="item" :index="index">{{ item }}</slot></li>
  </ul>
</div>
</template>
</rozie>
`;

function code(): string {
  const r = compile(SRC, { target: 'lit', filename: 'ScopedHost.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code;
}

describe('static scoped slots consult the rozieSlots record first', () => {
  it('the scoped default slot: record (key "default"), then __rozieDefaultSlot__, then <slot>', () => {
    const c = code();
    expect(c).toContain(
      "this.rozieSlots?.['default'] !== undefined ? this.rozieSlots?.['default']!({item: item, index: index}) : this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({item: item, index: index}) : html`<slot",
    );
  });

  it('an identifier-named scoped slot: record (its name), then the named property, then <slot>', () => {
    const c = code();
    expect(c).toContain(
      "this.rozieSlots?.['caption'] !== undefined ? this.rozieSlots?.['caption']!({title: this.title}) : this.caption !== undefined ? this.caption({title: this.title}) : html`<slot name=\"caption\"",
    );
  });

  it('declares the record property, and leaves a paramless slot as a plain <slot>', () => {
    const c = code();
    expect(c).toMatch(/@property\(\{ attribute: false \}\) rozieSlots\?:/);
    expect(c).not.toContain("rozieSlots?.['header']");
    expect(c).toContain('<slot name="header"></slot>');
  });

  it('with a dynamic slot family, the record type names the static scoped slots too (typed scope for their fills)', () => {
    const src = SRC.replace(
      '<slot name="header"></slot>',
      '<slot name="header"></slot><slot r-for="k in $props.items" :key="k" :name="`cell-${k}`" :value="k"></slot>',
    );
    const r = compile(src, { target: 'lit', filename: 'ScopedHost.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const decl = r.code.split('\n').find((l) => l.includes('rozieSlots?:'))!;
    expect(decl).toContain("'caption'?: (scope: { title: any }) => unknown;");
    expect(decl).toContain("'default'?: (scope: { item: any; index: any }) => unknown;");
    expect(decl).not.toContain("'header'?:");
    expect(decl).toContain('[key: `cell-${string}`]');
  });
});
