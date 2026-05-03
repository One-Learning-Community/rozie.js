// Vitest config for @rozie/runtime-react.
// happy-dom env per Wave 0 plan (D-64 + Phase 4 RESEARCH.md Wave 0 Gaps:
// runtime-react uses happy-dom for hook tests via @testing-library/react).
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/runtime-react test`
// from repo root vs direct invocation in the package directory.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
});
