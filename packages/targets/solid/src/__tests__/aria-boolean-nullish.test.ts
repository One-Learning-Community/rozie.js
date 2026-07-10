/**
 * Follow-up F (data-table beta) — Solid boolean-enumerated ARIA attrs drop via
 * `(expr) ?? undefined` (no string widening), for the WHOLE Booleanish/tristate set.
 *
 * Solid sibling of the React fix: `:aria-selected="cond ? !!sel : null"` on a
 * `<tr>` routed through `rozieAttr` widens to `string | undefined` → TS2322
 * against Solid's strict `Booleanish | undefined` JSX slot. `aria-expanded` was
 * the only member of `BOOLEAN_NULLISH_ARIA_ATTRS`; this expands it to the full
 * WAI-ARIA boolean set (pure-Booleanish + the tristate attrs that accept
 * `boolean`) so a nullish-branch boolean binding emits `(expr) ?? undefined`.
 *
 * Drives `emitAttributes` directly (mirrors `emitTemplateAttribute-style.test.ts`).
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
      solid: new SolidImportCollector(),
      runtime: new RuntimeSolidImportCollector(),
    },
  } as EmitAttrCtx;
}

describe('emitTemplateAttribute (Solid) — boolean-enumerated ARIA nullish-drop (follow-up F)', () => {
  it('the data-table binding `:aria-selected="cond ? !!sel : null"` drops via `?? undefined` (no rozieAttr widening)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [ariaBinding('aria-selected', "sel !== 'none' ? !!isSel(row) : null")],
      ctx,
    );
    expect(jsx).toContain('?? undefined');
    expect(jsx).not.toContain('rozieAttr');
    expect(ctx.collectors.runtime.has('rozieAttr')).toBe(false);
  });

  it('the whole Booleanish + tristate ARIA set drops via `?? undefined` on a nullish-branch boolean binding', () => {
    const ir = emptyIR();
    const booleanish = [
      'aria-atomic',
      'aria-busy',
      'aria-checked', // tristate
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

  it('NO-REGRESS: a NON-nullish string form `cond ? \'true\' : \'false\'` stays on the rozieAttr path', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [ariaBinding('aria-selected', "cond ? 'true' : 'false'")],
      ctx,
    );
    expect(jsx).toContain('rozieAttr');
    expect(jsx).not.toContain('?? undefined');
  });
});
