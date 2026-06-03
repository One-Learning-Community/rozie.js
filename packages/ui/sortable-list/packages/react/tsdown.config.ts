import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Phase 25: the generated component now does a side-effect `import
  // './SortableList.css'` (plain attribute-scoped CSS — CSS Modules dropped;
  // `[data-rozie-s-HASH]` is the sole isolation layer). tsdown's css-guard
  // refuses to process ANY `.css` import without the optional `@tsdown/css`
  // plugin (not a repo dep). Mark the relative CSS import EXTERNAL so tsdown
  // leaves the `./SortableList.css` specifier verbatim in the bundle, then
  // `copy` the CSS file into `dist/` so the relative import resolves at the
  // consumer's own bundler. The leaf also ships `src` in `files`, so the
  // source-side import resolves too.
  external: [
    'react',
    'react-dom',
    '@rozie/runtime-react',
    'sortablejs',
    /\.css$/,
  ],
  copy: [{ from: 'src/SortableList.css', to: 'dist', flatten: true }],
});
