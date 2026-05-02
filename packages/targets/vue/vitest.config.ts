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
  },
});
