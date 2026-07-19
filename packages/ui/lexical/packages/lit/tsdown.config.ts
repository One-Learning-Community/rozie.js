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
  // emitted LitElements + the vendored Lit bridge import — the Lit runtime
  // (`lit` + `lit/decorators.js`), the signal/context runtime (`@lit/context` +
  // `@lit-labs/preact-signals` + its `@preact/signals-core` peer), the Rozie Lit
  // runtime, and the Lexical engine — then keep the `/^@lexical\//` regex backstop so
  // a missed @lexical/* subpackage cannot silently inline. The emitted Lit output
  // inlines its component CSS via `static styles` and routes the `:root` global
  // escape hatch through `@rozie/runtime-lit` `injectGlobalStyles` (no sibling .css
  // files), so — unlike the react leaf — no css external/copy is needed.
  external: [
    'lit',
    'lit/decorators.js',
    '@lit/context',
    '@lit-labs/preact-signals',
    '@preact/signals-core',
    '@rozie/runtime-lit',
    'lexical',
    '@lexical/rich-text',
    '@lexical/history',
    '@lexical/list',
    '@lexical/link',
    '@lexical/utils',
    /^@lexical\//,
  ],
});
