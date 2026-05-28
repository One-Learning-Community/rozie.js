// Standalone bundle config for @rozie/language-server.
//
// Produces a SINGLE self-contained CJS (everything inlined except Node
// built-ins) that an editor host can spawn as `node server-standalone.cjs
// --stdio` without a node_modules tree. This is the artifact bundled into the
// IntelliJ plugin (and, later, the VSCode extension) so the server ships as one
// file. The default tsdown.config.ts build stays external-deps for in-repo /
// programmatic use; this one is purely for distribution.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { 'server-standalone': 'src/bin.ts' },
  outDir: 'dist-standalone',
  format: ['cjs'],
  dts: false,
  clean: true,
  // Inline EVERYTHING (@rozie/core + @babel/* + postcss + htmlparser2 + the
  // vscode-languageserver libs). Only Node built-ins stay external.
  noExternal: [/.*/],
});
