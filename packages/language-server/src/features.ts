import { parse } from '@rozie/core';
import type { SourceLoc } from '@rozie/core';
import {
  type CompletionItem,
  CompletionItemKind,
  type Hover,
  type Location,
  MarkupKind,
  type Position,
  type Range,
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { resolveSigilMemberAt, sigilCompletionContext } from './sigil.js';
import { extractSymbols, type RozieSymbol, type SigilKind, symbolsForSigil } from './symbols.js';

/**
 * The semantic navigation/completion features (Option C). Each is a pure
 * function of a document + position: parse the `.rozie` source with
 * `@rozie/core`, build the cross-block symbol model, and answer the request.
 * No caching — `parse()` is cheap and per-request matches the diagnostics path.
 * The IntelliJ plugin (via LSP4IJ) and the VSCode extension consume these
 * identically.
 */

function symbolsOf(doc: TextDocument) {
  const source = doc.getText();
  const { ast } = parse(source, { filename: uriToFilename(doc.uri) });
  if (!ast) return null;
  return extractSymbols(ast, source);
}

function toRange(doc: TextDocument, loc: SourceLoc): Range {
  return { start: doc.positionAt(loc.start), end: doc.positionAt(loc.end) };
}

function completionKind(sigil: SigilKind): CompletionItemKind {
  return sigil === 'refs' ? CompletionItemKind.Variable : CompletionItemKind.Field;
}

/** `$props.` / `$data.` / `$refs.` member completion. */
export function computeCompletions(doc: TextDocument, position: Position): CompletionItem[] {
  const offset = doc.offsetAt(position);
  const ctx = sigilCompletionContext(doc.getText(), offset);
  if (!ctx) return [];
  const symbols = symbolsOf(doc);
  if (!symbols) return [];
  const replaceRange: Range = { start: doc.positionAt(ctx.partialStart), end: position };
  const kind = completionKind(ctx.sigil);
  return symbolsForSigil(symbols, ctx.sigil).map((sym) => ({
    label: sym.name,
    kind,
    ...(sym.detail ? { detail: sym.detail } : {}),
    textEdit: { range: replaceRange, newText: sym.name },
  }));
}

/** Go-to-definition from a `$props.X` / `$data.X` / `$refs.X` usage. */
export function computeDefinition(doc: TextDocument, position: Position): Location | null {
  const sym = resolveSymbolAt(doc, position);
  if (!sym) return null;
  return { uri: doc.uri, range: toRange(doc, sym.loc) };
}

/** Hover over a `$props.X` / `$data.X` / `$refs.X` usage. */
export function computeHover(doc: TextDocument, position: Position): Hover | null {
  const offset = doc.offsetAt(position);
  const ref = resolveSigilMemberAt(doc.getText(), offset);
  if (!ref || ref.member.length === 0) return null;
  const symbols = symbolsOf(doc);
  if (!symbols) return null;
  const sym = symbolsForSigil(symbols, ref.sigil).find((s) => s.name === ref.member);
  if (!sym) return null;
  const signature = sym.detail
    ? `$${ref.sigil}.${sym.name}: ${sym.detail}`
    : `$${ref.sigil}.${sym.name}`;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: ['```ts', signature, '```'].join('\n'),
    },
    range: toRange(doc, ref.tokenLoc),
  };
}

function resolveSymbolAt(doc: TextDocument, position: Position): RozieSymbol | null {
  const offset = doc.offsetAt(position);
  const ref = resolveSigilMemberAt(doc.getText(), offset);
  if (!ref || ref.member.length === 0) return null;
  const symbols = symbolsOf(doc);
  if (!symbols) return null;
  return symbolsForSigil(symbols, ref.sigil).find((s) => s.name === ref.member) ?? null;
}

function uriToFilename(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri;
}
