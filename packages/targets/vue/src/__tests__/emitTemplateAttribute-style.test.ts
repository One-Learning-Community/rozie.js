/**
 * Quick-task 260520-8iu Task 2 — Vue dynamic-string `:style` passthrough.
 *
 * Confirming test (Spike 004 Iteration-4 asymmetry): Vue accepts a string
 * `:style` natively — `:style="<expr>"` — so a dynamic-string `:style`
 * needs NO emitter change and NO `parseInlineStyle` runtime helper. This
 * test pins that behavior so a future refactor cannot silently route Vue
 * through the React/Solid object-helper path.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'Test.rozie' });
  if (!result.ast) throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

describe('emitTemplateAttribute (Vue) — dynamic-string `:style` native passthrough', () => {
  it('dynamic-string `:style` emits native `:style="<expr>"`, no parseInlineStyle helper', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ cond: true }</data>
<template>
  <div :style="'opacity: ' + ($data.cond ? '0.5' : '1')"></div>
</template>
</rozie>`);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // Vue passes a string `:style` through natively via the generic binding path.
    expect(template).toMatch(/:style="/);
    expect(template).toContain("'opacity: '");
    // No React/Solid runtime helper, no PostCSS, in Vue output.
    expect(template).not.toContain('parseInlineStyle');
  });
});
