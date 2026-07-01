import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Map /preview/runtimes/<framework>.mjs in the iframe-served URL space to the
// matching workspace package's built dist. The compiled output of every
// non-trivial .rozie file imports from `@rozie/runtime-<framework>` (for
// model:true props, slot helpers, etc.) and the iframes need a URL to map
// those bare specifiers to from their importmaps.
// Per-target runtime bundles (one each for react/solid/vue/lit) plus
// `engine-helpers` — the framework-agnostic engine-wrapper helper bundle
// (introduced 260526-q7s; consumed by SortableList.rozie's useSortableJS).
// `svelte` is served too: svelte-emitted output imports `@rozie/runtime-svelte`
// (emitSvelte.ts), so the svelte iframe needs a URL to map that bare specifier
// to. `runtimeFile('svelte')` falls through to packages/runtime/svelte/dist.
// Angular is deliberately absent — emitAngular.ts inlines everything and asserts
// its output never imports `@rozie/runtime-angular`, so a served angular runtime
// would be dead weight.
const RUNTIME_FRAMEWORKS = ['react', 'solid', 'vue', 'lit', 'svelte', 'engine-helpers'] as const;
function runtimeFile(name: string): string {
  // KEEP-THE-URL (Phase 20-03, OQ1): the `engine-helpers` runtime package was
  // retired — its sole export (`useSortableJS`) is now colocated in the
  // `@rozie-ui/sortable-list` package source. The importmap key and the served
  // `/preview/runtimes/engine-helpers.mjs` URL stay stable; only the on-disk
  // file the URL maps to moves to the new helper location. SortableList.rozie's
  // emitted output still bundles a relative `./internal/useSortableJS` import,
  // so this URL is consumed only by the legacy importmap entry — pointing it at
  // the moved helper keeps the URL resolvable (no iframe 404).
  if (name === 'engine-helpers') {
    return resolve(
      __dirname,
      '../../packages/ui/sortable-list/src/internal/useSortableJS.ts',
    );
  }
  return resolve(__dirname, `../../packages/runtime/${name}/dist/index.mjs`);
}

