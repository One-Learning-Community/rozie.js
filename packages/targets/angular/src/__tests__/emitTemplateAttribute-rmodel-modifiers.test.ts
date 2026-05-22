// Phase 12 Plan 04 Task 2 — Angular r-model modifier emit.
//
// Angular's `[(ngModel)]` banana-box is sugar for `[ngModel]`+`(ngModelChange)`
// — the emitter already uses the long form for signal targets. `.number`/
// `.trim` hand-emit value coercion spliced into the change-handler expression
// (substituting `$v` with `$event`, the value the handler receives). `.lazy`
// swaps the bound event from `(ngModelChange)` to `(change)` (D-08). Bare
// `r-model` emit is byte-identical to pre-phase.
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

describe('emitTemplateAttribute — Angular r-model modifiers', () => {
  it('bare r-model emit is byte-identical to pre-phase', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input r-model="$data.query" />
</template>
</rozie>`);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain(
      '[ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{standalone: true}"',
    );
    expect(template).not.toContain('(change)=');
  });

  it('r-model.number splices the coercion into the (ngModelChange) handler', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ amount: '' }</data>
<template>
  <input r-model.number="$data.amount" />
</template>
</rozie>`);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('[ngModel]="amount()"');
    // The change handler still binds via (ngModelChange) (no .lazy).
    expect(template).toContain('(ngModelChange)=');
    // The .number coercion is spliced — the setter no longer receives bare $event.
    expect(template).not.toContain('(ngModelChange)="amount.set($event)"');
    expect(template).toContain('parseFloat');
  });

  it('r-model.trim splices .trim() into the change handler', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ name: '' }</data>
<template>
  <input r-model.trim="$data.name" />
</template>
</rozie>`);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('[ngModel]="name()"');
    expect(template).toContain('(ngModelChange)=');
    expect(template).toContain('.trim()');
  });

  it('r-model.lazy uses (change) instead of (ngModelChange)', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ query: '' }</data>
<template>
  <input r-model.lazy="$data.query" />
</template>
</rozie>`);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('[ngModel]="query()"');
    expect(template).toContain('(change)=');
    expect(template).not.toContain('(ngModelChange)=');
  });

  it('r-model.lazy.number.trim uses (change) and chains the coercions', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ amount: '' }</data>
<template>
  <input r-model.lazy.number.trim="$data.amount" />
</template>
</rozie>`);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('(change)=');
    expect(template).not.toContain('(ngModelChange)=');
    expect(template).toContain('.trim()');
    expect(template).toContain('parseFloat');
  });

  it('custom model modifier splices the transform into the change handler', () => {
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
    const { template } = emitTemplate(ir, registry);
    expect(template).toContain('[ngModel]="phone()"');
    expect(template).toContain("replace(/[^0-9]/g, '')");
  });
});
