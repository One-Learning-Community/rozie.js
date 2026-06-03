// tsdown bundler config for @rozie/babel-plugin.
// Per D-95 (Phase 6 OQ2 resolution): dual ESM+CJS + d.ts via Oxc isolated-decl.
//
// WR-03 — @rozie/core is imported via a RELATIVE path (../../core/src/...) from
// src and INLINED at bundle time, mirroring @rozie/cli and @rozie/unplugin. It
// is therefore NOT external: keeping it external resolved `compile()` to core's
// built dist/ at runtime (potentially stale), diverging from the live-source
// `compile()` the other three entrypoints (compile/unplugin/cli) inline — under
// which the Phase 23 dist-parity byte-equality contract could pass in CI yet
// drift in a real babel consumer build.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: [
    '@babel/core',
    '@babel/types',
    '@babel/helper-plugin-utils',
  ],
});
