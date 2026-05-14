import { defineConfig } from 'vitest/config';

/**
 * Phase 7 Plan 03 — slot-matrix vitest config.
 *
 * Copied near-verbatim from tests/dist-parity/vitest.config.ts: the slot matrix
 * is a pure compiler-layer suite (compile() per fixture per target), so the
 * node environment with no Vite/server overhead is correct.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['slot-matrix.test.ts'],
    testTimeout: 30000,
  },
});
