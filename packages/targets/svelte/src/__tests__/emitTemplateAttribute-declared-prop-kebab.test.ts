/**
 * Quick task 260812-2ur — declared-prop resolution for kebab-spelled
 * `aria-*`/`data-*` attributes on composed component tags (Svelte target).
 *
 * A consumer binding `:aria-label="expr"` (or plain `aria-label="str"`) on a
 * `<components>`-composed child that DECLARES a prop `ariaLabel` must reach
 * that prop. Before this task, `isHtmlNaturalKebabName` short-circuited the
 * `kebabToCamel` in `resolveAttrName` UNCONDITIONALLY for `aria-`/`data-`
 * names — a deliberate design for the `$$restProps` passthrough case, which
 * breaks down when the callee declares the prop explicitly. The declared list
 * (threaded from `TemplateElementIR.producerProps`) now front-runs that
 * preservation; genuine passthrough (no declared match / unresolved callee)
 * keeps the kebab form so `$$restProps` spreads still work.
 *
 * Harness shape per the React twin
 * (`emitTemplateAttribute-declared-prop-kebab.test.ts`): drives
 * `emitAttributes` directly with a hand-built `EmitAttrCtx` so
 * `producerProps` can be injected without running `threadParamTypes`.
 */

import { parseExpression } from '@babel/parser';
import type * as t from '@babel/types';
import type { AttributeBinding, IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { type EmitAttrCtx, emitAttributes } from '../emit/emitTemplateAttribute.js';

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

function attrBinding(name: string, exprSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name,
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
}

function staticAttr(name: string, value: string): AttributeBinding {
  return {
    kind: 'static',
    name,
    value,
    sourceLoc: { start: 0, end: value.length },
  };
}

function ctxWith(
  ir: IRComponent,
  elementTagKind?: 'html' | 'component' | 'self',
  producerProps?: readonly string[],
): EmitAttrCtx {
  return {
    ir,
    elementTagKind,
    ...(producerProps !== undefined ? { producerProps } : {}),
  };
}

describe('emitTemplateAttribute (Svelte) — declared-prop kebab resolution (260812-2ur)', () => {
  it('C1 (the bug): colon-bound :aria-label on a component DECLARING ariaLabel → emitted key is the DECLARED camelCase name', () => {
    const ir = emptyIR();
    const out = emitAttributes(
      [attrBinding('aria-label', "'Coverage Line Chart'")],
      ctxWith(ir, 'component', ['ariaLabel', 'data']),
    );
    expect(out).toContain('ariaLabel={');
    expect(out).not.toContain('aria-label=');
  });

  it('C2: PLAIN (colon-free) aria-label="str" on the same declaring component → same declared camelCase key', () => {
    const ir = emptyIR();
    const out = emitAttributes(
      [staticAttr('aria-label', 'Coverage Line Chart')],
      ctxWith(ir, 'component', ['ariaLabel', 'data']),
    );
    expect(out).toContain('ariaLabel="Coverage Line Chart"');
    expect(out).not.toContain('aria-label=');
  });

  it('C3 (byte-identity, native): elementTagKind html with the SAME declared-prop list threaded → hyphenated DOM name preserved', () => {
    const ir = emptyIR();
    const bound = emitAttributes(
      [attrBinding('aria-label', 'label')],
      ctxWith(ir, 'html', ['ariaLabel']),
    );
    expect(bound).toContain('aria-label={');
    expect(bound).not.toContain('ariaLabel={');
    const plain = emitAttributes(
      [staticAttr('aria-label', 'x')],
      ctxWith(ir, 'html', ['ariaLabel']),
    );
    expect(plain).toContain('aria-label="x"');
    expect(plain).not.toContain('ariaLabel=');
  });

  it("C4 (byte-identity, unresolved callee): component with NO declared-prop list → hyphenated name preserved (fallback is today's behavior)", () => {
    const ir = emptyIR();
    const out = emitAttributes(
      [attrBinding('aria-label', 'label')],
      ctxWith(ir, 'component', undefined),
    );
    expect(out).toContain('aria-label={');
    expect(out).not.toContain('ariaLabel={');
  });

  it('C5 (byte-identity, genuine passthrough): declared list with NO match for a data-* attribute → hyphenated name preserved so $$restProps spreads survive', () => {
    const ir = emptyIR();
    const bound = emitAttributes(
      [attrBinding('data-testid', "'coverage-line-wrap'")],
      ctxWith(ir, 'component', ['ariaLabel', 'value']),
    );
    expect(bound).toContain('data-testid={');
    expect(bound).not.toContain('dataTestid={');
    const plain = emitAttributes(
      [staticAttr('data-testid', 'coverage-line-wrap')],
      ctxWith(ir, 'component', ['ariaLabel', 'value']),
    );
    expect(plain).toContain('data-testid="coverage-line-wrap"');
    expect(plain).not.toContain('dataTestid=');
  });

  it('C5b (Svelte design case): a non-aria natural-kebab name (role) with no declared match → verbatim, $$restProps-safe', () => {
    const ir = emptyIR();
    const out = emitAttributes(
      [attrBinding('role', "'img'"), staticAttr('title', 'hi')],
      ctxWith(ir, 'component', ['ariaLabel']),
    );
    expect(out).toContain('role={');
    expect(out).toContain('title="hi"');
  });

  it('C6 (single-word invariant): a non-hyphenated attribute matching a declared name exactly → emitted key unchanged', () => {
    const ir = emptyIR();
    const out = emitAttributes(
      [attrBinding('value', 'x'), staticAttr('label', 'hi')],
      ctxWith(ir, 'component', ['value', 'label']),
    );
    // Exact-name-first means a single-word name can only resolve to itself —
    // the emitted string is byte-identical with or without the declared list.
    expect(out).toContain('value={');
    expect(out).toContain('label="hi"');
  });
});
