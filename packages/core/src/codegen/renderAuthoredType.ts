/**
 * renderAuthoredType — typed public surface (spec §4.1). The SINGLE printer
 * for every author-written type string (`<emits>` payloads, `:param-types`
 * values, `$expose` signatures, later `tsType`). Parses with Babel's TS
 * parser as the RHS of a throwaway alias, so exactly one type is accepted;
 * prints with @babel/generator so all six targets emit identical text.
 *
 * @experimental — shape may change before v1.0
 */
import { parse as babelParse } from '@babel/parser';
import _generate from '@babel/generator';
import * as t from '@babel/types';

const generate = (typeof _generate === 'function'
  ? _generate
  : (_generate as unknown as { default: typeof _generate }).default) as typeof _generate;

/** @experimental */
export interface AuthoredTypeResult {
  type: t.TSType;
  printed: string;
}

/** @experimental */
export function printTSType(type: t.TSType): string {
  return generate(type).code;
}

/** @experimental */
export function parseAuthoredType(src: string): AuthoredTypeResult | { error: string } {
  if (src.trim() === '') return { error: 'empty type string' };
  let file: t.File;
  try {
    file = babelParse(`type __RozieAuthored = ${src};`, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
  } catch (err) {
    return { error: (err as Error).message };
  }
  const body = file.program.body;
  if (body.length !== 1 || !t.isTSTypeAliasDeclaration(body[0])) {
    return { error: 'expected exactly one TypeScript type' };
  }
  const type = body[0].typeAnnotation;
  return { type, printed: printTSType(type) };
}
