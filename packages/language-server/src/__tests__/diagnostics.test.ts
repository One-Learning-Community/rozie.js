import { DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { describe, expect, it } from 'vitest';
import { computeDiagnostics, toLspDiagnostic } from '../diagnostics.js';

function rozieDoc(text: string, uri = 'file:///X.rozie'): TextDocument {
  return TextDocument.create(uri, 'rozie', 1, text);
}

describe('toLspDiagnostic', () => {
  it('resolves byte offsets to LSP line/character via the document', () => {
    const doc = rozieDoc('line0\nline1 BAD');
    const lsp = toLspDiagnostic(
      { code: 'ROZ001', severity: 'error', message: 'boom', loc: { start: 12, end: 15 } },
      doc,
    );
    expect(lsp.code).toBe('ROZ001');
    expect(lsp.source).toBe('rozie');
    expect(lsp.severity).toBe(DiagnosticSeverity.Error);
    expect(lsp.range.start).toEqual({ line: 1, character: 6 });
    expect(lsp.range.end).toEqual({ line: 1, character: 9 });
  });

  it('appends the hint to the message and maps related info to the same doc', () => {
    const doc = rozieDoc('abcdefghij');
    const lsp = toLspDiagnostic(
      {
        code: 'ROZ200',
        severity: 'warning',
        message: 'msg',
        hint: 'do X instead',
        loc: { start: 0, end: 3 },
        related: [{ message: 'declared here', loc: { start: 4, end: 6 } }],
      },
      doc,
    );
    expect(lsp.severity).toBe(DiagnosticSeverity.Warning);
    expect(lsp.message).toContain('do X instead');
    expect(lsp.relatedInformation?.[0]?.message).toBe('declared here');
    expect(lsp.relatedInformation?.[0]?.location.uri).toBe('file:///X.rozie');
    expect(lsp.relatedInformation?.[0]?.location.range.start).toEqual({ line: 0, character: 4 });
  });

  it('maps info severity to Information', () => {
    const doc = rozieDoc('xy');
    const lsp = toLspDiagnostic(
      { code: 'ROZ999', severity: 'info', message: 'fyi', loc: { start: 0, end: 1 } },
      doc,
    );
    expect(lsp.severity).toBe(DiagnosticSeverity.Information);
  });
});

describe('computeDiagnostics (end-to-end through @rozie/core parse)', () => {
  it('surfaces ROZ001 (missing <rozie> envelope) with a host range', () => {
    const doc = rozieDoc('plain text, no rozie envelope');
    const diags = computeDiagnostics(doc);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]?.code).toBe('ROZ001');
    expect(diags[0]?.source).toBe('rozie');
    expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
    expect(diags[0]?.range.start).toEqual({ line: 0, character: 0 });
  });

  it('produces no diagnostics for a well-formed component', () => {
    const doc = rozieDoc('<rozie><template>{{ }}</template></rozie>');
    expect(computeDiagnostics(doc)).toEqual([]);
  });

  it('surfaces the semantic ROZ200 (assignment to a non-model prop)', () => {
    // ROZ200 is produced during IR lowering, not parse() — this asserts the
    // LSP runs the full pipeline (compile()), which is what lets the IntelliJ
    // plugin retire its native RoziePropAssignmentInspection in favor of the
    // shared brain.
    const doc = rozieDoc(
      '<rozie name="X"><props>{ count: { type: Number } }</props>' +
        '<script>$props.count = 5;</script><template><div></div></template></rozie>',
    );
    const diags = computeDiagnostics(doc);
    expect(diags.some((d) => d.code === 'ROZ200' && d.severity === DiagnosticSeverity.Error)).toBe(
      true,
    );
  });
});
