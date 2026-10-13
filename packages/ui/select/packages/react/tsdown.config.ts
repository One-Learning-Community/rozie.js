import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Select`) and
  // its `default`. Opt into rolldown 'named' export mode so the mix is
  // unambiguous (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // @rozie-ui/popover-react is a published-package runtime peerDependency (the
  // Option-A composition, mirroring combobox/data-table), NOT vendored source —
  // it MUST stay external so it is not inlined/duplicated into this leaf's bundle
  // (an inlined copy would defeat the peerDependency and double-load the
  // primitive's own module-scope state alongside any copy the consumer's app
  // separately imports).
  external: ['react', 'react-dom', '@rozie/runtime-react', '@rozie-ui/popover-react', /\.css$/],
  // The generated component does a side-effect `import './Select.css'`; mark
  // it external and copy the file into dist so the relative specifier resolves
  // at the consumer's bundler.
  copy: [{ from: 'src/Select.css', to: 'dist', flatten: true }],
});
