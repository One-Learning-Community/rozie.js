import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`CommandPalette`) and its
  // `default`. Opt into rolldown 'named' export mode so the mix is unambiguous
  // (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // Phase 75 (D-11/D-12): @rozie-ui/combobox-react is a published-package
  // runtime peerDependency (Task 3), NOT vendored source — it must stay
  // external so it is NOT inlined/duplicated into this leaf's bundle (an
  // inlined copy would defeat the peerDependency and, worse, double-load the
  // primitive's own module-scope state alongside any copy the consumer's app
  // separately imports).
  external: ['react', 'react-dom', '@rozie/runtime-react', '@rozie-ui/combobox-react', /\.css$/],
  // The generated component does a side-effect `import './CommandPalette.css'`; mark it
  // external and copy the file into dist so the relative specifier resolves at
  // the consumer's bundler.
  copy: [{ from: 'src/CommandPalette.css', to: 'dist', flatten: true }],
});
