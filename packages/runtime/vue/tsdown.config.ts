// tsdown bundler config for @rozie/runtime-vue.
// Per D-95 (Phase 6 OQ2 resolution): dual ESM+CJS + d.ts via Oxc isolated-decl.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['vue'],
});
