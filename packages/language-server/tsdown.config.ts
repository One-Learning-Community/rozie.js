// tsdown bundler config for @rozie/language-server.
//
// Two entries: src/index.ts (the programmatic API — the diagnostics mapper +
// startServer, with .d.ts) and src/bin.ts (the shebang stdio entrypoint the
// editor clients spawn, consumed by package.json `bin`).
//
// `@rozie/core` and the vscode-languageserver libraries stay EXTERNAL: in the
// monorepo they resolve from node_modules (core's built dist, the LSP libs as
// installed deps). Bundling/inlining core for standalone distribution is a
// later concern — the first slice only needs a buildable, testable package.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm', 'cjs'],
  dts: { entry: ['src/index.ts'] },
  clean: true,
  external: [
    '@rozie/core',
    'vscode-languageserver',
    'vscode-languageserver/node',
    'vscode-languageserver-textdocument',
  ],
});
