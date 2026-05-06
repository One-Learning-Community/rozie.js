import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import Rozie from '@rozie/unplugin/vite';
import { resolve } from 'node:path';

// Phase 5 success criterion #3 — analogjs CI integration. Builds the
// minimal "import Counter from examples/Counter.rozie" → renders →
// type-checks via Angular's strictTemplates. Plan 05-05 Task 2 wires
// the GitHub Actions matrix that runs `pnpm -F rozie-angular-analogjs-integration build`
// against Angular 17 floor + 21 latest.
export default defineConfig({
  plugins: [Rozie({ target: 'angular' }), angular()],
  resolve: {
    alias: {
      '@examples': resolve(__dirname, '../../../examples'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      formats: ['es'],
      fileName: 'integration',
    },
    sourcemap: true,
  },
});
