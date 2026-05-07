import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['parity.test.ts'],
    // Parity gate runs in-process — no Vite/server overhead, so default
    // pool semantics are fine. Limit to 30s per test to surface hangs.
    testTimeout: 30000,
  },
});
