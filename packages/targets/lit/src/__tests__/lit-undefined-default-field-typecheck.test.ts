/**
 * LIT-TSC (UndefinedDefault) — tsc --noEmit gate proving Pattern B (260712-a09)
 * is fixed: a prop authored `default: undefined` (or `default: void 0`) must
 * NOT emit a typed field initialized to `undefined` (`foo: string = undefined`,
 * TS2322 under strictNullChecks). It must fall through to the existing
 * `?:`/`!:` no-default branch instead.
 *
 * Mirrors `exposeProbe-typecheck.test.ts`'s tsc-in-a-tmp-dir harness, with
 * strictNullChecks:true (this gate exists specifically to prove the
 * strictNullChecks-clean claim, unlike the relaxed sibling gates).
 *
 * @quick 260712-a09 Task 1
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '../..');
const ROOT = resolve(HERE, '../../../../..');
const FIXTURE = resolve(
  ROOT,
  'tests/regressions/fixtures/260712-a09-lit-undefined-default/input.rozie',
);

const TSCONFIG = {
  compilerOptions: {
    noEmit: true,
    module: 'ESNext',
    target: 'ES2022',
    moduleResolution: 'bundler',
    strict: true,
    verbatimModuleSyntax: true,
    experimentalDecorators: true,
    useDefineForClassFields: false,
    noImplicitOverride: false,
    skipLibCheck: true,
    strictNullChecks: true,
    exactOptionalPropertyTypes: false,
    noImplicitAny: false,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  },
  include: ['LitUndefinedDefault.lit.ts'],
};

describe('LIT-TSC (UndefinedDefault) — `default: undefined` routes to no-default field form', () => {
  it('emitted LitUndefinedDefault.lit.ts tsc --noEmit clean under strictNullChecks:true', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'lit',
      filename: 'LitUndefinedDefault.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // Fixed shape: no-default `?:`/`!:` branch, never `= undefined`.
    expect(result.code).toContain('width?: number;');
    expect(result.code).toContain('label?: string;');
    expect(result.code).not.toContain('= undefined');
    expect(result.code).not.toContain('= void 0');

    // Byte-identity controls, unaffected by this fix.
    expect(result.code).toContain('title!: string;');
    expect(result.code).toContain("subtitle: string = 'hello';");

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-undefined-default-tsc-'));
    try {
      writeFileSync(join(tmpDir, 'LitUndefinedDefault.lit.ts'), result.code, 'utf8');
      writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify(TSCONFIG, null, 2), 'utf8');
      // Symlink the package's node_modules so tsc resolves lit, lit/decorators.js,
      // @lit-labs/preact-signals + @rozie/runtime-lit.
      symlinkSync(join(PKG_ROOT, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(PKG_ROOT, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('tsc --noEmit exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
