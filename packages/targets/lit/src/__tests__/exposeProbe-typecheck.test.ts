/**
 * LIT-TSC (ExposeProbe) — tsc --noEmit gate over the emitted Lit output for the
 * Phase-21 `$expose` dogfood (REQ-10's lit typed-handle path).
 *
 * There is no `tests/lit-typecheck/` harness dir (only react/vue/svelte/angular
 * have one), so per 21-RESEARCH §D.3 option 1 the lit typed-handle tsc check
 * lives INSIDE this target package's suite: compile `examples/ExposeProbe.rozie`
 * → emitted `.lit.ts` → stage into a tmp dir → `tsc --noEmit`.
 *
 * The relaxed compilerOptions mirror the @rozie-ui lit LEAF package tsconfig
 * (`packages/ui/sortable-list/packages/lit/tsconfig.json`):
 * experimentalDecorators + useDefineForClassFields:false + noImplicitOverride:false
 * (the documented Lit decorator config), and strictNullChecks /
 * exactOptionalPropertyTypes / noImplicitAny OFF because the emitted Lit output
 * is bundler-built (tsdown/oxc), not strict-tsc-authored. We do NOT edit the
 * emitter to paper over this, and we add NO `@ts-ignore`/`any`-cast to pass.
 * The exposed public element methods (`reset(): void` / `focus(): void`) ARE
 * verified type-clean by this gate (REQ-10 — Lit infers the handle from the
 * public class methods, D-04, no separate interface).
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
    strictNullChecks: false,
    exactOptionalPropertyTypes: false,
    noImplicitAny: false,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  },
  include: ['ExposeProbe.lit.ts'],
};

describe('LIT-TSC (ExposeProbe) — emitted Lit $expose handle tsc clean', () => {
  it('emitted ExposeProbe.lit.ts (public reset/focus methods) tsc --noEmit clean', () => {
    const source = readFileSync(resolve(ROOT, 'examples/ExposeProbe.rozie'), 'utf8');
    const result = compile(source, {
      target: 'lit',
      filename: 'ExposeProbe.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // The exposed methods must be PUBLIC element methods (REQ-10 — no `private`,
    // and the top-level $expose(...) directive must be stripped).
    expect(result.code).toContain('reset(): void');
    expect(result.code).toContain('focus(): void');
    expect(result.code).not.toContain('private reset');
    expect(result.code).not.toContain('private focus');
    expect(result.code).not.toContain('$expose(');

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-expose-tsc-'));
    try {
      writeFileSync(join(tmpDir, 'ExposeProbe.lit.ts'), result.code, 'utf8');
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
