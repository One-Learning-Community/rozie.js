import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Phase 7 Plan 02 — preview-only config for the visual-regression host.
 *
 * The per-target sub-builds (see vite.config.ts) each write into `dist/<target>/`.
 * `scripts/build-cells.mjs` additionally drops `dist/index.html` (the URL-query
 * router). This config exists solely so `vite preview` serves the UNIFIED
 * `dist/` tree as the web root on the pinned port 4180 — Playwright's
 * `webServer` block points at it.
 */
export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
});
