/**
 * analogjs-detect.ts — Plan 05-04b Task 1.
 *
 * Phase 5 Angular path peer-dep detection. Per D-72, the Angular target
 * REQUIRES the consumer to install `@analogjs/vite-plugin-angular` explicitly
 * in their `vite.config.ts`. Rozie does NOT auto-detect or chain into it.
 * At factory-call time, `assertAngularPeerDeps` raises ROZ700 / ROZ701 / ROZ702
 * when one of three preconditions is missing:
 *
 *   - ROZ700 — `@analogjs/vite-plugin-angular` not resolvable from cwd (D-72)
 *   - ROZ701 — `@angular/core` not resolvable from cwd
 *   - ROZ702 — consumer's Vite version is < 6 (analogjs 2.5.x peerDeps require
 *     vite ^6 || ^7 || ^8 per RESEARCH OQ6 RESOLVED)
 *
 * Implementation note: `@analogjs/vite-plugin-angular` and `@angular/core`
 * BOTH ship modern `exports` maps that may not have `require` conditions
 * (ESM-only or ESM-preferred). Following the Plan 05-02b svelte-detect
 * directory-walk pattern, we probe `node_modules/<pkg>` (and the pnpm-flat
 * sibling `node_modules/.pnpm/node_modules/<pkg>`) instead of relying on
 * `createRequire().resolve()`. This works on Node 20+ and tolerates pnpm's
 * default non-shamefully-hoist layout.
 *
 * `detectViteMajor` reads the consumer's installed `vite/package.json`
 * directly via `createRequire().require('vite/package.json')` — `vite`
 * does declare a `package.json` export, so this is safe across all of
 * vite 5/6/7/8.
 *
 * @experimental — shape may change before v1.0
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve, parse as pathParse } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Returns true when `@analogjs/vite-plugin-angular` is resolvable from `cwd`.
 *
 * Walks upward through `node_modules` directories from the cwd until either
 * the package's directory is found OR the filesystem root is reached. Also
 * checks `node_modules/.pnpm/node_modules/<pkg>` at each level.
 */
export function detectAnalogjs(cwd?: string): boolean {
  const startDir = cwd ?? defaultCwd();
  return canResolveDirectory(startDir, '@analogjs/vite-plugin-angular');
}

/**
 * `@angular/core` peer-dep resolution check (ROZ701).
 *
 * Even when `@analogjs/vite-plugin-angular` is installed, `@angular/core`
 * itself must be resolvable. Mirrors `canResolveSvelte` for Plan 05-02b.
 */
export function canResolveAngularCore(cwd?: string): boolean {
  const startDir = cwd ?? defaultCwd();
  return canResolveDirectory(startDir, '@angular/core');
}

/**
 * Returns the major version of the consumer's installed `vite` package, or
 * `null` when vite is not resolvable.
 *
 * Used by `assertAngularPeerDeps` to raise ROZ702 when the consumer's vite
 * < 6 (analogjs 2.5.x peerDeps require vite ^6 || ^7 || ^8).
 *
 * `vite` ships a `./package.json` export so `require('vite/package.json')`
 * is safe across all current versions; we still wrap in try/catch for the
 * "vite not installed at all" case (returns null — caller decides whether
 * to treat as ROZ702 or as a separate diagnostic).
 */
export function detectViteMajor(cwd?: string): number | null {
  const startDir = cwd ?? defaultCwd();
  // Use createRequire scoped to a synthetic file inside the cwd so module
  // resolution starts from the consumer's tree.
  try {
    const requireFn = createRequire(resolve(startDir, '_synthetic.cjs'));
    const pkg = requireFn('vite/package.json') as { version?: string };
    if (typeof pkg.version !== 'string') return null;
    const firstSegment = pkg.version.split('.')[0];
    if (typeof firstSegment !== 'string') return null;
    const major = parseInt(firstSegment, 10);
    return Number.isFinite(major) ? major : null;
  } catch {
    return null;
  }
}

function defaultCwd(): string {
  // process.cwd() is the consumer project root during Vite/Rollup/CLI config
  // evaluation — that's where the consumer's @angular/core (etc.) lives in
  // pnpm setups (workspace-direct deps are not hoisted to the monorepo root).
  // Previously we used dirname(fileURLToPath(import.meta.url)), which walked
  // upward from this package's own dist/ — and never crossed into the
  // consumer workspace's node_modules. That worked accidentally when a
  // pnpm.overrides was hoisting @angular/* to repo-root node_modules; once
  // that override was removed (May 2026 Angular floor bump) the walk-up
  // missed the consumer's local install and assertAngularPeerDeps raised
  // a false-positive ROZ701. fileURLToPath(import.meta.url) is the fallback
  // for the (rare) call-from-Node-evaluation context where process.cwd() is
  // a synthetic path.
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    try {
      return process.cwd();
    } catch {
      // Fall through to import.meta.url fallback.
    }
  }
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Walk upward from `startDir` looking for `node_modules/<pkg>` (and its
 * pnpm-flat sibling `node_modules/.pnpm/node_modules/<pkg>`). Returns true
 * on first hit, false when the filesystem root is reached.
 */
function canResolveDirectory(startDir: string, pkgName: string): boolean {
  let dir = resolve(startDir);
  const root = pathParse(dir).root;
  for (let i = 0; i < 100; i++) {
    const direct = resolve(dir, 'node_modules', pkgName);
    if (existsSync(direct)) return true;
    const pnpmFlat = resolve(dir, 'node_modules', '.pnpm', 'node_modules', pkgName);
    if (existsSync(pnpmFlat)) return true;
    if (dir === root) return false;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  return false;
}
