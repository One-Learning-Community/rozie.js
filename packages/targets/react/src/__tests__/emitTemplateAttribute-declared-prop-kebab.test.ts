/**
 * Quick task 260812-2ur — declared-prop resolution for kebab-spelled
 * `aria-*`/`data-*` attributes on composed component tags (React target).
 *
 * A consumer binding `:aria-label="expr"` (or plain `aria-label="str"`) on a
 * `<components>`-composed child that DECLARES a prop `ariaLabel` must reach
 * that prop — the emitted key is the DECLARED camelCase name, not the
 * hyphenated attribute form. Before this task, `colonPropToJsxName`'s
 * aria-/data- preservation ran UNCONDITIONALLY (before any tagKind check),
 * so the child's destructuring (`_props.ariaLabel`) never saw the value.
 * Angular's component-tag camelization is the prior art (already correct);
 * this is the declaration-gated form of it — natives and genuine passthrough
 * attributes keep today's hyphen preservation exactly.
 *
 * Harness shape per `emitTemplateAttribute-component-passthrough.test.ts`:
 * drives `emitAttributes` directly with a hand-built `EmitAttrCtx` so
 * `producerProps` can be injected without running `threadParamTypes`.
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
    collectors: {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    },
    elementTagKind,
    ...(producerProps !== undefined ? { producerProps } : {}),
  };
}

describe('emitTemplateAttribute (React) — declared-prop kebab resolution (260812-2ur)', () => {
  it('C1 (the bug): colon-bound :aria-label on a component DECLARING ariaLabel → emitted key is the DECLARED camelCase name', () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('aria-label', "'Coverage Line Chart'")],
      ctxWith(ir, 'component', ['ariaLabel', 'data']),
    );
    expect(jsx).toContain('ariaLabel={');
    expect(jsx).not.toContain('aria-label=');
  });

  it('C2: PLAIN (colon-free) aria-label="str" on the same declaring component → same declared camelCase key', () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [staticAttr('aria-label', 'Coverage Line Chart')],
      ctxWith(ir, 'component', ['ariaLabel', 'data']),
    );
    expect(jsx).toContain('ariaLabel="Coverage Line Chart"');
    expect(jsx).not.toContain('aria-label=');
  });

  it('C3 (byte-identity, native): elementTagKind html with the SAME declared-prop list threaded → hyphenated DOM name preserved', () => {
    const ir = emptyIR();
    const bound = emitAttributes(
      [attrBinding('aria-label', 'label')],
      ctxWith(ir, 'html', ['ariaLabel']),
    );
    expect(bound.jsx).toContain('aria-label={');
    expect(bound.jsx).not.toContain('ariaLabel={');
    const plain = emitAttributes(
      [staticAttr('aria-label', 'x')],
      ctxWith(ir, 'html', ['ariaLabel']),
    );
    expect(plain.jsx).toContain('aria-label="x"');
    expect(plain.jsx).not.toContain('ariaLabel=');
  });

  it('C4 (byte-identity, unresolved callee): component with NO declared-prop list → hyphenated name preserved (fallback is today\'s behavior)', () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('aria-label', 'label')],
      ctxWith(ir, 'component', undefined),
    );
    expect(jsx).toContain('aria-label={');
    expect(jsx).not.toContain('ariaLabel={');
  });

  it('C5 (byte-identity, genuine passthrough): declared list with NO match for a data-* attribute → hyphenated name preserved', () => {
    const ir = emptyIR();
    const bound = emitAttributes(
      [attrBinding('data-testid', "'coverage-line-wrap'")],
      ctxWith(ir, 'component', ['ariaLabel', 'value']),
    );
    expect(bound.jsx).toContain('data-testid={');
    expect(bound.jsx).not.toContain('dataTestid={');
    const plain = emitAttributes(
      [staticAttr('data-testid', 'coverage-line-wrap')],
      ctxWith(ir, 'component', ['ariaLabel', 'value']),
    );
    expect(plain.jsx).toContain('data-testid="coverage-line-wrap"');
    expect(plain.jsx).not.toContain('dataTestid=');
  });

  it('C6 (single-word invariant): a non-hyphenated attribute matching a declared name exactly → emitted key unchanged', () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('value', 'x'), staticAttr('title', 'hi')],
      ctxWith(ir, 'component', ['value', 'title']),
    );
    // Exact-name-first means a single-word name can only resolve to itself —
    // the emitted string is byte-identical with or without the declared list.
    expect(jsx).toContain('value={');
    expect(jsx).toContain('title="hi"');
  });
});
