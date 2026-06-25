// Vitest config for @rozie/docs.
//
// One test surface: tests/comparison-surface.test.ts — the comparison-page
// staleness gate. For every `docs/components/<slug>-comparison.md` that maps to a
// shipped family package, it recomputes the family's compiled public surface
// (props / model props / emits / slots / $expose) over the @rozie/core IR and asserts
// the page's recorded `surface_hash:` marker still matches. A drift forces a human to
// re-read the hand-authored comparison prose (the Phase-62 date-picker regression).
//
// Pure (parse / lowerToIR over .rozie sources) — no DOM, no component mount — so the
// default node environment is enough.
//
// testTimeout: 30000 — lowering 27 families' full .rozie source sets under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and flake
// only in full batteries (the date-picker/otp analog).
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
