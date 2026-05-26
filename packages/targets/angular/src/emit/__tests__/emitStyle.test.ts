/**
 * Angular emitStyle `:deep()` lowering tests (quick task 260526-mk4).
 *
 * Angular's emitStyle byte-slices each scoped rule, preserving the source
 * verbatim. The `:deep(X)` → `::ng-deep X` lowering reparses ONLY rules
 * that contain `:deep(` and runs them through postcss-selector-parser to
 * rewrite the pseudo. Rules without `:deep()` flow through the byte-slice
 * unchanged (Risk 5 floor — output preserves source byte-identity for the
 * dominant case).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitStyle } from '../emitStyle.js';

function renderStyles(rozieSource: string): string {
  const result = parse(rozieSource, { filename: 'probe.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return emitStyle(lowered.ir.styles, rozieSource).stylesArrayBody;
}

const BASE = (style: string) => `<rozie name="X">
<template><div /></template>
<style>
${style}
</style>
</rozie>`;

describe('Angular emitStyle — :deep() lowering to ::ng-deep', () => {
  it(':deep(.x) → ::ng-deep .x', () => {
    const out = renderStyles(BASE(':deep(.x) { color: red; }'));
    expect(out).toContain('::ng-deep');
    expect(out).toContain('.x');
    expect(out).not.toContain(':deep(');
  });

  it('.outer :deep(.inner) → .outer ::ng-deep .inner', () => {
    const out = renderStyles(BASE('.outer :deep(.inner) { color: red; }'));
    expect(out).toMatch(/\.outer\s+::ng-deep\s+\.inner/);
    expect(out).not.toContain(':deep(');
  });

  it('.outer > :deep(.a > .b) preserves the parent combinator and inner combinator', () => {
    const out = renderStyles(BASE('.outer > :deep(.a > .b) { color: red; }'));
    expect(out).toMatch(/\.outer\s*>\s*::ng-deep\s+\.a\s*>\s*\.b/);
    expect(out).not.toContain(':deep(');
  });

  it('.outer :deep(.a, .b) distributes across the comma list', () => {
    const out = renderStyles(BASE('.outer :deep(.a, .b) { color: red; }'));
    expect(out).toMatch(/\.outer\s+::ng-deep\s+\.a/);
    expect(out).toMatch(/\.outer\s+::ng-deep\s+\.b/);
    expect(out).not.toContain(':deep(');
  });

  it('rules without :deep() flow through the byte-slice unchanged', () => {
    const css = '.plain { color: blue; }';
    const out = renderStyles(BASE(css));
    // The byte-slice preserves the original whitespace/structure.
    expect(out).toContain('.plain');
    expect(out).toContain('color: blue');
  });

  it('mixed: only the :deep rule is rewritten; the plain rule is byte-preserved', () => {
    const out = renderStyles(
      BASE('.plain { color: blue; }\n.outer :deep(.inner) { color: red; }'),
    );
    expect(out).toContain('.plain');
    expect(out).toMatch(/\.outer\s+::ng-deep\s+\.inner/);
    expect(out).not.toContain(':deep(');
  });
});
