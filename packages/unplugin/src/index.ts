/**
 * @rozie/unplugin — D-48 createUnplugin v3 factory.
 *
 * Path chosen by Plan 03-06 Wave 0 spike (Task 1): **path-virtual**. The
 * transform-only path (D-25 original) failed because `@vitejs/plugin-vue`'s
 * `transformInclude` defaults to `/\.vue$/` and rejects ids that don't end
 * in `.vue`. Our resolveId rewrites `Foo.rozie` to a synthetic
 * `<abs>/Foo.rozie.vue` id which vite-plugin-vue then picks up naturally
 * (without the `\0` virtual prefix — Vite's createFilter rejects `\0`-bearing
 * ids by default). See D-25 amendment in 03-CONTEXT.md.
 *
 * Plan 04-05 — React branch (D-58):
 *   - Suffix `.rozie.tsx` for the JSX shell (vite-plugin-react picks it up
 *     by extension).
 *   - Sibling `Foo.rozie.module.css` and `Foo.rozie.global.css` virtual ids
 *     for the styles produced by emitStyle (Vite's CSS-Modules pipeline
 *     hashes the `.module.css` form by extension — see 04-05-SPIKE.md
 *     Path 2).
 *   - `enforce: 'pre'` keeps @rozie/unplugin running BEFORE plugin-react /
 *     plugin-react-swc / plugin-vue (D-58 / D-25 plugin-chain ordering).
 *
 * Phase 3 ships the Vite entry only (D-48). `/rollup`, `/webpack`, `/esbuild`,
 * `/rolldown`, `/rspack` entries exist for symmetry but are not CI-tested
 * until Phase 6 (DIST distribution hardening).
 *
 * @experimental — shape may change before v1.0
 */

