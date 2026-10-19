/**
 * EB-1 (quick 261019-9g1) — Vue drops a nullable value bound to a plain-string
 * ARIA attribute on an HTML element via `(expr) ?? undefined`.
 *
 * `@vue/runtime-dom` 3.5 `AriaAttributes` types these 12 names as plain
 * `string | undefined` (never `| null`), so a nullable-shaped binding
 * (`string | null` prop) bound RAW is a vue-tsc TS2322 for a strict consumer that
 * compiles the emitted `.vue` source:
 *   aria-controls, aria-describedby, aria-details, aria-errormessage,
 *   aria-flowto, aria-keyshortcuts, aria-label, aria-labelledby, aria-owns,
 *   aria-placeholder, aria-roledescription, aria-valuetext.
 * (`aria-activedescendant` already lives in NULLABLE_DOM_ATTR_SLOTS.)
 *
 * Guards pinned here:
 *  - HTML hosts only — on a component host the slot is the child's prop type and
 *    `undefined` would select the child prop's default (a runtime change).
 *  - provably-non-nullish shapes (binary, both-non-null ternary) stay RAW (TS2869).
 *  - an expression that already ends in `|| undefined` / `?? undefined` stays RAW.
 *  - the enumerated-string ARIA names (aria-current…) are excluded by design.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

const NAMES = [
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-owns',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
];

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'Test.rozie' });
  if (!result.ast)
    throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

const PROPS = `<props>{ label: { type: String, default: null }, on: { type: Boolean, default: false }, n: { type: Number, default: null }, cur: { type: String, default: null } }</props>`;

function emitFor(attr: string, expr: string): string {
  const ir = lowerInline(`<rozie name="Test">
${PROPS}
<template>
  <div :${attr}="${expr}"></div>
</template>
</rozie>`);
  const { template, diagnostics } = emitTemplate(ir, REGISTRY);
  expect(diagnostics).toEqual([]);
  return template;
}

describe('emitTemplateAttribute (Vue) — nullable string ARIA drop (EB-1)', () => {
  for (const name of NAMES) {
    it(`${name} bound to a nullable prop on a <div> wraps as (expr) ?? undefined`, () => {
      const template = emitFor(name, '$props.label');
      expect(template).toMatch(new RegExp(`:${name}="\\(props\\.label\\) \\?\\? undefined"`));
    });
  }

  it('RAW: a binary operand stays unwrapped (TS2869 guard)', () => {
    const template = emitFor('aria-label', "'Item ' + $props.label");
    expect(template).toContain(':aria-label="');
    expect(template).not.toContain('?? undefined');
  });

  it('RAW: a both-literal ternary stays unwrapped', () => {
    const template = emitFor('aria-describedby', "$props.on ? 'a' : 'b'");
    expect(template).not.toContain('?? undefined');
  });

  it('RAW: an already `|| undefined` binding is not double-dropped', () => {
    const template = emitFor('aria-labelledby', '$props.label || undefined');
    expect(template).toContain(':aria-labelledby="props.label || undefined"');
    expect(template).not.toContain('?? undefined');
  });

  it('RAW: an already `?? undefined` binding is not double-dropped', () => {
    const template = emitFor('aria-labelledby', '$props.label ?? undefined');
    expect(template).toContain(':aria-labelledby="props.label ?? undefined"');
    expect(template).not.toMatch(/\?\? undefined\) \?\? undefined/);
  });

  it('RAW: a static aria-label is untouched', () => {
    const ir = lowerInline(`<rozie name="Test">
${PROPS}
<template>
  <div aria-label="Close"></div>
</template>
</rozie>`);
    const { template } = emitTemplate(ir, REGISTRY);
    expect(template).toContain('aria-label="Close"');
    expect(template).not.toContain('?? undefined');
  });

  it('GUARD: a component host keeps the binding RAW (undefined would select the child default)', () => {
    const ir = lowerInline(`<rozie name="Test">
<components>{ Child: "./Child.rozie" }</components>
${PROPS}
<template>
  <Child :aria-label="$props.label" />
</template>
</rozie>`);
    const { template } = emitTemplate(ir, REGISTRY);
    expect(template).toContain(':aria-label="props.label"');
    expect(template).not.toContain('?? undefined');
  });

  it('NO-REGRESS: the numeric tabindex member still wraps', () => {
    const template = emitFor('tabindex', '$props.n');
    expect(template).toContain(':tabindex="(props.n) ?? undefined"');
  });

  it('NO-REGRESS: an enumerated-string ARIA name (aria-current) stays RAW', () => {
    const template = emitFor('aria-current', '$props.cur');
    expect(template).toContain(':aria-current="props.cur"');
  });
});
