// Phase 12 Plan 04 Task 1 — Vue r-model modifier emit.
//
// Vue maps the three BUILT-IN model modifiers (.lazy/.number/.trim) ~1:1 to
// native `v-model.lazy.number.trim` modifier suffixes. A CUSTOM model modifier
// (e.g. `.phone`) has no native Vue equivalent, so the whole attribute is
// hand-emitted as an explicit `:value`/`@input`(`@change` when `.lazy`) pair
// with the chained `valueTransform` spliced into the handler.
//
// Test surface drives the public `emitTemplate` output (template text) — the
// same path the production compiler uses — and a custom-registry compile for
// the custom-modifier case.
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

/** A custom `.phone` model modifier — string→string reformatter, kind:'model'. */
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

describe('emitTemplateAttribute — Vue r-model modifiers', () => {
  it('bare r-model emits v-model="..." byte-identical to pre-phase', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input r-model="$data.query" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('v-model="query"');
    // No native modifier suffix, no hand-emitted form.
    expect(template).not.toMatch(/v-model\.[a-z]/);
    expect(template).not.toContain('@input');
  });

  it('r-model.number emits v-model.number', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ amount: '' }</data>
<template>
  <input r-model.number="$data.amount" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('v-model.number="amount"');
  });

  it('r-model.lazy emits v-model.lazy', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input r-model.lazy="$data.query" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('v-model.lazy="query"');
  });

  it('r-model.lazy.number.trim emits v-model carrying all three native modifier suffixes', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ amount: '' }</data>
<template>
  <input r-model.lazy.number.trim="$data.amount" />
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // All three built-in modifiers present as native v-model suffixes.
    const m = template.match(/v-model((?:\.[a-z]+)+)="amount"/);
    expect(m).not.toBeNull();
    const suffixes = m![1]!.split('.').filter(Boolean).sort();
    expect(suffixes).toEqual(['lazy', 'number', 'trim']);
  });

  it('custom model modifier hand-emits :value + @input (NOT v-model.<custom>)', () => {
    const registry = new ModifierRegistry();
    registerBuiltins(registry);
    registry.register(phoneModifier);
    const ir = lowerInline(
      `<rozie name="Test">
<data>{ phone: '' }</data>
<template>
  <input r-model.phone="$data.phone" />
</template>
</rozie>`,
      registry,
    );
    const { template, diagnostics } = emitTemplate(ir, registry);
    expect(diagnostics).toEqual([]);
    // No native v-model.phone — Vue has no such native modifier.
    expect(template).not.toContain('v-model.phone');
    expect(template).not.toContain('v-model="phone"');
    // Hand-emitted explicit :value + @input form.
    expect(template).toContain(':value="phone"');
    expect(template).toContain('@input=');
    // The valueTransform fragment is spliced into the handler.
    expect(template).toContain("replace(/[^0-9]/g, '')");
  });

  it('custom modifier + .lazy hand-emits :value + @change', () => {
    const registry = new ModifierRegistry();
    registerBuiltins(registry);
    registry.register(phoneModifier);
    const ir = lowerInline(
      `<rozie name="Test">
<data>{ phone: '' }</data>
<template>
  <input r-model.phone.lazy="$data.phone" />
</template>
</rozie>`,
      registry,
    );
    const { template, diagnostics } = emitTemplate(ir, registry);
    expect(diagnostics).toEqual([]);
    expect(template).not.toContain('v-model');
    expect(template).toContain(':value="phone"');
    // .lazy swaps the hand-emitted handler event from @input to @change.
    expect(template).toContain('@change=');
    expect(template).not.toContain('@input=');
  });
});
