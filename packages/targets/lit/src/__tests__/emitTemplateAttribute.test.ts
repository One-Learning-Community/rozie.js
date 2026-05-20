// Quick-task 260518-e2t — Lit `:style` literal-object → styleMap() lowering.
//
// Spike 004 (Lit subset): `style=${{ background: x }}` serializes the object
// via Lit's default attribute-value coercion → `[object Object]`. The fix is
// to lower literal-object `:style` through Lit's first-party `styleMap`
// directive, which normalizes camelCase keys to kebab-case internally and
// writes via `element.style.setProperty`.
//
// This file tests TWO layers:
//   1. The standalone `emitTemplateAttribute()` wrapper (typed test entry,
//      receives an optional `EmitTemplateAttributeState` for observing
//      `styleMapUsed`).
//   2. The full `emitLit()` shell — confirms that compiling a .rozie source
//      with a literal-object `:style` produces both the `styleMap(...)` call
//      AND the `import { styleMap } from 'lit/directives/style-map.js';`
//      shell import, while a .rozie source WITHOUT one does NOT emit the
//      import (no spurious unused-import noise).
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, AttributeBinding } from '../../../../core/src/ir/types.js';
import { emitTemplateAttribute, type EmitTemplateAttributeState } from '../emit/emitTemplateAttribute.js';
import { emitLit } from '../emitLit.js';

/**
 * Build a real IR via the parser/lowerer rather than hand-rolling one —
 * `rewriteTemplateExpression` reads many internal fields (computed, slots,
 * refs, etc.) and hand-rolled mocks brittle. Empty template is fine: we
 * only need a valid IR shape for the standalone wrapper to call into
 * rewriteTemplateExpression without crashing.
 */
function emptyIR(name = 'Test'): IRComponent {
  const src = `<rozie name="${name}">
<template>
  <div></div>
</template>
</rozie>`;
  const { ast } = parse(src, { filename: `${name}.rozie` });
  if (!ast) throw new Error('parse() returned null in emptyIR');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null in emptyIR');
  return ir;
}

function bindingAttr(name: string, exprSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name,
    expression: parseExpression(exprSrc) as t.Expression,
  } as AttributeBinding;
}

describe('emitTemplateAttribute (Lit) — `:style` literal-object → styleMap()', () => {
  it('single-key literal object → style=${styleMap({ background: "#f00" })}', () => {
    const ir = emptyIR();
    const state: EmitTemplateAttributeState = { styleMapUsed: false };
    const out = emitTemplateAttribute(
      bindingAttr('style', `({ background: '#f00' })`),
      ir,
      'span',
      state,
    );
    expect(out).toMatch(/^style=\$\{styleMap\(\{[\s\S]*background[\s\S]*\}\)\}$/);
    expect(state.styleMapUsed).toBe(true);
  });

  it('multi-key + camelCase keys passed through verbatim — styleMap kebab-izes at runtime', () => {
    const ir = emptyIR();
    const state: EmitTemplateAttributeState = { styleMapUsed: false };
    const out = emitTemplateAttribute(
      bindingAttr('style', `({ backgroundColor: '#f00', color: '#0f0' })`),
      ir,
      'span',
      state,
    );
    // Lit's styleMap directive handles camelCase → kebab-case internally; we
    // only need to preserve the object shape verbatim. No compile-time
    // kebabization required.
    expect(out).toContain('styleMap(');
    expect(out).toContain('backgroundColor');
    expect(out).toContain('color');
    expect(state.styleMapUsed).toBe(true);
  });

  it('non-object binding falls through to existing passthrough: `:style="someExpr"` → `style=${someExpr}`', () => {
    const ir = emptyIR();
    const state: EmitTemplateAttributeState = { styleMapUsed: false };
    const out = emitTemplateAttribute(
      bindingAttr('style', `someExpr`),
      ir,
      'span',
      state,
    );
    expect(out).toBe('style=${someExpr}');
    // Critical: did NOT mark styleMapUsed (would emit a spurious import).
    expect(state.styleMapUsed).toBe(false);
  });

  it('Spike 004 (260520-8iu): dynamic-string `:style` → native `style=${<expr>}`, no parseInlineStyle helper', () => {
    // Iteration-4 asymmetry: Lit's `style=${string}` attribute accepts a
    // string natively, so a dynamic-string `:style` (concatenation, not an
    // object literal) needs NO emitter change and NO React/Solid helper.
    const ir = emptyIR();
    const state: EmitTemplateAttributeState = { styleMapUsed: false };
    const out = emitTemplateAttribute(
      bindingAttr('style', `'opacity: ' + (cond ? '0.5' : '1')`),
      ir,
      'div',
      state,
    );
    // Native passthrough — string expression, no styleMap, no helper.
    expect(out).toMatch(/^style=\$\{/);
    expect(out).toContain("'opacity: '");
    expect(out).not.toContain('styleMap(');
    expect(out).not.toContain('parseInlineStyle');
    // Critical: did NOT mark styleMapUsed (would emit a spurious import).
    expect(state.styleMapUsed).toBe(false);
  });

  it('shell wiring: compiling a source with literal-object :style emits the styleMap import', () => {
    const src = `<rozie name="StyledSpan">
<data>{ color: '#3b82f6' }</data>
<template>
  <span :style="{ background: $data.color }"></span>
</template>
</rozie>`;
    const { ast } = parse(src, { filename: 'StyledSpan.rozie' });
    if (!ast) throw new Error('parse() returned null');
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast, { modifierRegistry: registry });
    if (!ir) throw new Error('lowerToIR() returned null');
    const out = emitLit(ir, { filename: 'StyledSpan.rozie', source: src, modifierRegistry: registry }).code;
    expect(out).toContain("import { styleMap } from 'lit/directives/style-map.js';");
    expect(out).toContain('styleMap(');
  });

  it('shell wiring: NO styleMap import when no literal-object :style is present (unused-import guard)', () => {
    const src = `<rozie name="PlainSpan">
<template>
  <span class="x"></span>
</template>
</rozie>`;
    const { ast } = parse(src, { filename: 'PlainSpan.rozie' });
    if (!ast) throw new Error('parse() returned null');
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast, { modifierRegistry: registry });
    if (!ir) throw new Error('lowerToIR() returned null');
    const out = emitLit(ir, { filename: 'PlainSpan.rozie', source: src, modifierRegistry: registry }).code;
    expect(out).not.toContain("from 'lit/directives/style-map.js'");
  });
});
