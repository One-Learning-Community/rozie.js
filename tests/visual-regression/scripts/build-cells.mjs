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
import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
// Repo root for cross-tree disk-cache cleanup. Three levels up: scripts → rig
// → tests → repo.
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const EXAMPLES_DIR = resolve(REPO_ROOT, 'examples');
const REFERENCE_BASENAMES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Phase 07.2 Plan 06 — ModalConsumer dogfood + sibling WrapperModal.
  // Both get cross-tree Angular `.rozie.ts` artefacts emitted during the
  // Angular sub-build; both must be cleaned up after.
  'ModalConsumer',
  'WrapperModal',
  // Spike 003 — PortalList wrapper. PortalListDemo (in examples/demos/) is
  // loaded by the VR rig; both write Angular `.rozie.ts` cache artefacts
  // that the directory-glob cleanup below sweeps.
  'PortalList',
  // Chart.js wrapper (added 2026-05-19). LineChartDemo (in examples/demos/)
  // is loaded by the VR rig; both write Angular `.rozie.ts` cache artefacts
  // that the directory-glob cleanup below sweeps. There is a sibling
  // `examples/LineChart.ts` cross-rozie composition shim — gitignored and
  // regenerated each Angular sub-build — that the cleanup deletes too.
  'LineChart',
];

// Cross-tree disk-cache files emitted by the Angular sub-build into the
// shared `<repo>/examples/` directory:
//   - `<basename>.rozie.ts`: D-70 disk-cache (analogjs's TS Program input)
//   - `Counter.ts`/`CardHeader.ts`: cross-rozie composition shims emitted by
//     `writeCrossRozieShimsFor()` because Card.rozie composes them via
//     `<components>{ Counter, CardHeader }</components>`.
//
// These files MUST exist during the Angular sub-build. After it completes
// they MUST be removed — they share `examples/` with every other consumer
// demo (vue-vite, react-vite, etc.) and TypeScript's bundler-mode module
// resolution prefers `.ts` extensions over the `*.rozie` ambient shims those
// demos rely on. Leaving them on disk poisons the whole workspace's `pnpm
// typecheck` with "Cannot find module '@angular/core'" errors in non-Angular
// consumers (the .rozie.ts files contain Angular imports).
//
// The `.gitignore` already filters them; this cleanup is for local
// developer experience (so `pnpm typecheck` works after a visual-regression
// build) and CI hygiene (workspace typecheck steps in unrelated workflows
// don't trip on leftover artifacts from a prior visual-regression CI run
// on the same runner cache).
function cleanupCrossTreeAngularArtifacts() {
  // Glob `examples/*.rozie.ts` (Angular disk-cache artefacts) — keeps cleanup
  // in sync with new fixtures/demos automatically. Previously this was driven
  // by REFERENCE_BASENAMES alone, which missed transitively-walked components
  // like Table.rozie (composed by examples/demos/TableDemo.rozie). The walk
  // happens via `RozieOptions.prebuildExtraRoots: [examplesRoot]`, so any
  // .rozie file the Angular target reaches lands a sibling .rozie.ts here.
  try {
    for (const entry of readdirSync(EXAMPLES_DIR)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(EXAMPLES_DIR, entry), { force: true });
      }
    }
  } catch {
    // examples dir always exists in a checkout — defensive only
  }
  // Cross-rozie composition shims at examples/ root (referenced from the 8
  // reference components — Counter and CardHeader by Card/Modal compositions;
  // Dropdown by examples/demos/DropdownDemo's `../Dropdown.rozie` reference;
  // Table by examples/demos/TableDemo's `../Table.rozie` reference).
  rmSync(resolve(EXAMPLES_DIR, 'Counter.ts'), { force: true });
  rmSync(resolve(EXAMPLES_DIR, 'CardHeader.ts'), { force: true });
  rmSync(resolve(EXAMPLES_DIR, 'Dropdown.ts'), { force: true });
  rmSync(resolve(EXAMPLES_DIR, 'Table.ts'), { force: true });
  // Demo-folder cross-tree artifacts. The Angular sub-build walks
  // `examples/demos/` as part of `prebuildExtraRoots: [examplesRoot]` and
  // emits `<DemoName>.rozie.ts` alongside the source. Leftover files break
  // the lit/solid sub-builds the same way the top-level ones do (cross-tree
  // imports of @angular/* from emitted Angular sources).
  //
  // Glob all `*.rozie.ts` files in `examples/demos/` so the cleanup keeps up
  // with new demos automatically (D-07.3.2-05-B fix — previously this list
  // was hand-maintained and missed `TableDemo.rozie.ts`, which broke the lit
  // sub-build because the Angular-emitted file imports `@angular/core`).
  const DEMOS_DIR = resolve(EXAMPLES_DIR, 'demos');
  try {
    for (const entry of readdirSync(DEMOS_DIR)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(DEMOS_DIR, entry), { force: true });
      }
    }
  } catch {
    // demos dir may not exist in some checkouts — ignore
  }
}

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
  // Always clean Angular's cross-tree disk-cache leftovers between targets.
  // Before this hook, the Angular sub-build (which succeeds now per the
  // pnpm.packageExtensions analogjs patch) was leaving `.rozie.ts` and `.ts`
  // shim files in `<repo>/examples/`. The next target's vite build would then
  // glob those leftovers via `import.meta.glob('../../../examples/*.rozie')`
  // and fail to resolve `lit`/`solid-js`/etc. from the Angular-emitted files
  // (the Angular sources import `@angular/core`, not the next target's
  // runtime). Cleanup-between-targets isolates each sub-build.
  if (target === 'angular') {
    cleanupCrossTreeAngularArtifacts();
  }
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
    // Clean up cross-tree disk-cache artifacts on failure too — leftover
    // .rozie.ts files in <repo>/examples/ would break unrelated demos'
    // typechecks. The user has bigger problems if we got here, but at
    // least don't leave the workspace in a broken state.
    cleanupCrossTreeAngularArtifacts();
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

// Clean up cross-tree disk-cache artifacts the Angular sub-build dropped into
// the shared `<repo>/examples/` directory — see the function comment for why.
cleanupCrossTreeAngularArtifacts();

const built = TARGETS.length - failures.length;
process.stdout.write(
  `\n[visual-regression] ${built}/${TARGETS.length} target sub-builds complete` +
    (failures.length > 0
      ? ` (soft-failed: ${failures.join(', ')} — see deferred-items.md)`
      : '') +
    '; dist/index.html router written\n',
);
