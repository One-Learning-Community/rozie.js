/**
 * Follow-up F (data-table beta) — React boolean-enumerated ARIA attrs drop via
 * `(expr) ?? undefined` (no string widening), for the WHOLE Booleanish/tristate set.
 *
 * `:aria-selected="cond ? !!sel : null"` on a `<tr>` compiles fine for the
 * `aria-expanded` SIBLING (same nullish-boolean shape) but `aria-selected` was
 * NOT in `BOOLEAN_NULLISH_ARIA_ATTRS`, so it fell to the generic `rozieAttr(...)`
 * path → widened to `string | undefined` → TS2322 against React's
 * `aria-selected?: Booleanish` in the data-table React leaf. The fix registers
 * the full WAI-ARIA boolean set — the pure-Booleanish attrs (aria-atomic, busy,
 * disabled, expanded, grabbed, hidden, modal, multiline, multiselectable,
 * readonly, required, selected) PLUS the tristate attrs that still accept
 * `boolean` (aria-checked, aria-pressed) — so a nullish-branch boolean binding
 * emits `(expr) ?? undefined` (typed `boolean | undefined`, drop preserved),
 * while a provably-boolean `!!x` binding still emits RAW (wrapForDisplay=false).
 *
 * Sibling of `aria-value-numeric.test.ts` (the NUMERIC class); drives
 * `emitAttributes` directly.
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

describe('emitTemplateAttribute (React) — boolean-enumerated ARIA nullish-drop (follow-up F)', () => {
  it('the data-table binding `:aria-selected="cond ? !!sel : null"` drops via `?? undefined` (no rozieAttr widening)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [ariaBinding('aria-selected', "sel !== 'none' ? !!isSel(row) : null")],
      ctx,
    );
    expect(jsx).toContain('aria-selected={(');
    expect(jsx).toContain('?? undefined');
    expect(jsx).not.toContain('rozieAttr');
    expect(ctx.collectors.runtime.has('rozieAttr')).toBe(false);
  });

  it('the whole Booleanish + tristate ARIA set drops via `?? undefined` on a nullish-branch boolean binding', () => {
    const ir = emptyIR();
    const booleanish = [
      'aria-atomic',
      'aria-busy',
      'aria-checked', // tristate: boolean | 'false' | 'mixed' | 'true'
      'aria-disabled',
      'aria-grabbed',
      'aria-hidden',
      'aria-modal',
      'aria-multiline',
      'aria-multiselectable',
      'aria-pressed', // tristate
      'aria-readonly',
      'aria-required',
      'aria-selected',
    ];
    for (const name of booleanish) {
      const ctx = freshCtx(ir);
      const { jsx } = emitAttributes([ariaBinding(name, 'cond ? !!x : null')], ctx);
      expect(jsx, `${name} should drop via ?? undefined`).toContain('?? undefined');
      expect(jsx, `${name} should not widen via rozieAttr`).not.toContain('rozieAttr');
      expect(ctx.collectors.runtime.has('rozieAttr'), `${name} rozieAttr`).toBe(false);
    }
  });

  it('NO-REGRESS: aria-expanded (the original member) still drops via `?? undefined`', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [ariaBinding('aria-expanded', 'grouped ? !!open : null')],
      ctx,
    );
    expect(jsx).toContain('?? undefined');
    expect(ctx.collectors.runtime.has('rozieAttr')).toBe(false);
  });

  it('NO-REGRESS: a NON-nullish string form `cond ? \'true\' : \'false\'` stays on the rozieAttr path (correctly typed, no `?? undefined`)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [ariaBinding('aria-selected', "cond ? 'true' : 'false'")],
      ctx,
    );
    // A `'true' | 'false' | undefined` union is already assignable to Booleanish —
    // the `?? undefined` rescue is gated on `hasNullishBranch` (false here), so it
    // must NOT trigger (an unreachable right operand would be TS2869).
    expect(jsx).toContain('rozieAttr');
    expect(jsx).not.toContain('?? undefined');
  });
});
