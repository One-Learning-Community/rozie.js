/**
 * REACT-TSC — tsc --noEmit gate over emitted React TSX.
 *
 * Compiles all 8 reference examples to React TSX, writes them to a tmp dir
 * (alongside a tsconfig.json and a node_modules symlink to this workspace),
 * then invokes `tsc --noEmit`. Fails on any TS error.
 *
 * Catches the class of emit bug that does not require runtime instrumentation:
 *   - "void is not callable" / wrong-arg-count from lifecycle/watcher emit
 *   - Type mismatches in slot fallback / merge expressions
 *   - Cast-narrowing failures on optional-callable props
 *   - Missing or wrong-shaped helper-runtime imports
 *
 * Mirrors the SOLID-TSC / LIT-TSC gates added in commit 536575a.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  readFileSync,
  symlinkSync,
} from 'node:fs';
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
  // Engine-wrapper examples — non-trivial `<script>` logic (an engine instance
  // held in `let editor = null`, untyped callback params). This is the shape
  // the untyped-`<script>` type-broken-emit bug regresses; covering it here is
  // what would have caught that bug. Engine imports resolve against the
  // ambient `engine-modules.d.ts` stub copied into the tmp dir below.
  // All four engine wrappers are now covered — quick task 260520-w18 closed
  // the residual type-error bug classes that previously blocked Uppy /
  // SortableList / Flatpickr.
  'TipTap',
  'Uppy',
  'SortableList',
  'Flatpickr',
];

// TYPED_EXAMPLES — the `examples/typed/*` fixture set (Phase 9
// `<script lang="ts">`). These are side-by-side typed variants resolved under
// `examples/typed/`, NOT added to the dist-parity EXAMPLES baseline. This gate
// compiles + tsc-checks them in a separate describe block so a typed-fixture
// failure is distinguishable from an untyped regression.
const TYPED_EXAMPLES = ['Counter', 'Dropdown', 'SortableList', 'TypedCard', 'MatchUnion', 'DataCast', 'PropsCustomType', 'PropsRequired'];

describe('REACT-TSC — tsc --noEmit clean over emitted React TSX', () => {
  it('all 12 emitted React TSX files (8 reference + 4 engine-wrapper) tsc clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-react-tsc-'));
    try {
      for (const name of EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'react',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.tsx'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // Copy the css-modules ambient .d.ts so tsc resolves emitted
      // `import styles from './Foo.module.css'` lines without TS2307.
      copyFileSync(join(HERE, 'css-modules.d.ts'), join(tmpDir, 'css-modules.d.ts'));
      // Ambient `any` stubs for engine modules imported by the engine-wrapper
      // examples (TipTap → @tiptap/*, Flatpickr → flatpickr).
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      // Symlink the workspace's node_modules so tsc resolves react, react-dom,
      // @rozie/runtime-react, etc.
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

describe('REACT-TSC (typed) — tsc --noEmit clean over emitted typed React TSX', () => {
  it('all 8 emitted typed React TSX files (examples/typed/*) tsc clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-react-tsc-typed-'));
    try {
      for (const name of TYPED_EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/typed/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'react',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.tsx'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      copyFileSync(join(HERE, 'css-modules.d.ts'), join(tmpDir, 'css-modules.d.ts'));
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
