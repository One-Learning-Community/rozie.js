import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Pitfall 4 / Assumption A1: the generated component does
  // `import styles from './SortableList.module.css'`. tsdown's css-guard
  // refuses to process CSS-modules without the optional `@tsdown/css` plugin
  // (not a repo dep). Mark the relative CSS import EXTERNAL so tsdown leaves
  // the `./SortableList.module.css` specifier verbatim in the bundle, then
  // `copy` the CSS file into `dist/` so the relative import resolves at the
  // consumer's own bundler (which owns CSS-modules handling). The leaf also
  // ships `src` in `files`, so the source-side import resolves too.
  external: [
    'react',
    'react-dom',
    '@rozie/runtime-react',
    'sortablejs',
    /\.module\.css$/,
  ],
  copy: [{ from: 'src/SortableList.module.css', to: 'dist', flatten: true }],
});
