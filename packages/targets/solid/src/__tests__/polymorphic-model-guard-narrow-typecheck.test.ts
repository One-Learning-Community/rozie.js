/**
 * SOLID-TSC (PolymorphicModelGuardNarrow) — tsc --noEmit gate proving a
 * polymorphic/union model-prop read guarded by `typeof` narrows on Solid.
 *
 * Emitter-hardening backlog item #11
 * (`project_solid_polymorphic_model_typeof_narrow_gap`). `$props.value` lowers
 * to a Solid accessor CALL (`value()`); TS cannot narrow a `typeof` guard
 * across two SEPARATE calls the way it narrows a plain variable/property read
 * (React/Vue/Svelte/Angular/Lit), so `selected(): string` returning the
 * unguarded union failed TS2322 before the fix. Real-world precedent:
 * DatePicker.rozie's `selected()` (commit bf3766b5) hand-authored the exact
 * `const v = $props.value; return typeof v === 'string' ? v : ''` workaround
 * this backlog item relocates into the emitter.
 *
 * Mirrors `exposeProbe-typecheck.test.ts`'s tsc-in-a-tmp-dir harness.
 *
 * @plan 73-02 Task 2
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/targets/solid/src/__tests__ -> repo root is 5 levels up.
const PKG_ROOT = resolve(HERE, '../..');
const ROOT = resolve(HERE, '../../../../..');
const FIXTURE = resolve(
  ROOT,
  'tests/regressions/fixtures/73-02-solid-polymorphic-model-guard-narrow/input.rozie',
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
    strictNullChecks: false,
    exactOptionalPropertyTypes: false,
    noImplicitAny: false,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  },
  include: ['PolymorphicModelGuardNarrow.solid.tsx'],
};

describe('SOLID-TSC (PolymorphicModelGuardNarrow) — polymorphic model guard narrows', () => {
  it('emitted PolymorphicModelGuardNarrow.solid.tsx tsc --noEmit clean (#11)', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'solid',
      filename: 'PolymorphicModelGuardNarrow.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-poly-guard-tsc-'));
    try {
      writeFileSync(
        join(tmpDir, 'PolymorphicModelGuardNarrow.solid.tsx'),
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
