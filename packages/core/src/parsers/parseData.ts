/**
 * `<data>` block parser (PARSE-02 — data side).
 *
 * Structurally identical to `parseProps`: same `@babel/parser.parseExpression`
 * path, same ObjectExpression top-level requirement. Wraps the result in
 * `DataAST` instead of `PropsAST` so downstream consumers can discriminate.
 *
 * D-08: collected-not-thrown. ROZxxx codes shared with parseProps:
 *  - ROZ010  Invalid JS expression in <data>
 *  - ROZ011  <data> top-level is not an object literal
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { DataAST } from '../ast/blocks/DataAST.js';
import { parserPositionFor, babelLocToRozieLoc } from './parserPosition.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseDataResult {
  node: DataAST | null;
  diagnostics: Diagnostic[];
}

export function parseData(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseDataResult {
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
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <data>: ${e.message ?? 'parse failed'}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  const errors =
    (expr as unknown as { errors?: Array<{ loc?: { index?: number }; message?: string }> }).errors ?? [];
  for (const e of errors) {
    diagnostics.push({
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <data>: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  if (expr.type !== 'ObjectExpression') {
    diagnostics.push({
      code: RozieErrorCode.NOT_OBJECT_LITERAL,
      severity: 'error',
      message: `<data> must be a JS object literal expression — found ${expr.type}.`,
      loc: babelLocToRozieLoc(expr),
      ...(filename !== undefined ? { filename } : {}),
      hint: 'Wrap your data declarations in `{ ... }`.',
    });
    return { node: null, diagnostics };
  }

  return {
    node: {
      type: 'DataAST',
      loc: contentLoc,
      expression: expr as ObjectExpression,
    },
    diagnostics,
  };
}
