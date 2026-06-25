// Vitest config for @rozie-ui/date-picker.
//
// Two test surfaces:
//   • tests/surface.test.ts — the DatePicker.rozie compile()/lowerToIR surface
//     gate (the same contract scripts/compile-date-picker-check.mjs checks), so a
//     drift in the 7-prop / 1-model / 1-emit / 1-slot / 3-expose surface or a
//     new compile() error fails the test gate under `turbo run test`, not just
//     the standalone script.
//   • src/internal/buildMonthGrid.test.ts — the pure calendar-grid algorithm
//     (leading/trailing spill, weekStartsOn rotation, min/max/disabledDates
//     gating, UTC-safe arithmetic). The `*.test.ts` is EXCLUDED from the leaf
//     vendoring (codegen's copyInternal filters it), so it runs only here.
//
// Both are pure (parse / lowerToIR / compile + a pure function) — no DOM, no
// component mount — so the default node environment is enough.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the otp/pagination analog).
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
