import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`MapLibre`) and its
  // `default`. Opt into rolldown 'named' export mode explicitly so that mix is
  // unambiguous (silences MIXED_EXPORTS; the default lands on `exports.default`
  // for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // The generated React component does side-effect CSS imports
  // (`./MapLibre.css` — the attribute-scoped component styles — AND
  // `./MapLibre.global.css` — the `:root` engine-DOM escape-hatch styles).
  // tsdown's css-guard refuses to process ANY `.css` import without the optional
  // `@tsdown/css` plugin (not a repo dep). Mark the relative CSS imports EXTERNAL
  // so tsdown leaves the specifiers verbatim in the bundle, then `copy` the CSS
  // files into `dist/` so the relative imports resolve at the consumer's own
  // bundler. The leaf also ships `src` in `files`, so the source-side import
  // resolves.
  external: ['react', 'react-dom', '@rozie/runtime-react', 'maplibre-gl', /\.css$/],
  copy: [
    { from: 'src/MapLibre.css', to: 'dist', flatten: true },
    { from: 'src/MapLibre.global.css', to: 'dist', flatten: true },
  ],
});
