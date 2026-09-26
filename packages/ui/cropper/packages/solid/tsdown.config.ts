import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
  // The generated barrel re-exports both the named component (`Cropper`) and its
  // `default`. Opt into rolldown 'named' export mode explicitly so that mix is
  // unambiguous (silences MIXED_EXPORTS; the default lands on `exports.default`
  // for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['solid-js', '@rozie/runtime-solid', 'cropperjs'],
}));
