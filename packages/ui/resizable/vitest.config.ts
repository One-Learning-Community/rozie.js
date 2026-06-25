// Vitest config for @rozie-ui/resizable.
//
// Two test surfaces:
//   • tests/surface.test.ts — the Resizable.rozie compile()/lowerToIR surface
//     gate (the same contract scripts/compile-resizable-check.mjs checks).
//   • src/internal/resizeMath.test.ts — the pure clamp/percent math unit tests.
//
// The surface gate is pure @rozie/core; the math tests are pure functions — no
// DOM, no component mount — so the default node environment is enough.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
