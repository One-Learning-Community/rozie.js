import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
  // The generated barrel re-exports both the named component (`Select`) and
  // its `default`. Opt into rolldown 'named' export mode so the mix is
  // unambiguous (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // @rozie-ui/popover-solid is a published-package runtime peerDependency (the
  // Option-A composition, mirroring combobox/data-table) — NOT vendored source.
  // It MUST stay external: solid-js components must be JSX-compiled by the
  // CONSUMING app's own solid preset, so popover-solid's own dist ships
  // un-transformed JSX that rolldown cannot parse if bundled here (and inlining
  // would double-load the primitive's own module-scope state).
  external: ['solid-js', '@rozie/runtime-solid', '@rozie-ui/popover-solid'],
}));
