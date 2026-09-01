import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Combobox`) and its
  // `default`. Opt into rolldown 'named' export mode so the mix is unambiguous
  // (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // @rozie-ui/popover-react is a published-package runtime peerDependency (the
  // Option-A composition, Phase 86 D-01, mirroring data-table's Phase 75
  // precedent), NOT vendored source — it MUST stay external so it is not
  // inlined/duplicated into this leaf's bundle (an inlined copy would defeat
  // the peerDependency and double-load the primitive's own module-scope state
  // alongside any copy the consumer's app separately imports).
  external: ['react', 'react-dom', '@rozie/runtime-react', '@rozie-ui/popover-react', /\.css$/],
  // The generated component does a side-effect `import './Combobox.css'`; mark it
  // external and copy the file into dist so the relative specifier resolves at
  // the consumer's bundler.
  copy: [{ from: 'src/Combobox.css', to: 'dist', flatten: true }],
});
