/**
 * Quick task 260623-kks — Vue emitter null-default hardening.
 *
 * Root cause: an untyped optional prop authored `{ type: null, default: null }`
 * lowers to `{ kind: 'identifier', name: 'unknown' }`. `renderPropField` widens
 * it to `unknown | null`; TS collapses `unknown | null` → `unknown`; Vue's
 * `withDefaults` `InferDefault<P, unknown>` resolves the default-slot type to
 * `((props) => {}) | undefined`, which REJECTS the emitted `null` literal default
 * inside `withDefaults(..., { obj: null })` → TS2322.
 *
 * RED-first oracle: this file is written and run BEFORE the emitter fix. Both
 * assertions must FAIL on the current emitter, then PASS after the surgical
 * `renderPropField` change (gate `needsNull && baseType === 'unknown'` →
 * non-collapsing base).
 *
 *   - Assertion A (string shape): the emitted `obj?:` field is NOT the collapsing
 *     `unknown | null` — it carries a non-collapsing base that keeps both union
 *     branches.
 *   - Assertion B (strict vue-tsc oracle, load-bearing): write the emitted SFC to
 *     a tmpdir, run `vue-tsc --noEmit` under a STRICT tsconfig, assert ZERO TS2322.
 *     The Function prop (`fn`, `{ type: Function, default: null }`) must ALSO
 *     produce 0 TS2322 — it already emits `((...args: any[]) => any) | null` and
 *     must stay byte-identical (non-regression leg).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  existsSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitVue } from '../../emitVue.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../../..');

// vue-tsc is NOT a direct devDep of @rozie/target-vue (W2). Resolve it from the
// tests/vue-typecheck harness package, which depends on it and has vue resolvable.
const VUE_TYPECHECK_DIR = resolve(ROOT, 'tests/vue-typecheck');
const VUE_TSC_BIN = resolve(VUE_TYPECHECK_DIR, 'node_modules/.bin/vue-tsc');

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitVue(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

const STRICT_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'preserve',
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    skipLibCheck: true,
    isolatedModules: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    noEmit: true,
    lib: ['ES2022', 'DOM'],
    types: ['vue'],
  },
  include: ['**/*.vue'],
});

/**
 * Write the emitted SFC into a tmpdir alongside a STRICT tsconfig, symlink the
 * vue-typecheck harness's node_modules so `vue` + its types resolve, run
 * `vue-tsc --noEmit`, and return the captured stdout+stderr (vue-tsc writes
 * diagnostics to stdout on non-zero, throwing via execFileSync).
 */
function strictVueTsc(sfc: string, name = 'Probe.vue'): string {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-nulldefault-'));
  try {
    writeFileSync(join(tmpDir, name), sfc);
    writeFileSync(join(tmpDir, 'tsconfig.json'), STRICT_TSCONFIG);
    symlinkSync(
      join(VUE_TYPECHECK_DIR, 'node_modules'),
      join(tmpDir, 'node_modules'),
      'dir',
    );
    try {
      execFileSync(VUE_TSC_BIN, ['--noEmit', '-p', 'tsconfig.json'], {
        cwd: tmpDir,
        stdio: 'pipe',
      });
      return ''; // clean
    } catch (err) {
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      return stdout + '\n' + stderr;
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function countTS2322(diag: string): number {
  return (diag.match(/TS2322/g) ?? []).length;
}

describe('Vue emitter — null-default untyped prop (260623-kks)', () => {
  it('precondition: vue-tsc binary is resolvable from the harness', () => {
    expect(existsSync(VUE_TSC_BIN)).toBe(true);
  });

  const SRC = `<rozie name="Probe">
<props>
{
  obj: { type: null, default: null },
  fn: { type: Function, default: null }
}
</props>
<template>
  <div></div>
</template>
</rozie>`;

  it('Assertion A — obj field is NOT the collapsing `unknown | null`', () => {
    const code = compile(SRC);
    // The emitted defineProps field for `obj` must not collapse to unknown.
    expect(code).not.toContain('obj?: unknown | null');
    // It must keep a non-collapsing base with both union branches.
    expect(code).toMatch(/obj\?: [^;}]*\| null/);
  });

  it('Assertion B — strict vue-tsc of the emitted SFC has ZERO TS2322 (obj + fn)', () => {
    const code = compile(SRC);
    const diag = strictVueTsc(code);
    const n = countTS2322(diag);
    if (n !== 0) {
      // Surface the captured diagnostics on failure for fast triage.
      throw new Error(
        `Expected 0 TS2322 in strict vue-tsc of the emitted SFC, got ${n}:\n${diag}`,
      );
    }
    expect(n).toBe(0);
  });
});
