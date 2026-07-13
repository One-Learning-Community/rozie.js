// Vitest config for @rozie-ui/combobox.
//
// Test surfaces:
//   • tests/surface.test.ts — the Combobox.rozie compile()/lowerToIR surface
//     gate (the same contract scripts/compile-combobox-check.mjs checks), so a
//     drift in the props/model/emits/slots/expose surface or a new compile()
//     error fails the test gate under `turbo run test`, not just the
//     standalone script.
//   • scripts/manifest-snapshot.test.mjs — the published-primitive manifest
//     round-trip anti-drift guard (Phase 75 Plan 03, D-03): re-derives
//     buildManifest(lowerToIR(Combobox.rozie)) and asserts it deep-equals the
//     committed __fixtures__/rozie-manifest.expected.json bytes.
//
// The gate is pure @rozie/core (parse / lowerToIR / compile / buildManifest)
// — no DOM, no component mount — so the default node environment is enough.
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
    include: ['tests/**/*.test.ts', 'scripts/**/*.test.mjs'],
    root: __dirname,
    testTimeout: 30000,
  },
});
