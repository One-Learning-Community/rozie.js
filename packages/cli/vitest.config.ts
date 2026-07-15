// Vitest config for @rozie/cli.
// Pinned `root: __dirname` so snapshot path resolution is stable whether
// invoked from the package dir or via `pnpm --filter @rozie/cli test`.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    root: __dirname,
    // The build/multi-target suites spawn full CLI compile passes (real .rozie
    // → multi-framework emit). Under `turbo run test` parallel CPU starvation
    // those can exceed vitest's 5s default and flake only in full batteries
    // (passes standalone). The heaviest (M2: 5 examples × 4 targets = 20 compiles)
    // was observed at ~34s under full-suite contention when the ceiling was
    // first set at 60s, then at ~84s in the 2026-07 whole-repo cold battery as
    // the repo grew — so the ceiling is 180s: a load-tolerant FAILSAFE, not an
    // assertion — same philosophy as tests/cli-smoke + tests/timing.
    testTimeout: 180000,
  },
});
