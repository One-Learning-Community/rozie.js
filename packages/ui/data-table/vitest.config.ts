// Vitest config for @rozie-ui/data-table.
//
// Test surface: tests/vendor-drift.test.ts — the D-04 vendored-Popover drift
// guard (sha256 envelope compare against the canonical @rozie-ui/popover
// source). Mirrors command-palette's vitest.config.ts.
//
// testTimeout: 30000 — matches command-palette's rationale (heavy module graph
// under `turbo run test` parallel CPU starvation).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
