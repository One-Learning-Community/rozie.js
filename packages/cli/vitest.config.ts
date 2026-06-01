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
    // (passes standalone). A 30s ceiling is a load-tolerant FAILSAFE, not an
    // assertion — same philosophy as tests/cli-smoke + tests/timing.
    testTimeout: 30000,
  },
});
