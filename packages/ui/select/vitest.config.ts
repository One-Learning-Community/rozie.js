// Vitest config for @rozie-ui/select.
//
// tests/surface.test.ts is the Select.rozie compile()/lowerToIR surface gate
// (the same contract scripts/compile-select-check.mjs checks). Pure @rozie/core,
// no DOM, so environment stays 'node'. `include` is a glob so new tests are
// collected without editing this file.
//
// testTimeout: 30000 — compile()x6 is a heavy module graph and can exceed the
// 5s default under parallel CPU starvation in full batteries.
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
