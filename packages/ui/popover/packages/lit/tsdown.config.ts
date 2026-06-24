import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['lit', '@lit-labs/preact-signals', '@preact/signals-core', '@rozie/runtime-lit', '@floating-ui/dom'],
});
