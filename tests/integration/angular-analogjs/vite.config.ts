import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import Rozie from '@rozie/unplugin/vite';
import { resolve } from 'node:path';

// Phase 5 success criterion #3 — analogjs CI integration. Builds the
// minimal "import Counter from examples/Counter.rozie" → renders →
// type-checks via Angular's strictTemplates. Plan 05-05 Task 2 wires
// the GitHub Actions matrix that runs
// `pnpm -F rozie-angular-analogjs-integration build` against Angular 17
// floor + 21 latest.
//
// Standard application build (HTML entry, not lib mode) so analogjs's
// AOT path actually runs Counter.rozie through Ivy compilation —
// proves Plan 05-03 SPIKE Path A holds in production wiring AND the
// Plan 05-04b D-70 disk-cache fallback (Rozie's enforce:'pre'
// configResolved hook prebuilds .rozie.ts files on disk so analogjs's
// fileEmitter walks them as part of the TS Program).
export default defineConfig({
  plugins: [Rozie({ target: 'angular' }), angular()],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
