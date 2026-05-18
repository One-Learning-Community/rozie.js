import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Map /preview/runtimes/<framework>.mjs in the iframe-served URL space to the
// matching workspace package's built dist. The compiled output of every
// non-trivial .rozie file imports from `@rozie/runtime-<framework>` (for
// model:true props, slot helpers, etc.) and the iframes need a URL to map
// those bare specifiers to from their importmaps.
const RUNTIME_FRAMEWORKS = ['react', 'solid', 'vue', 'lit'] as const;
function runtimeFile(name: string): string {
  return resolve(__dirname, `../../packages/runtime/${name}/dist/index.mjs`);
}

function roziePreviewRuntimes(): Plugin {
  const URL_PREFIX = '/preview/runtimes/';
  return {
    name: 'rozie-preview-runtimes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(URL_PREFIX)) return next();
        const match = req.url.slice(URL_PREFIX.length).match(/^([a-z]+)\.mjs(\?.*)?$/);
        if (!match) return next();
        const file = runtimeFile(match[1]);
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end(`# rozie runtime not built: ${match[1]} — run \`pnpm --filter @rozie/runtime-${match[1]} build\``);
          return;
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(file));
      });
    },
    // For production build, emit each runtime as a static asset under the same
    // URL the importmap expects.
    generateBundle() {
      for (const name of RUNTIME_FRAMEWORKS) {
        const file = runtimeFile(name);
        if (!existsSync(file)) continue;
        this.emitFile({
          type: 'asset',
          fileName: `preview/runtimes/${name}.mjs`,
          source: readFileSync(file),
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
