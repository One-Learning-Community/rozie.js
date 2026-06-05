import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`SortableList`/
  // `Flatpickr`) and its `default`. Opt into rolldown 'named' export mode
  // explicitly so that mix is unambiguous (silences MIXED_EXPORTS; the default
  // lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // Phase 25: the generated component now does a side-effect `import
  // './Flatpickr.css'` (plain attribute-scoped CSS — CSS Modules dropped;
  // `[data-rozie-s-HASH]` is the sole isolation layer). tsdown's css-guard
  // refuses to process ANY `.css` import without the optional `@tsdown/css`
  // plugin (not a repo dep). Mark the relative CSS import EXTERNAL so tsdown
  // leaves the `./Flatpickr.css` specifier verbatim in the bundle, then `copy`
  // the CSS file into `dist/` so the relative import resolves at the consumer's
  // own bundler. The leaf also ships `src` in `files`, so the source-side
  // import resolves.
  external: [
    'react',
    'react-dom',
    '@rozie/runtime-react',
    'flatpickr',
    /\.css$/,
  ],
  copy: [{ from: 'src/Flatpickr.css', to: 'dist', flatten: true }],
});
