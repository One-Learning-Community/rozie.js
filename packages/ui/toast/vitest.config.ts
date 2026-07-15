// Vitest config for @rozie-ui/toast.
//
// Test surfaces:
//   • tests/surface.test.ts — the Toaster.rozie compile()/lowerToIR surface gate
//     (the same contract scripts/compile-toast-check.mjs checks), so a drift in
//     the props/model/emits/slots/expose surface or a new compile() error fails
//     the test gate under `turbo run test`, not just the standalone script.
//   • tests/behavior/*.behavior.test.ts — mount-and-drive behavioral proof for
//     the timers/exit-lifecycle/patch+promise primitives, importing the
//     committed packages/vue/src/Toaster.vue leaf (the combobox
//     seed-query.behavior.test.ts precedent). Each opts into the `happy-dom`
//     DOM environment via a per-file `// @vitest-environment happy-dom`
//     docblock so the rest of the suite keeps the fast, DOM-less default.
//
// The default gate is pure @rozie/core (parse / lowerToIR / compile) — no DOM,
// no component mount — so `environment: 'node'` stays the suite default; the
// `vue()` plugin below only transforms the .vue import the behavioral tests
// pull in.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the captcha/cropper/otp analog).
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // vue() so tests/behavior/*.behavior.test.ts can import + mount the emitted
  // packages/vue/src/Toaster.vue leaf.
  plugins: [vue()],
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
