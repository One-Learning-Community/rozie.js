// Vitest config for @rozie/target-angular.
// happy-dom env so behavioral tests (Plan 05-04) can mount compiled .ts
// standalone components. Snapshot tests drive the fixtures under
// packages/targets/angular/fixtures/{example}.ts.snap (D-46/D-69).
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/target-angular test`
// from repo root vs direct invocation in the package directory.
//
// Phase 5 Plan 05-01 Wave 0 — scaffolds. Plan 05-04 fills in real harness.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
    // Behavioral tests compile .rozie → Angular standalone components and mount
    // them with zone.js + @angular/compiler — a heavy module graph. Under
    // `turbo run test` parallel CPU starvation that work can exceed vitest's 5s
    // default and flake only in full batteries (passes standalone). A 30s
    // ceiling is a load-tolerant FAILSAFE, not an assertion.
    testTimeout: 30000,
  },
});
