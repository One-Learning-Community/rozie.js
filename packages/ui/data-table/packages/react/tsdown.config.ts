import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named components (`DataTable`,
  // `Column`) and a back-compat `default` (= DataTable). Opt into rolldown
  // 'named' export mode so the mix is unambiguous (the default lands on
  // `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // The generated React DataTable does a side-effect `import './DataTable.css'`
  // (the attribute-scoped component styles). tsdown's css-guard refuses to
  // process any `.css` import without the optional `@tsdown/css` plugin (not a
  // repo dep). Mark the relative CSS imports EXTERNAL so tsdown leaves the
  // specifiers verbatim, then `copy` the file(s) into `dist/` so the relative
  // import resolves at the consumer's bundler. (The leaf also ships `src` in
  // `files`, so the source-side import resolves too.)
  external: ['react', 'react-dom', '@rozie/runtime-react', '@tanstack/table-core', /\.css$/],
  copy: [{ from: 'src/DataTable.css', to: 'dist', flatten: true }],
});
