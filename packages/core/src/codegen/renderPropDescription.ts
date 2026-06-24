/**
 * renderPropDescription — Phase 59 Plan 01 (SC-1/SC-4).
 *
 * The single ANTI-DRIFT source for the per-prop Description CELL of a props
 * table, plus the family-agnostic props-table generator that consumes it. This
 * mirrors the load-bearing discipline of `buildPropJsdoc.ts` (the JSDoc-block
 * twin): ONE deterministic string builder, consumed by EVERY surface that emits
 * a per-prop Markdown table — the package README generator (`readme.mjs`) AND
 * the docs-site API-props plugin (`props-codegen.ts`). A copy-paste of the
 * description-to-cell mapping into the 19 per-leaf READMEs (and the docs site)
 * would guarantee eventual drift; one builder guarantees cross-surface parity.
 *
 * The escaper + cell renderer are lifted VERBATIM from
 * `packages/ui/data-table/scripts/readme.mjs` so the data-table README
 * regenerates byte-identically once its glue is rewired to consume this module
 * (Plan 02). In particular the WR-03 unmatched-backtick warning prefix
 * (`readme.mjs: WARNING: unmatched backtick…`) is preserved byte-for-byte
 * (D-07) — do NOT rename the literal, do NOT throw, do NOT add an onWarn hook.
 *
 * GATING (inert path): `renderPropDescription` returns `''` for a docless prop,
 * so a prop without `docs` produces an empty Description cell exactly as today.
 *
 * COMMENT/CELL-INJECTION (T-59-01, carried from T-58-08): author-controlled
 * `docs.description` / `docs.deprecated` strings are interpolated INTO a
 * Markdown table row; a `|` or newline could break the row. `escapeTableCell`
 * collapses newlines, escapes pipes (`\|`), and warns on an unmatched backtick.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, PropDecl } from '../ir/types.js';

// ---------------------------------------------------------------------------
// Module-local Type/Default renderers — lifted VERBATIM from readme.mjs lines
// 20-60 and ported to TS so `renderPropsTable` has NO dependency on readme.mjs.
// ---------------------------------------------------------------------------

function renderPropType(typeAnnotation: PropDecl['typeAnnotation'] | undefined): string {
  if (!typeAnnotation) return 'any';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  if (typeAnnotation.kind === 'literal') {
    return typeAnnotation.value === null ? 'any' : String(typeAnnotation.value);
  }
  // Structural fallbacks (defensive — mirrors readme.mjs's permissive shape).
  const t = typeAnnotation as { name?: string; value?: unknown };
  if (t.name) return t.name;
  if (t.value !== undefined) {
    return t.value === null ? 'any' : String(t.value);
  }
  return 'any';
}

function renderPropDefault(defaultValue: PropDecl['defaultValue']): string {
  if (defaultValue == null) return '—';
  const node = defaultValue as {
    type: string;
    value?: unknown;
    name?: string;
    elements?: unknown[];
    properties?: unknown[];
    body?: { type: string; elements?: unknown[]; properties?: unknown[] };
  };
  switch (node.type) {
    case 'NullLiteral':
      return 'null';
    case 'BooleanLiteral':
      return String(node.value);
    case 'NumericLiteral':
      return String(node.value);
    case 'StringLiteral':
      return node.value === '' ? "''" : JSON.stringify(node.value);
    case 'ArrayExpression':
      return node.elements && node.elements.length ? '[…]' : '[]';
    case 'ObjectExpression':
      return node.properties && node.properties.length ? '{…}' : '{}';
    case 'ArrowFunctionExpression': {
      const body = node.body;
      if (body && body.type === 'ArrayExpression') return body.elements && body.elements.length ? '[…]' : '[]';
      if (body && body.type === 'ObjectExpression') return body.properties && body.properties.length ? '{…}' : '{}';
      return '() => …';
    }
    case 'Identifier':
      return node.name ?? String(node.type);
    default:
      return String(node.type);
  }
}

// ---------------------------------------------------------------------------
// Public surface.
// ---------------------------------------------------------------------------

/**
 * Escape an author-controlled string so it stays a single well-formed Markdown
 * table cell. Collapses newlines/whitespace to single spaces and escapes pipes
 * (`\|`). On an UNMATCHED backtick (an unclosed inline-code span) it writes a
 * non-fatal warning to `process.stderr` (WR-03 / D-07) — author intent is never
 * rewritten, just surfaced loudly at codegen time so the span can be closed in
 * the `.rozie` source.
 *
 * @public — consumed by `renderPropDescription` and the props-table generator.
 */
export function escapeTableCell(text: string): string {
  const escaped = String(text)
    .replace(/\r\n?|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
  // WR-03: an UNMATCHED backtick (an unclosed inline-code span) breaks code-span
  // rendering for the rest of the Description column in some Markdown parsers.
  // We don't rewrite author intent — surface it loudly at codegen time so the
  // author can close the span in the .rozie source.
  const backtickCount = (escaped.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) {
    process.stderr.write(
      `readme.mjs: WARNING: unmatched backtick in a prop description — the unclosed ` +
        `code span may break Markdown table rendering: ${JSON.stringify(escaped)}\n`,
    );
  }
  return escaped;
}

/**
 * Render the `## Props` Description cell from a prop's first-class `docs` field
 * (`PropDecl.docs`, lowered by Phase 58). Returns `''` when the prop carries no
 * docs (the inert path). A deprecated prop gets a leading `**(deprecated)**`
 * marker (with the deprecation message appended when `deprecated` is a string);
 * a `description` is appended; multiple parts join with a single space.
 *
 * @public — consumed by `renderPropsTable`, family `readme.mjs`, and the
 *           docs-site `props-codegen.ts`.
 */
export function renderPropDescription(prop: PropDecl): string {
  const docs = prop.docs;
  if (!docs) return '';
  const parts: string[] = [];
  if (docs.deprecated) {
    parts.push(
      typeof docs.deprecated === 'string'
        ? `**(deprecated)** ${escapeTableCell(docs.deprecated)}`
        : '**(deprecated)**',
    );
  }
  if (docs.description) parts.push(escapeTableCell(docs.description));
  return parts.join(' ');
}

/**
 * Render a family-agnostic `## Props` Markdown table from any component IR
 * (D-06). Input is `ir.props[]` — there are NO data-table literals, so the same
 * generator serves every family README props table AND the docs-site API props
 * table. The full 6-column layout mirrors the README for cross-surface
 * consistency; the Description column sources each cell from
 * `renderPropDescription` (empty for a docless prop).
 *
 * @public — the single props-table generator consumed by every surface.
 */
export function renderPropsTable(ir: IRComponent): string {
  const lines: string[] = [];
  lines.push('| Name | Type | Default | Two-way (model) | Required | Description |');
  lines.push('| --- | --- | --- | :---: | :---: | --- |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    lines.push(
      `| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} | ${required} | ${renderPropDescription(p)} |`,
    );
  }
  return lines.join('\n');
}
