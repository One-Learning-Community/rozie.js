// Stage the standalone @rozie/language-server bundle AND the TypeScript
// library subset its tsdk self-resolution chain loads (Phase 85 Task 2,
// REQ-V16) into the extension's `server/` dir so the packaged .vsix ships a
// zero-config server with real type intelligence — mirrors the IntelliJ
// plugin's Gradle `bundleLanguageServer` task. TypeScript cannot be inlined
// into the single-file server bundle: it loads its own lib.*.d.ts declaration
// files through the filesystem, and packages/language-server/src/volar/tsdk.ts
// (step 3) expects a real `typescript/lib` directory sitting BESIDE the
// running server module. Rebuilds the bundle first so `pnpm package` always
// ships a current server. Run from the extension root.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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

// The subset the running server actually loads (REQ-V16): the TypeScript
// library entry point and the library declaration files — deliberately NOT
// the package's full published tree. `tsc.js`/`tsserver.js`/locale
// directories/`typescript.d.ts` are build/CLI/localization surface the
// language service never touches; the English diagnostic message table ships
// embedded in `typescript.js` itself, so no separate locale file is staged.
// This keeps the staged subset roughly half the size of the full
// `typescript/lib` (~11 MB vs ~22 MB at the pinned 5.6.3).
const typescriptLibSrc = resolve(
  repoRoot,
  'packages/language-server/node_modules/typescript/lib',
);
const typescriptLibDest = resolve(destDir, 'typescript', 'lib');
const STAGED_TYPESCRIPT_PATTERN = /^lib\..*\.d\.ts$/;

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

if (!existsSync(typescriptLibSrc)) {
  throw new Error(`[bundle-server] expected TypeScript lib dir missing: ${typescriptLibSrc}`);
}
mkdirSync(typescriptLibDest, { recursive: true });
let stagedCount = 0;
for (const name of readdirSync(typescriptLibSrc)) {
  if (name !== 'typescript.js' && !STAGED_TYPESCRIPT_PATTERN.test(name)) continue;
  copyFileSync(resolve(typescriptLibSrc, name), resolve(typescriptLibDest, name));
  stagedCount += 1;
}
if (stagedCount === 0) {
  throw new Error(`[bundle-server] staged zero TypeScript lib files from ${typescriptLibSrc}`);
}
console.log(`[bundle-server] staged ${stagedCount} TypeScript lib files → ${typescriptLibDest}`);
