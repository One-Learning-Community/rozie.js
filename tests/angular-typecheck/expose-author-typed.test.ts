/**
 * EXPOSE-AUTHOR-TYPED (Angular) — typed public surface P1, final fix wave I1.
 * Author-typed `$expose` verbs of an opt-in component keep their own types on
 * the class surface (no `(...args: any[]) => any` field annotation over an
 * author-typed implementation, including a `const fn = function (…): T {}`
 * initializer — ledger T13). Shared fixture with strict-conformance.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, '../strict-conformance/__fixtures__/expose-author-typed/AuthorExpose.rozie'), 'utf8');

const CONSUMER = `import { AuthorExpose } from './AuthorExpose';
declare const h: AuthorExpose;
export const s1: string = h.add(1);
// @ts-expect-error — add takes a number
h.add('x');
export const s2: string = h.sub(1);
// @ts-expect-error — sub takes a number
h.sub('x');
export const s3: string = h.mul(2);
// @ts-expect-error — mul takes a number
h.mul('x');
export const s4: number = h.half(4);
// @ts-expect-error — half takes a number
h.half('x');
h.reset();
// @ts-expect-error — reset takes no arguments
h.reset(1);
h.loose('anything', 2);
h.twice('anything');
`;

describe('EXPOSE-AUTHOR-TYPED — Angular', () => {
  it('author-typed verbs carry no untyped field annotation', () => {
    const r = compile(SRC, { target: 'angular', filename: 'AuthorExpose.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.code).toMatch(/\n\s+add = \(by: number\): string => \{/);
    expect(r.code).toMatch(/\n\s+half = function \(by: number\): number \{/);
    expect(r.code).toMatch(/\n\s+reset: \(\) => void = /);
    expect(r.code).toMatch(/\n\s+loose: \(\.\.\.args: any\[\]\) => any = /);
  });
  it('component + consumer tsc clean', () => {
    const r = compile(SRC, { target: 'angular', filename: 'AuthorExpose.rozie', sourceMap: false });
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-i1-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'AuthorExpose.ts'), r.code);
      writeFileSync(join(tmpDir, 'consumer.ts'), CONSUMER);
      let out = '';
      try {
        execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      } catch (err) {
        const e = err as { stdout?: Buffer; stderr?: Buffer };
        out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
      }
      expect(out).toBe('');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
