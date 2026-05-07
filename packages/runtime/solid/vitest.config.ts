// Vitest config for @rozie/runtime-solid.
// happy-dom env so DOM globals are available for createOutsideClick tests.
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/runtime-solid test`
// from repo root vs direct invocation in the package directory.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
});
