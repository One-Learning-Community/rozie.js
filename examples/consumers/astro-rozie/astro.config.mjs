// Astro + Rozie MULTI-TARGET ISLAND MATRIX.
//
// Goal: mount a single Rozie `Counter.rozie` as an interactive island across
// up to five of Rozie's six compile targets ON ONE PAGE, proving the
// cross-framework value proposition holds inside Astro's island architecture
// at RUNTIME (hydration), not just at build/tag-presence level.
//
// ── The target-selection problem (load-bearing) ──────────────────────────────
// `@rozie/unplugin`'s factory is TARGET-LOCKED PER INSTANCE: `Rozie({ target })`
// closure-captures the target and uses it for resolveId / load / the sidecar
// emit. Its resolveId is PATH-BLIND — it matches ANY bare `.rozie` import by
// extension only and rewrites it to a per-target synthetic id
// (react/solid → `.rozie.tsx`, vue → `.rozie.vue`, svelte → `.rozie.svelte`,
// angular/lit → `.rozie.ts`). The factory exposes NO include/exclude knob.
//
// So a single shared Vite plugin array cannot host five targets against ONE
// `.rozie` file: whichever Rozie instance's resolveId runs first captures
// EVERY `.rozie` import and rewrites it to its own target — the others never
// see it. Astro does NOT isolate per-renderer Vite pipelines either (all
// `@astrojs/*` integrations `updateConfig({ vite: { plugins } })` into ONE
// shared Vite config), so Mechanism A (per-renderer pipeline isolation) is not
// available. See README.md "Coverage matrix & mechanism".
//
// ── Mechanism B (CHOSEN): per-target subdir copies + path-scoped instances ───
// Each island framework gets its OWN copy of Counter.rozie under a distinct
// directory (src/components/{react,vue,svelte,solid}/Counter.rozie — all
// byte-identical), and each Rozie instance is wrapped so its hooks ONLY act on
// `.rozie` imports whose IMPORTER (or resolved synthetic id) lives under that
// instance's directory. The scoping comes from OUTSIDE the factory (Vite's
// resolveId `importer` argument) since the factory has no filter knob.
//
// Lit keeps the existing GLOBAL `Rozie({ target: 'lit' })` instance scoped to
// `src/components/` (the root copy) and ships via a client `<script>` import +
// native `<rozie-counter>` tag — NO `client:*` island directive.
//
// Angular is the documented coverage EXCEPTION: there is no first-party
// `@astrojs/angular` (only community `@analogjs/astro-angular`), so it is
// intentionally not wired here.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import RozieFactory from '@rozie/unplugin/vite';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import solid from '@astrojs/solid-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = resolve(__dirname, 'src/components');

/**
 * Wrap a `Rozie({ target })` Vite plugin so its `.rozie`-handling hooks ONLY
 * fire for files under `scopeDir`. This is how Mechanism B sidesteps the
 * path-blind resolveId: a `.rozie` imported from outside `scopeDir` falls
 * through (returns null) and is left for the correctly-scoped instance.
 *
 * resolveId is scoped by the IMPORTER's location (for bare `.rozie` imports)
 * and by the resolved synthetic id's location (for the pass-through synthetic
 * ids the plugin emits). load is scoped by the id it is asked to load. The
 * lifecycle hooks (buildStart / configResolved / handleHotUpdate / config) are
 * left intact — buildStart's sidecar walk and configResolved's root capture are
 * harmless per-target and idempotent (the sidecar emitter skips unchanged
 * files), and `config`'s dep-scan-skip applies to all `.rozie` regardless.
 */
