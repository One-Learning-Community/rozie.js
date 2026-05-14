import { defineConfig } from 'vitest/config';

/**
 * Phase 7 Plan 05 — regressions vitest config.
 *
 * Copied near-verbatim from tests/dist-parity/vitest.config.ts: the regression
 * suite is a pure compiler-layer suite (compile() per fixture per target), so
 * the node environment with no Vite/server overhead is correct.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['regressions.test.ts'],
    testTimeout: 30000,
  },
});
