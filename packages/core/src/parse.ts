/**
 * Public `parse()` entrypoint for `@rozie/core` (D-09 / D-10).
 *
 * Pipeline:
 *   1. splitBlocks (Plan 02) — slice the .rozie source into typed BlockMap.
 *   2. Run each present block through its parser (Plan 03):
 *      parseProps / parseData / parseScript / parseTemplate / parseListeners /
 *      parseStyle.
 *   3. buildRozieAST (Plan 04 Task 3) — compose sub-ASTs into RozieAST and
 *      run the peggy modifier grammar over preserved modifier-chain text.
 *   4. Aggregate diagnostics throughout (collected, not thrown — D-08).
 *
 * @experimental — shape may change before v1.0
 */
import { splitBlocks } from './splitter/splitBlocks.js';
import { parseProps } from './parsers/parseProps.js';
import { parseData } from './parsers/parseData.js';
import { parseScript } from './parsers/parseScript.js';
import { parseTemplate } from './parsers/parseTemplate.js';
import { parseListeners } from './parsers/parseListeners.js';
import { parseStyle } from './parsers/parseStyle.js';
import { buildRozieAST } from './ast/normalize.js';
import type { RozieAST } from './ast/types.js';
import type { Diagnostic } from './diagnostics/Diagnostic.js';

export interface ParseResult {
  ast: RozieAST | null;
  diagnostics: Diagnostic[];
}

/**
 * @experimental — shape may change before v1.0
 *
 * Parse a `.rozie` source file into a typed `RozieAST` with byte-accurate
 * source locations on every node. Diagnostics are collected, never thrown
 * (D-08).
 *
 * `ast` is null only when fatal errors prevent AST construction (e.g.,
 * missing `<rozie>` envelope). Non-fatal errors return both an AST and
 * diagnostics so callers can render multiple problems at once — Vue-quality
 * DX rather than fix-one-at-a-time (D-06).
 *
 * @param source - the raw `.rozie` file contents
 * @param opts - optional filename for diagnostic messages
 * @returns `{ ast, diagnostics }` — see `ParseResult`.
 *
 * @example
 *   const { ast, diagnostics } = parse(source, { filename: 'Counter.rozie' });
 *   if (!ast) { for (const d of diagnostics) console.error(renderDiagnostic(d, source)); return; }
 *   for (const d of diagnostics) console.warn(renderDiagnostic(d, source));
 *   // ...consume ast...
 */
export function parse(source: string, opts: { filename?: string } = {}): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const filename = opts.filename;
  const blocks = splitBlocks(source, filename);
  diagnostics.push(...blocks.diagnostics);

  if (!blocks.rozie) {
    // ROZ001 already emitted by splitBlocks. Without an envelope we cannot
    // construct a meaningful RozieAST.
    return { ast: null, diagnostics };
  }

  const propsRes = blocks.props
    ? parseProps(blocks.props.content, blocks.props.contentLoc, source, filename)
    : { node: null, diagnostics: [] as Diagnostic[] };
  const dataRes = blocks.data
    ? parseData(blocks.data.content, blocks.data.contentLoc, source, filename)
    : { node: null, diagnostics: [] as Diagnostic[] };
  const scriptRes = blocks.script
    ? parseScript(blocks.script.content, blocks.script.contentLoc, source, filename)
    : { node: null, diagnostics: [] as Diagnostic[] };
  const templateRes = blocks.template
    ? parseTemplate(blocks.template.content, blocks.template.contentLoc, source, filename)
    : { node: null, diagnostics: [] as Diagnostic[] };
  const listenersRes = blocks.listeners
    ? parseListeners(blocks.listeners.content, blocks.listeners.contentLoc, source, filename)
    : { node: null, diagnostics: [] as Diagnostic[] };
  const styleRes = blocks.style
    ? parseStyle(blocks.style.content, blocks.style.contentLoc, source, filename)
    : { node: null, diagnostics: [] as Diagnostic[] };

  diagnostics.push(
    ...propsRes.diagnostics,
    ...dataRes.diagnostics,
    ...scriptRes.diagnostics,
    ...templateRes.diagnostics,
    ...listenersRes.diagnostics,
    ...styleRes.diagnostics,
  );

  const { ast, diagnostics: normDiags } = buildRozieAST({
    blocks,
    props: propsRes.node,
    data: dataRes.node,
    script: scriptRes.node,
    listeners: listenersRes.node,
    template: templateRes.node,
    style: styleRes.node,
  });
  diagnostics.push(...normDiags);

  return { ast, diagnostics };
}
