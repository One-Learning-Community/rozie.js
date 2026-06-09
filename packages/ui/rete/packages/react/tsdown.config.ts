import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`FlowCanvas`) and
  // its `default`. Opt into rolldown 'named' export mode explicitly so that mix is
  // unambiguous (silences MIXED_EXPORTS; the default lands on `exports.default`
  // for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // The generated React component does side-effect CSS imports
  // (`./FlowCanvas.css` — the attribute-scoped component styles — AND
  // `./FlowCanvas.global.css` — the `:root` engine-DOM escape-hatch styles that
  // carry ALL the node/socket/connection chrome, since Rete ships no stylesheet).
  // tsdown's css-guard refuses to process ANY `.css` import without the optional
  // `@tsdown/css` plugin (not a repo dep). Mark the relative CSS imports EXTERNAL
  // so tsdown leaves the specifiers verbatim in the bundle, then `copy` the CSS
  // files into `dist/` so the relative imports resolve at the consumer's own
  // bundler. The leaf also ships `src` in `files`, so the source-side import
  // resolves.
  external: ['react', 'react-dom', '@rozie/runtime-react', 'rete', 'rete-area-plugin', 'rete-connection-plugin', 'rete-render-utils', /\.css$/],
  copy: [
    { from: 'src/FlowCanvas.css', to: 'dist', flatten: true },
    { from: 'src/FlowCanvas.global.css', to: 'dist', flatten: true },
  ],
});
