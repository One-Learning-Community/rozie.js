// Vitest config for @rozie-ui/command-palette.
//
// Test surfaces:
//   • tests/surface.test.ts — the CommandPalette.rozie compile()/lowerToIR
//     surface gate (the same contract scripts/compile-command-palette-check.mjs
//     checks), so a drift in the 8-prop / 2-model / 1-emit / 3-slot / 4-expose
//     surface or a new compile() error fails the gate under `turbo run test`.
//   • src/internal/scoreCommands.test.ts — the pure fuzzy-ranking + highlight helper.
//   • tests/groupcap-actions.behavior.test.ts — mount-and-drive behavioral proof
//     for groupCap × per-row actions composition, importing the committed
//     packages/vue/src/CommandPalette.vue leaf (the combobox
//     group-cap.behavior.test.ts / seed-query.behavior.test.ts precedent). Opts
//     into the `happy-dom` DOM environment via a per-file
//     `// @vitest-environment happy-dom` docblock so the rest of the suite
//     keeps the fast, DOM-less node default; the `vue()` plugin below only
//     transforms the one `.vue` import that test pulls in.
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
  plugins: [vue()],
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/internal/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
