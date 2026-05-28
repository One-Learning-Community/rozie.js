// Bundle the VSCode extension client to a single CJS file. `vscode` is provided
// by the host at runtime and must stay external; everything else (the language
// client) is inlined so the packaged extension carries no node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
});
