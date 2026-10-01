/**
 * Function-expression script verbs on Angular (found while re-verifying ledger
 * item T13 in typed-surface P1's final fix wave). A top-level
 * `const half = function (by) { return $data.total / by }` becomes a CLASS
 * FIELD; emitted as a `function` expression its rewritten `this.total` has no
 * lexical `this` (TS2683 under strict, and `this` is lost when the verb is
 * called detached, e.g. passed as a callback). It must be lifted like every
 * other script function: as an arrow field.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));

const FN_EXPR_SRC = `<rozie name="FnExpr">
<data>
{ total: 8 }
</data>
<script>
const half = function (by) {
  return $data.total / by
}
const gen = function* () {
  yield 1
}
const args = function () {
  return arguments.length
}
$expose({ half, gen, args })
</script>
<template>
  <span>{{ half(2) }}</span>
</template>
</rozie>`;

describe('function-expression script verbs — Angular', () => {
  it('a plain function expression is lifted as an arrow field; generators and `arguments` users are left alone', () => {
    const r = compile(FN_EXPR_SRC, { target: 'angular', filename: 'FnExpr.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.code).toMatch(/\n\s+half = \(by: any\) => \{/);
    expect(r.code).toMatch(/\n\s+gen = function\* \(\) \{/);
    expect(r.code).toMatch(/\n\s+args = function \(\) \{/);
  });
  it('the component is tsc clean (no TS2683 implicit-any `this`)', () => {
    const r = compile(FN_EXPR_SRC.replace(/const gen[\s\S]*?\n}\nconst args[\s\S]*?\n}\n/, '').replace(', gen, args', ''), {
      target: 'angular',
      filename: 'FnExpr.rozie',
      sourceMap: false,
    });
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-fnexpr-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'FnExpr.ts'), r.code);
      let out = '';
      try {
        execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      } catch (err) {
        const e = err as { stdout?: Buffer; stderr?: Buffer };
        out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
      }
      expect(out).toBe('');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
