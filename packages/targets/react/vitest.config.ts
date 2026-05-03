// Vitest config for @rozie/target-react.
// happy-dom env so behavioral tests (Plan 04-02 + 04-04) can mount compiled
// .tsx via @testing-library/react. Snapshot tests (Plans 04-02..04-06) drive
// the fixtures under packages/targets/react/fixtures/{example}.{tsx,module.css,
// global.css,jsx-skeleton}.snap (D-69).
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/target-react test`
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
