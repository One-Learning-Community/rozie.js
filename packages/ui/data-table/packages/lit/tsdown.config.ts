import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports the named components (`DataTable`, `Column`)
  // and a back-compat `default` (= DataTable). Opt into rolldown 'named' export
  // mode so the mix is unambiguous (the default lands on `exports.default` for
  // CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['lit', '@lit/context', '@lit-labs/preact-signals', '@preact/signals-core', '@rozie/runtime-lit', '@tanstack/table-core'],
});
