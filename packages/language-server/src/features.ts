import { parse } from '@rozie/core';
import type { RozieAST, SourceLoc } from '@rozie/core';
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
import {
  componentTagAt,
  componentTagCompletionContext,
  resolveComponentUri,
} from './componentNav.js';
import { resolveSigilMemberAt, sigilCompletionContext } from './sigil.js';
import {
  extractSymbols,
  type RozieSymbol,
  type RozieSymbols,
  type SigilKind,
  symbolsForSigil,
} from './symbols.js';

/**
 * The semantic navigation/completion features (Option C). Each is a pure
 * function of a document + position: parse the `.rozie` source with
 * `@rozie/core`, build the cross-block symbol model, and answer the request.
 * No caching — `parse()` is cheap and per-request matches the diagnostics path.
 * The IntelliJ plugin (via LSP4IJ) and the VSCode extension consume these
 * identically.
 */

interface Analysis {
  ast: RozieAST;
  symbols: RozieSymbols;
}

function analyze(doc: TextDocument): Analysis | null {
  const source = doc.getText();
  const { ast } = parse(source, { filename: uriToFilename(doc.uri) });
  if (!ast) return null;
  return { ast, symbols: extractSymbols(ast, source) };
}

function toRange(doc: TextDocument, loc: SourceLoc): Range {
  return { start: doc.positionAt(loc.start), end: doc.positionAt(loc.end) };
}

const FILE_START: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

function completionKind(sigil: SigilKind): CompletionItemKind {
  return sigil === 'refs' ? CompletionItemKind.Variable : CompletionItemKind.Field;
}

/**
 * Completion for `$props.`/`$data.`/`$refs.` members and composed-component
 * tag names (`<Modal`).
 */
export function computeCompletions(doc: TextDocument, position: Position): CompletionItem[] {
  const text = doc.getText();
  const offset = doc.offsetAt(position);

  const sigilCtx = sigilCompletionContext(text, offset);
  if (sigilCtx) {
    const analysis = analyze(doc);
    if (!analysis) return [];
    const kind = completionKind(sigilCtx.sigil);
    const replaceRange: Range = { start: doc.positionAt(sigilCtx.partialStart), end: position };
    return symbolsForSigil(analysis.symbols, sigilCtx.sigil).map((sym) => ({
      label: sym.name,
      kind,
      ...(sym.detail ? { detail: sym.detail } : {}),
      textEdit: { range: replaceRange, newText: sym.name },
    }));
  }

  const tagCtx = componentTagCompletionContext(text, offset);
  if (tagCtx) {
    const analysis = analyze(doc);
    if (!analysis || analysis.symbols.components.length === 0) return [];
    const replaceRange: Range = { start: doc.positionAt(tagCtx.partialStart), end: position };
    return analysis.symbols.components
      .filter((c) => c.name.startsWith(tagCtx.partial))
      .map((c) => ({
        label: c.name,
        kind: CompletionItemKind.Class,
        detail: c.path,
        textEdit: { range: replaceRange, newText: c.name },
      }));
  }

  return [];
}

/**
 * Go-to-definition from a `$props.X`/`$data.X`/`$refs.X` usage (to its
 * declaration) or a composed-component tag (to its `.rozie` file).
 */
export function computeDefinition(doc: TextDocument, position: Position): Location | null {
  const analysis = analyze(doc);
  if (!analysis) return null;
  const offset = doc.offsetAt(position);

  const sym = resolveSigilSymbol(doc, analysis.symbols, offset);
  if (sym) return { uri: doc.uri, range: toRange(doc, sym.loc) };

  const tag = analysis.ast.template
    ? componentTagAt(analysis.ast.template.children, analysis.symbols.components, offset)
    : null;
  if (tag) {
    const uri = resolveComponentUri(tag.symbol.path, doc.uri);
    if (uri) return { uri, range: FILE_START };
  }
  return null;
}

/**
 * Hover over a `$props.X`/`$data.X`/`$refs.X` usage (shows type/value) or a
 * composed-component tag (shows the resolved import path).
 */
export function computeHover(doc: TextDocument, position: Position): Hover | null {
  const analysis = analyze(doc);
  if (!analysis) return null;
  const text = doc.getText();
  const offset = doc.offsetAt(position);

  const ref = resolveSigilMemberAt(text, offset);
  if (ref && ref.member.length > 0) {
    const sym = symbolsForSigil(analysis.symbols, ref.sigil).find((s) => s.name === ref.member);
    if (sym) {
      const signature = sym.detail
        ? `$${ref.sigil}.${sym.name}: ${sym.detail}`
        : `$${ref.sigil}.${sym.name}`;
      return {
        contents: { kind: MarkupKind.Markdown, value: ['```ts', signature, '```'].join('\n') },
        range: toRange(doc, ref.tokenLoc),
      };
    }
  }

  const tag = analysis.ast.template
    ? componentTagAt(analysis.ast.template.children, analysis.symbols.components, offset)
    : null;
  if (tag) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${tag.symbol.name}** — \`${tag.symbol.path}\``,
      },
      range: toRange(doc, tag.nameLoc),
    };
  }
  return null;
}

function resolveSigilSymbol(
  doc: TextDocument,
  symbols: RozieSymbols,
  offset: number,
): RozieSymbol | null {
  const ref = resolveSigilMemberAt(doc.getText(), offset);
  if (!ref || ref.member.length === 0) return null;
  return symbolsForSigil(symbols, ref.sigil).find((s) => s.name === ref.member) ?? null;
}

function uriToFilename(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri;
}
