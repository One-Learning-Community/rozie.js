import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports the named components (`DataTable`, `Column`)
  // and a back-compat `default` (= DataTable). Opt into rolldown 'named' export
  // mode so the mix is unambiguous (the default lands on `exports.default` for
  // CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // @rozie-ui/popover-solid is a published-package runtime peerDependency (the
  // Option-A composition, quick 260713-iiy), NOT vendored source — it MUST stay
  // external so it is not inlined/duplicated into this leaf's bundle (an inlined
  // copy would defeat the peerDependency and double-load the primitive's own
  // module-scope state alongside any copy the consumer's app separately imports).
  external: ['solid-js', '@rozie/runtime-solid', '@rozie-ui/popover-solid', '@tanstack/table-core'],
});
