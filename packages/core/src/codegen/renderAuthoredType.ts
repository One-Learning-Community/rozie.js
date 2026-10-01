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

/**
 * Re-indent a multi-line printed authored type so its continuation lines sit
 * one nesting level (2 spaces) deeper, as required when the type is placed
 * into an interface member / object-type field. Single-line types are
 * returned unchanged. The ONE shared helper for field placement.
 *
 * @experimental
 */
export function indentContinuation(printed: string): string {
  return printed.replace(/\n/g, '\n  ');
}

/** The wrapper every authored type string is parsed inside. */
const AUTHORED_TYPE_PREFIX = 'type __RozieAuthored = ';

/**
 * Babel's message with its wrapper-relative `(line:col)` suffix replaced by a
 * position inside the AUTHOR's type string (final fix wave L12): line 1
 * columns shift left by the wrapper prefix; later lines are unaffected.
 */
function authoredTypeErrorMessage(err: unknown): string {
  const e = err as { message?: string; loc?: { line: number; column: number } };
  const base = (e.message ?? 'parse failed').replace(/\s*\(\d+:\d+\)\s*$/, '');
  if (!e.loc) return base;
  const line = e.loc.line;
  const column = Math.max(0, line === 1 ? e.loc.column - AUTHORED_TYPE_PREFIX.length : e.loc.column) + 1;
  return `${base} (line ${line}, column ${column} of the type string)`;
}

/** @experimental */
export function parseAuthoredType(src: string): AuthoredTypeResult | { error: string } {
  if (src.trim() === '') return { error: 'empty type string' };
  let file: t.File;
  try {
    file = babelParse(`${AUTHORED_TYPE_PREFIX}${src};`, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
  } catch (err) {
    return { error: authoredTypeErrorMessage(err) };
  }
  const body = file.program.body;
  if (body.length !== 1 || !t.isTSTypeAliasDeclaration(body[0])) {
    return { error: 'expected exactly one TypeScript type' };
  }
  const type = body[0].typeAnnotation;
  return { type, printed: printTSType(type) };
}
