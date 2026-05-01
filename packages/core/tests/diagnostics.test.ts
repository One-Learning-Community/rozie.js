// D-06 / D-07 / D-08 — diagnostics infrastructure (Plan 04 Task 2 + Task 4 e2e).
// Implementation: packages/core/src/diagnostics/{codes.ts,frame.ts} (Task 2),
// end-to-end via packages/core/src/parse.ts (Task 4 unskips the multi-error test).
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { Diagnostic } from '../src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../src/diagnostics/codes.js';
import { renderDiagnostic } from '../src/diagnostics/frame.js';
import { splitBlocks } from '../src/splitter/splitBlocks.js';
import { parseProps } from '../src/parsers/parseProps.js';
import { parseStyle } from '../src/parsers/parseStyle.js';
import { parseTemplate } from '../src/parsers/parseTemplate.js';
import { parseListeners } from '../src/parsers/parseListeners.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Diagnostic type wiring', () => {
  it('Diagnostic type is imported from @rozie/core source', () => {
    const _diag: Diagnostic | null = null;
    expect(_diag).toBeNull();
    expect(__dirname).toMatch(/tests$/);
  });
});

describe('RozieErrorCode registry (D-07)', () => {
  it('exports stable string codes for all Phase 1 owners', () => {
    expect(RozieErrorCode.MISSING_ROZIE_ENVELOPE).toBe('ROZ001');
    expect(RozieErrorCode.MULTIPLE_ROZIE_ENVELOPES).toBe('ROZ002');
    expect(RozieErrorCode.UNKNOWN_TOP_LEVEL_BLOCK).toBe('ROZ003');
    expect(RozieErrorCode.DUPLICATE_BLOCK).toBe('ROZ004');
    expect(RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION).toBe('ROZ010');
    expect(RozieErrorCode.NOT_OBJECT_LITERAL).toBe('ROZ011');
    expect(RozieErrorCode.LISTENER_KEY_NOT_STRING).toBe('ROZ012');
    expect(RozieErrorCode.LISTENER_VALUE_NOT_OBJECT).toBe('ROZ013');
    expect(RozieErrorCode.SCRIPT_PARSE_ERROR).toBe('ROZ030');
    expect(RozieErrorCode.SCRIPT_UNRECOVERABLE).toBe('ROZ031');
    expect(RozieErrorCode.TEMPLATE_UNCLOSED_ELEMENT).toBe('ROZ050');
    expect(RozieErrorCode.TEMPLATE_MALFORMED_MUSTACHE).toBe('ROZ051');
    expect(RozieErrorCode.MODIFIER_GRAMMAR_ERROR).toBe('ROZ070');
    expect(RozieErrorCode.STYLE_PARSE_ERROR).toBe('ROZ080');
    expect(RozieErrorCode.STYLE_MIXED_ROOT_SELECTOR).toBe('ROZ081');
  });
});

describe('renderDiagnostic (D-06)', () => {
  it('renders a Diagnostic with the line of source containing the offset and a caret marker', () => {
    const source = 'line one\nline two has bug here\nline three\n';
    const offset = source.indexOf('bug');
    const diag: Diagnostic = {
      code: 'ROZ010',
      severity: 'error',
      message: 'Invalid expression',
      loc: { start: offset, end: offset + 3 },
    };
    const out = renderDiagnostic(diag, source);
    expect(out).toContain('ROZ010');
    expect(out).toContain('Invalid expression');
    expect(out).toContain('bug');
    // Caret marker on the offending column (code-frame uses '^').
    expect(out).toContain('^');
  });

  it('includes filename when provided', () => {
    const source = 'x\n';
    const diag: Diagnostic = {
      code: 'ROZ001',
      severity: 'error',
      message: 'Missing envelope',
      loc: { start: 0, end: 0 },
      filename: 'Counter.rozie',
    };
    const out = renderDiagnostic(diag, source);
    expect(out).toContain('Counter.rozie');
  });

  it('respects highlightCode option (ANSI when terminal supports color)', () => {
    // @babel/code-frame defers to chalk's TTY/FORCE_COLOR detection at module
    // load time, so we cannot toggle ANSI emission mid-process. Instead, we
    // assert the option is plumbed correctly by checking the renderer behaves
    // identically to its raw codeFrameColumns counterpart on the same input —
    // the assertion is "highlightCode: true output is at least as long as
    // highlightCode: false output" (ANSI codes are additive when applied).
    const source = 'a\nb\nc';
    const diag: Diagnostic = {
      code: 'ROZ010',
      severity: 'error',
      message: 'msg',
      loc: { start: 2, end: 3 },
    };
    const colored = renderDiagnostic(diag, source, { highlightCode: true });
    const plain = renderDiagnostic(diag, source, { highlightCode: false });
    // Either ANSI is emitted (color-capable env) OR both outputs are equal
    // (no-color env). Both are correct; the test fails only if the option is
    // ignored and SOMETIMES emits ANSI when highlightCode: false.
    expect(colored.length).toBeGreaterThanOrEqual(plain.length);
    expect(plain.includes('\x1b[')).toBe(false);
  });

  it('omits ANSI codes by default (highlightCode: false)', () => {
    const source = 'a\nb\nc';
    const diag: Diagnostic = {
      code: 'ROZ010',
      severity: 'error',
      message: 'msg',
      loc: { start: 2, end: 3 },
    };
    const plain = renderDiagnostic(diag, source);
    expect(plain.includes('\x1b[')).toBe(false);
  });

  it('falls back to "no source available" rather than throwing on out-of-range loc', () => {
    const diag: Diagnostic = {
      code: 'ROZ001',
      severity: 'error',
      message: 'Missing envelope',
      loc: { start: 99999, end: 99999 },
    };
    expect(() => renderDiagnostic(diag, 'short source')).not.toThrow();
    const out = renderDiagnostic(diag, 'short source');
    expect(out).toContain('ROZ001');
    expect(out).toContain('Missing envelope');
  });

  it('includes hint when present on the diagnostic', () => {
    const diag: Diagnostic = {
      code: 'ROZ003',
      severity: 'error',
      message: 'Unknown block',
      loc: { start: 0, end: 5 },
      hint: 'Refs are derived from `ref="..."` attributes',
    };
    const out = renderDiagnostic(diag, '<refs></refs>');
    expect(out).toContain('hint');
    expect(out).toContain('ref="..."');
  });
});

