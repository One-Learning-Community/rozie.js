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
  // Phase 75 (D-11/D-12): @rozie-ui/combobox-solid is a published-package
  // runtime peerDependency (Task 3), NOT vendored source — keep it external
  // so it is not inlined/duplicated into this leaf's bundle.
  external: ['solid-js', '@rozie/runtime-solid', '@rozie-ui/combobox-solid'],
});
