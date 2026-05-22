// Phase 12 Plan 04 Task 2 — Svelte r-model modifier emit.
//
// Svelte's `bind:value` two-way sugar cannot carry a value coercion, so when
// any modifier is present the emit drops to an explicit `value={x}` plus an
// event handler. `.number`/`.trim` hand-emit the value coercion via
// `$v`-substitution; `.lazy` swaps the handler event from `oninput` to
// `onchange` (D-08). The Svelte 5 attribute form (`oninput=`/`onchange=`) is
// used — NOT the deprecated `on:input` directive — so the emit never mixes
// old + new event syntax on one element. Bare `r-model` keeps
// `bind:value={x}` byte-identical to pre-phase.
//
// Test surface drives the public `emitTemplate` output (template text).
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { ModifierRegistry, registerBuiltins } from '@rozie/core';
import type { ModelModifierImpl } from '@rozie/core';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(
  src: string,
  registry: ModifierRegistry = createDefaultRegistry(),
  filename = 'Test.rozie',
): IRComponent {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: registry });
  if (!lowered.ir) {
    throw new Error(
      `lowerToIR() returned null IR: ${lowered.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  return lowered.ir;
}

const phoneModifier: ModelModifierImpl = {
  kind: 'model',
  name: 'phone',
  arity: 'none',
  resolve() {
    return {
      descriptor: {
        valueTransform: "String($v).replace(/[^0-9]/g, '')",
      },
      diagnostics: [],
    };
  },
};

describe('emitTemplateAttribute — Svelte r-model modifiers', () => {
  it('bare r-model emits bind:value={...} byte-identical to pre-phase', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input type="text" r-model="$data.query" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:value={query}');
    expect(template).not.toContain('oninput');
    expect(template).not.toContain('onchange');
  });

  it('r-model.number drops bind:value for value={...} + oninput with coercion', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ amount: '' }</data>
<template>
  <input type="text" r-model.number="$data.amount" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).not.toContain('bind:value');
    expect(template).toContain('value={amount}');
    expect(template).toContain('oninput=');
    // The .number coercion fragment is spliced into the handler.
    expect(template).toContain('parseFloat');
  });

  it('r-model.trim drops bind:value for value={...} + oninput with .trim()', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ name: '' }</data>
<template>
  <input type="text" r-model.trim="$data.name" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).not.toContain('bind:value');
    expect(template).toContain('value={name}');
    expect(template).toContain('oninput=');
    expect(template).toContain('.trim()');
  });

  it('r-model.lazy uses an onchange handler', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input type="text" r-model.lazy="$data.query" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).not.toContain('bind:value');
    expect(template).toContain('value={query}');
    expect(template).toContain('onchange=');
    expect(template).not.toContain('oninput=');
  });

  it('r-model.lazy.number.trim uses onchange and chains the coercions', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ amount: '' }</data>
<template>
  <input type="text" r-model.lazy.number.trim="$data.amount" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('onchange=');
    expect(template).toContain('.trim()');
    expect(template).toContain('parseFloat');
  });

  it('custom model modifier hand-emits value={...} + handler with the transform', () => {
    const registry = new ModifierRegistry();
    registerBuiltins(registry);
    registry.register(phoneModifier);
    const ir = lowerInline(
      `<rozie name="Test">
<data>{ phone: '' }</data>
<template>
  <input type="text" r-model.phone="$data.phone" />
</template>
</rozie>`,
      registry,
    );
    const { template, diagnostics } = emitTemplate(ir, registry);
    expect(diagnostics).toEqual([]);
    expect(template).not.toContain('bind:value');
    expect(template).toContain('value={phone}');
    expect(template).toContain("replace(/[^0-9]/g, '')");
  });
});
