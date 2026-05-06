import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { syntheticResolver } from './src/synthetic-resolver-plugin';

// Phase 5 Plan 05-03 OQ3 spike — default config exists for `pnpm dev`/`build`
// hand-debugging. The spike test (spike.test.ts) ignores this file via
// `configFile: false` and constructs its own server with both default and
// reversed plugin orderings.
//
// Default config — synthetic resolver FIRST, analogjs SECOND.
export default defineConfig({
  plugins: [syntheticResolver(), angular()],
  build: {
    sourcemap: true,
  },
});
