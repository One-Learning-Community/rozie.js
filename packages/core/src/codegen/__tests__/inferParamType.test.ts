/**
 * inferParamType.test.ts — Quick 260803-ibt CR-02 RED fixture.
 *
 * Pins the D2/D3 fix: a bare-Identifier slot param that resolves to a
 * top-level `<script>` function must type as a CALLABLE
 * (`(...args: any[]) => any`), while an `r-for` loop var (never a script
 * function — resolvable by construction only within TEMPLATE scope, which
 * `inferParamType` cannot see) must keep typing `unknown`.
 *
 * Both populations are asserted from ONE component per the review's
 * red-fixture instruction (findings CR-02): a slot exposing a top-level
 * script function (`toggle`) AND a slot exposing an `r-for` loop var
 * (`slide`/`index`) in the same fixture.
 *
 * Covers both top-level function shapes:
 *   - `function toggle() {}`      (FunctionDeclaration)
 *   - `const toggle = () => {}`  (arrow-const, the `examples/Dropdown.rozie`
 *     shape used by the T4 typed-consumer gate)
 *
 * Plus a negative case: a bare identifier that resolves to NEITHER a prop
 * NOR a top-level script function (an undeclared / template-only name)
 * must stay `unknown` — proves the fix does not widen the resolved set
 * beyond top-level script declarations.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../../ir/lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { inferParamType } from '../renderPropsInterface.js';

function irFor(src: string) {
  const { ast } = parse(src, { filename: 'Probe.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

function paramTypeFor(ir: ReturnType<typeof irFor>, slotName: string, paramName: string): string {
  const slot = ir.slots.find((s) => s.name === slotName);
  if (!slot) throw new Error(`slot ${slotName} not found`);
  const param = slot.params.find((p) => p.name === paramName);
  if (!param) throw new Error(`param ${paramName} not found on slot ${slotName}`);
  return inferParamType(param, ir);
}

describe('inferParamType — CR-02 callable-vs-unknown resolution (Quick 260803-ibt)', () => {
  it('FunctionDeclaration shape — a slot param naming a top-level `function toggle() {}` types callable', () => {
    const src = `<rozie name="Probe">
<props>
{
  slides: { type: Array, default: () => [] },
}
</props>
<script>
function toggle() { }
</script>
<template>
<div>
  <slot name="trigger" :toggle="toggle" />
  <div r-for="slide, i in $props.slides" :key="slide">
    <slot name="slide" :slide="slide" :index="i">{{ slide }}</slot>
  </div>
</div>
</template>
</rozie>`;
    const ir = irFor(src);
    expect(paramTypeFor(ir, 'trigger', 'toggle')).toBe('(...args: any[]) => any');
    expect(paramTypeFor(ir, 'slide', 'slide')).toBe('unknown');
    expect(paramTypeFor(ir, 'slide', 'index')).toBe('unknown');
  });

  it('arrow-const shape (examples/Dropdown.rozie) — a slot param naming a top-level `const toggle = () => {}` types callable', () => {
    const src = `<rozie name="Probe">
<props>
{
  slides: { type: Array, default: () => [] },
}
</props>
<script>
const toggle = () => { }
</script>
<template>
<div>
  <slot name="trigger" :toggle="toggle" />
  <div r-for="slide, i in $props.slides" :key="slide">
    <slot name="slide" :slide="slide" :index="i">{{ slide }}</slot>
  </div>
</div>
</template>
</rozie>`;
    const ir = irFor(src);
    expect(paramTypeFor(ir, 'trigger', 'toggle')).toBe('(...args: any[]) => any');
    expect(paramTypeFor(ir, 'slide', 'slide')).toBe('unknown');
    expect(paramTypeFor(ir, 'slide', 'index')).toBe('unknown');
  });

  it('negative case — a bare identifier that is neither a prop nor a top-level script function stays unknown', () => {
    const src = `<rozie name="Probe">
<props>
{
  slides: { type: Array, default: () => [] },
}
</props>
<script>
const toggle = () => { }
</script>
<template>
<div>
  <slot name="trigger" :toggle="toggle" :ghost="ghost" />
</div>
</template>
</rozie>`;
    const ir = irFor(src);
    expect(paramTypeFor(ir, 'trigger', 'toggle')).toBe('(...args: any[]) => any');
    // `ghost` is an undeclared/template-only identifier — never a prop, never
    // a top-level script decl. Must NOT widen to callable.
    expect(paramTypeFor(ir, 'trigger', 'ghost')).toBe('unknown');
  });
});
