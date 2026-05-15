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
  // Quick task 260515-1y4 — angular only: the Angular sub-build's
  // `import.meta.glob('../../../examples/*.rozie')` pulls files from OUTSIDE
  // the Vite project root (`tests/visual-regression/`). The Angular target's
  // D-70 disk-cache prebuild only walks DOWN from the project root, so
  // without `prebuildExtraRoots` the `<repo>/examples/*.rozie` files never
  // get prebuilt to `.rozie.ts` siblings — cross-rozie composition imports
  // (Card → CardHeader) then fail at Rollup bind time with "Could not
  // resolve './CardHeader' from 'examples/Card.rozie.ts'". Symlinking
  // examples/ into here is blocked by the T-05-04b-03 / WR-01 closure
  // (correct and must stay), so the explicit allowlist is the real fix.
  // Other targets do not need this option (their resolveId+load pipelines
  // consume upstream `code` directly without an on-disk TS Program).
  plugins: [
    Rozie({
      target: TARGET,
      ...(TARGET === 'angular'
        ? { prebuildExtraRoots: [resolve(__dirname, '..', '..', 'examples')] }
        : {}),
    }),
    ...(await frameworkPlugins(TARGET)),
  ],
  // D-VR-01: the `@rozie/target-lit` emitter emits TC39-stage-3 *class-field*
  // decorators (`@property() foo;`). esbuild — Vite's transform pipeline — does
  // not read the workspace `tsconfig.json` for the `.rozie.ts` virtual modules
  // `@rozie/unplugin` produces, so it defaulted to standard-decorator semantics
  // and the Lit/preact-signals runtime threw `Unsupported decorator location:
  // field` at class-construction time. Passing `tsconfigRaw` with
  // `experimentalDecorators` (and `useDefineForClassFields: false`) tells
  // esbuild to lower Lit's class-field decorators in the legacy form the Lit 3
  // decorator runtime accepts. Scoped to the Lit sub-build only — the other
  // five targets emit no class-field decorators.
  ...(TARGET === 'lit'
    ? {
        esbuild: {
          tsconfigRaw: {
            compilerOptions: {
              experimentalDecorators: true,
              useDefineForClassFields: false,
            },
          },
        },
      }
    : {}),
  build: {
    outDir: resolve(__dirname, 'dist', TARGET),
    // Each target build must NOT wipe sibling target builds.
    emptyOutDir: false,
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
