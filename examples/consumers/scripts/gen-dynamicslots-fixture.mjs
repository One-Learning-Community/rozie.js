#!/usr/bin/env node
/**
 * ONE-OFF generation script — Phase 79 Plan 12 Task 3.
 *
 * Compiles `./fixtures-src/DynamicSlots.rozie` (a SELF-OWNED source, see that
 * file's own header comment for why it is deliberately NOT
 * `tests/fixtures/pending-79/DynamicSlots.rozie` — a different plan's
 * fixture with exact-count assertions this task must not risk perturbing)
 * for all six targets and copies the compiled output into each
 * `examples/consumers/{target}-ts/fixtures/` directory.
 *
 * This script is intentionally NOT wired into `refresh-consumer-fixtures.mjs`
 * (whose `EXAMPLE_INPUTS` list is the FIVE existing reference examples,
 * Counter/SearchInput/Dropdown/TodoList/Modal) — adding a sixth input there
 * would regenerate every consumer-ts fixture and is a larger blast radius
 * than this plan's R6 proof needs. Run once; the generated fixture files are
 * committed like any other checked-in fixture.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuildMatrix } from '@rozie/cli';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const SRC_ROOT = resolve(HERE, 'fixtures-src');
const SRC_FILE = resolve(SRC_ROOT, 'DynamicSlots.rozie');

const TARGETS = /** @type {const} */ (['vue', 'react', 'svelte', 'angular', 'solid', 'lit']);

function pruneReactRuntimeArtifacts(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      pruneReactRuntimeArtifacts(full);
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.module.css') || entry.endsWith('.global.css')) {
      rmSync(full);
    }
  }
}

async function main() {
  for (const target of TARGETS) {
    const consumerDir = resolve(ROOT, `examples/consumers/${target}-ts`);
    if (!existsSync(consumerDir)) {
      process.stdout.write(`[gen-dynamicslots-fixture] skip ${target}: ${consumerDir} does not exist\n`);
      continue;
    }
    const fixturesDir = resolve(consumerDir, 'fixtures');
    const distDir = resolve(consumerDir, '_dist_dynamicslots');
    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });

    await runBuildMatrix(
      [SRC_FILE],
      {
        target: [target],
        out: distDir,
        types: true,
        sourceMap: false,
        root: SRC_ROOT,
      },
      { exit: 'throw' },
    );

    const flatSource = resolve(distDir, target);
    if (!existsSync(flatSource)) {
      throw new Error(`[gen-dynamicslots-fixture] ${target}: expected ${flatSource} to exist. Aborting.`);
    }
    mkdirSync(fixturesDir, { recursive: true });
    cpSync(flatSource, fixturesDir, { recursive: true });
    rmSync(distDir, { recursive: true, force: true });

    if (target === 'react') {
      pruneReactRuntimeArtifacts(fixturesDir);
    }
    process.stdout.write(`[gen-dynamicslots-fixture] ${target}: wrote DynamicSlots.* into ${fixturesDir}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + '\n');
  process.exitCode = 1;
});
