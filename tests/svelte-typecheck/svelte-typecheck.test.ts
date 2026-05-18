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
];

describe('SVELTE-CHECK — svelte-check --threshold error clean over emitted Svelte SFCs', () => {
  it('all 8 emitted Svelte .svelte files svelte-check clean', () => {
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
