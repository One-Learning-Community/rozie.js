/**
 * quick 261019-9g1 (add-on C) — React numeric `aria-colspan` / `aria-rowspan` /
 * `aria-posinset` / `aria-setsize` raw-emit (no string widening).
 *
 * React's `AriaAttributes` types these four `number | undefined`, exactly like
 * `aria-rowindex` / `aria-colcount` / `aria-level` / `aria-value*`. Unlisted, a
 * number-typed binding routes through `rozieAttr(...)` and widens to
 * `string | undefined` → TS2322 against the `number` slot. Registered in
 * `NUMERIC_HTML_ATTRS` so a provably-non-nullish numeric expr emits RAW and a
 * genuinely-nullish binding still drops via `?? undefined`.
 *
 * Drives `emitAttributes` directly (its return carries the JSX text + the
 * runtime-import collector for `rozieAttr` membership assertions).
 */

import { parseExpression } from '@babel/parser';
import type * as t from '@babel/types';
import type { AttributeBinding, IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { type EmitAttrCtx, emitAttributes } from '../emit/emitTemplateAttribute.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

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

describe('emitTemplateAttribute (React) — numeric aria-colspan/rowspan/posinset/setsize (add-on C)', () => {
  for (const name of ['aria-colspan', 'aria-rowspan', 'aria-posinset', 'aria-setsize']) {
    it(`${name}: a number-typed call-expr emits RAW (no rozieAttr widening)`, () => {
      const ir = emptyIR();
      const ctx = freshCtx(ir);
      const { jsx } = emitAttributes([ariaBinding(name, 'getN()')], ctx);
      expect(jsx).toContain(`${name}={getN()}`);
      expect(jsx).not.toContain('rozieAttr');
      expect(ctx.collectors.runtime.has('rozieAttr')).toBe(false);
    });

    it(`${name}: a genuinely-nullish \`x ? n : null\` still DROPS via \`?? undefined\``, () => {
      const ir = emptyIR();
      const ctx = freshCtx(ir);
      const { jsx } = emitAttributes([ariaBinding(name, 'cond ? 5 : null')], ctx);
      expect(jsx).toContain('?? undefined');
      expect(jsx).not.toContain('rozieAttr');
    });
  }
});
