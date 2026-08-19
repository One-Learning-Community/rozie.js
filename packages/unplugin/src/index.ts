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
 *   - Sibling `Foo.rozie.css` (plain scoped CSS) and `Foo.rozie.global.css`
 *     virtual ids for the styles produced by emitStyle (Phase 25: plain
 *     attribute-scoped `.css`, NOT CSS Modules — isolation is the
 *     `[data-rozie-s-<hash>]` selector, not class hashing).
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
  invalidateSharedIRCache,
  prebuildAngularRozieFiles,
  transformIncludeRozie,
  walkRozieFiles,
} from './transform.js';
import { emitSidecar } from './emitSidecar.js';
import { readFileSync } from 'node:fs';

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
  // Phase 23 — thread the Angular CVA opt-out into the Vite-runtime load path.
  // `options.angular?.cva` is undefined when the consumer omits the namespace,
  // which exercises the emitter default-ON path byte-identically to compile().
  // Phase 26 (D-11) — also thread the GLOBAL safe-interpolation opt-out.
  // `options.safeInterpolation` is undefined when the consumer omits it, which
  // exercises the lowerer's default-ON path byte-identically to compile().
  const load = createLoadHook(
    registry,
    options.target,
    options.angular?.cva,
    options.safeInterpolation,
  );

  // Captured by the Vite adapter's configResolved (the only adapter with a
  // first-class project-root concept). The shared buildStart sidecar walk
  // prefers this over process.cwd() so its scope matches the consumer's actual
  // Vite project — NOT whatever directory the host process happens to run in.
  // Without this, a Vite consumer whose `root` differs from cwd (programmatic
  // createServer/build with `root: …`, monorepo tooling, test runners invoked
  // from the repo root) walks the WRONG tree: too narrow (missing sidecars) or
  // far too wide (littering a whole monorepo with this target's sidecars —
  // which, cross-target, type-lies to sibling projects and breaks Angular AOT).
  // Non-Vite adapters have no root concept; they keep the process.cwd()
  // convention.
  let viteResolvedRoot: string | null = null;

  // Phase 22 Plan 22-05 — `.d.rozie.ts` sidecar generation.
  //
  // Walk the project roots and emit a `<Name>.d.rozie.ts` sidecar next to each
  // `.rozie` source, dispatching by `options.target` to the matching
  // `emit<Target>Types` renderer (via emitSidecar). The trust boundary is the
  // union of (root + consumer `prebuildExtraRoots`), mirroring the Angular
  // disk-cache prebuild allowlist — a file discovered under any root may write
  // its sidecar inside that root.
  //
  // ANGULAR EXCEPTION: for `target: 'angular'` the walk DELETES sidecars
  // instead of writing them (emitSidecar heals + skips internally) — a
  // type-only `.d.rozie.ts` next to a `.rozie` source shadows the disk-cache
  // `.rozie.ts` in ngtsc's module resolution and silently kills AOT
  // ("JIT compiler unavailable"). See emitSidecar.ts ANGULAR EXCEPTION.
  //
  // This is wired to the SHARED `buildStart` hook (below) so Rollup/Webpack/
  // esbuild/Rolldown/Rspack adapters emit sidecars too — NOT a Vite-only API
  // (RESEARCH Anti-Pattern: "Vite-only API for generation"). `handleHotUpdate`
  // adds a Vite-only single-file refresh ON TOP of this primary path.
  const emitSidecarsForRoot = (root: string): void => {
    const allowedRoots = [root, ...(options.prebuildExtraRoots ?? [])];
    // WR-05: dedupe discovered paths across roots. When `prebuildExtraRoots`
    // overlaps the primary root (or roots nest), the same `.rozie` would
    // otherwise be discovered and re-rendered once per containing root — the
    // idempotent skip inside emitSidecar suppresses the redundant WRITE but not
    // the redundant read+render. Walk each unique root and emit each unique
    // path once per buildStart.
    const seen = new Set<string>();
    // WR-04: distinguish failure classes. A `renderSidecar` returning null is a
    // source-diagnostic bail (warn + skip — correct; the request-time transform
    // of that file surfaces a precise error). A THROWN error is a different
    // class — a renderer bug or a trust-boundary write refusal — which must NOT
    // be silently swallowed, or a systemic break stays invisible (combined with
    // WR-03's soft missing-sidecar note). Accumulate thrown failures and raise a
    // single aggregated error at the end so the build fails loudly.
    const failures: string[] = [];
    // Phase 54 negative route: `walkRozieFiles` yields ONLY `.rozie` files
    // (`entry.endsWith('.rozie')`), so a `.rzts`/`.rzjs` script partial is never
    // walked and never gets a `.d.rzts.ts` sidecar. This is load-bearing: a
    // type-only sidecar next to a partial would shadow nothing useful and (for
    // Angular) re-introduce the ngtsc `.d.rozie.ts` disk-cache-shadow trap
    // (D-01). Partials carry no standalone module surface — they vanish into the
    // host at lowerToIR — so there is nothing to type a sidecar against.
    for (const rootDir of allowedRoots) {
      for (const roziePath of walkRozieFiles(rootDir)) {
        if (seen.has(roziePath)) continue;
        seen.add(roziePath);
        try {
          const source = readFileSync(roziePath, 'utf8');
          emitSidecar(roziePath, source, options.target, allowedRoots);
        } catch (err) {
          // Renderer threw / write refused — a systemic failure class. Record
          // it; the aggregated throw below makes the whole build fail.
          const msg = err instanceof Error ? err.message : String(err);
          // biome-ignore lint/suspicious/noConsole: build-time diagnostic
          console.warn(`[@rozie/unplugin] sidecar emit failed for ${roziePath} → ${msg}`);
          failures.push(`${roziePath} → ${msg}`);
        }
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `[@rozie/unplugin] ${failures.length} sidecar(s) failed to generate (renderer threw / write refused):\n` +
          failures.map((f) => `  - ${f}`).join('\n'),
      );
    }
  };

  // Single-file sidecar refresh (Vite HMR optimization — see handleHotUpdate).
  const emitSidecarFor = (roziePath: string, root: string): void => {
    const allowedRoots = [root, ...(options.prebuildExtraRoots ?? [])];
    try {
      const source = readFileSync(roziePath, 'utf8');
      emitSidecar(roziePath, source, options.target, allowedRoots);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // biome-ignore lint/suspicious/noConsole: HMR-time diagnostic
      console.warn(`[@rozie/unplugin] sidecar HMR refresh failed for ${roziePath} → ${msg}`);
    }
  };

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
    // Phase 22 Plan 22-05 — SHARED hook (present across Vite/Rollup/Webpack/
    // esbuild/Rolldown/Rspack adapters). Generate `.d.rozie.ts` sidecars
    // BEFORE downstream tsc resolution. `enforce: 'pre'` already orders Rozie
    // ahead of the framework plugins; running the sidecar walk here means a
    // fresh checkout's first build writes all sidecars before the consumer's
    // tsc resolves any `.rozie` import (SPEC-R5/R6). The walk root is the Vite
    // resolved root when available (see viteResolvedRoot above), else the
    // process cwd (the bundler's invocation dir), unioned with the consumer's
    // optional `prebuildExtraRoots` allowlist.
    buildStart(): void {
      emitSidecarsForRoot(viteResolvedRoot ?? process.cwd());
    },
    // Vite-only: the dep-scan step (`vite:dep-scan`) runs esbuild ahead of
    // the regular plugin pipeline. esbuild calls our resolveId, gets back
    // `<abs>/Foo.rozie.{vue,tsx}`, and then tries to fs.readFile that
    // synthetic path — load never fires. Marking `.rozie` imports
    // `external: true` during the scan tells esbuild to skip loading; the
    // real transform pipeline still runs at request time when Vite serves
    // the module.
    vite: {
      // Bundler-aware dep-scan-skip. Vite 8 defaults to the Rolldown bundler,
      // which reads `optimizeDeps.rolldownOptions` and flags the legacy
      // `optimizeDeps.esbuildOptions` key `@deprecated Use rolldownOptions
      // instead` (a warning today, a hard error in a future Vite). Vite 5/6/7
      // only read `esbuildOptions`. So this is NOT a key rename — the two keys
      // carry DIFFERENT plugin shapes (esbuild `setup(build){ build.onResolve }`
      // vs Rolldown/Rollup `{ name, resolveId }`) and the correct branch must
      // be selected at runtime per host bundler.
      //
      // Detection is LAZY and INSIDE this hook on purpose. This `config` hook
      // only ever runs under Vite, so `vite` is guaranteed resolvable here —
      // but a STATIC top-level `import { rolldownVersion } from 'vite'` would
      // throw at ESM link time on Vite <=7 (where that binding is absent) and
      // on the Rollup/Webpack/esbuild hosts the unplugin core also loads under
      // (where `vite` may not be installed at all). `rolldownVersion` is the
      // canonical "this is rolldown-vite / Vite 8" marker: a named export of
      // `vite` in v8, undefined in <=7. Vite awaits async config hooks, so the
      // dynamic import is safe.
      config: async () => {
        let isRolldown = false;
        try {
          const viteMod = (await import('vite')) as { rolldownVersion?: string };
          isRolldown = Boolean(viteMod.rolldownVersion);
        } catch {
          // `vite` unresolvable / no rolldownVersion — treat as Vite <=7.
          isRolldown = false;
        }

        if (isRolldown) {
          // Vite 8 (Rolldown): rolldownOptions.plugins are ROLLDOWN/Rollup
          // plugins. Returning a `{ id, external: true }` from resolveId marks
          // the `.rozie` import external during the dep scan so the scanner
          // does not try to load the synthetic `<abs>/Foo.rozie.{vue,tsx}` id.
          return {
            optimizeDeps: {
              rolldownOptions: {
                plugins: [
                  {
                    name: 'rozie:dep-scan-skip',
                    resolveId(id: string) {
                      if (/\.rozie$/.test(id)) {
                        return { id, external: true };
                      }
                      return null;
                    },
                  },
                ],
              },
            },
          };
        }

        // Vite 5/6/7 (esbuild dep scan): only esbuildOptions is honored. KEEP
        // the esbuild plugin shape — a naive rename to rolldownOptions would be
        // silently ignored by these versions, re-opening the original
        // dep-scan-load failure.
        return {
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
        };
      },
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
        // Capture the Vite project root for ALL targets — the shared buildStart
        // sidecar walk scopes itself to this instead of process.cwd().
        viteResolvedRoot = resolvedConfig?.root ?? null;
        if (options.target !== 'angular') return;
        const root = resolvedConfig?.root ?? process.cwd();
        // Quick task 260515-1y4 — pass through the consumer's optional
        // `prebuildExtraRoots` allowlist so the prebuild walker covers
        // filesystem trees outside the single Vite project root (e.g.
        // `tests/visual-regression/` needs to walk `<repo>/examples/`).
        // Phase 23 — forward the CVA opt-out into the disk-prebuild leg so it
        // stays byte-identical to the Vite-runtime leg (Pitfall 2).
        prebuildAngularRozieFiles(root, registry, options.prebuildExtraRoots ?? [], options.angular?.cva);
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
        // Drop the changed file's cached producer IR (+ transitive consumers)
        // from the build-scoped shared IRCache so a `<components>` consumer
        // re-lowers the edited producer on its next load instead of serving a
        // stale cache hit. No-op when nothing has populated the cache yet.
        invalidateSharedIRCache(file);
        // Phase 22 Plan 22-05 — Vite-only sidecar refresh OPTIMIZATION on top
        // of the shared buildStart primary path: when a `.rozie` source changes
        // in dev, re-emit its `<Name>.d.rozie.ts` so the consumer's tsc/IDE
        // sees fresh types without a full rebuild. The idempotent skip inside
        // emitSidecar means an unchanged source is a no-op (no HMR loop).
        // (For target:'angular' this is a heal/no-op — see emitSidecar.ts
        // ANGULAR EXCEPTION.)
        {
          const hmrRoot = server?.config?.root ?? process.cwd();
          emitSidecarFor(file, hmrRoot);
        }
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
            // Phase 23 — HMR re-emit must honor the same CVA opt-out.
            emitRozieTsToDisk(file, registry, allowed, options.angular?.cva);
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
          // react — Phase 25: scoped CSS virtual id is plain `.rozie.css`
          // (VIRTUAL_SUFFIX_REACT_CSS), no longer `.rozie.module.css`. The HMR
          // invalidation candidate MUST match the registered virtual id or a
          // `<style>` edit silently fails to hot-reload in Vite dev.
          candidates = [file + '.tsx', file + '.css', file + '.global.css'];
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

        mods.forEach((m: any) => {
          server.moduleGraph.invalidateModule(m);
        });
        return mods;
      },
    },
  };
});

// Per D-48 — Vite is the only CI-tested entry in Phase 3. Other targets are
// exported for symmetry (Phase 6 expands CI matrix).
export default unplugin;
