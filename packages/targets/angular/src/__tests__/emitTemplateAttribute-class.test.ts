/**
 * Angular `:class` — an object or nested array INSIDE a class list must apply.
 *
 * Angular's native `[class]` (and `[ngClass]`) accept `string | string[] |
 * Set | Record<string, boolean>`, but array ENTRIES must be strings: an object
 * (or nested array) inside an array is dropped (`[class]`) or throws
 * (`[ngClass]`). The other five targets follow Vue semantics — a class value is
 * a string, a `{ name: truthy }` object, or an array whose entries are any of
 * these, recursively. So a `:class` whose value may hold such entries is
 * flattened through `rozieClass(...)` (`@rozie/runtime-angular`, imported as
 * `__rozieClass`, delegated by a same-named class method because Angular AOT
 * resolves template identifiers against the component instance).
 *
 * Shapes Angular already handles natively (a string, a template literal, a
 * string concat/conditional, a plain object literal, an array of plain
 * strings) stay unwrapped, so their output is unchanged.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

function compileAngular(body: string): string {
  const src = `<rozie name="Cls" inherit-attrs="false">
<props>{ listClass: { type: [String, Array, Object], default: '' }, kind: { type: String, default: 'a' } }</props>
<data>{ cond: true }</data>
<template>
${body}
</template>
</rozie>`;
  const result = parse(src, { filename: 'Cls.rozie' });
  if (!result.ast) {
    throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const ir: IRComponent = lowered.ir;
  return emitAngular(ir, { filename: 'Cls.rozie', source: src }).code;
}

const IMPORT = 'rozieClass as __rozieClass';
const METHOD = 'rozieClass(...args: unknown[]): string { return __rozieClass(...args); }';

describe('Angular `:class` — nested objects/arrays in a class list', () => {
  it('wraps an array literal holding an object', () => {
    const code = compileAngular(`<div :class="['a', { b: $data.cond }]"></div>`);
    expect(code).toContain(`[class]="rozieClass(['a', { b: cond() }])"`);
    expect(code).toMatch(/import \{[^}]*rozieClass as __rozieClass[^}]*\} from '@rozie\/runtime-angular';/);
    expect(code).toContain(METHOD);
  });

  it('wraps a prop read (its runtime value may be an array holding objects)', () => {
    const code = compileAngular(`<div :class="['a', $props.listClass]"></div>`);
    expect(code).toContain(`[class]="rozieClass(['a', listClass()])"`);
  });

  it('wraps a bare prop read', () => {
    const code = compileAngular(`<div :class="$props.listClass"></div>`);
    expect(code).toContain(`[class]="rozieClass(listClass())"`);
  });

  it('wraps the [ngClass] merge when a static class sits beside a list with an object', () => {
    const code = compileAngular(`<div class="base" :class="['x', { y: $data.cond }]"></div>`);
    expect(code).toContain(`class="base"`);
    expect(code).toContain(`[ngClass]="rozieClass(['x', { y: cond() }])"`);
    expect(code).toContain(METHOD);
  });

  it('wraps the [ngClass] merge of a static class and a prop', () => {
    const code = compileAngular(`<div class="base" :class="$props.listClass"></div>`);
    expect(code).toContain(`[ngClass]="rozieClass(listClass())"`);
  });

  describe('shapes Angular already handles stay unwrapped', () => {
    it.each([
      [`{ b: $data.cond }`, `[class]="{ b: cond() }"`],
      [`'a b'`, `[class]="'a b'"`],
      [`['a', 'b']`, `[class]="['a', 'b']"`],
      [`$data.cond ? 'on' : 'off'`, `[class]="cond() ? 'on' : 'off'"`],
      [`'k-' + $props.kind`, `[class]="'k-' + kind()"`],
    ])('`:class="%s"`', (expr, expected) => {
      const code = compileAngular(`<div :class="${expr}"></div>`);
      expect(code).toContain(expected);
      expect(code).not.toContain(IMPORT);
      expect(code).not.toContain('rozieClass(');
    });

    it('static class + object literal merge stays on plain [ngClass]', () => {
      const code = compileAngular(`<div class="base" :class="{ y: $data.cond }"></div>`);
      expect(code).toContain(`[ngClass]="{ y: cond() }"`);
      expect(code).not.toContain('rozieClass(');
    });
  });
});
