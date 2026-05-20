/**
 * Quick-task 260520-8iu Task 2 — Solid string-form `:style` lowering.
 *
 * Mirrors the React string-`:style` emitter test:
 *   - string LITERAL `:style` → compile-time PostCSS parse → object form
 *   - string LITERAL with `!important` → object form + ROZ083 WARN
 *   - dynamic-string `:style` → `style={parseInlineStyle(<expr>)}` + import
 *   - object-form `:style` → unchanged (260518-e2t passthrough, no regression)
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, AttributeBinding } from '../../../../core/src/ir/types.js';
import {
  SolidImportCollector,
  RuntimeSolidImportCollector,
} from '../rewrite/collectSolidImports.js';
import { emitAttributes, type EmitAttrCtx } from '../emit/emitTemplateAttribute.js';

function emptyIR(): IRComponent {
  const src = `<rozie name="Test">
<template>
  <div></div>
</template>
</rozie>`;
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

function styleBinding(exprSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name: 'style',
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
}

function freshCtx(ir: IRComponent): EmitAttrCtx {
  return {
    ir,
    collectors: {
      solid: new SolidImportCollector(),
      runtime: new RuntimeSolidImportCollector(),
    },
  };
}

describe('emitTemplateAttribute (Solid) — string-form `:style` (Plan 260520-8iu Task 2)', () => {
  it('string LITERAL → compile-time object form, no runtime helper import', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx, diagnostics } = emitAttributes([styleBinding(`'background: red'`)], ctx);
    expect(jsx).toContain('style={{');
    expect(jsx).toContain('background: "red"');
    expect(jsx).not.toContain('parseInlineStyle');
    expect(diagnostics).toEqual([]);
    expect(ctx.collectors.runtime.has('parseInlineStyle')).toBe(false);
  });

  it('string LITERAL with kebab properties → camelCased object keys', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [styleBinding(`'background-color: blue; font-size: 12px'`)],
      ctx,
    );
    expect(jsx).toContain('backgroundColor: "blue"');
    expect(jsx).toContain('fontSize: "12px"');
  });

  it('string LITERAL with `!important` → object form AND a ROZ083 WARN', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx, diagnostics } = emitAttributes(
      [styleBinding(`'color: red !important'`)],
      ctx,
    );
    expect(jsx).toContain('style={{');
    expect(jsx).toContain('color:');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('ROZ083');
    expect(diagnostics[0]!.severity).toBe('warning');
    expect(diagnostics[0]!.message).toContain('!important');
  });

  it('dynamic-string `:style` → `style={parseInlineStyle(<expr>)}` + import collected', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx, diagnostics } = emitAttributes(
      [styleBinding(`'opacity: ' + (cond ? '0.5' : '1')`)],
      ctx,
    );
    expect(jsx).toContain('style={parseInlineStyle(');
    expect(diagnostics).toEqual([]);
    expect(ctx.collectors.runtime.has('parseInlineStyle')).toBe(true);
  });

  it('object-form `:style` → unchanged generic binding emit (no regression)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([styleBinding(`({ background: x })`)], ctx);
    expect(jsx).toContain('style={{');
    expect(jsx).toContain('background: x');
    expect(jsx).not.toContain('parseInlineStyle');
    expect(ctx.collectors.runtime.has('parseInlineStyle')).toBe(false);
  });
});
