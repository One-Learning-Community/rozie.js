// Vitest config for @rozie-ui/switch.
//
// One test surface:
//   • tests/surface.test.ts — the Switch.rozie compile()/lowerToIR surface gate
//     (the same contract scripts/compile-switch-check.mjs checks), so a drift in
//     the 4-prop / 1-model / 1-emit / 1-slot / 2-expose surface or a new
//     compile() error fails the test gate under `turbo run test`, not just the
//     standalone script.
//
// The gate is pure @rozie/core (parse / lowerToIR / compile) — no DOM, no
// component mount — so the default node environment is enough.
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
    include: ['tests/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
