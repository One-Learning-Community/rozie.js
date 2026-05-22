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
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync } from 'node:fs';
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

// TYPED_EXAMPLES — the `examples/typed/*` fixture set (Phase 9
// `<script lang="ts">`). Side-by-side typed variants resolved under
// `examples/typed/`, NOT added to the dist-parity EXAMPLES baseline. Linted +
// tsc-checked in separate describe blocks so a typed-fixture failure is
// distinguishable from an untyped regression. Solid uses a LINT gate (this
// workspace) as its per-target gate — it has no separate typecheck workspace.
const TYPED_EXAMPLES = ['Counter', 'Dropdown', 'SortableList', 'TypedCard', 'DataCast', 'PropsCustomType', 'PropsRequired'];

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

describe('SOLID-TSC — tsc --noEmit clean over emitted Solid TSX', () => {
  // Catches the class of bug that eslint-plugin-solid does not:
  //   - TDZ ("use before declaration") in emitter output (2026-05-18 SortableListDemo)
  //   - "void is not callable" / wrong-arg-count from lifecycle/watcher emit
  //   - Type mismatches in slot fallback / merge expressions
  //   - Missing or wrong-shaped helper-runtime imports
  // Implementation mirrors the eslint gate above: compile every example to TSX,
  // write them into a tmpdir with a tsconfig + node_modules symlink, invoke tsc.
  it('all 8 emitted Solid TSX files tsc clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-tsc-'));
    try {
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

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // Symlink the lint workspace's node_modules so tsc resolves solid-js,
      // @rozie/runtime-solid, etc. — matches the same pattern eslint uses (it
      // reads its plugins from HERE/node_modules via --config).
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
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

describe('SOLID-T-04 (typed) — eslint-plugin-solid clean over emitted typed Solid TSX', () => {
  it('all 7 emitted typed Solid TSX files (examples/typed/*) lint clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-lint-typed-'));
    try {
      for (const name of TYPED_EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/typed/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'solid',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.tsx'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // typed/SortableList imports `sortablejs`; typed/TypedCard `import type`s
      // from it — the ambient engine-module stub resolves both to `any` so the
      // type-aware ESLint parser does not flag an unresolved module.
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));

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

describe('SOLID-TSC (typed) — tsc --noEmit clean over emitted typed Solid TSX', () => {
  it('all 7 emitted typed Solid TSX files (examples/typed/*) tsc clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-tsc-typed-'));
    try {
      for (const name of TYPED_EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/typed/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'solid',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.tsx'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // typed/SortableList imports `sortablejs`; typed/TypedCard `import type`s
      // from it — the ambient engine-module stub resolves both to `any`.
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
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
