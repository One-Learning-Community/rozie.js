/**
 * LB6 SEAM 2 — React numeric `aria-value*` attrs raw-emit (no string widening).
 *
 * `:aria-valuenow="someCallExpr()"` (a number-typed call-expr) bound on an HTML
 * host previously routed through `rozieAttr(...)`, widening to `string |
 * undefined` → TS2322 against React's `aria-valuenow?: number`. This is the
 * sibling of the 63-12 WR-02 `aria-rowindex` numeric class. The fix registers
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax` in `NUMERIC_HTML_ATTRS` so a
 * provably-non-nullish numeric expr emits RAW, while a genuinely-nullish
 * binding (`x ? n : null`) still DROPS via `?? undefined` (numeric-typed, no
 * string widening). `aria-valuetext` is a STRING in React and is NOT added.
 *
 * Drives `emitAttributes` directly (its return carries the JSX text + the
 * runtime-import collector for `rozieAttr` membership assertions).
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, AttributeBinding } from '../../../../core/src/ir/types.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
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

function ariaBinding(name: string, exprSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name,
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    wrapForDisplay: true,
    sourceLoc: { start: 0, end: exprSrc.length },
  } as AttributeBinding;
}

function freshCtx(ir: IRComponent): EmitAttrCtx {
  return {
    ir,
    collectors: {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    },
    elementTagKind: 'html',
    tagName: 'div',
  } as EmitAttrCtx;
}

describe('emitTemplateAttribute (React) — numeric aria-value* raw-emit (LB6 SEAM 2)', () => {
  it('a number-typed call-expr `:aria-valuenow` emits RAW (no rozieAttr widening)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([ariaBinding('aria-valuenow', 'getNow()')], ctx);
    expect(jsx).toContain('aria-valuenow={getNow()}');
    expect(jsx).not.toContain('rozieAttr');
    expect(ctx.collectors.runtime.has('rozieAttr')).toBe(false);
  });

  it('aria-valuemin / aria-valuemax member-exprs also emit RAW', () => {
    const ir = emptyIR();
    const ctxMin = freshCtx(ir);
    expect(emitAttributes([ariaBinding('aria-valuemin', 'bounds.min')], ctxMin).jsx).toContain(
      'aria-valuemin={bounds.min}',
    );
    expect(ctxMin.collectors.runtime.has('rozieAttr')).toBe(false);

    const ctxMax = freshCtx(ir);
    expect(emitAttributes([ariaBinding('aria-valuemax', 'bounds.max')], ctxMax).jsx).toContain(
      'aria-valuemax={bounds.max}',
    );
    expect(ctxMax.collectors.runtime.has('rozieAttr')).toBe(false);
  });

  it('NO-REGRESS: a genuinely-nullish `x ? n : null` still DROPS via `?? undefined` (numeric, no rozieAttr)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [ariaBinding('aria-valuenow', 'cond ? 5 : null')],
      ctx,
    );
    expect(jsx).toContain('?? undefined');
    expect(jsx).not.toContain('rozieAttr');
    expect(ctx.collectors.runtime.has('rozieAttr')).toBe(false);
  });

  it('aria-valuetext is a STRING in React — stays on the rozieAttr drop path (NOT widened to numeric)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([ariaBinding('aria-valuetext', 'label()')], ctx);
    expect(jsx).toContain('rozieAttr(label())');
    expect(ctx.collectors.runtime.has('rozieAttr')).toBe(true);
  });
});
