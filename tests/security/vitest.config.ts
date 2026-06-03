import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // security has multiple battery files (sink-scan / parity / adversarial),
    // unlike dist-parity's single parity.test.ts. Pick them all up.
    include: ['*.test.ts'],
    // MANDATORY — turbo-parallel flake class (memory project_turbo_parallel_test_flake).
    // Every new test package MUST set this or it flakes under `turbo run test`.
    testTimeout: 30000,
  },
});
