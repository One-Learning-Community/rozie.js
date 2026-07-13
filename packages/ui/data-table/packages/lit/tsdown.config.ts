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
  // @rozie-ui/popover-lit is a published-package runtime peerDependency (the
  // Option-A composition, quick 260713-iiy), NOT vendored source — it MUST stay
  // external. Inlining it would double-register the `rozie-popover` custom
  // element (a DOMException) the moment a consumer app also loads
  // @rozie-ui/popover-lit directly alongside data-table-lit.
  external: ['lit', '@lit/context', '@lit-labs/preact-signals', '@preact/signals-core', '@rozie/runtime-lit', '@rozie-ui/popover-lit', '@tanstack/table-core'],
});
