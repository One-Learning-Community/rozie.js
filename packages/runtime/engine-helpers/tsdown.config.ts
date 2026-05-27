// tsdown bundler config for @rozie/runtime-engine-helpers.
// Mirrors the sibling runtime packages — dual ESM+CJS + .d.ts via Oxc isolated-decl.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['sortablejs'],
});
