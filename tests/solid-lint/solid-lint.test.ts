/**
 * SOLID-T-04 / SOLID-T-05 — eslint-plugin-solid reactivity gate.
 *
 * Compiles all 8 reference examples to Solid TSX, writes them to a tmp dir
 * (alongside our flat eslint.config.mjs and tsconfig.json), then invokes
 * ESLint with --max-warnings 0. Fails if any warning or error is emitted,
 * ensuring the emitter stays clean under eslint-plugin-solid reactivity rules.
 *
 * D-137 — workspace mirror of tests/smoke-sourcemap convention.
 * D-138 — plugin:solid/typescript ONLY (no typescript-eslint type-aware rules).
 *
 * Common reactivity violations this gate catches:
 *   - Bare signal access in JSX ({count} instead of {count()})
 *   - Direct _props destructuring (must use splitProps — D-141)
 *   - createEffect with second-arg dep array (Solid ≠ React)
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
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

describe('SOLID-T-04 — eslint-plugin-solid clean (--max-warnings 0)', () => {
  it('all 8 emitted Solid TSX files lint clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-lint-'));
    try {
      // Compile all 8 examples to TSX in the tmp dir.
      // We do NOT copy the eslint config — instead we point ESLint to the config
      // in the solid-lint workspace via --config, so plugin resolution works from
      // the workspace's node_modules (not the transient tmpDir).
      for (const name of EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'solid',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.tsx'), result.code, 'utf8');
      }

      // Copy tsconfig so @typescript-eslint/parser can resolve types from tmpDir.
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));

      // Invoke eslint binary from the workspace node_modules.
      // --config points to our eslint.config.mjs so plugins resolve from HERE/node_modules.
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
