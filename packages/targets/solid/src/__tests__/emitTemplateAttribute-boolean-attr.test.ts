/**
 * Bug fix — Solid target emits a bare valueless HTML boolean attribute
 * (`<input disabled>`) as `disabled=""`, a STRING, which fails Solid's strict
 * JSX typings for boolean-typed props (`multiple`/`disabled`/`checked`/…)
 * with TS2322 "Type 'string' is not assignable to type 'boolean'".
 *
 * Mirrors the already-fixed React twin (quick task 260520-w18 bug class 4,
 * `react/src/emit/emitTemplateAttribute.ts:1256-1258`): a STATIC AttributeBinding
 * whose `value === ''` AND whose name is in the shared `BOOLEAN_HTML_ATTRS`
 * whitelist emits the JSX boolean form `name={true}`, not `name=""`.
 *
 * The IR collapses a genuinely-valueless attr (`<input disabled>`) and an
 * attr with an explicit empty string (`alt=""`) to the SAME
 * `{ kind: 'static', value: '' }` shape (see
 * `packages/core/src/ir/lowerers/lowerTemplate.ts:302-346` — the `attr.value
 * ?? ''` collapse on a DOM element). The IR does not preserve "had no value"
 * vs "had an explicit empty value" for a bare (non-`:`) DOM attribute, so the
 * only safe signal is the attribute NAME whitelist — exactly what the React
 * target already gates on. `alt` is not in `BOOLEAN_HTML_ATTRS`, so
 * `alt=""` must stay a plain empty string literal (unaffected).
 */

import type { AttributeBinding, IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { type EmitAttrCtx, emitAttributes } from '../emit/emitTemplateAttribute.js';
import {
  RuntimeSolidImportCollector,
  SolidImportCollector,
} from '../rewrite/collectSolidImports.js';

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

function staticAttr(name: string, value: string): AttributeBinding {
  return {
    kind: 'static',
    name,
    value,
    sourceLoc: { start: 0, end: name.length },
  };
}

function freshCtx(ir: IRComponent): EmitAttrCtx {
  return {
    ir,
    collectors: {
      solid: new SolidImportCollector(),
      runtime: new RuntimeSolidImportCollector(),
    },
    elementTagKind: 'html',
    tagName: 'input',
  };
}

describe('emitTemplateAttribute (Solid) — valueless boolean HTML attribute', () => {
  it('bare `disabled` (empty-string static value) emits `disabled={true}`, NOT `disabled=""`', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx, diagnostics } = emitAttributes([staticAttr('disabled', '')], ctx);
    expect(jsx).toBe('disabled={true}');
    expect(jsx).not.toContain('disabled=""');
    expect(diagnostics).toEqual([]);
  });

  it('bare `multiple` on a <select> emits `multiple={true}`', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    ctx.tagName = 'select';
    const { jsx } = emitAttributes([staticAttr('multiple', '')], ctx);
    expect(jsx).toBe('multiple={true}');
  });

  it('bare `checked`, `readonly`, `required`, `hidden`, `selected`, `autofocus` all emit boolean-true form', () => {
    const ir = emptyIR();
    // `readonly` is name-aliased to `readOnly` by HTML_TO_SOLID_ATTR (a
    // separate, pre-existing concern from the boolean-value fix under test);
    // every other name here passes through unaliased.
    for (const [name, jsxName] of [
      ['checked', 'checked'],
      ['readonly', 'readOnly'],
      ['required', 'required'],
      ['hidden', 'hidden'],
      ['selected', 'selected'],
      ['autofocus', 'autofocus'],
    ]) {
      const ctx = freshCtx(ir);
      const { jsx } = emitAttributes([staticAttr(name!, '')], ctx);
      expect(jsx).toBe(`${jsxName}={true}`);
    }
  });

  it('explicit `alt=""` (NOT a boolean attribute name) stays a plain empty string literal', () => {
    const ir = emptyIR();
    const ctx = freshCtx(ir);
    const { jsx, diagnostics } = emitAttributes([staticAttr('alt', '')], ctx);
    expect(jsx).toBe('alt=""');
    expect(diagnostics).toEqual([]);
  });
});
