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
    '@babel/code-frame',
    'htmlparser2',
    'peggy',
    'postcss',
    'picocolors',
  ],
});
