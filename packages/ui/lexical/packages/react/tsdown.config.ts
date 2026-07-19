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
  // the editor's command/node registry, T-76-05-DUP). Enumerate every peer the
  // emitted components + vendored bridge import, then keep the `/^@lexical\//`
  // and `/^react-dom\//` regex backstops so a missed subpackage cannot inline.
  external: [
    'react',
    'react-dom',
    /^react-dom\//,
    '@rozie/runtime-react',
    'lexical',
    '@lexical/rich-text',
    '@lexical/history',
    '@lexical/list',
    '@lexical/link',
    '@lexical/utils',
    /^@lexical\//,
    /\.css$/,
  ],
  // The generated components do side-effect `import './<Name>.css'` (+ the React-only
  // `:root` global escape hatch `import './LexicalEditor.global.css'`). Mark them
  // external (above) and copy the files into dist so the relative specifiers resolve
  // at the consumer's bundler.
  copy: [
    { from: 'src/LexicalEditor.css', to: 'dist', flatten: true },
    { from: 'src/LexicalEditor.global.css', to: 'dist', flatten: true },
    { from: 'src/Toolbar.css', to: 'dist', flatten: true },
  ],
});
