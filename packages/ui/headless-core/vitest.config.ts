// Vitest config for @rozie-ui/headless-core (Phase 64 P0).
//
// One test surface:
//   • tests/surface.test.ts — the cross-package bare-specifier `.rzts` boundary
//     gate (the same contract scripts/compile-headless-core-check.mjs checks), so
//     a regression in cross-package resolve/inline/dissolve fails under
//     `turbo run test`, not just the standalone script.
//
// The gate is pure @rozie/core (compile) — no DOM, no component mount — so the
// default node environment is enough.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the combobox/otp analog).
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
