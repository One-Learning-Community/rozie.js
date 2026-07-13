// Vitest config for @rozie/core.
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot path
// resolution is stable across `pnpm --filter @rozie/core test` from repo root
// vs direct `pnpm test` from packages/core/.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Phase 75 Plan 01 — `src/manifest/*.test.ts` is colocated (no `__tests__/`
    // subdir), unlike the rest of the package's convention. `src/**/*.test.ts`
    // is a superset of `src/**/__tests__/*.test.ts` (kept for clarity/history).
    include: ['tests/**/*.test.ts', 'src/**/__tests__/*.test.ts', 'src/**/*.test.ts'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
  resolve: {
    alias: {
      '@rozie/core': resolve(__dirname, 'src/index.ts'),
    },
  },
});
