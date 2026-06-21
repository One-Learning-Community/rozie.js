// Quick-task 260518-e2t — Svelte `:style` literal-object lowering (Spike 004 subset).
//
// Verifies that `:style="{ key: value, ... }"` lowers to per-key Svelte 5
// `style:<kebab(key)>={value}` directives, sidestepping the `[object Object]`
// toString serialization that the previous `style={ ... }` passthrough
// produced. Non-object `:style` exprs keep the existing passthrough so the
// string-form case Svelte handles natively (`:style="'background: red'"`)
// still works.
//
// Test surface targets the public `emitTemplate` output (template text) since
// emitAttributes/emitSingleAttr's contract is observable only through the
// rendered template — the same path the production compiler uses.
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(src: string, filename = 'Test.rozie'): IRComponent {
  const result = parse(src, { filename });
  if (!result.ast) throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

describe('emitTemplateAttribute — `:style` literal-object lowering (Svelte / Spike 004 subset)', () => {
  // `inherit-attrs="false"` on each of these literal-object `:style` tests
  // opts the single-root element OUT of `synthesizeAttrsFallthrough`. Without
  // the opt-out, pre-Phase-16 cleanup Item-2-residual routes `:style="{...}"`
  // through the new string-form path so the consumer's spread `style="..."`
  // value can overwrite the wrapper's defaults (cross-target consumer-wins
  // precedence). These three tests isolate the pre-residual `style:` directive
  // lowering; the dedicated `…interacts with auto-fallthrough` test below
  // covers the new string-form path.
  it('single-key literal object: `:style="{ background: \'#f00\' }"` → `style:background={\'#f00\'}`', () => {
    const ir = lowerInline(`<rozie name="Test" inherit-attrs="false">
<template>
  <span :style="{ background: '#f00' }"></span>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // rewriteTemplateExpression preserves the source quote style for string
    // literals — accept either form for resilience.
    expect(template).toMatch(/style:background=\{['"]#f00['"]\}/);
    // Must NOT fall back to the object passthrough.
    expect(template).not.toMatch(/style=\{\s*\{/);
  });

  it('multi-key literal object: `:style="{ background: x, color: y }"` → two style: directives', () => {
    const ir = lowerInline(`<rozie name="Test" inherit-attrs="false">
<data>{ x: '#f00', y: '#0f0' }</data>
<template>
  <span :style="{ background: $data.x, color: $data.y }"></span>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('style:background={x}');
    expect(template).toContain('style:color={y}');
    expect(template).not.toMatch(/style=\{\s*\{/);
  });

  it('camelCase key kebabizes: `:style="{ backgroundColor: x }"` → `style:background-color={x}`', () => {
    const ir = lowerInline(`<rozie name="Test" inherit-attrs="false">
<data>{ x: '#f00' }</data>
<template>
  <span :style="{ backgroundColor: $data.x }"></span>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('style:background-color={x}');
  });

  it('Item-2-residual: literal-object `:style` switches to string-form `style="..."` when auto-fallthrough is active on the same element', () => {
    // Pre-Phase-16 cleanup Item-2-residual — when a single-root html element
    // is `synthesizeAttrsFallthrough`-eligible (the default — `inherit-attrs`
    // is true), the lowering swaps `style:<prop>={value}` directives for a
    // string-form `style="prop: value"` attribute. Background: Svelte's
    // compiled output places per-property `style:` directive state under a
    // Symbol-keyed slot processed AFTER any spread inside the generated props
    // object, so directives win over spread `style` — the OPPOSITE precedence
    // the other 5 targets implement. String-form lets the consumer's spread
    // `style` value overwrite the wrapper's defaults via `setAttribute`,
    // restoring cross-target parity. The wrapper's un-overridden defaults
    // survive via the wrapper's `var(--prop, fallback)` CSS fallback.
    const ir = lowerInline(`<rozie name="Test">
<template>
  <button :style="{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }"></button>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // String-form style attribute with both custom properties spliced.
    expect(template).toContain('style="--btn-bg: #3b82f6; --btn-fg: #ffffff"');
    // No `style:` directives (the Item-2-residual switch suppresses them).
    expect(template).not.toMatch(/\bstyle:--btn-bg=/);
    expect(template).not.toMatch(/\bstyle:--btn-fg=/);
    // Auto-fallthrough fired (sanity check).
    expect(template).toContain('{...__rozieAttrs}');
  });

  it('Item-2-residual: dynamic-value literal-object `:style` interpolates expressions into the string', () => {
    // Same fallthrough condition as above, but the object values are
    // identifiers/expressions rather than string literals. The rewriter
    // splices each value via Svelte template-literal interpolation in the
    // attribute string: `style="prop: {expr}; prop2: {expr2}"`.
    const ir = lowerInline(`<rozie name="Test">
<data>{ bg: '#3b82f6', fg: '#ffffff' }</data>
<template>
  <button :style="{ '--btn-bg': $data.bg, '--btn-fg': $data.fg }"></button>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('style="--btn-bg: {bg}; --btn-fg: {fg}"');
    expect(template).not.toMatch(/\bstyle:--btn-bg=/);
  });

  it('260620-rta: non-object dynamic `:style="$data.s"` routes through rozieStyle → `style={rozieStyle(s)}`', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ s: 'background: red' }</data>
<template>
  <span :style="$data.s"></span>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // Dynamic (non-literal-object) `:style` is normalized so an OBJECT value
    // delivered via the binding serializes to a CSS string instead of
    // `[object Object]`; a string value passes through verbatim. The call is
    // the DIRECT binding-site value so Svelte 5 rune reactivity re-reads it.
    expect(template).toContain('style={rozieStyle(s)}');
    // Must NOT emit any style: directive form for a non-object expression.
    expect(template).not.toMatch(/\bstyle:[a-z]/);
  });

  it('Spike 004 (260520-8iu): dynamic-string `:style` → native `style={<expr>}`, no parseInlineStyle helper', () => {
    // Iteration-4 asymmetry: Svelte accepts a string `style=` attribute
    // natively, so a dynamic-string `:style` (concatenation, not an object
    // literal) needs NO emitter change and NO React/Solid runtime helper.
    const ir = lowerInline(`<rozie name="Test">
<data>{ cond: true }</data>
<template>
  <div :style="'opacity: ' + ($data.cond ? '0.5' : '1')"></div>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // Native passthrough — string expression through the generic binding path.
    expect(template).toMatch(/style=\{/);
    expect(template).toContain("'opacity: '");
    // No style: directive (that's the literal-object path) and no helper.
    expect(template).not.toMatch(/\bstyle:[a-z]/);
    expect(template).not.toContain('parseInlineStyle');
  });

  it('PortalListDemo-shape: `:style="{background: item.color}"` inside r-for emits style:background={item.color}', () => {
    // Drive the same shape PortalListDemo.rozie has: a literal-object :style
    // whose value reads a loop-scoped identifier. The lowering should NOT
    // attempt to rewrite `item.color` through the $data./$props. prefix
    // rewrite (loop aliases are already shadowed by rewriteTemplateExpression).
    const ir = lowerInline(`<rozie name="Test">
<data>{ items: [{ id: 1, color: '#3b82f6' }] }</data>
<template>
  <ul>
    <li r-for="item in $data.items" :key="item.id">
      <span :style="{background: item.color}"></span>
    </li>
  </ul>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('style:background={item.color}');
  });
});

describe('emitTemplateAttribute — r-model on form inputs (Svelte bind: directive selection)', () => {
  it('r-model on `<input type="checkbox">` emits bind:checked (NOT bind:value)', () => {
    // 260519 linechart-watch-recreate step 5 — `bind:value` silently no-ops on
    // a checkbox: the box renders unchecked and toggling never writes back.
    // Svelte's checkbox two-way primitive is `bind:checked`.
    const ir = lowerInline(`<rozie name="Test">
<data>{ enabled: true }</data>
<template>
  <input type="checkbox" r-model="$data.enabled" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:checked={enabled}');
    expect(template).not.toContain('bind:value={enabled}');
  });

  it('r-model on `<input type="text">` keeps bind:value', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input type="text" r-model="$data.query" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:value={query}');
    expect(template).not.toContain('bind:checked');
  });

  it('r-model on `<input>` with no static type defaults to bind:value', () => {
    // Svelte treats a typeless <input> as text — bind:value is correct.
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input r-model="$data.query" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:value={query}');
    expect(template).not.toContain('bind:checked');
  });
});
