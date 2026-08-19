/**
 * LIT-TSC (AriaMixinFieldCollision) — tsc --noEmit gate proving the ARIAMixin
 * field-name collision (260712-ig6 Task A) is fixed: a prop named after an
 * ARIAMixin-reserved field (`ariaLabel`, `role`, etc.) with `default:
 * undefined` must NOT emit the ordinary Pattern B no-default `?:` field form
 * (`ariaLabel?: string;`, i.e. `string | undefined`) — LitElement `implements
 * ARIAMixin`, whose `ariaLabel` field is declared `string | null`, and
 * `string | undefined` is not assignable to `string | null` (TS2416/TS1240).
 * It must instead render a `string | null`-compatible field.
 *
 * Distinct from Pattern B (260712-a09), which is correct in general and must
 * keep emitting the ordinary `?:`/`!:` no-default form for every OTHER prop
 * name (byte-identity control asserted below via the sibling `label` prop).
 *
 * Mirrors `lit-undefined-default-field-typecheck.test.ts`'s tsc-in-a-tmp-dir
 * harness, with strictNullChecks:true. The emitted `.lit.ts` extends
 * `LitElement` (which implements `ARIAMixin`), so the collision is exercised
 * directly against real `lit` types resolved via the symlinked node_modules —
 * no hand-written stub needed.
 *
 * @quick 260712-ig6 Task A
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
const FIXTURE = resolve(ROOT, 'tests/regressions/fixtures/260712-ig6-lit-ariamixin/input.rozie');

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
  include: ['LitAriaMixin.lit.ts'],
};

describe('LIT-TSC (AriaMixinFieldCollision) — ARIAMixin-named prop routes to `| null`-compatible field', () => {
  it('emitted LitAriaMixin.lit.ts tsc --noEmit clean under strictNullChecks:true', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const result = compile(source, {
      target: 'lit',
      filename: 'LitAriaMixin.rozie',
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // Fixed shape: ARIAMixin-named prop routes to a `| null`-compatible field,
    // never the `undefined`-admitting no-default `?:` form.
    expect(result.code).toContain('ariaLabel: string | null = null;');
    expect(result.code).not.toContain('ariaLabel?: string;');

    // Byte-identity control — `label` is NOT an ARIAMixin field name, same
    // `default: undefined` shape. Must keep emitting the pre-existing
    // no-default `?:` form (Pattern B, unaffected by this fix).
    expect(result.code).toContain('label?: string;');

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-ariamixin-tsc-'));
    try {
      writeFileSync(join(tmpDir, 'LitAriaMixin.lit.ts'), result.code, 'utf8');
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
