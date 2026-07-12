/**
 * Quick-task 260520-8iu Task 2 — Angular dynamic-string `:style` passthrough.
 *
 * Confirming test (Spike 004 Iteration-4 asymmetry): Angular's generic
 * property-binding path emits `[style]="<expr>"`, and `[style]` accepts a
 * string-or-object since Angular v9 — so a dynamic-string `:style` needs
 * NO `parseInlineStyle` runtime helper. This test pins that behavior so a
 * future refactor cannot silently route Angular through the React/Solid
 * object-helper path.
 *
 * SUPERSEDED (Quick task 260711-tgk): a `:style` binding whose expression is
 * PROVABLY a string (StringLiteral/TemplateLiteral/`+`-concat/both-provable-
 * Conditional — see isProvablyStringStyleExpression) now emits
 * `[attr.style]="<expr>"` instead of `[style]="<expr>"`. `[attr.style]`
 * compiles to `ɵɵattribute`/`setAttribute`, which the browser parses with
 * the same tolerant CSS parser the other 5 targets already rely on —
 * `[style]="<expr>"` binds through `ɵɵstyleMap`, whose parser corrupts on an
 * empty declaration (a `;;` produced by string concatenation), silently
 * dropping the following declaration. This fixture's expression (a
 * StringLiteral `+` a both-string-branch Conditional) is provably a string,
 * so it now takes the `[attr.style]=` path — updated below to match.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'Test.rozie' });
  if (!result.ast) throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

describe('emitTemplateAttribute (Angular) — dynamic-string `:style` native passthrough', () => {
  it('provably-string `:style` emits `[attr.style]="<expr>"` (260711-tgk), no parseInlineStyle helper', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ cond: true }</data>
<template>
  <div :style="'opacity: ' + ($data.cond ? '0.5' : '1')"></div>
</template>
</rozie>`);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    // 260711-tgk — this expression is PROVABLY a string (StringLiteral `+` a
    // both-branch-string Conditional), so it takes the `[attr.style]=` path
    // (setAttribute, tolerant browser CSS parsing) rather than `[style]=`
    // (ɵɵstyleMap, which corrupts on a `;;` empty declaration).
    expect(template).toMatch(/\[attr\.style\]="/);
    expect(template).toContain("'opacity: '");
    // No React/Solid runtime helper, no PostCSS, in Angular output.
    expect(template).not.toContain('parseInlineStyle');
  });
});
