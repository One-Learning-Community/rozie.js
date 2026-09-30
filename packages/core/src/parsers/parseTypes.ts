/**
 * parseTypes — `<types>` block (typed public surface, spec §3.1). Always
 * TypeScript. Only type-only statements are allowed, so hoisting the block
 * into every target module can never change runtime behaviour.
 *
 * ROZxxx codes owned here:
 *  - ROZ019  statement is not type-only
 *  - ROZ020  block is not valid TypeScript
 *
 * @experimental — shape may change before v1.0
 */
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { babelLocToRozieLoc, parserPositionFor } from './parserPosition.js';
import type { TypesAST } from '../ast/blocks/TypesAST.js';
import type { SourceLoc } from '../ast/types.js';

function isAllowedStatement(s: t.Statement): boolean {
  if (t.isImportDeclaration(s)) return s.importKind === 'type';
  if (t.isTSInterfaceDeclaration(s) || t.isTSTypeAliasDeclaration(s)) return !s.declare;
  if (t.isExportNamedDeclaration(s)) {
    if (s.declaration) {
      return (
        (t.isTSInterfaceDeclaration(s.declaration) || t.isTSTypeAliasDeclaration(s.declaration)) &&
        !s.declaration.declare
      );
    }
    return s.exportKind === 'type'; // `export type { A } [from 'x']`
  }
  return false;
}

export function parseTypes(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename: string | undefined,
): { node: TypesAST | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const pos = parserPositionFor(source, contentLoc);
  const fileField = filename !== undefined ? { filename } : {};
  let file: t.File;
  try {
    file = babelParse(content, {
      ...pos,
      ...(filename !== undefined ? { sourceFilename: filename } : {}),
      sourceType: 'module',
      plugins: ['typescript'],
      errorRecovery: true,
    });
  } catch (err) {
    const e = err as { message?: string; loc?: { index?: number } };
    diagnostics.push({
      code: RozieErrorCode.TYPES_BLOCK_PARSE_ERROR,
      severity: 'error',
      message: `<types> is not valid TypeScript: ${e.message ?? 'parse failed'}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...fileField,
    });
    return { node: null, diagnostics };
  }
  const errors = (file as unknown as { errors?: Array<{ message?: string; loc?: { index?: number } }> }).errors ?? [];
  for (const e of errors) {
    diagnostics.push({
      code: RozieErrorCode.TYPES_BLOCK_PARSE_ERROR,
      severity: 'error',
      message: `<types> is not valid TypeScript: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...fileField,
    });
  }
  for (const s of file.program.body) {
    if (isAllowedStatement(s)) continue;
    diagnostics.push({
      code: RozieErrorCode.TYPES_BLOCK_DISALLOWED_STATEMENT,
      severity: 'error',
      message:
        '<types> may contain only `import type`, `interface`, `type`, and `export` of those — this statement would add runtime code to every emitted module.',
      loc: babelLocToRozieLoc(s),
      hint: 'Move runtime code into <script>; a value import used only as a type can be written `import type { X } from …`.',
      ...fileField,
    });
  }
  return { node: { type: 'TypesAST', loc: contentLoc, program: file.program }, diagnostics };
}
