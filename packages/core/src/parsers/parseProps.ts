/**
 * `<props>` block parser (PARSE-02 — props side).
 *
 * Uses `@babel/parser.parseExpression` to parse the block content as a single
 * JS expression — must be an `ObjectExpression` at top level. Identifier
 * references like `Number`/`Array`, unary expressions like `-Infinity`, and
 * arrow-function default factories like `() => []` are all supported by
 * Babel's expression grammar (none of which JSON5 can parse — see
 * RESEARCH.md "Five Big Decisions" §5).
 *
 * D-08 contract: NEVER throw on user input. Returns
 * `{ node: PropsAST | null, diagnostics: Diagnostic[] }`.
 *
 * ROZxxx codes owned here (Plan 04 will centralize the registry):
 *  - ROZ010  Invalid JS expression in <props>
 *  - ROZ011  <props> top-level is not an object literal
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { PropsAST } from '../ast/blocks/PropsAST.js';
import { parserPositionFor, babelLocToRozieLoc } from './parserPosition.js';

export interface ParsePropsResult {
  node: PropsAST | null;
  diagnostics: Diagnostic[];
}

export function parseProps(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParsePropsResult {
  const diagnostics: Diagnostic[] = [];
  const pos = parserPositionFor(source, contentLoc);

  let expr: ReturnType<typeof parseExpression>;
  try {
    expr = parseExpression(content, {
      ...pos,
      ...(filename !== undefined ? { sourceFilename: filename } : {}),
      errorRecovery: true,
    });
  } catch (err: unknown) {
    const e = err as { message?: string; loc?: { index?: number } };
    diagnostics.push({
      code: 'ROZ010',
      severity: 'error',
      message: `Invalid JS expression in <props>: ${e.message ?? 'parse failed'}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  // Lift recoverable errors collected by Babel under errorRecovery.
  // Note (Assumption A5): @babel/parser populates `errors` on the expression
  // node itself (not a wrapper) when `errorRecovery: true` is used with
  // parseExpression. Treat all collected errors as ROZ010.
  const errors =
    (expr as unknown as { errors?: Array<{ loc?: { index?: number }; message?: string }> }).errors ?? [];
  for (const e of errors) {
    diagnostics.push({
      code: 'ROZ010',
      severity: 'error',
      message: `Invalid JS expression in <props>: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  if (expr.type !== 'ObjectExpression') {
    diagnostics.push({
      code: 'ROZ011',
      severity: 'error',
      message: `<props> must be a JS object literal expression — found ${expr.type}.`,
      loc: babelLocToRozieLoc(expr),
      ...(filename !== undefined ? { filename } : {}),
      hint: 'Wrap your prop declarations in `{ ... }`.',
    });
    return { node: null, diagnostics };
  }

  return {
    node: {
      type: 'PropsAST',
      loc: contentLoc,
      expression: expr as ObjectExpression,
    },
    diagnostics,
  };
}