function scopeRozie(plugin, scopeDir) {
  const scopedPrefix = scopeDir.endsWith('/') ? scopeDir : scopeDir + '/';
  const under = (p) => typeof p === 'string' && (p === scopeDir || p.startsWith(scopedPrefix));

  const origResolveId = plugin.resolveId;
  const origLoad = plugin.load;

  return {
    ...plugin,
    name: `${plugin.name}:scoped(${scopeDir.slice(componentsDir.length) || '/'})`,
    resolveId(id, importer, options) {
      if (typeof id !== 'string') return null;
      // Bare `.rozie` import → scope by the IMPORTER (the .astro/.tsx/etc.
      // island wrapper doing the import).
      if (id.endsWith('.rozie')) {
        const abs = id.startsWith('.') && importer ? resolve(dirname(importer), id) : id;
        if (!under(abs)) return null;
        return origResolveId.call(this, id, importer, options);
      }
      // Synthetic ids this plugin emits (`*.rozie.{tsx,vue,svelte,ts}` and the
      // React `*.rozie.module.css` / `*.rozie.global.css`) → scope by id path.
      if (id.includes('.rozie')) {
        if (!under(id)) return null;
        return origResolveId.call(this, id, importer, options);
      }
      // The React emit's `import styles from './Counter.module.css'` (and
      // `.global.css`) — these are NOT `.rozie` ids, but the React-scoped
      // instance must rewrite them to the synthetic `.rozie.module.css` form.
      // Scope by the IMPORTER (the emitted `.rozie.tsx` under scopeDir).
      if (id.endsWith('.module.css') || id.endsWith('.global.css')) {
        if (!under(importer)) return null;
        return origResolveId.call(this, id, importer, options);
      }
      // Extensionless cross-rozie composition is not used in this single-
      // component demo — let other plugins handle everything else.
      return null;
    },
    load(id, ...rest) {
      if (typeof id !== 'string' || !id.includes('.rozie')) return null;
      if (!under(id)) return null;
      return origLoad.call(this, id, ...rest);
    },
  };
}

const litRozie = RozieFactory({ target: 'lit' });
const reactRozie = scopeRozie(RozieFactory({ target: 'react' }), resolve(componentsDir, 'react'));
const vueRozie = scopeRozie(RozieFactory({ target: 'vue' }), resolve(componentsDir, 'vue'));
const svelteRozie = scopeRozie(RozieFactory({ target: 'svelte' }), resolve(componentsDir, 'svelte'));
const solidRozie = scopeRozie(RozieFactory({ target: 'solid' }), resolve(componentsDir, 'solid'));

// The Lit instance is scoped to the ROOT components dir but must NOT capture the
// per-target subdir copies (those belong to react/vue/svelte/solid). Scope it to
// the root copy specifically by excluding the target subdirs.
const litScoped = (() => {
  const subdirs = ['react', 'vue', 'svelte', 'solid'].map((t) => resolve(componentsDir, t) + '/');
  const isInSubdir = (p) => typeof p === 'string' && subdirs.some((d) => p.startsWith(d));
  const origResolveId = litRozie.resolveId;
  const origLoad = litRozie.load;
  return {
    ...litRozie,
    name: `${litRozie.name}:scoped(lit-root)`,
    resolveId(id, importer, options) {
      const isBareRozie = typeof id === 'string' && id.endsWith('.rozie');
      if (isBareRozie) {
        const abs = id.startsWith('.') && importer ? resolve(dirname(importer), id) : id;
        if (isInSubdir(abs)) return null;
      } else if (typeof id === 'string' && id.includes('.rozie')) {
        if (isInSubdir(id)) return null;
      }
      return origResolveId.call(this, id, importer, options);
    },
    load(id, ...rest) {
      if (typeof id === 'string' && isInSubdir(id)) return null;
      return origLoad.call(this, id, ...rest);
    },
  };
})();

export default defineConfig({
  integrations: [
    // React and Solid BOTH emit `.tsx`, so Astro cannot tell which JSX renderer
    // owns a given component without `include`/`exclude` scoping. Each target's
    // Counter copy lives in its own subdir, so scope each JSX renderer to its
    // directory. (Vue and Svelte are unambiguous — `.vue` / `.svelte`.)
    react({ include: ['**/components/react/**'] }),
    vue(),
    svelte(),
    solid({ include: ['**/components/solid/**'] }),
  ],
  vite: {
    plugins: [reactRozie, vueRozie, svelteRozie, solidRozie, litScoped],
    // The Lit target emits TS legacy decorators (`@customElement`,
    // `@property`). Astro's default esbuild transform does NOT transpile
    // decorators unless told to, so the raw `@customElement(...)` leaks into the
    // bundle and crashes the browser ("Invalid or unexpected token"). Enabling
    // experimentalDecorators here makes esbuild lower the decorators for the
    // `.rozie.ts` (Lit) virtual module — the same setting the lit-vite consumer
    // demo carries in its tsconfig. (No effect on the other targets' output.)
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  },
});
