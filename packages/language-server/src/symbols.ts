import type {
  RozieAST,
  SourceLoc,
  TemplateNode,
  TemplateElement,
} from '@rozie/core';

/**
 * The Rozie cross-block symbol model — the semantic substrate every
 * navigation/completion feature reads (Option C). `$props.X`, `$data.X`, and
 * `$refs.X` all resolve through here. Built once per request from the
 * `@rozie/core` `RozieAST` so the editor and compiler share one source of
 * truth for what a `.rozie` component declares.
 *
 * Babel node offsets in `<props>`/`<data>` are ABSOLUTE byte offsets in the
 * original `.rozie` source (parseProps/parseData pass `startIndex` to Babel),
 * so `loc` here maps directly onto LSP positions via `TextDocument.positionAt`.
 */

/** The three member-access sigils that resolve into the symbol model. */
export type SigilKind = 'props' | 'data' | 'refs';

export interface RozieSymbol {
  name: string;
  /** Absolute byte span of the declaration's NAME in the `.rozie` source. */
  loc: SourceLoc;
  /** Short one-line summary for completion `detail` + hover (e.g. a type). */
  detail: string;
}

export interface RozieSymbols {
  props: RozieSymbol[];
  data: RozieSymbol[];
  refs: RozieSymbol[];
}

/** Minimal structural view of a Babel node's absolute offsets. */
interface OffsetNode {
  start?: number | null;
  end?: number | null;
  loc?: { start: { index?: number }; end: { index?: number } } | null;
}

function nodeStart(node: OffsetNode): number | null {
  return node.loc?.start.index ?? node.start ?? null;
}

function nodeEnd(node: OffsetNode): number | null {
  return node.loc?.end.index ?? node.end ?? null;
}

function sliceNode(source: string, node: OffsetNode): string {
  const start = nodeStart(node);
  const end = nodeEnd(node);
  if (start === null || end === null) return '';
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

/** Name + absolute loc of an object-literal key, or null for unsupported keys. */
function keyInfo(
  key: { type: string; name?: string; value?: unknown } & OffsetNode,
): { name: string; loc: SourceLoc } | null {
  let name: string | null = null;
  if (key.type === 'Identifier' && typeof key.name === 'string') {
    name = key.name;
  } else if (key.type === 'StringLiteral' && typeof key.value === 'string') {
    name = key.value;
  }
  if (name === null) return null;
  const start = nodeStart(key);
  const end = nodeEnd(key);
  if (start === null || end === null) return null;
  return { name, loc: { start, end } };
}

/**
 * Detail string for a `<props>` entry: the declared `type` when the value is a
 * `{ type: ..., default: ... }` descriptor, otherwise the raw value source.
 */
function propDetail(value: OffsetNode & { type: string; properties?: unknown[] }, source: string): string {
  if (value.type === 'ObjectExpression' && Array.isArray(value.properties)) {
    for (const prop of value.properties as Array<
      OffsetNode & { type: string; key?: { type: string; name?: string }; value?: OffsetNode }
    >) {
      if (prop.type !== 'ObjectProperty' || !prop.key || !prop.value) continue;
      if (prop.key.type === 'Identifier' && prop.key.name === 'type') {
        const typeText = sliceNode(source, prop.value);
        if (typeText) return typeText;
      }
    }
  }
  return sliceNode(source, value);
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function collectObjectKeys(
  expression: { properties?: unknown[] },
  source: string,
  detailFor: (value: OffsetNode & { type: string; properties?: unknown[] }) => string,
): RozieSymbol[] {
  const out: RozieSymbol[] = [];
  const seen = new Set<string>();
  for (const prop of (expression.properties ?? []) as Array<
    OffsetNode & {
      type: string;
      key?: { type: string; name?: string; value?: unknown } & OffsetNode;
      value?: OffsetNode & { type: string; properties?: unknown[] };
    }
  >) {
    if (prop.type !== 'ObjectProperty' && prop.type !== 'ObjectMethod') continue;
    if (!prop.key) continue;
    const info = keyInfo(prop.key);
    if (!info || seen.has(info.name)) continue;
    seen.add(info.name);
    out.push({
      name: info.name,
      loc: info.loc,
      detail: prop.value ? truncate(detailFor(prop.value)) : '',
    });
  }
  return out;
}

function collectRefs(template: { children: TemplateNode[] }): RozieSymbol[] {
  const out: RozieSymbol[] = [];
  const seen = new Set<string>();

  const visit = (node: TemplateNode): void => {
    if (node.type !== 'TemplateElement') return;
    const el = node as TemplateElement;
    for (const attr of el.attributes) {
      if (
        attr.name === 'ref' &&
        attr.kind === 'static' &&
        typeof attr.value === 'string' &&
        attr.value.length > 0 &&
        attr.valueLoc &&
        !seen.has(attr.value)
      ) {
        seen.add(attr.value);
        out.push({ name: attr.value, loc: attr.valueLoc, detail: 'template ref' });
      }
    }
    for (const child of el.children) visit(child);
  };

  for (const child of template.children) visit(child);
  return out;
}

/**
 * Extract the cross-block symbol model from a parsed `.rozie` AST.
 *
 * @param ast - the `RozieAST` from `@rozie/core` `parse()` (never null here)
 * @param source - the original `.rozie` source, for building `detail` slices
 */
export function extractSymbols(ast: RozieAST, source: string): RozieSymbols {
  const props = ast.props
    ? collectObjectKeys(ast.props.expression, source, (v) => propDetail(v, source))
    : [];
  const data = ast.data
    ? collectObjectKeys(ast.data.expression, source, (v) => sliceNode(source, v))
    : [];
  const refs = ast.template ? collectRefs(ast.template) : [];
  return { props, data, refs };
}

/** Look up the declared symbols for a given sigil. */
export function symbolsForSigil(symbols: RozieSymbols, sigil: SigilKind): RozieSymbol[] {
  switch (sigil) {
    case 'props':
      return symbols.props;
    case 'data':
      return symbols.data;
    case 'refs':
      return symbols.refs;
  }
}
