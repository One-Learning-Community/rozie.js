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
  type TextEdit,
  type WorkspaceEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  componentTagAt,
  componentTagCompletionContext,
  resolveComponentUri,
  slotFillAt,
  tagAttributeContext,
} from './componentNav.js';
import { extractProducerSurface, type ProducerSurface } from './producers.js';
import { findSigilMemberUsages, resolveSigilMemberAt, sigilCompletionContext } from './sigil.js';
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

/**
 * Cross-file resolution hook. The server passes a resolver backed by open
 * documents + the filesystem; tests pass an in-memory map. Absent → cross-file
 * features (producer-surface completion, slot-fill nav) degrade to silence.
 */
export interface FeatureContext {
  readDoc?: (uri: string) => string | null;
}

function analyze(doc: TextDocument): Analysis | null {
  const source = doc.getText();
  const { ast } = parse(source, { filename: uriToFilename(doc.uri) });
  if (!ast) return null;
  return { ast, symbols: extractSymbols(ast, source) };
}

/** Resolve + parse the producer behind a component name, via the read hook. */
function producerSurfaceFor(
  doc: TextDocument,
  symbols: RozieSymbols,
  componentName: string,
  ctx: FeatureContext | undefined,
): ProducerSurface | null {
  if (!ctx?.readDoc) return null;
  const comp = symbols.components.find((c) => c.name === componentName);
  if (!comp) return null;
  const uri = resolveComponentUri(comp.path, doc.uri);
  if (!uri) return null;
  const source = ctx.readDoc(uri);
  if (source == null) return null;
  return extractProducerSurface(source);
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
export function computeCompletions(
  doc: TextDocument,
  position: Position,
  ctx?: FeatureContext,
): CompletionItem[] {
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

  const attrCtx = tagAttributeContext(text, offset);
  if (attrCtx) {
    const analysis = analyze(doc);
    if (!analysis) return [];
    const surface = producerSurfaceFor(doc, analysis.symbols, attrCtx.tagName, ctx);
    if (!surface) return [];
    const replaceRange: Range = { start: doc.positionAt(attrCtx.partialStart), end: position };
    const items = producerAttributeItems(surface, attrCtx.prefix, replaceRange);
    return items.filter((i) => i.label.startsWith(attrCtx.partial));
  }

  return [];
}

/** Completion items for a child component's surface, by attribute prefix. */
function producerAttributeItems(
  surface: ProducerSurface,
  prefix: '' | ':' | '@' | '#',
  range: Range,
): CompletionItem[] {
  if (prefix === '@') {
    return surface.events.map((e) => ({
      label: e.name,
      kind: CompletionItemKind.Event,
      textEdit: { range, newText: e.name },
    }));
  }
  if (prefix === '#') {
    return surface.slots.map((s) => ({
      label: s.name,
      kind: CompletionItemKind.Interface,
      textEdit: { range, newText: s.name },
    }));
  }
  // '' or ':' → the component's props.
  return surface.props.map((p) => ({
    label: p.name,
    kind: CompletionItemKind.Field,
    ...(p.detail ? { detail: p.detail } : {}),
    textEdit: { range, newText: p.name },
  }));
}

/**
 * Go-to-definition from a `$props.X`/`$data.X`/`$refs.X` usage (to its
 * declaration) or a composed-component tag (to its `.rozie` file).
 */
export function computeDefinition(
  doc: TextDocument,
  position: Position,
  ctx?: FeatureContext,
): Location | null {
  const analysis = analyze(doc);
  if (!analysis) return null;
  const offset = doc.offsetAt(position);

  const sym = resolveSigilSymbol(doc, analysis.symbols, offset);
  if (sym) return { uri: doc.uri, range: toRange(doc, sym.loc) };

  const children = analysis.ast.template?.children;

  // Slot fill (`#header`) → the producer's matching `<slot name="header">`.
  if (children) {
    const slot = slotFillAt(children, analysis.symbols.components, offset);
    if (slot) {
      const uri = resolveComponentUri(slot.component.path, doc.uri);
      const source = uri && ctx?.readDoc ? ctx.readDoc(uri) : null;
      if (uri && source != null) {
        const producerSlot = extractProducerSurface(source).slots.find(
          (s) => s.name === slot.slotName,
        );
        if (producerSlot) {
          // Map the producer-source byte span to a position via a transient doc.
          const pdoc = TextDocument.create(uri, 'rozie', 0, source);
          return {
            uri,
            range: { start: pdoc.positionAt(producerSlot.loc.start), end: pdoc.positionAt(producerSlot.loc.end) },
          };
        }
        // Slot name unknown in producer — fall through to the component tag check.
      }
    }
  }

  // Component tag (`<Modal>`) → the producer `.rozie` file.
  const tag = children
    ? componentTagAt(children, analysis.symbols.components, offset)
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

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

interface SigilSymbolHit {
  sigil: SigilKind;
  sym: RozieSymbol;
  /** The span under the cursor — the usage member, or the declaration name. */
  anchor: SourceLoc;
}

function within(loc: SourceLoc, offset: number): boolean {
  return offset >= loc.start && offset <= loc.end;
}

/**
 * The Rozie sigil symbol at [offset] — resolved whether the cursor is on a
 * `$sigil.X` usage OR on the declaration itself (a `<props>`/`<data>` key or a
 * `ref="..."` value). Shared by find-references and rename.
 */
function sigilSymbolAt(
  doc: TextDocument,
  symbols: RozieSymbols,
  offset: number,
): SigilSymbolHit | null {
  const text = doc.getText();

  // 1. Cursor on a `$sigil.member` usage.
  const ref = resolveSigilMemberAt(text, offset);
  if (ref && ref.member.length > 0) {
    const sym = symbolsForSigil(symbols, ref.sigil).find((s) => s.name === ref.member);
    if (sym) return { sigil: ref.sigil, sym, anchor: ref.memberLoc };
  }

  // 2. Cursor on a declaration site.
  for (const sigil of ['props', 'data', 'refs'] as const) {
    for (const sym of symbolsForSigil(symbols, sigil)) {
      if (within(sym.loc, offset)) return { sigil, sym, anchor: sym.loc };
    }
  }
  return null;
}

/** True when the declaration text is exactly the name (rules out quoted keys). */
function bareDecl(text: string, sym: RozieSymbol): boolean {
  return text.slice(sym.loc.start, sym.loc.end) === sym.name;
}

/**
 * Find-references for a `$props.X`/`$data.X`/`$refs.X` symbol: the declaration
 * (when [includeDeclaration]) plus every `$sigil.X` usage across all blocks.
 */
export function computeReferences(
  doc: TextDocument,
  position: Position,
  includeDeclaration: boolean,
): Location[] {
  const analysis = analyze(doc);
  if (!analysis) return [];
  const hit = sigilSymbolAt(doc, analysis.symbols, doc.offsetAt(position));
  if (!hit) return [];
  const usages = findSigilMemberUsages(doc.getText(), hit.sigil, hit.sym.name);
  const locs = includeDeclaration ? [hit.sym.loc, ...usages] : usages;
  return locs.map((loc) => ({ uri: doc.uri, range: toRange(doc, loc) }));
}

/**
 * Validate the rename target — `prepareRename`. Returns the range the editor
 * should select for the inline rename, or null when the cursor is not on a
 * renameable Rozie symbol.
 */
export function computePrepareRename(doc: TextDocument, position: Position): Range | null {
  const analysis = analyze(doc);
  if (!analysis) return null;
  const found = sigilSymbolAt(doc, analysis.symbols, doc.offsetAt(position));
  if (!found || !bareDecl(doc.getText(), found.sym)) return null;
  return toRange(doc, found.anchor);
}

/**
 * Cross-block rename of a `$props.X`/`$data.X`/`$refs.X` symbol: rewrites the
 * declaration (the `<props>`/`<data>` key or the `ref="..."` value) and every
 * `$sigil.X` usage across all blocks in one `WorkspaceEdit`.
 */
export function computeRename(
  doc: TextDocument,
  position: Position,
  newName: string,
): WorkspaceEdit | null {
  if (!IDENTIFIER.test(newName)) return null;
  const analysis = analyze(doc);
  if (!analysis) return null;
  const found = sigilSymbolAt(doc, analysis.symbols, doc.offsetAt(position));
  if (!found || !bareDecl(doc.getText(), found.sym)) return null;

  const text = doc.getText();
  const locs: SourceLoc[] = [
    found.sym.loc,
    ...findSigilMemberUsages(text, found.sigil, found.sym.name),
  ];
  // Dedupe by start offset (the declaration may coincide with nothing, but
  // guard against overlap) and emit one TextEdit per site.
  const seen = new Set<number>();
  const edits: TextEdit[] = [];
  for (const loc of locs) {
    if (seen.has(loc.start)) continue;
    seen.add(loc.start);
    edits.push({ range: toRange(doc, loc), newText: newName });
  }
  return { changes: { [doc.uri]: edits } };
}

function uriToFilename(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri;
}
