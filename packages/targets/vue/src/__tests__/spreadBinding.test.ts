/**
 * Plan 14-04 Task 1 — Vue `spreadBinding` emitter (v-bind + R6 class/style merge).
 *
 * The `spreadBinding` IR variant (`r-bind="<expr>"`) lowers to Vue's native
 * argument-less `v-bind="<obj>"` attribute spread. NO key normalization is
 * applied: Vue wants HTML attribute names verbatim (D-03 is React/Solid-only).
 *
 * Cases:
 *   - LITERAL ObjectExpression  → `v-bind="{ ... }"` with HTML keys verbatim
 *   - DYNAMIC object            → `v-bind="someObj"`
 *   - `$attrs` (Vue native)     → `v-bind="$attrs"` — `rewriteTemplateExpression`
 *                                 leaves the bare `$attrs` Identifier alone so
 *                                 Vue's own `$attrs` proxy is the runtime source.
 *
 * R6: when an `r-bind` LITERAL carries a `class`/`style` key AND the element
 * also has an explicit `:class`/`:style`, the literal's `class`/`style` is
 * extracted into the existing `:class="[...]"` merge path and only the
 * remaining keys spread via `v-bind`. Source order is preserved (Pitfall 2).
 *
 * SECURITY (T-14-06): the compile-time literal key walk drops
 * `__proto__`/`constructor`/`prototype` keys.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, AttributeBinding } from '../../../../core/src/ir/types.js';
import { emitMergedAttributes, type EmitAttrCtx } from '../emit/emitTemplateAttribute.js';

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

function spread(exprSrc: string): AttributeBinding {
  return {
    kind: 'spreadBinding',
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
}

function classBinding(exprSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name: 'class',
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
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
    registry: createDefaultRegistry(),
  };
}

describe('emitTemplateAttribute (Vue) — spreadBinding (Plan 14-04 Task 1)', () => {
  it('(1) plain LITERAL spread → `v-bind="{ id: \'x\', title: \'t\' }"` with HTML keys verbatim', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes(
      [spread(`{ id: 'x', title: 't' }`)],
      ctx,
    );
    // HTML attribute names — no remap (no `class→className`).
    expect(out).toMatchInlineSnapshot(`"v-bind="{ id: 'x', title: 't' }""`);
    expect(out).toContain('v-bind=');
    expect(out).not.toContain('className');
    expect(out).not.toContain('htmlFor');
  });

  it('(2) DYNAMIC spread → `v-bind="someObj"` — pass-through, no runtime wrap', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes([spread(`someObj`)], ctx);
    expect(out).toMatchInlineSnapshot(`"v-bind="someObj""`);
    // Vue has no runtime normalizeAttrs helper — pure native v-bind.
    expect(out).not.toContain('normalizeAttrs');
  });

  it('(3) $attrs spread → `v-bind="$attrs"` (Vue native magic accessor)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes([spread(`$attrs`)], ctx);
    // Vue's template `$attrs` is the native magic accessor — leave it as-is.
    // No rewrite to `attrs` (that's React/Solid).
    expect(out).toMatchInlineSnapshot(`"v-bind="$attrs""`);
    expect(out).toContain('$attrs');
  });

  it('(4) R6 — :class + r-bind LITERAL class merge: both classes render, only `id` spreads', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes(
      [classBinding(`'a'`), spread(`{ class: 'b', id: 'x' }`)],
      ctx,
    );
    // The literal's `class` is extracted into the :class array; only `id`
    // remains in the v-bind spread.
    expect(out).toContain(':class=');
    expect(out).toContain(`'a'`);
    expect(out).toContain(`'b'`);
    expect(out).toContain(`v-bind="{ id: 'x' }"`);
    // Source order: explicit :class first, then v-bind="{ id: ... }".
    expect(out).toMatchInlineSnapshot(
      `":class="['a', 'b']" v-bind="{ id: 'x' }""`,
    );
  });

  it('(5) R6 reordered — r-bind LITERAL before :class: both classes still render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes(
      [spread(`{ class: 'b', id: 'x' }`), classBinding(`'a'`)],
      ctx,
    );
    // Both classes must still appear; reorder swaps their position in the
    // :class array (positional last-wins is preserved within the merge).
    expect(out).toContain(':class=');
    expect(out).toContain(`'a'`);
    expect(out).toContain(`'b'`);
    expect(out).toContain(`v-bind="{ id: 'x' }"`);
  });

  it('R6 — :style + r-bind LITERAL style merge: both styles render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes(
      [
        styleBinding(`{ color: 'red' }`),
        spread(`{ style: { fontSize: '12px' }, id: 'x' }`),
      ],
      ctx,
    );
    expect(out).toContain(':style=');
    expect(out).toContain(`color: 'red'`);
    expect(out).toContain(`fontSize: '12px'`);
    expect(out).toContain(`v-bind="{ id: 'x' }"`);
  });

  it('SECURITY (T-14-06): LITERAL key walk drops __proto__/constructor/prototype', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitMergedAttributes(
      [spread(`{ ["__proto__"]: evil, constructor: bad, id: 'ok' }`)],
      ctx,
    );
    expect(out).not.toContain('__proto__');
    expect(out).not.toContain('constructor');
    expect(out).toContain(`id: 'ok'`);
  });
});
