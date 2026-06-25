// Vitest config for @rozie-ui/command-palette.
//
// Two test surfaces:
//   • tests/surface.test.ts — the CommandPalette.rozie compile()/lowerToIR
//     surface gate (the same contract scripts/compile-command-palette-check.mjs
//     checks), so a drift in the 8-prop / 2-model / 1-emit / 3-slot / 4-expose
//     surface or a new compile() error fails the gate under `turbo run test`.
//   • src/internal/filterCommands.test.ts — the pure query-filter helper.
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
    include: ['tests/**/*.test.ts', 'src/internal/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
