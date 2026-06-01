/**
 * SOLID-TSC (ExposeProbe) — tsc --noEmit gate over the emitted Solid output for
 * the Phase-21 `$expose` dogfood (REQ-10's solid typed-handle path).
 *
 * There is no `tests/solid-typecheck/` harness dir (only react/vue/svelte/angular
 * have one), so per 21-RESEARCH §D.3 option 1 the solid typed-handle tsc check
 * lives INSIDE this target package's suite: compile `examples/ExposeProbe.rozie`
 * → emitted `.solid.tsx` → stage into a tmp dir → `tsc --noEmit`.
 *
 * The relaxed compilerOptions mirror the @rozie-ui solid LEAF package tsconfig
 * (`packages/ui/sortable-list/packages/solid/tsconfig.json`): strictNullChecks /
 * exactOptionalPropertyTypes / noImplicitAny are OFF because the emitted Solid
 * output is bundler-built (tsdown/oxc), not strict-tsc-authored — emitted DOM
 * refs are typed `HTMLElement | null` (the known strict-null backlog gap,
 * memory `project_leaf_strict_typecheck_emitter_findings`). We do NOT edit the
 * emitter to paper over this, and we add NO `@ts-ignore`/`any`-cast to pass.
 * The typed handle (`ref?: (h: ExposeProbeHandle) => void` + the
 * `interface ExposeProbeHandle { reset(): void; focus(): void; }`) IS verified
 * type-clean by this gate (REQ-10).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/targets/solid/src/__tests__ -> repo root is 5 levels up.
const PKG_ROOT = resolve(HERE, '../..');
const ROOT = resolve(HERE, '../../../../..');

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
  include: ['ExposeProbe.solid.tsx'],
};

describe('SOLID-TSC (ExposeProbe) — emitted Solid $expose handle tsc clean', () => {
  it('emitted ExposeProbe.solid.tsx (typed reset/focus handle) tsc --noEmit clean', () => {
    const source = readFileSync(resolve(ROOT, 'examples/ExposeProbe.rozie'), 'utf8');
    const result = compile(source, {
      target: 'solid',
      filename: 'ExposeProbe.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // The typed handle surface must be present in the emit (REQ-10).
    expect(result.code).toContain('interface ExposeProbeHandle');
    expect(result.code).toContain('ref?: (h: ExposeProbeHandle) => void');
    expect(result.code).not.toContain('$expose(');

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-expose-tsc-'));
    try {
      writeFileSync(join(tmpDir, 'ExposeProbe.solid.tsx'), result.code, 'utf8');
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
