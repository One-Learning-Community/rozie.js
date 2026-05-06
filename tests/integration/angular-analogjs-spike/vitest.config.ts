import { defineConfig } from 'vitest/config';

// Phase 5 Plan 05-03 OQ3 spike — vitest-only config, deliberately separate
// from `vite.config.ts`. The spike test (`spike.test.ts`) constructs its
// own programmatic Vite server (with analogjs() plugin) inside each test
// via `createServer({ configFile: false, plugins: [...] })`; we do NOT
// want vitest itself to bootstrap analogjs (which would try to compile
// `src/main.ts`'s `import 'synthetic.rozie.ts'` during dep-scan and fail).
//
// Therefore: zero Vite plugins at the vitest level; the spike test owns
// the Vite/analogjs lifecycle entirely.
export default defineConfig({
  test: {
    include: ['spike.test.ts'],
    // analogjs + Angular bootstrap is slow; first transformRequest can take
    // several seconds while @angular-devkit warms up esbuild + the Angular
    // compilation pipeline.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
