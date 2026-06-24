// Vitest config for @rozie-ui/popover.
//
// Two test surfaces:
//   • tests/surface.test.ts — the Popover.rozie compile()/lowerToIR surface gate
//     (the same contract scripts/compile-popover-check.mjs checks), so a drift in
//     the surface or a new compile() error fails the test gate under
//     `turbo run test`, not just the standalone script.
//   • src/internal/*.test.ts — unit tests for the branchy middleware builder.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the captcha/cropper analog).
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
