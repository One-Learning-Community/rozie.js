/**
 * `<emits>` block parser (typed public surface).
 *
 * Uses `@babel/parser.parseExpression` to parse the block content as a single
 * JS expression — must be an `ObjectExpression` at top level. Identifier
 * references like `Number`/`Array`, unary expressions like `-Infinity`, and
 * arrow-function default factories like `() => []` are all supported by
 * Babel's expression grammar (none of which JSON5 can parse — see
 * RESEARCH.md "Five Big Decisions" §5).
 *
 * D-08 contract: NEVER throw on user input. Returns
 * `{ node: EmitsAST | null, diagnostics: Diagnostic[] }`.
 *
 * ROZxxx codes owned here (Plan 04 will centralize the registry):
 *  - ROZ010  Invalid JS expression in <emits>
 *  - ROZ011  <emits> top-level is not an object literal
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { EmitsAST } from '../ast/blocks/EmitsAST.js';
import { parserPositionFor, babelLocToRozieLoc } from './parserPosition.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseEmitsResult {
  node: EmitsAST | null;
  diagnostics: Diagnostic[];
}

export function parseEmits(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseEmitsResult {
  const diagnostics: Diagnostic[] = [];
  const pos = parserPositionFor(source, contentLoc);

  let expr: ReturnType<typeof parseExpression>;
  try {
    expr = parseExpression(content, {
      ...pos,
      ...(filename !== undefined ? { sourceFilename: filename } : {}),
      plugins: ['typescript'],
      errorRecovery: true,
    });
  } catch (err: unknown) {
    const e = err as { message?: string; loc?: { index?: number } };
    diagnostics.push({
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <emits>: ${e.message ?? 'parse failed'}`,
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
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <emits>: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  if (expr.type !== 'ObjectExpression') {
    diagnostics.push({
      code: RozieErrorCode.NOT_OBJECT_LITERAL,
      severity: 'error',
      message: `<emits> must be a JS object literal expression — found ${expr.type}.`,
      loc: babelLocToRozieLoc(expr),
      ...(filename !== undefined ? { filename } : {}),
      hint: 'Wrap your emit declarations in `{ ... }`.',
    });
    return { node: null, diagnostics };
  }

  return {
    node: {
      type: 'EmitsAST',
      loc: contentLoc,
      expression: expr as ObjectExpression,
    },
    diagnostics,
  };
}
