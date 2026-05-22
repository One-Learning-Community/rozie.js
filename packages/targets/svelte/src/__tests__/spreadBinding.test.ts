/**
 * Plan 14-04 Task 2 — Svelte `spreadBinding` emitter ({...obj} + R6 class/style merge).
 *
 * The `spreadBinding` IR variant (`r-bind="<expr>"`) lowers to Svelte 5's
 * native `{...obj}` attribute-spread directive. NO key normalization is
 * applied: Svelte wants HTML attribute names verbatim (D-03 is React/Solid-only).
 *
 * Cases:
 *   - LITERAL ObjectExpression  → `{...{ ... }}` with HTML keys verbatim
 *   - DYNAMIC object            → `{...someObj}`
 *   - `$attrs`                  → `{...$$restProps}` — Svelte 5's native
 *                                 rest-attributes object (`$attrs` Identifier
 *                                 is rewritten in `rewriteTemplateExpression`).
 *
 * R6: when an `r-bind` LITERAL carries a `class`/`style` key AND the element
 * also has an explicit `class`/`style`, the literal's value is extracted into
 * Svelte's `class={[...]}` / `style={[...]}` merge path; only the remaining
 * keys flow through `{...obj}`. Source order is preserved (Pitfall 2).
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

function spread(exprSrc: string): AttributeBinding {
  return {
    kind: 'spreadBinding',
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
}

function staticClass(value: string): AttributeBinding {
  return {
    kind: 'static',
    name: 'class',
    value,
    sourceLoc: { start: 0, end: value.length },
  };
}

function staticStyle(value: string): AttributeBinding {
  return {
    kind: 'static',
    name: 'style',
    value,
    sourceLoc: { start: 0, end: value.length },
  };
}

function freshCtx(ir: IRComponent): EmitAttrCtx {
  return { ir };
}

describe('emitTemplateAttribute (Svelte) — spreadBinding (Plan 14-04 Task 2)', () => {
  it('(1) plain LITERAL spread → `{...{ id: \'x\', title: \'t\' }}` with HTML keys verbatim', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes(
      [spread(`{ id: 'x', title: 't' }`)],
      ctx,
    );
    // HTML attribute names — no remap (no `class→className`).
    expect(out).toMatchInlineSnapshot(`"{...{ id: 'x', title: 't' }}"`);
    expect(out).not.toContain('className');
    expect(out).not.toContain('htmlFor');
  });

  it('(2) DYNAMIC spread → `{...someObj}` — pass-through, no runtime wrap', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes([spread(`someObj`)], ctx);
    expect(out).toMatchInlineSnapshot(`"{...someObj}"`);
    // Svelte has no runtime normalizeAttrs helper — pure native spread.
    expect(out).not.toContain('normalizeAttrs');
  });

  it('(3) $attrs spread → `{...__rozieAttrs}` (Svelte 5 runes-mode rest binding)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes([spread(`$attrs`)], ctx);
    // Plan 14-05 — Svelte 5 runes-mode rejects the legacy `$$restProps`
    // identifier (`Cannot use $$restProps in runes mode`). The Identifier
    // visitor in `rewriteTemplateExpression` rewrites `$attrs` to the
    // synthesised `__rozieAttrs` rest binding (declared in the `$props()`
    // destructure via `buildPropsDestructureEntries`).
    expect(out).toMatchInlineSnapshot(`"{...__rozieAttrs}"`);
    expect(out).toContain('__rozieAttrs');
    expect(out).not.toContain('$attrs');
    expect(out).not.toContain('$$restProps');
  });

  it('(4) R6 — class + r-bind LITERAL class merge: both classes render, only `id` spreads', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes(
      [staticClass('a'), spread(`{ class: 'b', id: 'x' }`)],
      ctx,
    );
    // The literal's `class` is extracted into the Svelte class={[...]} merge;
    // only `id` remains in the {...obj} spread.
    expect(out).toContain('class={[');
    expect(out).toContain(`"a"`);
    expect(out).toContain(`'b'`);
    expect(out).toContain(`{...{ id: 'x' }}`);
    // Source order: explicit class first, then {...obj}.
    expect(out).toMatchInlineSnapshot(
      `"class={["a", 'b']} {...{ id: 'x' }}"`,
    );
  });

  it('(5) R6 reordered — r-bind LITERAL before class: both classes still render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes(
      [spread(`{ class: 'b', id: 'x' }`), staticClass('a')],
      ctx,
    );
    // Both classes must still appear; reorder swaps their position in the
    // class={[...]} array (positional last-wins is preserved within the merge).
    expect(out).toContain('class={[');
    expect(out).toContain(`"a"`);
    expect(out).toContain(`'b'`);
    expect(out).toContain(`{...{ id: 'x' }}`);
  });

  it('R6 — style + r-bind LITERAL style merge: both styles render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes(
      [
        staticStyle('color: red'),
        spread(`{ style: 'font-size: 12px', id: 'x' }`),
      ],
      ctx,
    );
    expect(out).toContain('style={[');
    expect(out).toContain(`"color: red"`);
    expect(out).toContain(`'font-size: 12px'`);
    expect(out).toContain(`{...{ id: 'x' }}`);
  });

  it('SECURITY (T-14-06): LITERAL key walk drops __proto__/constructor/prototype', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const out = emitAttributes(
      [spread(`{ ["__proto__"]: evil, constructor: bad, id: 'ok' }`)],
      ctx,
    );
    expect(out).not.toContain('__proto__');
    expect(out).not.toContain('constructor');
    expect(out).toContain(`id: 'ok'`);
  });
});
