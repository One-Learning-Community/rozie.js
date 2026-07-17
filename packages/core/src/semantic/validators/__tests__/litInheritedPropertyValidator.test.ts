// Quick 260717-8zb (Task 2 Item 5) — ROZ147 Lit inherited-DOM-PROPERTY prop-name
// validator. The property-sibling gap of ROZ142's curated
// LIT_DOM_PROP_FOOTGUNS warning tier: ROZ142 hand-curates its property subset
// to avoid flagging already-shipped safe names; ROZ147 widens coverage to the
// REMAINING inherited HTMLElement/Element/Node property names ROZ142 does not
// already cover, as a SUPPRESSIBLE warning (never blocks the build). The
// validator NEVER throws on malformed input (D-08) and never mutates the AST.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'litprop.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function analyzeSource(source: string, filename = 'litprop.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

const roz147 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.LIT_INHERITED_PROPERTY_PROP_NAME);

function propsComponent(propsBody: string): string {
  return `<rozie name="X">
<props>{ ${propsBody} }</props>
<template><div></div></template>
</rozie>`;
}

describe('litInheritedPropertyValidator (ROZ147)', () => {
  it('warns for a prop named after an inherited Element property NOT already covered by ROZ142 (e.g. "part")', () => {
    const diags = analyzeSource(propsComponent(`part: { type: String, default: '' }`));
    const hits = roz147(diags);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe('warning');
  });

  it('warns for "shadowRoot" (Element property)', () => {
    const diags = analyzeSource(propsComponent(`shadowRoot: { type: Boolean, default: false }`));
    expect(roz147(diags).length).toBeGreaterThan(0);
  });

  it('does NOT double-fire for a name already covered by ROZ142 (curated footgun tier, e.g. "tabIndex")', () => {
    const diags = analyzeSource(propsComponent(`tabIndex: { type: Number, default: 0 }`));
    // ROZ142 covers it; ROZ147 must stay silent for this name.
    expect(roz147(diags)).toHaveLength(0);
  });

  it('does NOT double-fire for a name already covered by ROZ142 (method tier, e.g. "normalize")', () => {
    const diags = analyzeSource(propsComponent(`normalize: { type: Boolean, default: false }`));
    expect(roz147(diags)).toHaveLength(0);
  });

  it('does NOT fire for a benign, non-colliding prop name', () => {
    const diags = analyzeSource(propsComponent(`label: { type: String, default: '' }`));
    expect(roz147(diags)).toHaveLength(0);
  });

  it('is suppressible in the sense that it never blocks compile — no error-severity entries', () => {
    const diags = analyzeSource(propsComponent(`part: { type: String, default: '' }`));
    const hits = roz147(diags);
    expect(hits.every((d) => d.severity !== 'error')).toBe(true);
  });
});
