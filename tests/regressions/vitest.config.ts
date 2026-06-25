import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 7 Plan 05 — regressions vitest config.
 *
 * Compiler-layer fixtures (regressions.test.ts) run in node env (pure
 * compile() snapshot comparisons).
 *
 * Phase 07.3.2 Plan 04 SC#4 — also run React-mount regression tests
 * (`*.test.tsx`) in happy-dom env so we can mount compiled dist-parity
 * fixtures with @testing-library/react and assert rendered DOM. Vitest's
 * `environmentMatchGlobs` per-pattern env switch is the cleanest way to
 * keep the existing compile-snapshot tests in node and add browser-like
 * tests on top — no need to fork the package.
 *
 * Cross-package fixture resolution: the dist-parity fixtures
 * (`tests/dist-parity/fixtures/WrapperModal.tsx`) import
 * `@rozie/runtime-react` which is NOT in tests/dist-parity/node_modules.
 * Alias the import to the workspace package built artifact so Vite can
 * resolve it from any test file.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@rozie/runtime-react': resolve(
        __dirname,
        '..',
        '..',
        'packages',
        'runtime',
        'react',
        'dist',
        'index.mjs',
      ),
      // Phase 07.3.2 SC#4 — alias react/react-dom to the regressions
      // package's hoisted node_modules so dist-parity fixtures (which live
      // outside any react-dependent package) can resolve `react`,
      // `react/jsx-dev-runtime`, etc. when mounted by @testing-library/react.
      react: resolve(__dirname, 'node_modules', 'react'),
      'react-dom': resolve(__dirname, 'node_modules', 'react-dom'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'happy-dom'],
    ],
    include: [
      'regressions.test.ts',
      'runtime-side-effects.test.ts',
      'collision/**/*.test.ts',
      '**/*.test.tsx',
    ],
    testTimeout: 30000,
  },
});
