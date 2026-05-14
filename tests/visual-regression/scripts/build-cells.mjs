/*
 * Phase 7 Plan 02 — visual-regression host build orchestrator.
 *
 * Vite can host only ONE `Rozie({ target })` per build. This script runs
 * `vite build` once per target (6 sub-builds), each with `ROZIE_TARGET` set, so
 * `vite.config.ts` wires the matching `Rozie({ target })` + framework plugin.
 * Each sub-build emits into `dist/<target>/` (its `build.outDir`).
 *
 * Finally it writes `dist/index.html` — the URL-query router that redirects
 * `?example=&target=` to the matching per-target entry HTML. `pnpm preview`
 * (vite.preview.config.ts) then serves the unified `dist/` on port 4180.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

for (const target of TARGETS) {
  process.stdout.write(`\n[visual-regression] building target: ${target}\n`);
  const result = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--config', 'vite.config.ts'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ROZIE_TARGET: target },
    },
  );
  if (result.status !== 0) {
    process.stderr.write(
      `\n[visual-regression] sub-build FAILED for target: ${target}\n`,
    );
    process.exit(result.status ?? 1);
  }
}

// Drop the dist-root router. host/index.html redirects ?target= to the matching
// per-target entry HTML, preserving the query string.
const distDir = resolve(ROOT, 'dist');
mkdirSync(distDir, { recursive: true });
copyFileSync(
  resolve(ROOT, 'host', 'index.html'),
  resolve(distDir, 'index.html'),
);

process.stdout.write(
  '\n[visual-regression] all 6 target sub-builds complete; dist/index.html router written\n',
);
