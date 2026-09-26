import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['solid-js', '@rozie/runtime-solid', '@floating-ui/dom'],
}));
