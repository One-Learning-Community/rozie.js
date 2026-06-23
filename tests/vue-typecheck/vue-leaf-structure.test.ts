/**
 * VUE-LEAF-STRUCTURE — Layer 1 structural guard (quick task 260623-jwh).
 *
 * Enforces that every @rozie-ui Vue leaf ships COMPILED dist (dist+source), never
 * source-only. This locks in run 260623-hsh, which converted the last 9 source-only
 * Vue leaves to dist+source. A future leaf that reverts to source-only fails this
 * gate with its name + the failed sub-check listed (threat T-jwh-01).
 *
 * For each `packages/ui/*\/packages/vue/package.json` it asserts ALL of:
 *   (a) exports['.'] resolves under `./dist/` — the `import` entry (or `default`
 *       when no `import`) starts with `./dist/`, NOT `./src/`. `types` starts with
 *       `./dist/` too.
 *   (b) scripts.build is a REAL build, NOT the source-only no-op sentinel
 *       (/echo|ships source|no build/i).
 *   (c) files array includes `'dist'`.
 *
 * All offending leaves are collected across the whole scan and surfaced in a SINGLE
 * expectation so a RED gate names every broken leaf (no fail-fast).
 *
 * Reads package.json only — no leaf dist required, so this runs fast + standalone.
 *
 * Uses node:fs readdir (fast-glob fallback) to avoid adding a dep to this package.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const UI_DIR = resolve(ROOT, 'packages/ui');

const SOURCE_ONLY_BUILD = /echo|ships source|no build/i;

interface LeafInfo {
  name: string;
  pkgPath: string;
  pkg: Record<string, unknown>;
}

/** Find every `packages/ui/<family>/packages/<target>/package.json`. */
function findTargetLeaves(target: string): LeafInfo[] {
  const leaves: LeafInfo[] = [];
  for (const family of readdirSync(UI_DIR, { withFileTypes: true })) {
    if (!family.isDirectory()) continue;
    const pkgPath = join(UI_DIR, family.name, 'packages', target, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    leaves.push({ name: (pkg.name as string) ?? family.name, pkgPath, pkg });
  }
  return leaves;
}

/**
 * Returns the list of failed sub-checks for one leaf (empty = clean).
 * dist-exports + real-build + files:['dist'].
 */
function structuralFailures(pkg: Record<string, unknown>): string[] {
  const failures: string[] = [];

  // (a) exports['.'] resolves under ./dist/
  const exports = pkg.exports as Record<string, unknown> | undefined;
  const dot = exports?.['.'] as Record<string, string> | string | undefined;
  if (!dot || typeof dot === 'string') {
    failures.push('(a) exports["."] missing or not an object');
  } else {
    const runtime = dot.import ?? dot.default;
    if (!runtime || !runtime.startsWith('./dist/')) {
      failures.push(`(a) exports["."].import/default does not start with ./dist/ (got ${runtime ?? 'undefined'})`);
    }
    if (!dot.types || !dot.types.startsWith('./dist/')) {
      failures.push(`(a) exports["."].types does not start with ./dist/ (got ${dot.types ?? 'undefined'})`);
    }
  }

  // (b) scripts.build is a real build, not the source-only no-op sentinel
  const scripts = pkg.scripts as Record<string, string> | undefined;
  const build = scripts?.build;
  if (!build) {
    failures.push('(b) scripts.build missing');
  } else if (SOURCE_ONLY_BUILD.test(build)) {
    failures.push(`(b) scripts.build matches source-only sentinel (got "${build}")`);
  }

  // (c) files includes 'dist'
  const files = pkg.files as string[] | undefined;
  if (!Array.isArray(files) || !files.includes('dist')) {
    failures.push(`(c) files does not include "dist" (got ${JSON.stringify(files)})`);
  }

  return failures;
}

describe('VUE-LEAF-STRUCTURE — no @rozie-ui Vue leaf is source-only (Layer 1)', () => {
  it('every packages/ui/*/packages/vue leaf ships compiled dist (dist+source)', () => {
    const vueLeaves = findTargetLeaves('vue');

    // Sanity: as of 260623-hsh there are 19 Vue leaves. If a family is added/removed
    // this count moves — that is expected; the assertion below is what matters.
    expect(vueLeaves.length).toBeGreaterThanOrEqual(19);

    const offenders: string[] = [];
    for (const leaf of vueLeaves) {
      const failures = structuralFailures(leaf.pkg);
      if (failures.length > 0) {
        offenders.push(`  - ${leaf.name}: ${failures.join('; ')}`);
      }
    }

    expect(
      offenders,
      `Source-only / mis-shaped Vue leaves found (must be dist+source):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // NON-VUE targets are flagged-but-NOT-enforced here. This run enforces vue ONLY.
  // TODO: a future task may promote these other targets to enforced once their
  // source-only conversions land. Current scan: none found (logged, never fails).
  it('reports non-vue source-only leaves (flagged, NOT enforced — known TODO)', () => {
    const otherTargets = ['react', 'svelte', 'solid', 'lit', 'angular'];
    const flagged: string[] = [];
    for (const target of otherTargets) {
      for (const leaf of findTargetLeaves(target)) {
        const failures = structuralFailures(leaf.pkg);
        if (failures.length > 0) {
          flagged.push(`  [${target}] ${leaf.name}: ${failures.join('; ')}`);
        }
      }
    }
    if (flagged.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[vue-leaf-structure] non-vue source-only leaves flagged (NOT enforced):\n${flagged.join('\n')}`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.log('[vue-leaf-structure] non-vue scan clean: no source-only leaves found.');
    }
    // Intentionally no assertion — vue is the only enforced target in this run.
    expect(true).toBe(true);
  });
});
