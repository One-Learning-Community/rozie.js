import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Tags`) and its
  // `default`. Opt into rolldown 'named' export mode so the mix is unambiguous
  // (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // The generated component does side-effect CSS imports (`./Tags.css` — the
  // attribute-scoped component styles — AND `./Tags.global.css` — the `:root`
  // OS-dark escape-hatch styles). Mark the relative CSS imports external and
  // copy both files into dist so the relative specifiers resolve at the
  // consumer's own bundler (mirrors rete's FlowCanvas config).
  external: ['react', 'react-dom', '@rozie/runtime-react', /\.css$/],
  copy: [
    { from: 'src/Tags.css', to: 'dist', flatten: true },
    { from: 'src/Tags.global.css', to: 'dist', flatten: true },
  ],
});
