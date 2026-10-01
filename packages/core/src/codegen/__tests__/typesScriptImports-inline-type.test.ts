/**
 * typesStatementsForModule — final fix wave L10. When the dedupe rewrites a
 * local re-export of a dropped binding it forces `export type { … }`; an
 * inline `type` modifier on a kept specifier must be stripped, otherwise the
 * output is `export type { type A }` (TS2207).
 */
import { describe, expect, it } from 'vitest';
import { parse as babelParse } from '@babel/parser';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import { typesStatementsForModule } from '../typesScriptImports.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function' ? _generate : (_generate as unknown as { default: GenerateFn }).default;

const body = (src: string) => babelParse(src, { sourceType: 'module', plugins: ['typescript'] }).program.body;

describe('typesStatementsForModule — inline `type` specifiers (L10)', () => {
  it('strips the inline modifier when forcing `export type`', () => {
    const types = body(`import type { Thing, Other } from './lib'\nexport { type Thing as T2, type Other }`);
    const script = body(`import { Thing } from './lib'`);
    const code = generate(t.program([...typesStatementsForModule(types, script)])).code;
    expect(code).not.toMatch(/\{\s*type /);
    expect(code).toContain('export type { Other };');
    expect(code).toContain("export type { Thing as T2 } from './lib';");
  });
});
