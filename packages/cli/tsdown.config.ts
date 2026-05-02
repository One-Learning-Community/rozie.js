// tsdown bundler config for @rozie/cli.
//
// Mirrors @rozie/unplugin's pattern: workspace TS-source siblings
// (@rozie/core, @rozie/target-vue) are imported via relative `../...` paths
// from src and INLINED at bundle time so the dist artefacts work without
// requiring those packages to have built dist/. True 3rd-party deps (commander,
// picocolors, @babel/code-frame, etc.) remain external — they're resolved at
// runtime from node_modules in the consumer install.
//
// Two entries: src/index.ts (the runCli API surface, with .d.ts) and
// src/bin.ts (the shebang wrapper consumed by package.json `bin`).
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm', 'cjs'],
  dts: { entry: ['src/index.ts'] },
  clean: true,
  // Keep these external — they're real npm deps consumers install separately.
  external: [
    'commander',
    'picocolors',
    '@babel/code-frame',
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    '@babel/generator',
    'magic-string',
    'postcss',
    'htmlparser2',
    '@vue/compiler-sfc',
    'source-map-js',
    // Node built-ins are auto-externalized by tsdown but listed for clarity.
    'node:fs',
    'node:path',
    'node:url',
  ],
});
