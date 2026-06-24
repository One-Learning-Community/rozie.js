import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Popover`) and its
  // `default`. Opt into rolldown 'named' export mode explicitly (silences
  // MIXED_EXPORTS; the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // The generated React component does a side-effect CSS import (`./Popover.css` —
  // the attribute-scoped component styles). tsdown's css-guard refuses to process
  // any `.css` import without the optional `@tsdown/css` plugin (not a repo dep), so
  // mark relative CSS imports EXTERNAL and `copy` the file into dist/ so the relative
  // import resolves at the consumer's own bundler. (Popover ships no `:root`
  // engine-DOM escape-hatch rules — Floating UI creates no DOM — so there is no
  // Popover.global.css.)
  external: ['react', 'react-dom', '@rozie/runtime-react', '@floating-ui/dom', /\.css$/],
  copy: [{ from: 'src/Popover.css', to: 'dist', flatten: true }],
});
