/**
 * VUE-TSC — vue-tsc --noEmit gate over emitted Vue SFCs.
 *
 * Mirrors tests/solid-lint SOLID-TSC and tests/lit-lint LIT-TSC: compiles every
 * reference example to a Vue SFC, writes them into a tmpdir with a tsconfig +
 * node_modules symlink, then invokes vue-tsc and fails on any error.
 *
 * Catches the class of bug that snapshot-only emit tests do not:
 *   - <script setup> macro misuse (defineProps/defineModel/defineEmits/defineSlots)
 *   - Untyped or wrong-typed binding expressions in <template>
 *   - Wrong-arg-count from lifecycle/watcher emit
 *   - Type mismatches in slot fallback / scoped-slot expressions
 *   - Missing or wrong-shaped helper-runtime imports
 *
 * Implementation: compile each example to .vue source, drop into tmpdir, run
 * `vue-tsc --noEmit -p tsconfig.json` against the workspace's pinned vue-tsc.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
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

describe('VUE-TSC — vue-tsc --noEmit clean over emitted Vue SFCs', () => {
  it('all 8 emitted Vue SFC files typecheck clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-tsc-'));
    try {
      for (const name of EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'vue',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.vue'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // Symlink the workspace's node_modules so vue-tsc resolves vue,
      // @rozie/runtime-vue, etc.
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const vueTscBin = resolve(HERE, 'node_modules/.bin/vue-tsc');
      try {
        execFileSync(vueTscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('vue-tsc --noEmit exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
