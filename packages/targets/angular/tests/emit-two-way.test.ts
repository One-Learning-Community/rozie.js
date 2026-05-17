/**
 * Phase 07.3 Wave 3 Plan 07.3-05 — Angular consumer-side two-way binding
 * (`r-model:propName=`) emit.
 *
 * LONG-FORM emit: `[prop]="X()" (propChange)="X.set($event)"` — NOT the
 * banana-in-a-box `[(prop)]` sugar. Per RESEARCH §Landmines (WritableSignal
 * AOT-recognition variance in some Angular 19.x point releases). Mirrors the
 * existing `r-model` form-input branch's [ngModel]/(ngModelChange) precedent
 * in the same file.
 *
 * Tests drive end-to-end through parse → lowerToIR → emitTemplate. The
 * lowerer (Plan 07.3-02) already produces `kind: 'twoWayBinding'` for
 * `r-model:propName=` directives; this file asserts the new emit branch in
 * `emitTemplateAttribute.ts` produces the long-form output shape.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitTemplate } from '../src/emit/emitTemplate.js';

function lowerSource(src: string): IRComponent {
  const result = parse(src, { filename: 'consumer.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics
        .map((d) => d.message)
        .join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error(
      `lowerToIR returned null IR: ${lowered.diagnostics
        .map((d) => d.message)
        .join(', ')}`,
    );
  }
  return lowered.ir;
}

function consumerWithModel(propName: string, expr: string): string {
  return `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<data>
{
  open1: false,
  flag: true
}
</data>

<template>
<Producer r-model:${propName}="${expr}" />
</template>

</rozie>
`;
}

describe('Angular emit — consumer-side two-way binding (r-model:propName=)', () => {
  it('emits long-form `[open]="open1()" (openChange)="open1.set($event)"` for $data.open1 signal LHS', () => {
    const ir = lowerSource(consumerWithModel('open', '$data.open1'));
    const { template } = emitTemplate(ir, createDefaultRegistry());

    // LONG-FORM signal pair — the load-bearing shape per D-01 + landmine guard.
    expect(template).toContain('[open]="open1()" (openChange)="open1.set($event)"');

    // Banana sugar `[(open)]` must NOT appear — landmine guard
    // (WritableSignal AOT-recognition variance in some Angular 19.x).
    expect(template).not.toContain('[(open)]');
  });

  it('preserves camelCase propName: r-model:closeOnEscape= → [closeOnEscape]/(closeOnEscapeChange)', () => {
    const ir = lowerSource(consumerWithModel('closeOnEscape', '$data.flag'));
    const { template } = emitTemplate(ir, createDefaultRegistry());

    expect(template).toContain(
      '[closeOnEscape]="flag()" (closeOnEscapeChange)="flag.set($event)"',
    );
    expect(template).not.toContain('[(closeOnEscape)]');
  });

  it('non-signal fallback: emits one-way `[prop]="expr"` only (degrade documented)', () => {
    // RHS is a member expression NOT rooted at $data.X or $props.X (model:true)
    // — so the signal-resolution helper returns null and we fall back to the
    // one-way `[prop]="expr"` shape (lossy on the change-output half, per
    // plan task: "rare-case degrade").
    const src = `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<data>
{
  obj: { nested: false }
}
</data>

<template>
<Producer r-model:open="$data.obj.nested" />
</template>

</rozie>
`;
    const ir = lowerSource(src);
    const { template } = emitTemplate(ir, createDefaultRegistry());

    // One-way half present (rewritten expression for $data.obj.nested → obj().nested).
    expect(template).toMatch(/\[open\]="[^"]+"/);
    // Critically: NO banana sugar.
    expect(template).not.toContain('[(open)]');
    // Critically: NO `.set($event)` since the signalName resolution failed.
    expect(template).not.toContain('.set($event)');
  });
});
