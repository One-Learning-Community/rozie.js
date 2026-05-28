import { parse } from '@rozie/core';
import type { BlockEntry, RozieAST, SourceLoc } from '@rozie/core';
import { type DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { extractSymbols, type RozieSymbol } from './symbols.js';

/**
 * Document outline (`textDocument/documentSymbol`) — the structure view and
 * breadcrumbs. Each SFC block is a top-level node; `<props>`/`<data>` members,
 * `<components>` entries, and template refs nest beneath their block. This is
 * the cross-block structure the flat injection-first PSI can't express, so it
 * lives in the shared brain and flows to both editors.
 */

function rangeOf(doc: TextDocument, loc: SourceLoc) {
  return { start: doc.positionAt(loc.start), end: doc.positionAt(loc.end) };
}

function symbol(
  doc: TextDocument,
  name: string,
  kind: SymbolKind,
  loc: SourceLoc,
  children?: DocumentSymbol[],
  detail?: string,
): DocumentSymbol {
  const range = rangeOf(doc, loc);
  return {
    name,
    kind,
    range,
    selectionRange: range,
    ...(detail ? { detail } : {}),
    ...(children && children.length > 0 ? { children } : {}),
  };
}

function memberSymbols(
  doc: TextDocument,
  members: RozieSymbol[],
  kind: SymbolKind,
): DocumentSymbol[] {
  return members.map((m) => symbol(doc, m.name, kind, m.loc, undefined, m.detail || undefined));
}

function blockSymbol(
  doc: TextDocument,
  label: string,
  block: BlockEntry | undefined,
  children?: DocumentSymbol[],
): DocumentSymbol | null {
  if (!block) return null;
  return symbol(doc, label, SymbolKind.Module, block.loc, children);
}

export function computeDocumentSymbols(doc: TextDocument): DocumentSymbol[] {
  const source = doc.getText();
  const { ast } = parse(source, { filename: doc.uri });
  if (!ast) return [];
  const symbols = extractSymbols(ast, source);
  const blocks = ast.blocks;
  const out: DocumentSymbol[] = [];

  const push = (sym: DocumentSymbol | null): void => {
    if (sym) out.push(sym);
  };

  push(blockSymbol(doc, 'props', blocks.props, memberSymbols(doc, symbols.props, SymbolKind.Field)));
  push(blockSymbol(doc, 'data', blocks.data, memberSymbols(doc, symbols.data, SymbolKind.Field)));
  push(
    blockSymbol(
      doc,
      'components',
      blocks.components,
      symbols.components.map((c) =>
        symbol(doc, c.name, SymbolKind.Class, c.loc, undefined, c.path),
      ),
    ),
  );
  push(blockSymbol(doc, 'script', blocks.script));
  push(blockSymbol(doc, 'listeners', blocks.listeners));
  push(
    blockSymbol(
      doc,
      'template',
      blocks.template,
      memberSymbols(doc, symbols.refs, SymbolKind.Variable),
    ),
  );
  push(blockSymbol(doc, 'style', blocks.style));

  // Wrap everything under the component name when the envelope is present, so
  // the outline reads "ComponentName › props/data/template/…".
  return wrapInComponent(doc, ast, out);
}

function wrapInComponent(
  doc: TextDocument,
  ast: RozieAST,
  blocks: DocumentSymbol[],
): DocumentSymbol[] {
  const envelope = ast.blocks.rozie;
  if (!envelope) return blocks;
  return [
    symbol(doc, ast.name || 'rozie', SymbolKind.Class, envelope.loc, blocks),
  ];
}
