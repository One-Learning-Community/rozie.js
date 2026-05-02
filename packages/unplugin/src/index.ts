/**
 * @rozie/unplugin — D-48 createUnplugin v3 factory.
 *
 * Path chosen by Plan 06 Wave 0 spike (Task 1): **path-virtual**. The transform-only
 * path (D-25 original) failed because `@vitejs/plugin-vue`'s `transformInclude`
 * defaults to `/\.vue$/` and rejects ids that don't end in `.vue`. Our
 * resolveId rewrites `Foo.rozie` to a synthetic `<abs>/Foo.rozie.vue` id which
 * vite-plugin-vue then picks up naturally (without the `\0` virtual prefix —
 * Vite's createFilter rejects `\0`-bearing ids by default). See D-25 amendment
 * in 03-CONTEXT.md.
 *
 * Phase 3 ships the Vite entry only (D-48). `/rollup`, `/webpack`, `/esbuild`,
 * `/rolldown`, `/rspack` entries exist for symmetry but are not CI-tested
 * until Phase 6 (DIST distribution hardening).
 *
 * @experimental — shape may change before v1.0
 */

import { createUnplugin as createUnpluginV3 } from 'unplugin';
import { ModifierRegistry } from '../../core/src/modifiers/ModifierRegistry.js';
import { registerBuiltins } from '../../core/src/modifiers/registerBuiltins.js';
import { validateOptions, type RozieOptions } from './options.js';
import {
  createLoadHook,
  createResolveIdHook,
} from './transform.js';

export type { RozieOptions };
export { validateOptions } from './options.js';

/**
 * The createUnplugin v3 factory. Per D-48, exposes `.vite`, `.rollup`,
 * `.webpack`, `.esbuild`, `.rolldown`, `.rspack` getters; consumers import
 * via `@rozie/unplugin/vite` (or any of the others).
 */
export const unplugin = createUnpluginV3<Partial<RozieOptions>>((rawOptions) => {
  const options = validateOptions(rawOptions);

  // Build a default modifier registry once per plugin instance — shared by
  // every transform call. ModifierRegistry is read-only after registerBuiltins.
  const registry = new ModifierRegistry();
  registerBuiltins(registry);

  void options.target; // currently unused; kept for future per-target dispatch (D-48 / Phase 4-5)

  const resolveId = createResolveIdHook();
  const load = createLoadHook(registry);

  // NOTE: we do NOT register a `transform` hook in the production plugin.
  // The path-virtual chain is resolveId → load (returns .vue source) → vite-plugin-vue.
  // A `transform` hook here would double-fire on the same id and re-run the
  // already-compiled .vue source through the parse pipeline, producing
  // spurious ROZ003 errors. Tests exercise `createTransformHook` directly.
  return {
    name: 'rozie',
    enforce: 'pre',
    resolveId,
    load,
    // Vite-only: the dep-scan step (`vite:dep-scan`) runs esbuild ahead of
    // the regular plugin pipeline. esbuild calls our resolveId, gets back
    // `<abs>/Foo.rozie.vue`, and then tries to fs.readFile that synthetic
    // path — load never fires. Marking `.rozie` imports `external: true`
    // during the scan tells esbuild to skip loading; the real transform
    // pipeline still runs at request time when Vite serves the module.
    vite: {
      config: () => ({
        optimizeDeps: {
          esbuildOptions: {
            plugins: [
              {
                name: 'rozie:dep-scan-skip',
                setup(build: { onResolve: (opts: { filter: RegExp }, cb: (args: { path: string }) => { path: string; external: true }) => void }) {
                  build.onResolve({ filter: /\.rozie$/ }, (args) => ({
                    path: args.path,
                    external: true,
                  }));
                },
              },
            ],
          },
        },
      }),
    },
  };
});

// Per D-48 — Vite is the only CI-tested entry in Phase 3. Other targets are
// exported for symmetry (Phase 6 expands CI matrix).
export default unplugin;
