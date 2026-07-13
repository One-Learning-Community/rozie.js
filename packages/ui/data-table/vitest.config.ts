// Vitest config for @rozie-ui/data-table.
//
// Test surface: none at the family-meta level. The former D-04 vendored-Popover
// drift guard (tests/vendor-drift.test.ts) was retired when the composition
// graduated to Option A (published `@rozie-ui/popover-<target>` packages) — with
// no vendored copy there is nothing to guard. The family's real coverage lives at
// the repo level: dist-parity, the target-* snapshot suites, and Linux VR. So this
// suite is intentionally empty; `passWithNoTests` keeps the gate green.
//
// testTimeout: 30000 — matches command-palette's rationale (heavy module graph
// under `turbo run test` parallel CPU starvation).
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
    passWithNoTests: true,
  },
});
