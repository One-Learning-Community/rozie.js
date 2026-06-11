// Vitest config for @rozie-ui/embla.
//
// The package has no TS sources (the .rozie is codegen-compiled into the
// per-framework leaves; those typecheck the emitted output). This config exists
// to run the SURFACE gate (tests/surface.test.ts) under `turbo run test` — it
// re-asserts the Carousel.rozie compile()/lowerToIR surface (the same contract the
// standalone scripts/compile-carousel-check.mjs checks), so a drift in the 16-prop
// / 1-model / 4-emit / 2-slot / 9-expose surface or a new compile() error
// diagnostic fails the test gate, not just the manual script.
//
// testTimeout: 30000 — compile()×6 over an engine wrapper is a heavy module
// graph; under `turbo run test` parallel CPU starvation can exceed vitest's 5s
// default and flake only in full batteries (passes standalone). A 30s ceiling is
// a load-tolerant FAILSAFE (the cropper/maplibre analog).
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