import { unlinkSync } from 'node:fs';
import { createUnplugin as createUnpluginV3 } from 'unplugin';
import { ModifierRegistry } from '@rozie/core';
import { registerBuiltins } from '../../core/src/modifiers/registerBuiltins.js';
import {
  validateOptions,
  assertReactPeerDeps,
  assertSveltePeerDeps,
  assertAngularPeerDeps,
  assertSolidPeerDeps,
  type RozieOptions,
} from './options.js';
import {
  createLoadHook,
  createResolveIdHook,
  emitRozieTsToDisk,
  prebuildAngularRozieFiles,
  transformIncludeRozie,
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

  // Plan 04-05: enforce React peer deps (ROZ500/ROZ501) at factory-call time
  // for `target: 'react'` only. Phase 3's `target: 'vue'` peer-dep checks
  // remain warn-only per Pitfall 8 (verify Vue setup is monorepo-friendly
  // first, then tighten to throws in Phase 7).
  if (options.target === 'react') {
    assertReactPeerDeps();
  }

  // Plan 05-02b: enforce Svelte peer deps (ROZ600/ROZ601) at factory-call
  // time for `target: 'svelte'`. Mirrors React above.
  if (options.target === 'svelte') {
    assertSveltePeerDeps();
  }

  // Plan 05-04b: enforce Angular peer deps (ROZ700/ROZ701/ROZ702) at
  // factory-call time for `target: 'angular'` (D-72). Per RESEARCH OQ6
  // RESOLVED, Vite >= 6 is required because @analogjs/vite-plugin-angular
  // 2.5.x peerDeps require vite ^6 || ^7 || ^8.
  if (options.target === 'angular') {
    assertAngularPeerDeps();
  }

  // Plan 06.3-01: enforce Solid peer deps (ROZ810/ROZ811) at factory-call
  // time for `target: 'solid'` (D-139). Mirrors React/Svelte above.
  if (options.target === 'solid') {
    assertSolidPeerDeps();
  }

  // Build a default modifier registry once per plugin instance — shared by
  // every transform call. ModifierRegistry is read-only after registerBuiltins.
  const registry = new ModifierRegistry();
  registerBuiltins(registry);

  const resolveId = createResolveIdHook(options.target);
  const load = createLoadHook(registry, options.target);

  // NOTE: we do NOT register a `transform` hook in the production plugin.
  // The path-virtual chain is resolveId → load (returns target source) →
  // downstream framework plugin. A `transform` hook here would double-fire
  // on the same id and re-run the already-compiled source through the parse
  // pipeline, producing spurious ROZ003 errors. Tests exercise
  // `createTransformHook` directly.
  return {
    name: 'rozie',
    enforce: 'pre',
    resolveId,
    load,
    transformInclude: transformIncludeRozie,
    // Vite-only: the dep-scan step (`vite:dep-scan`) runs esbuild ahead of
    // the regular plugin pipeline. esbuild calls our resolveId, gets back
    // `<abs>/Foo.rozie.{vue,tsx}`, and then tries to fs.readFile that
    // synthetic path — load never fires. Marking `.rozie` imports
    // `external: true` during the scan tells esbuild to skip loading; the
    // real transform pipeline still runs at request time when Vite serves
    // the module.
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
      // D-70 disk-cache: for the Angular target, eagerly emit each `.rozie`
      // → `.rozie.ts` to disk during `configResolved` so analogjs's TS
      // Program (constructed in its own `configResolved`, which fires AFTER
      // ours because Rozie has `enforce: 'pre'`) finds the files via the
      // standard `tsconfig.app.json` `include` patterns.
      //
      // Without this, analogjs's `fileEmitter` walks the TS Program for AOT
      // and synthetic non-filesystem `.rozie.ts` ids return empty content,
      // breaking consumer-side `import default from './Foo.rozie'` at
      // Rollup bind time.
      //
      // For non-Angular targets, this hook is a no-op — Vue/React/Svelte
      // plugins consume the upstream `code` via Vite's standard transform
      // chain and don't need the disk-cache.
      // biome-ignore lint/suspicious/noExplicitAny: Vite ResolvedConfig type varies by version
      configResolved(resolvedConfig: any) {
        if (options.target !== 'angular') return;
        const root = resolvedConfig?.root ?? process.cwd();
        // Quick task 260515-1y4 — pass through the consumer's optional
        // `prebuildExtraRoots` allowlist so the prebuild walker covers
        // filesystem trees outside the single Vite project root (e.g.
        // `tests/visual-regression/` needs to walk `<repo>/examples/`).
        prebuildAngularRozieFiles(root, registry, options.prebuildExtraRoots ?? []);
      },
      // When a .rozie file changes on disk, Vite's HMR lookup finds no module
      // graph entry for it (the graph entry is the synthetic .rozie.vue/.tsx id).
      // handleHotUpdate fires before Vite's own HMR path, so we can map the
      // real file back to its virtual module, invalidate it, and return it so
      // the downstream framework plugin (vite-plugin-vue / vite-plugin-react)
      // handles the actual HMR update.
      // biome-ignore lint/suspicious/noExplicitAny: Vite HMR context type varies by version
      handleHotUpdate({ file, server }: { file: string; server: any }) {
        if (!file.endsWith('.rozie')) return;
        // D-70 disk-cache HMR support: when a `.rozie` source file changes,
        // re-emit the sibling `.rozie.ts` on disk so analogjs's downstream
        // HMR machinery (which watches the .ts file) picks up the new
        // content. Vite's own chokidar will see the .rozie.ts write and
        // route HMR through analogjs's transform chain naturally.
        if (options.target === 'angular') {
          try {
            // Pass the union of (server root + consumer-supplied extra roots)
            // as the trust boundary — Quick task 260515-1y4 widens the HMR
            // re-emit allowlist to match configResolved so an HMR edit of a
            // .rozie file under an extra root re-emits cleanly without
            // tripping the WR-01/T-05-04b-03 outside-root refusal.
            const hmrRoot = server?.config?.root ?? process.cwd();
            const allowed = [hmrRoot, ...(options.prebuildExtraRoots ?? [])];
            emitRozieTsToDisk(file, registry, allowed);
          } catch (err) {
            // Surface as a warning rather than aborting HMR. Closes WR-02:
            // delete the stale .rozie.ts so Vite gets a module-not-found
            // error (surfaced in the browser overlay) rather than silently
            // serving stale compiled output. The next successful save will
            // re-write the file and restore normal operation.
            const msg = err instanceof Error ? err.message : String(err);
            // biome-ignore lint/suspicious/noConsole: HMR-time diagnostic
            console.warn(`[@rozie/unplugin] HMR re-emit failed for ${file}: ${msg}`);
            try { unlinkSync(file + '.ts'); } catch { /* already absent */ }
          }
        }
        let candidates: string[];
        if (options.target === 'vue') {
          candidates = [file + '.vue'];
        } else if (options.target === 'svelte') {
          candidates = [file + '.svelte'];
        } else if (options.target === 'angular') {
          // Plan 05-04b: single virtual id `.rozie.ts` per Path A (no sibling
          // CSS — Angular emits styles inline in the @Component decorator).
          candidates = [file + '.ts'];
        } else if (options.target === 'solid') {
          // Plan 06.3-01: single virtual id `.rozie.tsx` (no CSS sidecar —
          // Solid emits styles inline, Pitfall 3).
          candidates = [file + '.tsx'];
        } else {
          // react
          candidates = [file + '.tsx', file + '.module.css', file + '.global.css'];
        }
        // biome-ignore lint/suspicious/noExplicitAny: ModuleNode type from vite
        const mods: any[] = candidates
          .map((id: string) => server.moduleGraph.getModuleById(id))
          .filter(Boolean);
        if (mods.length === 0) return;

        // D-SH-03: `@vitejs/plugin-vue` and `@sveltejs/vite-plugin-svelte`
        // split a component's `<style>` into a SEPARATE style sub-module
        // (`...vue?type=style&index=0&lang.css`, `...svelte?type=style&lang.css`),
        // and Lit's shadow-DOM `<style>` is likewise a distinct asset. Those
        // sub-modules are children of the top-level virtual module in Vite's
        // module graph — invalidating only the top-level module left the
        // framework plugin serving STALE CSS, so a `<style>` edit never
        // hot-applied for vue / svelte / lit. Walk the top-level module's
        // imported modules and additively invalidate any style sub-module so
        // the framework plugin re-transforms the CSS on the next request.
        // (React already invalidates its `.module.css` / `.global.css`
        // sidecars via the `candidates` list above; Solid emits styles inline
        // in the component module, so the component-module HMR carries them.)
        if (
          options.target === 'vue' ||
          options.target === 'svelte' ||
          options.target === 'lit'
        ) {
          const styleMods = new Set<unknown>();
          const isStyleSubModule = (id: string): boolean =>
            id.includes('type=style') ||
            id.includes('lang.css') ||
            /[?&]vue&type=style/.test(id) ||
            /[?&]svelte&type=style/.test(id);
          for (const m of mods) {
            const imported: Iterable<{ id?: string | null }> =
              m.importedModules ?? [];
            for (const dep of imported) {
              if (dep?.id && isStyleSubModule(dep.id)) styleMods.add(dep);
            }
          }
          for (const sm of styleMods) {
            // biome-ignore lint/suspicious/noExplicitAny: ModuleNode from vite
            server.moduleGraph.invalidateModule(sm as any);
            mods.push(sm);
          }
        }

        mods.forEach((m: any) => server.moduleGraph.invalidateModule(m));
        return mods;
      },
    },
  };
});

// Per D-48 — Vite is the only CI-tested entry in Phase 3. Other targets are
// exported for symmetry (Phase 6 expands CI matrix).
export default unplugin;
