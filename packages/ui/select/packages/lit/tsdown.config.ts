import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Select`) and
  // its `default`. Opt into rolldown 'named' export mode so the mix is
  // unambiguous (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // @rozie-ui/popover-lit is a published-package runtime peerDependency (the
  // Option-A composition, mirroring combobox/data-table) — NOT vendored source.
  // It MUST stay external: inlining it would double-register the `rozie-popover`
  // custom element (a DOMException) the moment a consumer app also loads
  // @rozie-ui/popover-lit directly alongside select-lit.
  external: ['lit', '@lit-labs/preact-signals', '@preact/signals-core', '@rozie/runtime-lit', '@rozie-ui/popover-lit'],
});
