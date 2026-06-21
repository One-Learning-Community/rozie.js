import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports the named component AND its default; opt
  // into rolldown 'named' export mode so that mix is unambiguous.
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: [
    'lit',
    '@lit-labs/preact-signals',
    '@preact/signals-core',
    '@rozie/runtime-lit',
  ],
});
