/**
 * SOLID-TSC (RefObjectPropNull) — tsc --noEmit gate proving Patterns D + F
 * (260712-a09) are fixed:
 *
 *   - Pattern D: a DOM ref (`HTMLElement | null`) passed as a DIRECT call
 *     argument to a non-null-typed engine constructor inside `$onMount` must
 *     carry a non-null assertion (`xRef!`) at that call site — the ref
 *     DECLARATION stays `| null`.
 *   - Pattern F: an Object-typed prop with an empty-object factory default
 *     must not widen to `Record<string, any> | {}` — member access on the
 *     merged prop must typecheck.
 *
 * Mirrors `polymorphic-model-guard-narrow-typecheck.test.ts`'s tsc-in-a-tmp-dir
 * harness, with strictNullChecks:true (this gate exists specifically to prove
 * the strictNullChecks-clean claim).
 *
 * @quick 260712-a09 Task 2
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
  'tests/regressions/fixtures/260712-a09-solid-ref-objectprop-null/input.rozie',
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
  include: ['SolidRefObjectPropNull.solid.tsx'],
};

describe('SOLID-TSC (RefObjectPropNull) — engine-init ref arg + object-prop default typecheck', () => {
  it('emitted SolidRefObjectPropNull.solid.tsx tsc --noEmit clean under strictNullChecks:true', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'solid',
      filename: 'SolidRefObjectPropNull.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // Pattern D fixed shape: non-null assertion at the call site, declaration
    // stays `| null`.
    expect(result.code).toContain('let containerRef: HTMLElement | null = null;');
    expect(result.code).toContain('useEngine(containerRef!,');

    // Pattern F fixed shape: the mergeProps default entry (factory-invoked,
    // since `default: () => ({})` is a mutable-literal factory) is cast to
    // the prop's own rendered type.
    expect(result.code).toContain('options: (() => ({}))() as Record<string, any>');

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-ref-objectprop-tsc-'));
    try {
      writeFileSync(
        join(tmpDir, 'SolidRefObjectPropNull.solid.tsx'),
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
