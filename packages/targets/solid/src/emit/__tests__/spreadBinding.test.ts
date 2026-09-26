/**
 * Plan 14-03 Task 2 — Solid `spreadBinding` emitter (D-03 hybrid + R6 merge).
 *
 * The `spreadBinding` IR variant (`r-bind="<expr>"`) lowers to a JSX `{...obj}`
 * spread. The D-03 hybrid for Solid:
 *   - LITERAL object  → keys remapped at compile time, but `class` is KEPT
 *                       (Solid JSX native); zero runtime cost
 *   - DYNAMIC object  → `{...normalizeAttrs(<expr>)}` + runtime import collected
 *   - `$attrs`        → `{...attrs}`, EXEMPT from key normalization (D-04)
 *
 * R6: when an `r-bind` LITERAL carries a `class`/`style` key AND the element
 * also has an explicit `:class`/`:style`, the literal's `class`/`style` is
 * extracted into the existing class path and only the remaining keys spread.
 *
 * SECURITY (T-14-06): the compile-time literal key walk skips
 * `__proto__`/`constructor`/`prototype` keys.
 */

import { parseExpression } from '@babel/parser';
import type * as t from '@babel/types';
import type { AttributeBinding, IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import {
  RuntimeSolidImportCollector,
  SolidImportCollector,
} from '../../rewrite/collectSolidImports.js';
import { type EmitAttrCtx, emitAttributes } from '../emitTemplateAttribute.js';

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
    collectors: {
      solid: new SolidImportCollector(),
      runtime: new RuntimeSolidImportCollector(),
    },
  };
}

describe('emitTemplateAttribute (Solid) — spreadBinding (Plan 14-03 Task 2)', () => {
  it('(1) plain LITERAL spread → compile-time key remap, class KEPT, no normalizeAttrs', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([spread(`{ class: 'btn', for: 'x' }`)], ctx);
    // Solid keeps `class`; only `for` → `htmlFor`.
    expect(jsx).toMatchInlineSnapshot(`"{...{ class: 'btn', htmlFor: 'x' }}"`);
    expect(jsx).not.toContain('normalizeAttrs');
    expect(ctx.collectors.runtime.has('normalizeAttrs')).toBe(false);
  });

  it('(2) DYNAMIC spread → {...normalizeAttrs(expr)} + runtime import collected', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([spread(`someObj`)], ctx);
    expect(jsx).toMatchInlineSnapshot(`"{...normalizeAttrs(someObj)}"`);
    expect(ctx.collectors.runtime.has('normalizeAttrs')).toBe(true);
  });

  it('(3) $attrs spread → {...attrs}, NO normalizeAttrs wrap (D-04 exempt)', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([spread(`$attrs`)], ctx);
    expect(jsx).toMatchInlineSnapshot(`"{...attrs}"`);
    expect(jsx).not.toContain('normalizeAttrs');
    expect(jsx).not.toContain('$attrs');
    expect(ctx.collectors.runtime.has('normalizeAttrs')).toBe(false);
  });

  it('(4) R6 — :class + r-bind LITERAL class merge: both classes render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([classBinding(`'a'`), spread(`{ class: 'b', id: 'x' }`)], ctx);
    // The literal's `class` is extracted and fed into the class path;
    // only `id` spreads. Both 'a' and 'b' must appear in the class value.
    expect(jsx).toContain('class=');
    expect(jsx).toContain(`'a'`);
    expect(jsx).toContain(`'b'`);
    expect(jsx).toContain(`{...{ id: 'x' }}`);
  });

  it('(5) R6 reordered — r-bind LITERAL before :class: both classes still render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([spread(`{ class: 'b', id: 'x' }`), classBinding(`'a'`)], ctx);
    expect(jsx).toContain('class=');
    expect(jsx).toContain(`'a'`);
    expect(jsx).toContain(`'b'`);
    expect(jsx).toContain(`{...{ id: 'x' }}`);
  });

  it('(6) BUGFIX 260926 — :style + $attrs opaque spread: own style survives, consumer style merges', () => {
    // Reproduces the Slider/Resizable shape: a root element computes its OWN
    // `style` (e.g. `:style="fillStyle"`, a `$computed` custom-property map)
    // AND auto-fallthrough-spreads `$attrs`. Before the fix, `style=` was
    // emitted BEFORE `{...attrs}` with no re-merge, so a consumer's own
    // `style` prop (landing in `attrs.style`, an undeclared pass-through key)
    // REPLACED the component's style outright instead of merging — wiping
    // custom properties like `--rozie-slider-fill-start`.
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([styleBinding('fillStyle'), spread('$attrs')], ctx);
    expect(jsx).toMatchSnapshot();
    // The spread must land BEFORE the (deferred) style attribute so the
    // style attribute wins JSX's last-write ordering.
    const spreadIdx = jsx.indexOf('{...attrs}');
    const styleIdx = jsx.indexOf('style=');
    expect(spreadIdx).toBeGreaterThan(-1);
    expect(styleIdx).toBeGreaterThan(spreadIdx);
    // The own style value AND the consumer's `attrs.style` both feed into a
    // single `parseInlineStyle([...])` merge call (array — "later wins" per
    // overlapping declaration, own custom properties the consumer never set
    // are preserved — matches Vue's `normalizeStyle([own, fallthrough])`
    // fallthrough-attrs parity).
    expect(jsx).toContain('parseInlineStyle([');
    expect(jsx).toContain('attrs as unknown as Record<string, unknown>).style');
    expect(ctx.collectors.runtime.has('parseInlineStyle')).toBe(true);
  });

  it('SECURITY (T-14-06): LITERAL key walk skips __proto__/constructor/prototype', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [spread(`{ ["__proto__"]: evil, constructor: bad, id: 'ok' }`)],
      ctx,
    );
    expect(jsx).not.toContain('__proto__');
    expect(jsx).not.toContain('constructor');
    expect(jsx).toContain(`id: 'ok'`);
  });
});
