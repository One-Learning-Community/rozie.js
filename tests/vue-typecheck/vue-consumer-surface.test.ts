/**
 * VUE-CONSUMER-SURFACE — Layer 2 strict consumer-surface gate (quick task 260623-jwh).
 *
 * Automates the verdaccio dogfood: proves a STRICT (strict:true + noImplicitAny:true)
 * typed Vue consumer of the COMPILED leaf dist stays vue-tsc clean. This catches the
 * "source-only Vue leaf breaks consumer vue-tsc with 49 errors" class for FUTURE leaves
 * (threat T-jwh-02).
 *
 * Mirrors the existing VUE-TSC harness shape: mkdtempSync tmpdir, copy in the strict
 * tsconfig (as tsconfig.json) + the Consumer.vue stub, symlink this package's
 * node_modules (so the workspace-symlinked @rozie-ui leaf packages + vue + peer types
 * resolve), then run `node_modules/.bin/vue-tsc --noEmit -p tsconfig.json` and throw
 * with the captured stdout/stderr on non-zero.
 *
 * The consumer stub imports the sampled leaves BY PACKAGE NAME, so resolution goes
 * through each package's `.` exports map → the compiled dist/index.d.ts. The sampled
 * leaves MUST be built first (their dist .d.ts must exist):
 *   pnpm turbo run build --filter "@rozie-ui/*-vue"
 * In CI this is covered by the preceding `pnpm turbo run build` step (Layer 3).
 *
 * Sample = data-table (MANDATORY) + listbox (pure-Rozie) + sortable-list (engine-wrapper).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, copyFileSync, symlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

// Sampled leaves whose compiled dist .d.ts the consumer stub imports. The test
// asserts each is built before running so a missing-dist run fails loud (not a
// false green) rather than silently resolving nothing.
const SAMPLED_DIST = [
  'packages/ui/data-table/packages/vue/dist/index.d.ts',
  'packages/ui/listbox/packages/vue/dist/index.d.ts',
  'packages/ui/sortable-list/packages/vue/dist/index.d.ts',
];

describe('VUE-CONSUMER-SURFACE — strict typed consumer of compiled leaf dist is vue-tsc clean (Layer 2)', () => {
  it('Consumer.vue importing sampled @rozie-ui leaf dist typechecks clean under strict tsconfig', () => {
    // Fail loud if the sampled leaves were not built — the consumer resolves their
    // compiled dist .d.ts, so a missing dist is a setup error, not a pass.
    const missing = SAMPLED_DIST.filter((p) => !existsSync(resolve(ROOT, p)));
    if (missing.length > 0) {
      throw new Error(
        'Sampled Vue leaf dist .d.ts missing — build them first ' +
          '(`pnpm turbo run build --filter "@rozie-ui/*-vue"`):\n  ' +
          missing.join('\n  '),
      );
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-consumer-'));
    try {
      // Strict consumer tsconfig (strict + noImplicitAny) → tsconfig.json in tmp.
      copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
      // The typed consumer stub.
      mkdirSync(join(tmpDir, 'consumer-stub'), { recursive: true });
      copyFileSync(
        join(HERE, 'consumer-stub', 'Consumer.vue'),
        join(tmpDir, 'consumer-stub', 'Consumer.vue'),
      );
      // Symlink this package's node_modules so the workspace-symlinked @rozie-ui
      // leaves + vue + @tanstack peer types resolve through their real exports maps.
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
        throw new Error(
          'vue-tsc --noEmit exited non-zero for the strict consumer surface:\n' + stdout + '\n' + stderr,
        );
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    expect(true).toBe(true);
  });
});
