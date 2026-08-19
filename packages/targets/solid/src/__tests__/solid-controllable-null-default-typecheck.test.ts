/**
 * SOLID-TSC (ControllableNullDefault) — tsc --noEmit gate proving the
 * NEW-controllable-null-default gap (260712-kb9) is fixed:
 *
 *   - A `model: true` prop whose `<props>` declaration has a literal
 *     `default: null` must emit `createControllableSignal<T | null>(...)`,
 *     not `createControllableSignal<T>(...)` — the generic `T` alone
 *     excludes `null` while the emitted initial-value argument IS `null`,
 *     producing TS2345 under strictNullChecks.
 *
 * Mirrors `solid-ref-objectprop-null-typecheck.test.ts`'s tsc-in-a-tmp-dir
 * harness, with strictNullChecks:true.
 *
 * @quick 260712-kl1 Task 1
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
  'tests/regressions/fixtures/260712-kl1-solid-controllable-null-default/input.rozie',
);

const TSCONFIG = {
  compilerOptions: {
    noEmit: true,
    module: 'ESNext',
    target: 'ES2022',
    moduleResolution: 'bundler',
    strict: true,
    verbatimModuleSyntax: true,
    jsx: 'preserve',
    jsxImportSource: 'solid-js',
    skipLibCheck: true,
    strictNullChecks: true,
    exactOptionalPropertyTypes: false,
    noImplicitAny: false,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  },
  include: ['SolidControllableNullDefault.solid.tsx'],
};

describe('SOLID-TSC (ControllableNullDefault) — model-prop null-default generic-widen typecheck', () => {
  it('emitted SolidControllableNullDefault.solid.tsx tsc --noEmit clean under strictNullChecks:true', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'solid',
      filename: 'SolidControllableNullDefault.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // Fixed shape: the generic is widened to `number | null` (RED against the
    // pre-fix emitter, which emits bare `createControllableSignal<number>(`).
    expect(result.code).toContain('createControllableSignal<number | null>(');

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-controllable-null-default-tsc-'));
    try {
      writeFileSync(
        join(tmpDir, 'SolidControllableNullDefault.solid.tsx'),
        result.code,
        'utf8',
      );
      writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify(TSCONFIG, null, 2), 'utf8');
      // Symlink the package's node_modules so tsc resolves solid-js +
      // @rozie/runtime-solid.
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
