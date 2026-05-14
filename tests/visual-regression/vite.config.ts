import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import Rozie from '@rozie/unplugin/vite';

/**
 * Phase 7 Plan 02 — visual-regression host (D-09).
 *
 * Per RESEARCH Open Question 2 (RESOLVED): the host is a thin mount shell, NOT
 * a 6-way Vite config. Vite can only host ONE `Rozie({ target })` per build, so
 * each target is built independently by `scripts/build-cells.mjs`, which invokes
 * `vite build` once per target with the `ROZIE_TARGET` env var set. Every
 * per-target sub-build writes into the SAME `dist/<target>/` subtree (with
 * `emptyOutDir: false` so siblings survive); the build script then drops the
 * `dist/index.html` host router. `pnpm preview` serves the unified `dist/` so
 * every (example × target) cell is reachable under one origin on port 4180.
 *
 * The Rozie() plugin is wired BEFORE the framework plugin per D-25/D-58 ordering.
 */

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

const TARGET = (process.env.ROZIE_TARGET ?? 'vue') as Target;

async function frameworkPlugins(target: Target) {
  switch (target) {
    case 'vue': {
      const { default: vue } = await import('@vitejs/plugin-vue');
      return [
        vue({
          template: {
            compilerOptions: {
              isCustomElement: (tag: string) => tag.startsWith('rozie-'),
            },
          },
        }),
      ];
    }
    case 'react': {
      const { default: react } = await import('@vitejs/plugin-react');
      return [react()];
    }
    case 'svelte': {
      const { svelte } = await import('@sveltejs/vite-plugin-svelte');
      return [svelte()];
    }
    case 'solid': {
      const { default: solid } = await import('vite-plugin-solid');
      return [solid()];
    }
    case 'angular': {
      const { default: angular } = await import('@analogjs/vite-plugin-angular');
      return [angular()];
    }
    case 'lit':
      // Lit has no host Vite plugin — components are plain ES modules.
      return [];
    default:
      return [];
  }
}

export default defineConfig(async () => ({
  // Sub-builds are served from dist/<target>/; the host router lives at dist root.
  base: `/${TARGET}/`,
  plugins: [Rozie({ target: TARGET }), ...(await frameworkPlugins(TARGET))],
  build: {
    outDir: resolve(__dirname, 'dist', TARGET),
    // Each target build must NOT wipe sibling target builds.
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'host', `entry.${TARGET}.html`),
    },
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
}));
