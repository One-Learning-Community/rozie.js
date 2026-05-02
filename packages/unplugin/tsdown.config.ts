// tsdown bundler config for @rozie/unplugin.
//
// Per RESEARCH.md §"Pattern 10": dual ESM+CJS. Workspace siblings
// (@rozie/core, @rozie/target-vue) are INLINED (not externalized) because
// they're TS-only source-distributed packages — externalizing them would
// leave a `.ts` import that Node's loader cannot resolve. Inlining gives
// us a self-contained `dist/{vite,index,...}.{js,cjs}` that the demo's
// vite.config.ts can import via `@rozie/unplugin/vite` and Node loads
// natively.
//
// True 3rd-party deps remain external — peggy's generated.js (CJS in an
// ESM-typed package) is one of the workspace internals; inlining it
// requires careful esbuild handling (see comment below). The Plan 06
// approach: inline core including modifier-grammar, but rely on tsdown's
// rolldown bundler to handle the CJS-in-ESM gracefully (rolldown wraps
// CJS modules with `__commonJS()` shim).
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/vite.ts',
    'src/rollup.ts',
    'src/webpack.ts',
    'src/esbuild.ts',
    'src/rolldown.ts',
    'src/rspack.ts',
  ],
  format: ['esm', 'cjs'],
  dts: false, // consumers still get types from `main: ./src/index.ts` for in-IDE hints
  clean: true,
  // Externalize runtime-only third-party deps + the unplugin core itself.
  // Workspace TS-source siblings (@rozie/core / @rozie/target-vue / @rozie/runtime-vue)
  // are INLINED — see file-level comment.
  external: [
    'unplugin',
    '@vitejs/plugin-vue',
    'vue',
    'magic-string',
    'postcss',
    'htmlparser2',
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    '@babel/generator',
    '@babel/code-frame',
    'picocolors',
    '@vue/compiler-sfc',
    'source-map-js',
  ],
});
