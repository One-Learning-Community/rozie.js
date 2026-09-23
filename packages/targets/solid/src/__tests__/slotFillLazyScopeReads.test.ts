/**
 * Quick 260922-mkb — Solid consumer slot fills read their scope LAZILY.
 *
 * The producer invokes a scoped slot inside a tracked JSX expression, passing a
 * getter-backed ctx (`{ get grouping() { … } }`, F-03). The consumer used to emit
 * `slotName={({ grouping, … }) => …}`: that destructuring READS every getter at
 * call time, inside the producer's tracking scope, so any scope change re-ran the
 * producer's expression and re-created the whole fill subtree — focus lost,
 * component state reset. Measured on @rozie-ui/data-table: the #groupBar fill's
 * GroupBar root and the focused chip were fresh nodes after one Enter (C-04), and
 * a #editor drop-in was torn down by its own commit's re-render (C-10).
 *
 * The fill now binds the ctx object and reads `ctx.<prop>` at each use site, so
 * each read is tracked by the fine-grained computation that uses it. These cases
 * pin the shape AND every place a scope param can be read from, because a path
 * that misses the rewrite would emit an unbound identifier.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  return lowered.ir;
}

function emit(rozie: string): string {
  const ir = lowerInline(rozie);
  const out = emitSolid(ir, { filename: 'inline.rozie', source: rozie });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.code;
}

const consumer = (body: string, extraData = ''): string => `
<rozie name="Host">
<components>{ Bar: './Bar.rozie' }</components>
<data>{ items: [1, 2], ${extraData} }</data>
<template>
<Bar>
${body}
</Bar>
</template>
</rozie>`;

describe('Solid consumer scoped slot fill — lazy scope reads', () => {
  it('does not destructure the scope; interpolations read ctx.<prop>', () => {
    const code = emit(consumer(`<template #head="{ grouping, count }"><span>{{ grouping }} / {{ count }}</span></template>`));
    expect(code).not.toMatch(/headSlot=\{\(\{/);
    expect(code).toMatch(/headSlot=\{\(_rozieSlot\) =>/);
    expect(code).toContain('_rozieSlot.grouping');
    expect(code).toContain('_rozieSlot.count');
  });

  it('rewrites r-if tests, attribute bindings, event handlers and r-for iterables', () => {
    const code = emit(consumer(`<template #head="{ open, label, toggle, rows }">
  <b r-if="open" :title="label" @click="toggle(label)">x</b>
  <i r-else-if="rows.length > 0">y</i>
  <u r-for="r in rows" :key="r">{{ r }}</u>
</template>`));
    expect(code).toContain('_rozieSlot.open');
    expect(code).toContain('_rozieSlot.label');
    expect(code).toContain('_rozieSlot.toggle(_rozieSlot.label)');
    expect(code).toContain('_rozieSlot.rows.length');
    expect(code).toMatch(/each=\{_rozieSlot\.rows[ }]/);
    // No bare param survives anywhere in value position.
    expect(code).not.toMatch(/[^.\w]open\b(?!:)/);
  });

  it('honours bindAs renames: the local name maps to the declared scope property', () => {
    const code = emit(consumer(`<template #head="{ grouping: g }"><span>{{ g }}</span></template>`));
    expect(code).toContain('_rozieSlot.grouping');
    expect(code).not.toMatch(/[^.\w]g\b/);
  });

  it('an r-for alias that shadows a scope param wins inside the loop body', () => {
    const code = emit(consumer(`<template #head="{ label, rows }"><u r-for="label in rows" :key="label">{{ label }}</u><s>{{ label }}</s></template>`));
    // Outside the loop: the scope read.
    expect(code).toMatch(/<s[^>]*>\{rozieDisplay\(_rozieSlot\.label\)\}<\/s>/);
    // Inside the loop: the alias, never the scope.
    expect(code).toContain('by={(label) => label}');
    expect(code).toContain('{rozieDisplay(label())}</u>');
  });

  it('an expression-local binding that shadows a scope param is left alone', () => {
    const code = emit(consumer(`<template #head="{ label, rows }"><b @click="rows.forEach((label) => label)">x</b></template>`));
    expect(code).toContain('_rozieSlot.rows.forEach(label => label)');
  });

  it('a shorthand object property keeps its key and reads the scope for its value', () => {
    const code = emit(consumer(`<template #head="{ label }"><b :data-x="JSON.stringify({ label })">x</b></template>`));
    expect(code).toContain('label: _rozieSlot.label');
  });

  it('a nested fill gets its own ctx and still reads the outer one', () => {
    const code = emit(`
<rozie name="Host">
<components>{ Bar: './Bar.rozie', Baz: './Baz.rozie' }</components>
<template>
<Bar>
  <template #head="{ label }">
    <Baz><template #item="{ value }"><i>{{ label }}:{{ value }}</i></template></Baz>
  </template>
</Bar>
</template>
</rozie>`);
    expect(code).toMatch(/headSlot=\{\(_rozieSlot\) =>/);
    expect(code).toMatch(/itemSlot=\{\(_rozieSlot1\) =>/);
    expect(code).toContain('_rozieSlot.label');
    expect(code).toContain('_rozieSlot1.value');
  });

  it('record-routed fills (non-identifier names) read lazily too', () => {
    const code = emit(consumer(`<template #cell-status="{ value }"><i>{{ value }}</i></template>`));
    expect(code).toMatch(/'cell-status': \(_rozieSlot\) =>/);
    expect(code).toContain('_rozieSlot.value');
  });

  it('a param-less named fill keeps the zero-arg arrow', () => {
    const code = emit(consumer(`<template #head><i>x</i></template>`));
    expect(code).toMatch(/headSlot=\{\(\) =>/);
  });
});
