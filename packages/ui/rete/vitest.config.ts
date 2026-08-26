// Vitest config for @rozie-ui/rete.
//
// Two test surfaces:
//   • tests/**/*.test.ts — the SURFACE gate (tests/surface.test.ts), the
//     leaf structural gates (tests/arrange-layout.test.ts, tests/lazy-arrange.test.ts),
//     sidecars, and dark-palette-drift, run under `turbo run test` — re-asserting
//     the FlowCanvas.rozie compile()/lowerToIR surface (the same contract the
//     standalone scripts/compile-maplibre-check.mjs checks), so a drift in the
//     13-prop / 7-emit / 1-slot / 12-expose surface or a new compile() error
//     diagnostic fails the test gate, not just the manual script.
//   • src/**/*.test.ts — the package now carries a hand-written TS source under
//     src/internal/ (arrangeGeometry.ts, 260826-h7k), tested by an ordinary
//     co-located vitest matching the @rozie-ui/date-picker src/internal/ pattern.
//     WITHOUT this glob the file is silently never collected — `pnpm test`'s
//     `--passWithNoTests` exits GREEN on zero collected tests, not an error.
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
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    root: __dirname,
    testTimeout: 30000,
  },
});
