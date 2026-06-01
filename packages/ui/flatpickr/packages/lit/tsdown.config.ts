import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: [
    'lit',
    '@lit-labs/preact-signals',
    '@preact/signals-core',
    '@rozie/runtime-lit',
    'flatpickr',
  ],
});
