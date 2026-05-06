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

import { existsSync } from 'node:fs';
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
 * Walk upward from `startDir` looking for `node_modules/<pkg>` (and its
 * pnpm-flat sibling `node_modules/.pnpm/node_modules/<pkg>`). Returns true
 * on first hit, false when the filesystem root is reached.
 */
function canResolveDirectory(startDir: string, pkgName: string): boolean {
  let dir = resolve(startDir);
  const root = pathParse(dir).root;
  // Bound the loop generously to avoid pathological infinite loops on
  // unusual filesystems.
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
