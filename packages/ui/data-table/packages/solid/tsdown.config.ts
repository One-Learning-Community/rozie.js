import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
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
}));
