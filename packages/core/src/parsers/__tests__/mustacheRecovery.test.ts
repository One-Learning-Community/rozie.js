// Phase 85 Plan 03 (REQ-V13) — parser error recovery for an unterminated
// `{{` mustache opener.
//
// Before this plan, an unmatched `{{` in a text run reported the
// TEMPLATE_MALFORMED_MUSTACHE diagnostic and then treated the ENTIRE
// remaining tail as plain text — no interpolation node at all. That is
// exactly the AST state a template is in on every keystroke between typing
// the braces and typing the expression, which blocked the Volar language
// server from offering completion at that caret.
//
// The fix is additive: `parseTemplate.ts`'s existing diagnostic-and-text-node
// push stays UNTOUCHED (same code, severity, message, range, and text), and
// a NEW `TemplateInterpolation` node — marked `recovered: true` — is pushed
// alongside it, spanning the opener through the end of the run.
// `lowerTemplate.ts` skips `recovered` nodes, so the IR (and therefore every
// target's emitted output) is unaffected: the unchanged TemplateText node is
// the only thing that ever reaches codegen for this span, exactly as before
// this plan.
import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../parseTemplate.js';
import { parse } from '../../parse.js';
import { lowerToIR } from '../../ir/lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type {
  TemplateInterpolation,
  TemplateText,
  TemplateNode,
} from '../../ast/blocks/TemplateAST.js';

function parseTpl(content: string) {
  return parseTemplate(content, { start: 0, end: content.length }, content, 'MustacheRecovery.rozie');
}

function findAll<T extends TemplateNode['type']>(
  nodes: TemplateNode[],
  type: T,
): Extract<TemplateNode, { type: T }>[] {
  return nodes.filter((n): n is Extract<TemplateNode, { type: T }> => n.type === type);
}

describe('parseTemplate — unterminated {{ recovery (REQ-V13)', () => {
  it('a half-typed {{ still reports the malformed-mustache diagnostic AND yields a marked recovery node', () => {
    const content = 'hello {{ foo';
    const { node, diagnostics } = parseTpl(content);
    expect(node).not.toBeNull();

    // The diagnostic is UNCHANGED — same code, severity, message, range.
    expect(diagnostics).toHaveLength(1);
    const d = diagnostics[0]!;
    expect(d.code).toBe(RozieErrorCode.TEMPLATE_MALFORMED_MUSTACHE);
    expect(d.severity).toBe('error');
    expect(d.message).toBe(
      'Unmatched `{{` in template — expected a closing `}}` in the same text run.',
    );
    expect(d.loc).toEqual({ start: 6, end: 8 });

    // The existing plain-text node is UNCHANGED — still covers the whole
    // tail, including the unmatched braces, verbatim.
    const textNodes = findAll(node!.children, 'TemplateText');
    expect(textNodes).toHaveLength(1);
    expect(textNodes[0]!.text).toBe(content);
    expect(textNodes[0]!.loc).toEqual({ start: 0, end: content.length });

    // NEW: an additive, marked recovery interpolation node spans the opener
    // through the end of the run, carrying the partial expression text.
    const interps = findAll(node!.children, 'TemplateInterpolation');
    expect(interps).toHaveLength(1);
    const interp = interps[0]!;
    expect(interp.recovered).toBe(true);
    expect(interp.rawExpr).toBe(' foo');
    expect(interp.loc).toEqual({ start: 6, end: content.length });
  });

  it('a well-formed interpolation is unmarked and its node shape is unchanged', () => {
    const content = 'hi {{ $props.label }} there';
    const { node, diagnostics } = parseTpl(content);
    expect(diagnostics).toHaveLength(0);

    const interps = findAll(node!.children, 'TemplateInterpolation');
    expect(interps).toHaveLength(1);
    const interp = interps[0]!;
    expect(interp.recovered).toBeUndefined();
    expect(interp.rawExpr).toBe(' $props.label ');
  });

  it('an opener with an empty tail yields a marked node with empty expression text — not a crash, not a skipped node', () => {
    const content = 'x {{';
    const { node, diagnostics } = parseTpl(content);
    expect(diagnostics).toHaveLength(1);

    const interps = findAll(node!.children, 'TemplateInterpolation');
    expect(interps).toHaveLength(1);
    const interp = interps[0]!;
    expect(interp.recovered).toBe(true);
    expect(interp.rawExpr).toBe('');
    expect(interp.loc).toEqual({ start: 2, end: content.length });
  });

  it('two unterminated openers in one text run produce ONE marked node for the first, matching the diagnostic', () => {
    const content = 'a {{ one {{ two';
    const { node, diagnostics } = parseTpl(content);

    // The diagnostic already reports only the first unmatched opener.
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.loc).toEqual({ start: 2, end: 4 });

    const interps = findAll(node!.children, 'TemplateInterpolation');
    expect(interps).toHaveLength(1);
    const interp = interps[0]!;
    expect(interp.recovered).toBe(true);
    // Spans from AFTER the FIRST opener to the end of the run — the second
    // (literal, unrecognized) `{{` is just part of the partial expression
    // text, same as it's just part of the unchanged TemplateText node.
    expect(interp.rawExpr).toBe(' one {{ two');
    expect(interp.loc).toEqual({ start: 2, end: content.length });
  });

  it('a well-formed interpolation followed by an unterminated opener in the SAME text run recovers only the trailing tail', () => {
    const content = 'ok {{ $data.x }} then {{ broken';
    const { node, diagnostics } = parseTpl(content);
    expect(diagnostics).toHaveLength(1);

    const interps = findAll(node!.children, 'TemplateInterpolation');
    expect(interps).toHaveLength(2);
    expect(interps[0]!.recovered).toBeUndefined();
    expect(interps[0]!.rawExpr).toBe(' $data.x ');
    expect(interps[1]!.recovered).toBe(true);
    expect(interps[1]!.rawExpr).toBe(' broken');
  });
});

