/**
 * svelte-detect.ts — Plan 05-02b Task 1 (mirrors react-detect.ts).
 *
 * Phase 5 Svelte path peer-dep detection. Per D-72-style pattern, we resolve
 * `@sveltejs/vite-plugin-svelte` and `svelte` from the consumer's cwd to
 * decide whether to fail-fast (ROZ600 / ROZ601) at factory-call time.
 *
 * Implementation note: `@sveltejs/vite-plugin-svelte` is ESM-only with
 * `exports` declaring only the `import` condition, which means
 * `createRequire().resolve()` cannot reach it (Node throws "No 'exports'
 * main defined" in CJS-resolution mode). We instead probe the
 * package-directory existence by walking the consumer's node_modules tree.
 * This is the standard approach for detecting ESM-only packages without
 * actually importing them.
 *
 * The walker also checks `.pnpm/node_modules/<pkg>` because pnpm's default
 * (non-shamefully-hoist) layout places transitive workspace devDeps there
 * rather than at the workspace-root `node_modules/<pkg>`. Without that
 * fallback, monorepo-internal probes from `packages/unplugin/src/...`
 * would never find packages that are only declared as `@sveltejs/vite-plugin-svelte`
 * in `examples/consumers/svelte-vite/package.json`.
 *
 * Per RESEARCH.md (Phase 5 standard stack): the consumer is expected to have
 * `@sveltejs/vite-plugin-svelte ^5.1.1` (peer of vite ^6) and `svelte ^5.0.0`
 * installed. Both are resolvable in our monorepo via `examples/consumers/svelte-vite`.
 *
 * @experimental — shape may change before v1.0
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, parse as pathParse } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Returns true when `@sveltejs/vite-plugin-svelte` is resolvable from `cwd`.
 *
 * Walks upward through `node_modules` directories from the cwd until either
 * the package's directory is found OR the filesystem root is reached. Also
 * checks `node_modules/.pnpm/node_modules/<pkg>` at each level — pnpm
 * places non-hoisted workspace devDeps there.
 */
export function detectSveltePlugin(cwd?: string): boolean {
  const startDir = cwd ?? defaultCwd();
  return canResolveDirectory(startDir, '@sveltejs/vite-plugin-svelte');
}

/**
 * `svelte` peer-dep resolution check (ROZ601).
 *
 * Even when `@sveltejs/vite-plugin-svelte` is installed, `svelte` itself
 * must be resolvable. Mirrors `canResolveReact()` for Plan 04-05.
 */
export function canResolveSvelte(cwd?: string): boolean {
  const startDir = cwd ?? defaultCwd();
  return canResolveDirectory(startDir, 'svelte');
}

function defaultCwd(): string {
  // Resolve from this file's location — so monorepo-internal probes work
  // when the function is called without an explicit cwd.
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Walk upward from `startDir` looking for `<pkg>` installed at any level.
 * At each `node_modules` it checks three layouts and returns true on the
 * first hit, false when the filesystem root is reached:
 *
 *   1. `node_modules/<pkg>` — direct dependency / npm-flat / hoisted.
 *   2. `node_modules/.pnpm/node_modules/<pkg>` — pnpm's legacy flat dir.
 *   3. `node_modules/.pnpm/<pkg>@<version>_<hash>/` — pnpm's versioned
 *      virtual store. pnpm v10 does NOT hoist a workspace package's devDeps
 *      into any walked `node_modules/`, but it always materializes every
 *      package under the workspace-root `.pnpm` store. Without this check a
 *      monorepo-internal probe (the no-`cwd` path) misses peer deps that
 *      are declared only in a consumer demo's `package.json`.
 */
function canResolveDirectory(startDir: string, pkgName: string): boolean {
  let dir = resolve(startDir);
  const root = pathParse(dir).root;
  // pnpm escapes the scope separator in its virtual store — a scoped
  // package `@scope/name` is materialized under `.pnpm/@scope+name@…/`.
  const pnpmStorePrefix = pkgName.replace(/\//g, '+') + '@';
  // Bound the loop generously to avoid pathological infinite loops on
  // unusual filesystems.
  for (let i = 0; i < 100; i++) {
    const nodeModules = resolve(dir, 'node_modules');
    if (existsSync(resolve(nodeModules, pkgName))) return true;
    if (existsSync(resolve(nodeModules, '.pnpm', 'node_modules', pkgName))) return true;
    try {
      for (const entry of readdirSync(resolve(nodeModules, '.pnpm'))) {
        if (entry.startsWith(pnpmStorePrefix)) return true;
      }
    } catch {
      // No `.pnpm` directory at this level — keep walking upward.
    }
    if (dir === root) return false;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  return false;
}
