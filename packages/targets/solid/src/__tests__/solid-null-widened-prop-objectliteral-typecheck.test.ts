/**
 * SOLID-TSC (NullWidenedPropObjectLiteral) — tsc --noEmit gate proving the
 * null-widened-prop → 3rd-party object-literal coercion (260712-ig6 Task B)
 * is fixed: a null-widened (`default: null`) prop read (type `T | null`)
 * spliced into an object-literal property passed to a 3rd-party-style call
 * inside a `$onMount` setup body must coerce `null` → `undefined` at that
 * splice site (`?? undefined`) — the 3rd-party lib's options field types
 * `T | undefined`, never `T | null` (TS2345/TS2322 before the fix).
 *
 * Distinct from Pattern D (260712-a09, already fixed — a `$refs` DOM ref used
 * as a DIRECT call argument): this fires on a DIFFERENT predicate ($props
 * reads nested inside an object-literal call argument). This gate also
 * re-runs the Pattern D + Pattern F sibling gate to prove no regression.
 *
 * Mirrors `solid-ref-objectprop-null-typecheck.test.ts`'s tsc-in-a-tmp-dir
 * harness, with strictNullChecks:true.
 *
 * @quick 260712-ig6 Task B
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
  'tests/regressions/fixtures/260712-ig6-solid-null-widened-prop/input.rozie',
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
  include: ['SolidNullWidenedPropObjectLiteral.solid.tsx'],
};

describe('SOLID-TSC (NullWidenedPropObjectLiteral) — null-widened prop → 3rd-party object-literal coercion', () => {
  it('emitted SolidNullWidenedPropObjectLiteral.solid.tsx tsc --noEmit clean under strictNullChecks:true', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'solid',
      filename: 'SolidNullWidenedPropObjectLiteral.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // Fixed shape: the splice site coerces null → undefined.
    expect(result.code).toContain('handle: local.handle ?? undefined');

    // Byte-identity control — `label` (same default: null shape) read into a
    // plain local OUTSIDE an object-literal call argument. Must NOT be
    // coerced.
    expect(result.code).toContain('const labelLocal = local.label;');
    expect(result.code).not.toContain('local.label ?? undefined');

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-null-widened-prop-tsc-'));
    try {
      writeFileSync(
        join(tmpDir, 'SolidNullWidenedPropObjectLiteral.solid.tsx'),
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