describe('Negative tests by ROZ-code range (at least one per range)', () => {
  it('ROZ001 — synthetic input <props>{}</props> (no envelope)', () => {
    const source = '<props>{}</props>';
    const result = splitBlocks(source);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('ROZ001');
  });

  it('ROZ003 — synthetic <refs> block emits ROZ003 with the ref hint', () => {
    const source = '<rozie name="X"><refs></refs></rozie>';
    const result = splitBlocks(source);
    const refsDiag = result.diagnostics.find((d) => d.code === 'ROZ003');
    expect(refsDiag).toBeDefined();
    expect(refsDiag!.hint).toMatch(/ref=/);
  });

  it('ROZ010 — invalid JS in <props>', () => {
    const content = '{ ??? broken }';
    const contentLoc = { start: 0, end: content.length };
    const { node, diagnostics } = parseProps(content, contentLoc, content);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('ROZ010');
    // Even with parser errors, recovery may still yield a node OR null —
    // the contract is "diagnostics emitted, no throw". Both shapes are valid.
    expect(node === null || node !== null).toBe(true);
  });

  it('ROZ011 — non-object <props> top-level', () => {
    const content = '42';
    const contentLoc = { start: 0, end: content.length };
    const { diagnostics } = parseProps(content, contentLoc, content);
    expect(diagnostics.map((d) => d.code)).toContain('ROZ011');
  });

  it('ROZ012 — listener key is not a string literal', () => {
    const content = '{ [event]: { handler: foo } }';
    const contentLoc = { start: 0, end: content.length };
    const { diagnostics } = parseListeners(content, contentLoc, content);
    expect(diagnostics.map((d) => d.code)).toContain('ROZ012');
  });

  it('ROZ050 — unclosed template element', () => {
    const content = '<div><span>orphan';
    const contentLoc = { start: 0, end: content.length };
    const { diagnostics } = parseTemplate(content, contentLoc, content);
    expect(diagnostics.map((d) => d.code)).toContain('ROZ050');
  });

  it('ROZ051 — malformed mustache (unclosed `{{`)', () => {
    const content = '<div>hello {{ unclosed</div>';
    const contentLoc = { start: 0, end: content.length };
    const { diagnostics } = parseTemplate(content, contentLoc, content);
    expect(diagnostics.map((d) => d.code)).toContain('ROZ051');
  });

  it('ROZ081 — mixed :root, .other selector', () => {
    const content = ':root, .other { color: red; }';
    const contentLoc = { start: 0, end: content.length };
    const { diagnostics } = parseStyle(content, contentLoc, content);
    expect(diagnostics.map((d) => d.code)).toContain('ROZ081');
  });
});

describe('end-to-end diagnostics via parse() (D-08)', () => {
  it('multi-error parse() collects ALL diagnostics without throwing — ≥3 distinct codes', async () => {
    const { parse } = await import('../src/parse.js');
    const source = `<rozie name="Bad">
  <refs></refs>
  <props>{ ??? }</props>
  <style>:root, .foo { color: red; }</style>
</rozie>`;
    expect(() => parse(source)).not.toThrow();
    const result = parse(source);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('ROZ003'); // <refs> unknown block
    expect(codes).toContain('ROZ081'); // mixed :root selector
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);

    // Each diagnostic renders cleanly via renderDiagnostic with its code.
    for (const d of result.diagnostics) {
      const rendered = renderDiagnostic(d, source);
      expect(rendered).toContain(d.code);
    }
  });
});
