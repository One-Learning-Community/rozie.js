// Vitest config for @rozie-ui/text-field.
//
// Test surfaces:
//   • tests/surface.test.ts — the TextField.rozie compile()/lowerToIR surface gate,
//     so a drift in the surface or a new compile() error fails `turbo run test`.
//   • tests/wiring.behavior.test.ts — the a11y wiring, model, events and autosize
//     behaviour, rendered on the leaves.
//   • tests/typed-events.test.ts and tests/sidecars.test.ts — the typed event
//     payloads, and the Vue web-types / Lit CEM sidecars.
//   • src/internal/*.test.ts — unit tests for the autosize measurement.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the captcha/cropper analog).
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // vue() so tests/*.behavior.test.ts can import + mount the emitted
  // packages/vue/src/TextField.vue leaf.
  plugins: [vue()],
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    root: __dirname,
    testTimeout: 30000,
  },
});
