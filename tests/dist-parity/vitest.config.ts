import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Phase 54 — partial-inline-parity.test.ts is the inline-vs-partial
    // byte-identity gate (currently describe.skip until Plan 05 blesses the
    // fixtures). Added to include so it is discoverable now (Wave 0).
    include: ['parity.test.ts', 'partial-inline-parity.test.ts'],
    // Parity gate runs in-process — no Vite/server overhead, so default
    // pool semantics are fine. Limit to 30s per test to surface hangs.
    testTimeout: 30000,
  },
});
