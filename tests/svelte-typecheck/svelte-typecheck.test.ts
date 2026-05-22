/**
 * SVELTE-CHECK — svelte-check --threshold error gate.
 *
 * Compiles all 8 reference examples to Svelte 5 SFCs (`.svelte`), writes them
 * to a tmp dir (alongside a tsconfig + node_modules symlink), then invokes
 * `svelte-check` and fails if any error fires. svelte-check parses .svelte
 * SFCs, extracts <script lang="ts"> blocks, and type-checks them in the
 * context of the template — the standard tool for the Svelte target since
 * `tsc` alone cannot understand .svelte files.
 *
 * Mirrors tests/solid-lint/solid-lint.test.ts SOLID-TSC shape; swaps `tsc`
 * for `svelte-check`.
 *
 * Catches the class of bug that integration tests do not:
 *   - $watch callback arity (wrong-arg-count from watcher emit)
 *   - Prop type renderType producing `unknown[]` where `.filter(...)` is called
 *   - $bindable() typing for model:true props
 *   - Snippet<[ctx]> mismatches in slot fallback / merge expressions
 *   - Listener cleanup typing (passive flag etc.)
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
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
// `<script lang="ts">`). Side-by-side typed variants resolved under
// `examples/typed/`, NOT added to the dist-parity EXAMPLES baseline. Checked
// in a separate describe block so a typed-fixture failure is distinguishable
// from an untyped regression.
const TYPED_EXAMPLES = ['Counter', 'Dropdown', 'SortableList', 'TypedCard', 'MatchUnion', 'DataCast', 'PropsCustomType', 'PropsRequired'];

describe('SVELTE-CHECK — svelte-check --threshold error clean over emitted Svelte SFCs', () => {
  it('all 12 emitted Svelte .svelte files (8 reference + 4 engine-wrapper) svelte-check clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-check-'));
    try {
      for (const name of EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'svelte',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.svelte'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // Ambient `any` stubs for engine modules imported by the engine-wrapper
      // examples (TipTap → @tiptap/*, Flatpickr → flatpickr).
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      // Symlink the workspace's node_modules so svelte-check resolves svelte,
      // typescript, etc. — same pattern the Solid/Lit tsc gates use.
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const svelteCheckBin = resolve(HERE, 'node_modules/.bin/svelte-check');
      try {
        execFileSync(
          svelteCheckBin,
          ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
          {
            cwd: tmpDir,
            stdio: 'pipe',
          },
        );
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('svelte-check exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SVELTE-CHECK (typed) — svelte-check clean over emitted typed Svelte SFCs', () => {
  it('all 8 emitted typed Svelte .svelte files (examples/typed/*) svelte-check clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-check-typed-'));
    try {
      for (const name of TYPED_EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/typed/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'svelte',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.svelte'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // typed/SortableList imports `sortablejs`; typed/TypedCard `import type`s
      // from it — the ambient engine-module stub resolves both to `any`.
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const svelteCheckBin = resolve(HERE, 'node_modules/.bin/svelte-check');
      try {
        execFileSync(
          svelteCheckBin,
          ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
          {
            cwd: tmpDir,
            stdio: 'pipe',
          },
        );
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('svelte-check exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
