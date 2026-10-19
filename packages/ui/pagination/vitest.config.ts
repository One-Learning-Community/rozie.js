// Vitest config for @rozie-ui/pagination.
//
// Two test surfaces:
//   • tests/surface.test.ts — the Pagination.rozie compile()/lowerToIR surface
//     gate (the same contract scripts/compile-pagination-check.mjs checks), so a
//     drift in the props / model / emits / slots / expose surface its EXPECT block
//     pins, or a new compile() error, fails the test gate under `turbo run test`,
//     not just the standalone script.
//   • tests/typed-events.test.ts — the compiled `change` payload type on every target.
//   • tests/sidecars.test.ts — the IDE sidecars (Vue web-types.json, Lit
//     custom-elements.json): version lockstep with the leaf, package.json wiring,
//     and component coverage.
//   • src/internal/paginationItems.test.ts — the pure page-item algorithm
//     (ellipsis / sibling / boundary edge cases with concrete expected arrays).
//     The `*.test.ts` is EXCLUDED from the leaf vendoring (codegen's
//     copyInternal filters it), so it runs only here.
//
// Both are pure (parse / lowerToIR / compile + a pure function) — no DOM, no
// component mount — so the default node environment is enough.
//
// testTimeout: 30000 — compile()×6 is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default and
// flake only in full batteries (the captcha/cropper analog).
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
