// Vitest config for @rozie/target-vue.
// happy-dom env so behavioral tests (Plan 02-05) can mount compiled .vue
// SFCs via @vue/test-utils. Snapshot tests (Plan 02-05) drive the
// fixtures under packages/targets/vue/fixtures/{example}.{vue,script,
// template,style}.snap (D-46).
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/target-vue test`
// from repo root vs direct invocation in the package directory.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
    // Behavioral tests compile .rozie → .vue and mount via @vue/compiler-sfc +
    // @vue/test-utils — a heavy module graph. Under `turbo run test` parallel
    // CPU starvation that work can exceed vitest's 5s default and flake only in
    // full batteries (passes standalone). A 30s ceiling is a load-tolerant
    // FAILSAFE, not an assertion.
    testTimeout: 30000,
  },
});
