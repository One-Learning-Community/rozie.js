import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['solid-js', '@rozie/runtime-solid', '@floating-ui/dom'],
});
