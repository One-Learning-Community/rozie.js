import { parse } from '@rozie/core';
import type { Diagnostic as RozieDiagnostic } from '@rozie/core';
import { DiagnosticSeverity, type Diagnostic as LspDiagnostic } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * The semantic brain wiring (Option C). `@rozie/core`'s `parse()` is the single
 * source of truth for `.rozie` diagnostics — the same analyzer the compiler and
 * every editor share. This module maps its locked `Diagnostic` shape (ROZ codes,
 * byte-offset `SourceLoc`) onto the LSP `Diagnostic` protocol shape, so a core
 * change (new ROZ code, tightened rule) surfaces in every editor with zero
 * per-editor work.
 */

const SOURCE = 'rozie';

function toLspSeverity(severity: RozieDiagnostic['severity']): DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'info':
      return DiagnosticSeverity.Information;
  }
}

/**
 * Map a single `@rozie/core` [RozieDiagnostic] to an LSP [LspDiagnostic],
 * resolving its byte-offset `loc` to LSP line/character positions via the
 * document. The `hint` (when present) is appended to the message — LSP has no
 * dedicated hint channel — and `related` entries become `relatedInformation`
 * anchored in the same document.
 */
export function toLspDiagnostic(diag: RozieDiagnostic, doc: TextDocument): LspDiagnostic {
  const result: LspDiagnostic = {
    range: {
      start: doc.positionAt(diag.loc.start),
      end: doc.positionAt(diag.loc.end),
    },
    severity: toLspSeverity(diag.severity),
    code: diag.code,
    source: SOURCE,
    message: diag.hint ? `${diag.message}\n\n${diag.hint}` : diag.message,
  };
  if (diag.related && diag.related.length > 0) {
    result.relatedInformation = diag.related.map((rel) => ({
      location: {
        uri: doc.uri,
        range: {
          start: doc.positionAt(rel.loc.start),
          end: doc.positionAt(rel.loc.end),
        },
      },
      message: rel.message,
    }));
  }
  return result;
}

/**
 * Parse [doc]'s text through `@rozie/core` and return its diagnostics in LSP
 * form. Pure: no transport, no I/O — directly unit-testable, and the function
 * the LSP server calls on every open/change.
 */
export function computeDiagnostics(doc: TextDocument): LspDiagnostic[] {
  const { diagnostics } = parse(doc.getText(), { filename: uriToFilename(doc.uri) });
  return diagnostics.map((diag) => toLspDiagnostic(diag, doc));
}

function uriToFilename(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri;
}
