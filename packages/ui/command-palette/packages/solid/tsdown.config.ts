import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
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
}));
