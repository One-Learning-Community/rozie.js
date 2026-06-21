// Vitest config for @rozie-ui/captcha.
//
// Two test surfaces:
//   • tests/surface.test.ts — the Captcha.rozie compile()/lowerToIR surface gate
//     (the contract scripts/compile-captcha-check.mjs also checks), so a drift in
//     the 7-prop / 3-emit / 0-slot / 3-expose surface or a new compile() error
//     fails the test gate, not just the manual script.
//   • src/internal/loadCaptchaApi.test.ts — the provider-loader unit tests
//     (inject-once singleton, poll, timeout, error). These need DOM globals
//     (document, Event), hence the happy-dom environment.
//
// testTimeout: 30000 — compile()×6 over an engine wrapper is a heavy module
// graph; under `turbo run test` parallel CPU starvation can exceed vitest's 5s
// default and flake only in full batteries (the cropper/maplibre analog).
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // plugin-vue so the behavioral test can import + mount the emitted Captcha.vue.
  plugins: [vue()],
  test: {
    globals: false,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
