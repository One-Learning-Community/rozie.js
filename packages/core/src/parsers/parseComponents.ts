/**
 * `<components>` block parser — Phase 06.2 P1 Task 1.
 *
 * Mirrors `parseProps` shape: `@babel/parser.parseExpression` parses the block
 * content as a single JS expression — must be an `ObjectExpression` at top
 * level. Authors declare composed children with `{ Modal: './Modal.rozie' }`.
 *
 * D-08 contract: NEVER throw on user input. Returns
 * `{ node: ComponentsAST | null, diagnostics: Diagnostic[] }`.
 *
 * ROZxxx codes owned here:
 *  - ROZ010  Invalid JS expression in <components>
 *  - ROZ011  <components> top-level is not an object literal — also used as
 *            placeholder for non-`.rozie` value (Task 1); Task 4 upgrades to
 *            ROZ921 NON_ROZIE_IMPORT_PATH.
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ComponentsAST } from '../ast/blocks/ComponentsAST.js';
import { parserPositionFor, babelLocToRozieLoc } from './parserPosition.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseComponentsResult {
  node: ComponentsAST | null;
  diagnostics: Diagnostic[];
}

export function parseComponents(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseComponentsResult {
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
      message: `Invalid JS expression in <components>: ${e.message ?? 'parse failed'}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  // Lift recoverable errors collected by Babel under errorRecovery (mirror parseProps).
  const errors =
    (expr as unknown as { errors?: Array<{ loc?: { index?: number }; message?: string }> }).errors ?? [];
  for (const e of errors) {
    diagnostics.push({
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <components>: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  if (expr.type !== 'ObjectExpression') {
    diagnostics.push({
      code: RozieErrorCode.NOT_OBJECT_LITERAL,
      severity: 'error',
      message: `<components> must be a JS object literal expression — found ${expr.type}.`,
      loc: babelLocToRozieLoc(expr),
      ...(filename !== undefined ? { filename } : {}),
      hint: 'Wrap your component declarations in `{ Modal: "./Modal.rozie", ... }`.',
    });
    return { node: null, diagnostics };
  }

  // Per-property structural validation. Task 1 uses NOT_OBJECT_LITERAL as the
  // placeholder code for non-`.rozie` values; Task 4 upgrades to ROZ921
  // NON_ROZIE_IMPORT_PATH with a tailored hint.
  // (Non-Identifier keys are deferred to lowerComponents — silent skip there.)
  for (const prop of expr.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    if (prop.computed) continue;
    if (prop.key.type !== 'Identifier' && prop.key.type !== 'StringLiteral') continue;
    const keyName =
      prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
    const value = prop.value;
    if (value.type !== 'StringLiteral') {
      diagnostics.push({
        code: RozieErrorCode.NOT_OBJECT_LITERAL,
        severity: 'error',
        message: `<components> entry '${keyName}' must reference a '.rozie' file string literal (got ${value.type}).`,
        loc: babelLocToRozieLoc(value),
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Only .rozie file paths are supported as component imports in v1.',
      });
      continue;
    }
    if (!value.value.endsWith('.rozie')) {
      diagnostics.push({
        code: RozieErrorCode.NOT_OBJECT_LITERAL,
        severity: 'error',
        message: `<components> entry '${keyName}' references '${value.value}', which does not end with '.rozie'.`,
        loc: babelLocToRozieLoc(value),
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Only .rozie file paths are supported as component imports in v1.',
      });
    }
  }

  return {
    node: {
      type: 'ComponentsAST',
      loc: contentLoc,
      expression: expr as ObjectExpression,
    },
    diagnostics,
  };
}
