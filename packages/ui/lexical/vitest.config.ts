// Vitest config for @rozie-ui/lexical.
//
// One test surface:
//   • tests/surface.test.ts — the GENERIC per-source gate: for every src/*.rozie
//     it re-asserts compile()×5 (react/vue/svelte/angular/solid) zero-error AND
//     the D-05/REQ-37 acceptance check — the emitted Svelte compiles clean under
//     the repo Svelte 5 compiler (no `dollar_prefix_invalid`). Same contract
//     scripts/compile-lexical-check.mjs checks, promoted so `turbo run test`
//     re-asserts it.
//
// environment: 'node' — this family's gate compiles sources through @rozie/core
// and the Svelte compiler; no DOM globals are needed (unlike the captcha
// behavioral test which mounts an emitted SFC under happy-dom).
//
// testTimeout: 30000 — compile()×5 over an editor wrapper is a heavy module
// graph; under `turbo run test` parallel CPU starvation can exceed vitest's 5s
// default and flake only in full batteries.
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
