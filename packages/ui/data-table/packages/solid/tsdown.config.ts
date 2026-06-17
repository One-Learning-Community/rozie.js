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
  external: ['solid-js', '@rozie/runtime-solid', '@tanstack/table-core'],
});
