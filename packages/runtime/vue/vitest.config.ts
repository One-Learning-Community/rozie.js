// Vitest config for @rozie/runtime-vue.
// happy-dom env per Wave 0 plan (D-46 fixture pattern + Phase 3 RESEARCH.md
// Wave 0 Gaps: runtime-vue uses happy-dom for DOM-side helper tests).
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/runtime-vue test`
// from repo root vs direct invocation in the package directory.
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
  },
});
