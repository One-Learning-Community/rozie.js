// tsdown bundler config for @rozie/core.
// Per RESEARCH.md §"Pattern 10": dual ESM+CJS + d.ts via Oxc isolated-decl.
// Tsup ^8.5.1 is the documented one-line-config fallback (RESEARCH.md OQ-1 / D-03)
// if tsdown 0.x stability becomes an issue.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: [
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    '@babel/generator',
    '@babel/code-frame',
    'htmlparser2',
    'magic-string',
    'peggy',
    'postcss',
    'picocolors',
    '@vue/compiler-sfc',
    // Workspace siblings — inlined when they ship from src/, externalized
    // once they ship from dist/. Phase 6 Plan 06-01 ships dist/ for all
    // four target packages so we externalize them here to avoid bundling
    // their full code into @rozie/core's dist (which would defeat the
    // purpose of per-package emission and creates a tsdown build cycle
    // since target-vue depends on @rozie/core which would re-bundle target-vue).
    '@rozie/target-vue',
    '@rozie/target-react',
    '@rozie/target-svelte',
    '@rozie/target-angular',
  ],
});