// `@rozie/runtime-svelte` ships SOURCE (TypeScript, no dist) — every other
// runtime has a prebuilt `dist/index.mjs`, but the svelte package deliberately
// has a no-op build (consumers compile it with Svelte's own toolchain). The
// svelte iframe still needs an executable ESM to map `@rozie/runtime-svelte` to,
// so bundle its `src/index.ts` on the fly with esbuild (resolved via vite's own
// copy — no extra playground dep), leaving `svelte*` bare specifiers external so
// the iframe importmap resolves them. Cached after the first build.
let svelteRuntimeCache: Buffer | null = null;
function svelteRuntimeBytes(): Buffer {
  if (svelteRuntimeCache) return svelteRuntimeCache;
  const esbuildPath = require.resolve('esbuild', {
    paths: [require.resolve('vite/package.json')],
  });
  const esbuild = require(esbuildPath) as typeof import('esbuild');
  const result = esbuild.buildSync({
    entryPoints: [resolve(__dirname, '../../packages/runtime/svelte/src/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    external: ['svelte', 'svelte/*'],
  });
  svelteRuntimeCache = Buffer.from(result.outputFiles[0]!.contents);
  return svelteRuntimeCache;
}

// Load the served bytes for a runtime URL. Svelte is source-bundled; every
// other runtime is read from its prebuilt dist. Returns null when the dist is
// missing (unbuilt) so the caller can 404-with-hint.
function loadRuntimeBytes(name: string): Buffer | null {
  if (name === 'svelte') return svelteRuntimeBytes();
  const file = runtimeFile(name);
  if (!existsSync(file)) return null;
  return readFileSync(file);
}

function roziePreviewRuntimes(): Plugin {
  const URL_PREFIX = '/preview/runtimes/';
  return {
    name: 'rozie-preview-runtimes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(URL_PREFIX)) return next();
        const match = req.url.slice(URL_PREFIX.length).match(/^([a-z-]+)\.mjs(\?.*)?$/);
        if (!match) return next();
        const bytes = loadRuntimeBytes(match[1]);
        if (bytes === null) {
          res.statusCode = 404;
          res.end(`# rozie runtime not built: ${match[1]} — run \`pnpm --filter @rozie/runtime-${match[1]} build\``);
          return;
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(bytes);
      });
    },
    // For production build, emit each runtime as a static asset under the same
    // URL the importmap expects.
    generateBundle() {
      for (const name of RUNTIME_FRAMEWORKS) {
        const bytes = loadRuntimeBytes(name);
        if (bytes === null) continue;
        this.emitFile({
          type: 'asset',
          fileName: `preview/runtimes/${name}.mjs`,
          source: bytes,
        });
      }
    },
  };
}

// Mitigation strategy: main-thread compile with Vite resolve.alias shims for
// every Node-ism statically imported by the BUILT @rozie/core bundle AND its
// transitive deps (postcss uses bare `require('path')`/`require('fs')`/
// `require('url')` for source-map machinery).
//
// Two forms of each builtin must be aliased: the `node:*` prefixed form (used
// by @rozie/core's own dist after tsdown) AND the bare form (used by postcss's
// pre-bundled CJS). Build-time (rollup) was tree-shaking postcss's source-map
// branch so the build gate stayed green, but dev-time (esbuild deps optimizer)
// evaluates module top-levels eagerly — hence the bare-name destructures hit
// the browser and Vite externalized them with the "Module 'path' has been
// externalized" warning.
//
// Process polyfill: @babel/types reads `process.env.BABEL_TYPES_8_BREAKING` at
// module-load (see node_modules/@babel/types/lib/index.js + definitions/core.js)
// and postcss reads `process.env.NODE_ENV` / `process.env.LANG`. The runtime
// polyfill in index.html installs `globalThis.process` before any module loads,
// and the `define` block below substitutes the specific literal keys for
// dead-code elimination at transform time.
//
// `process.cwd()` inside @rozie/core's resolver is bypassed at the call site
// via `resolverRoot: '/'` in compile.ts — no define substitution needed there.
export default defineConfig({
  resolve: {
    alias: {
      // node:* form — used by @rozie/core's own dist
      'node:fs': resolve(__dirname, 'src/shims/node-fs.ts'),
      'node:path': resolve(__dirname, 'src/shims/node-path.ts'),
      'node:module': resolve(__dirname, 'src/shims/node-module.ts'),
      'node:url': resolve(__dirname, 'src/shims/node-url.ts'),
      // Bare form — used by postcss and other CJS deps that predate the
      // `node:` prefix convention
      fs: resolve(__dirname, 'src/shims/node-fs.ts'),
      path: resolve(__dirname, 'src/shims/node-path.ts'),
      module: resolve(__dirname, 'src/shims/node-module.ts'),
      url: resolve(__dirname, 'src/shims/node-url.ts'),
      // Userland resolver packages — enhanced-resolve is eagerly constructed
      // by ProducerResolver so it needs the ResolverFactory.createResolver()
      // shape, not an empty stub. get-tsconfig's createPathsMatcher/getTsconfig
      // returns are null-tolerant in @rozie/core, so empty-pkg stays fine.
      'enhanced-resolve': resolve(__dirname, 'src/shims/enhanced-resolve.ts'),
      'get-tsconfig': resolve(__dirname, 'src/shims/empty-pkg.ts'),
      // postcss uses `require('source-map-js')` for sourcemap I/O. Playground
      // disables source maps, but the destructured named bindings must resolve.
      'source-map-js': resolve(__dirname, 'src/shims/source-map-js.ts'),
    },
  },
  define: {
    // Literal substitution for the known process.env reads. Dynamic accesses
    // (`process.env[varName]`) fall through to the runtime polyfill in
    // index.html instead.
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.BABEL_TYPES_8_BREAKING': 'false',
    'process.env.LANG': JSON.stringify('en_US.UTF-8'),
  },
  optimizeDeps: {
    // Keep Vite from pre-bundling the workspace dep, which would re-resolve
    // through node_modules and miss the workspace:* symlink.
    exclude: ['@rozie/core'],
  },
  worker: {
    // Monaco workers want ES modules in modern Vite.
    format: 'es',
  },
  server: { port: 5180 },
  plugins: [roziePreviewRuntimes()],
});
