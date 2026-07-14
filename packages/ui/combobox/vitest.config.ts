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
//   • src/internal/groupOptions.test.ts — the pure group-partition helper
//     (combobox-native-groups) — mirrors command-palette's
//     src/internal/**/*.test.ts include.
//   • tests/seed-query.behavior.test.ts — mount-and-drive behavioral proof for
//     the `seedQuery` imperative handle verb, importing the committed
//     packages/vue/src/Combobox.vue leaf (the captcha
//     model-param-shadow.vue.test.ts precedent). Opts into the `happy-dom`
//     DOM environment via a per-file `// @vitest-environment happy-dom`
//     docblock so the rest of the suite keeps the fast, DOM-less default.
//
// The default gate is pure @rozie/core (parse / lowerToIR / compile /
// buildManifest) — no DOM, no component mount — so `environment: 'node'`
// stays the suite default; the `vue()` plugin below only transforms the one
// .vue import the behavioral test pulls in.
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
  // vue() so tests/seed-query.behavior.test.ts can import + mount the
  // emitted packages/vue/src/Combobox.vue leaf.
  plugins: [vue()],
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'scripts/**/*.test.mjs', 'src/internal/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
