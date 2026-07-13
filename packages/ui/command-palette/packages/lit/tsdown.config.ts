import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`CommandPalette`) and its
  // `default`. Opt into rolldown 'named' export mode so the mix is unambiguous
  // (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // Phase 75 (D-11/D-12): @rozie-ui/combobox-lit is a published-package
  // runtime peerDependency (Task 3), NOT vendored source — it MUST stay
  // external. Inlining it would double-register the `rozie-combobox` custom
  // element (a DOMException) the moment a consumer app also loads
  // @rozie-ui/combobox-lit directly alongside command-palette-lit.
  external: [
    'lit',
    '@lit-labs/preact-signals',
    '@preact/signals-core',
    '@rozie/runtime-lit',
    '@rozie-ui/combobox-lit',
  ],
});
