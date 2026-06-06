import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`CodeMirror`)
  // and its `default`. Opt into rolldown 'named' export mode explicitly so that
  // mix is unambiguous (silences MIXED_EXPORTS; the default lands on
  // `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: [
    'lit',
    '@lit-labs/preact-signals',
    '@preact/signals-core',
    '@rozie/runtime-lit',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/commands',
    '@codemirror/lang-javascript',
    '@codemirror/theme-one-dark',
  ],
});