describe('lowerTemplate — recovery nodes are skipped (IR unaffected, T-85-09)', () => {
  function lowerFixture(templateInner: string) {
    const source = `<rozie name="MustacheRecoveryIR">
<template>
${templateInner}
</template>
</rozie>`;
    const { ast, diagnostics: parseDiags } = parse(source, {
      filename: 'MustacheRecoveryIR.rozie',
    });
    if (!ast) {
      throw new Error(
        `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
      );
    }
    const malformed = parseDiags.filter(
      (d) => d.code === RozieErrorCode.TEMPLATE_MALFORMED_MUSTACHE,
    );
    const { ir } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
      filename: 'MustacheRecoveryIR.rozie',
    });
    if (!ir) throw new Error('lowerToIR returned null ir');
    return { ir, malformed };
  }

  function countInterpolationIR(node: unknown): number {
    if (!node || typeof node !== 'object') return 0;
    const n = node as { type?: string; children?: unknown[] };
    let count = n.type === 'TemplateInterpolation' ? 1 : 0;
    if (Array.isArray(n.children)) {
      for (const child of n.children) count += countInterpolationIR(child);
    }
    return count;
  }

  it('a file with only an unterminated opener lowers to ZERO interpolation IR nodes — the recovery node never reaches codegen', () => {
    const { ir, malformed } = lowerFixture('<div>hello {{ foo</div>');
    expect(malformed).toHaveLength(1);
    expect(countInterpolationIR(ir.template)).toBe(0);
  });

  it('a well-formed interpolation ALONGSIDE an unterminated opener in the same run still lowers exactly ONE interpolation IR node', () => {
    const { ir, malformed } = lowerFixture(
      '<div>ok {{ 1 + 1 }} then {{ broken</div>',
    );
    expect(malformed).toHaveLength(1);
    expect(countInterpolationIR(ir.template)).toBe(1);
  });
});
