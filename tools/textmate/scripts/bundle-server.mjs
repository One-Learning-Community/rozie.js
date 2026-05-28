// Stage the standalone @rozie/language-server bundle into the extension's
// `server/` dir so the packaged .vsix ships a zero-config server (mirrors the
// IntelliJ plugin's Gradle copy). Rebuilds the bundle first so `pnpm package`
// always ships a current server. Run from the extension root.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const bundle = resolve(
  repoRoot,
  'packages/language-server/dist-standalone/server-standalone.cjs',
);
const destDir = resolve(here, '..', 'server');
const dest = resolve(destDir, 'server-standalone.cjs');

console.log('[bundle-server] building @rozie/language-server standalone bundle…');
execFileSync('pnpm', ['--filter', '@rozie/language-server', 'build:standalone'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (!existsSync(bundle)) {
  throw new Error(`[bundle-server] expected bundle missing: ${bundle}`);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(bundle, dest);
console.log(`[bundle-server] staged → ${dest}`);
