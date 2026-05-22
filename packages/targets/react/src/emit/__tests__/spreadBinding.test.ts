/**
 * Plan 14-03 Task 2 — React `spreadBinding` emitter (D-03 hybrid + R6 merge).
 *
 * The `spreadBinding` IR variant (`r-bind="<expr>"`) lowers to a JSX `{...obj}`
 * spread. The D-03 hybrid:
 *   - LITERAL object  → keys remapped at compile time (class→className, …),
 *                       zero runtime cost, no `normalizeAttrs` call
 *   - DYNAMIC object  → `{...normalizeAttrs(<expr>)}` + runtime import collected
 *   - `$attrs`        → `{...attrs}`, EXEMPT from key normalization (D-04)
 *
 * R6: when an `r-bind` LITERAL carries a `class`/`style` key AND the element
 * also has an explicit `:class`/`:style`, the literal's `class`/`style` is
 * extracted into the existing merge path and only the remaining keys spread.
 *
 * SECURITY (T-14-06): the compile-time literal key walk skips
 * `__proto__`/`constructor`/`prototype` keys.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, AttributeBinding } from '../../../../../core/src/ir/types.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../../rewrite/collectReactImports.js';
import { emitAttributes, type EmitAttrCtx } from '../emitTemplateAttribute.js';

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

function freshCtx(ir: IRComponent): EmitAttrCtx {
  return {
    ir,
    collectors: {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    },
  };
}

describe('emitTemplateAttribute (React) — spreadBinding (Plan 14-03 Task 2)', () => {
  it('(1) plain LITERAL spread → compile-time key remap, no normalizeAttrs', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes([spread(`{ class: 'btn', id: 'x' }`)], ctx);
    expect(jsx).toMatchInlineSnapshot(`"{...{ className: 'btn', id: 'x' }}"`);
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
    const { jsx } = emitAttributes(
      [classBinding(`'a'`), spread(`{ class: 'b', id: 'x' }`)],
      ctx,
    );
    // The literal's `class` is extracted and fed into the class-merge path;
    // only `id` spreads. Both 'a' and 'b' must appear in the className value.
    expect(jsx).toContain('className=');
    expect(jsx).toContain(`'a'`);
    expect(jsx).toContain(`'b'`);
    expect(jsx).toContain(`{...{ id: 'x' }}`);
    expect(jsx).toMatchInlineSnapshot(
      `"className={clsx('a', 'b')} {...{ id: 'x' }}"`,
    );
  });

  it('(5) R6 reordered — r-bind LITERAL before :class: both classes still render', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx } = emitAttributes(
      [spread(`{ class: 'b', id: 'x' }`), classBinding(`'a'`)],
      ctx,
    );
    expect(jsx).toContain('className=');
    expect(jsx).toContain(`'a'`);
    expect(jsx).toContain(`'b'`);
    expect(jsx).toContain(`{...{ id: 'x' }}`);
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
