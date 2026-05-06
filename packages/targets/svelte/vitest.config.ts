// Vitest config for @rozie/target-svelte.
// happy-dom env so behavioral tests (Plan 05-02) can mount compiled .svelte
// SFCs via svelte's compile() output. Snapshot tests (Plan 05-02) drive the
// fixtures under packages/targets/svelte/fixtures/{example}.svelte.snap (D-46/D-69).
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/target-svelte test`
// from repo root vs direct invocation in the package directory.
//
// Phase 5 Plan 05-01 Wave 0 — scaffolds. Plan 05-02 fills in real harness.
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
