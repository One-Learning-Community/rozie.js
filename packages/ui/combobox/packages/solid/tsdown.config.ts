import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
  // The generated barrel re-exports both the named component (`Combobox`) and its
  // `default`. Opt into rolldown 'named' export mode so the mix is unambiguous
  // (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // @rozie-ui/popover-solid is a published-package runtime peerDependency (the
  // Option-A composition, Phase 86 D-01, mirroring data-table's Phase 75
  // precedent) — NOT vendored source. It MUST stay external: solid-js
  // components must be JSX-compiled by the CONSUMING app's own solid preset
  // (Solid's fine-grained reactivity depends on that), so popover-solid's own
  // dist ships un-transformed JSX that rolldown cannot parse if bundled here
  // (and inlining would double-load the primitive's own module-scope state
  // alongside any copy the consumer's app separately imports).
  external: ['solid-js', '@rozie/runtime-solid', '@rozie-ui/popover-solid'],
}));
