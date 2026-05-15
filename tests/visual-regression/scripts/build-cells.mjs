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

// Targets whose sub-build failure is treated as non-fatal. Empty after Quick
// task 260515-1y4: the cross-tree prebuild fix
// (`RozieOptions.prebuildExtraRoots`) makes the Angular sub-build
// self-sufficient — the disk-cache walker now reaches `<repo>/examples/`
// from `tests/visual-regression/`'s vite.config.ts. The Angular sub-build is
// hard-required.
//
// If a future upstream-tooling regression re-breaks the column, add 'angular'
// back here AND open a follow-up issue. Silent re-soft-failing is forbidden —
// the matrix should fail loudly so the regression is surfaced rather than
// papered over. The plumbing below is preserved for that contingency.
const SOFT_FAIL_TARGETS = new Set();

const failures = [];

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
    if (SOFT_FAIL_TARGETS.has(target)) {
      process.stderr.write(
        `\n[visual-regression] sub-build failed for target: ${target} ` +
          `(known out-of-scope upstream breakage — see deferred-items.md); continuing\n`,
      );
      failures.push(target);
      continue;
    }
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

const built = TARGETS.length - failures.length;
process.stdout.write(
  `\n[visual-regression] ${built}/${TARGETS.length} target sub-builds complete` +
    (failures.length > 0
      ? ` (soft-failed: ${failures.join(', ')} — see deferred-items.md)`
      : '') +
    '; dist/index.html router written\n',
);
