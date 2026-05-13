/**
 * LIT-T-06 — eslint-plugin-lit + eslint-plugin-wc lint gate.
 *
 * Compiles all 8 reference examples to Lit `.ts` output via @rozie/core, writes
 * them to a tmp dir, then invokes ESLint with --max-warnings 0 using the flat
 * config in this workspace. Fails if any warning or error is emitted —
 * ensuring the emitter stays clean under both plugin rule sets.
 *
 * Layered on top of Plan 02's emitter-source invariant grep (T-06.4-03):
 *   - Plan 02 grep'd target-lit/src/**.ts for `unsafe-html` imports.
 *   - This test runs eslint-plugin-lit/flat/recommended on the EMITTED output,
 *     so any accidental unsafe-html-shaped pattern in compiler output fails CI.
 *
 * eslint-plugin-wc/flat/best-practice contributes the require-listener-teardown
 * rule (RESEARCH.md A8 / D-LIT-09) — D-LIT-09 emitter contract is that every
 * addEventListener in firstUpdated/connectedCallback registers a teardown in
 * _disconnectCleanups. If a future emitter change drops that pattern, eslint
 * catches it.
 *
 * Mirrors tests/solid-lint/solid-lint.test.ts shape.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
];

describe('LIT-T-06 — eslint-plugin-lit + eslint-plugin-wc clean (--max-warnings 0)', () => {
  it('all 8 emitted Lit .ts files lint clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-lint-'));
    try {
      for (const name of EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'lit',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.ts'), result.code, 'utf8');
      }

      // Copy tsconfig so the TS parser can find a config from tmpDir's cwd.
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));

      // Invoke eslint from the workspace node_modules — --config points at our
      // flat config so plugins resolve from HERE/node_modules.
      const eslintBin = resolve(HERE, 'node_modules/.bin/eslint');
      const configPath = join(HERE, 'eslint.config.mjs');
      try {
        execFileSync(eslintBin, ['.', '--config', configPath, '--max-warnings', '0'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('eslint exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
