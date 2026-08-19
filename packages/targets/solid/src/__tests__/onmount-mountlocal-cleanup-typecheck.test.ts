/**
 * SOLID-TSC (OnMountMountLocalCleanup) — tsc --noEmit gate proving a `$onMount`
 * mount-local `let`/`const` stays in scope for its returned teardown.
 *
 * Emitter-hardening backlog item #2 (`project_emitter_hardening_backlog` Tier 1,
 * memory-adjacent to `project_solid_polymorphic_model_typeof_narrow_gap`). Before
 * the fix, Solid's `emitScript.ts` re-parented the `$onMount` setup body into its
 * own `(() => { ... })()` IIFE, so a mount-local declared inside that setup block
 * (`const timer = setInterval(...)`) went out of scope for the sibling
 * `onCleanup(() => clearInterval(timer))` call — TS2304 (`timer` is not defined).
 *
 * Mirrors `exposeProbe-typecheck.test.ts`'s tsc-in-a-tmp-dir harness (no
 * `tests/solid-typecheck/` project exists for this target — see that file's
 * header comment for why).
 *
 * @plan 73-02 Task 1
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
  'tests/regressions/fixtures/73-02-solid-onmount-mountlocal-cleanup/input.rozie',
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
  include: ['OnMountMountLocalCleanup.solid.tsx'],
};

describe('SOLID-TSC (OnMountMountLocalCleanup) — mount-local stays in scope for teardown', () => {
  it('emitted OnMountMountLocalCleanup.solid.tsx tsc --noEmit clean (#2)', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'solid',
      filename: 'OnMountMountLocalCleanup.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-onmount-mountlocal-tsc-'));
    try {
      writeFileSync(
        join(tmpDir, 'OnMountMountLocalCleanup.solid.tsx'),
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
