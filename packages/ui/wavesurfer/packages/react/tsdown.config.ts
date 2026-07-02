import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Waveform`) and its
  // `default`. Opt into rolldown 'named' export mode explicitly so that mix is
  // unambiguous (silences MIXED_EXPORTS; the default lands on `exports.default`
  // for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // The generated React component does a side-effect CSS import
  // (`./Waveform.css` — the attribute-scoped component styles). tsdown's css-guard
  // refuses to process ANY `.css` import without the optional `@tsdown/css` plugin
  // (not a repo dep). Mark relative CSS imports EXTERNAL so tsdown leaves the
  // specifiers verbatim, then `copy` the CSS into `dist/` so the relative import
  // resolves at the consumer's own bundler. (Waveform ships no `:root` engine-DOM
  // escape-hatch rules, so there is no `Waveform.global.css` — unlike maplibre.)
  external: ['react', 'react-dom', '@rozie/runtime-react', /^wavesurfer\.js/, /\.css$/],
  copy: [{ from: 'src/Waveform.css', to: 'dist', flatten: true }],
});
