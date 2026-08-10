// Vitest config for @rozie-ui/codemirror.
//
// The package has no TS sources of its own (the .rozie is codegen-compiled into
// the per-framework leaves; those typecheck the emitted output). This config
// exists to run two surface gates under `turbo run test`:
//
//   - tests/surface.test.ts — re-asserts the CodeMirror.rozie compile()/lowerToIR
//     surface (10 props / zero emits / 12 expose verbs / 5 slots), so a drift in
//     the public surface or a new compile() error diagnostic fails the test gate,
//     not just a manual script.
//   - tests/sidecars.test.ts — the IDE-sidecar guard (D-05): pins the vue
//     web-types.json / lit custom-elements.json version to the sibling leaf
//     package.json version (the 4a095fdd stale-sidecar failure mode).
//
// testTimeout: 30000 per project_turbo_parallel_test_flake — compile()×6 over a
// large engine wrapper is a heavy module graph; under `turbo run test` parallel
// CPU starvation can exceed vitest's 5s default and flake only in full
// batteries (passes standalone). A 30s ceiling is a load-tolerant FAILSAFE.
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
