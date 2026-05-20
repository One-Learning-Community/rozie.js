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
  it('single-key literal object: `:style="{ background: \'#f00\' }"` → `style:background={\'#f00\'}`', () => {
    const ir = lowerInline(`<rozie name="Test">
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
    const ir = lowerInline(`<rozie name="Test">
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
    const ir = lowerInline(`<rozie name="Test">
<data>{ x: '#f00' }</data>
<template>
  <span :style="{ backgroundColor: $data.x }"></span>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('style:background-color={x}');
  });

  it('non-object binding falls through to existing passthrough: `:style="$data.s"` → `style={s}`', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ s: 'background: red' }</data>
<template>
  <span :style="$data.s"></span>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('style={s}');
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
