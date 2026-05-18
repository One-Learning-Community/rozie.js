import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mitigation strategy: main-thread compile with Vite resolve.alias shims for
// every Node-ism statically imported by the BUILT @rozie/core bundle
// (`node:fs`, `node:path`, `node:module`, `enhanced-resolve`, `get-tsconfig`).
//
// Why aliases (not vite-plugin-node-polyfills, not a Web Worker):
//   - The playground compiles a single in-memory .rozie buffer with no
//     cross-file imports, so the resolver / tsconfig-walker code paths inside
//     @rozie/core are unreachable for our inputs. Throw-on-call shim bodies
//     give a loud surfaceable error if a future buffer ever does invoke them.
//   - The node:* imports are STATIC at the top of dist/index.mjs, so they
//     must be aliased at bundle-resolve time — a runtime guard cannot help;
//     Vite fails during bundling if the named imports do not resolve.
//   - process.cwd() is bypassed by passing `resolverRoot: '/'` explicitly at
//     compile call-site (see src/compile.ts) — no `define` substitution
//     needed, removes a fragile rewrite source.
//
// Alias coverage was determined by:
//   pnpm --filter @rozie/core build
//   grep -E "from [\"']node:" packages/core/dist/index.mjs
// Expected (and verified): exactly `node:module`, `node:fs`, `node:path`.
// If a future @rozie/core build adds a new node:* specifier, extend this map
// AND add a matching src/shims/* file.
export default defineConfig({
  resolve: {
    alias: {
      'node:fs': resolve(__dirname, 'src/shims/node-fs.ts'),
      'node:path': resolve(__dirname, 'src/shims/node-path.ts'),
      'node:module': resolve(__dirname, 'src/shims/node-module.ts'),
      'enhanced-resolve': resolve(__dirname, 'src/shims/empty-pkg.ts'),
      'get-tsconfig': resolve(__dirname, 'src/shims/empty-pkg.ts'),
    },
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
});
