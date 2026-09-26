// Vitest config for @rozie-ui/dialog.
//
// Two test surfaces:
//   • tests/surface.test.ts — the Dialog.rozie compile()/lowerToIR surface gate
//     (the same contract scripts/compile-dialog-check.mjs checks), so a drift in
//     the 6-prop / 1-model / 1-emit / 1-slot / 2-expose surface or a new
//     compile() error fails the test gate under `turbo run test`, not just the
//     standalone script.
//   • src/internal/scrollLock.test.ts — the ref-counted scroll-lock unit tests
//     (a duck-typed `document` stub, no real DOM needed).
//
// The gate is pure @rozie/core (parse / lowerToIR / compile) — no DOM, no
// component mount — so the default node environment is enough.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the captcha/cropper/otp analog).
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
