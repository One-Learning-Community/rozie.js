import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports the primary component (`LexicalEditor`) as both
  // `default` and named, plus the plugin/toolbar named exports — opt into rolldown
  // 'named' export mode so the mix is unambiguous.
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  // D-08 externals (the load-bearing guard against the vue-leaf external-drift class
  // — an omitted peer silently inlines a SECOND Lexical instance into dist, breaking
  // the editor's command/node registry, T-76-05-DUP). Solid inlines its component CSS
  // via `__rozieInjectStyle` (no sibling .css files), so no css external/copy is
  // needed. Enumerate every peer the emitted components + vendored bridge import
  // (incl. the `solid-js/web` render subpath), with `/^solid-js\//` + `/^@lexical\//`
  // regex backstops so a missed subpackage cannot inline.
  external: [
    'solid-js',
    /^solid-js\//,
    '@rozie/runtime-solid',
    'lexical',
    '@lexical/rich-text',
    '@lexical/history',
    '@lexical/list',
    '@lexical/link',
    '@lexical/utils',
    /^@lexical\//,
  ],
});
