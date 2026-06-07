import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/languages.ts'],
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
    'solid-js',
    '@rozie/runtime-solid',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/commands',
    '@codemirror/lang-javascript',
    '@codemirror/lang-sql',
    '@codemirror/lang-python',
    '@codemirror/lang-xml',
    '@codemirror/lang-yaml',
    '@codemirror/lang-markdown',
    '@codemirror/lang-json',
    '@codemirror/lang-vue',
    '@codemirror/lang-sass',
    '@codemirror/lang-css',
    '@codemirror/lang-html',
    '@codemirror/theme-one-dark',
  ],
});
