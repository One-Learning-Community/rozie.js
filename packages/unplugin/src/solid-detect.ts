/**
 * solid-detect.ts — Phase 06.3-01 (D-139).
 *
 * Auto-detect whether the consumer has vite-plugin-solid and solid-js
 * installed. Mirrors react-detect.ts (createRequire pattern).
 *
 * Solid has only one official Vite plugin (vite-plugin-solid), so
 * detectSolidPlugin returns boolean (not a union like ReactPluginChoice).
 *
 * Implementation note: we use Node's `createRequire` to reach
 * `require.resolve` from this ESM module, scoped to a consumer cwd when
 * provided. The `paths: [cwd]` option restricts module resolution to the
 * consumer's `node_modules` tree.
 *
 * @experimental — shape may change before v1.0
 */

import { createRequire } from 'node:module';

function canResolve(requireFn: NodeJS.Require, pkg: string): boolean {
  try {
    requireFn.resolve(pkg);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if `vite-plugin-solid` is resolvable from `cwd`, false otherwise.
 *
 * @param cwd — consumer project root. When omitted, resolves from the current
 *   process's cwd (so test environments and CLI invocations behave naturally).
 */
export function detectSolidPlugin(cwd?: string): boolean {
  const requireFn = cwd
    ? createRequire(cwd.endsWith('/') ? cwd : cwd + '/')
    : createRequire(import.meta.url);
  return canResolve(requireFn, 'vite-plugin-solid');
}

/**
 * Returns true if `solid-js` is resolvable from `cwd`, false otherwise.
 *
 * Even when vite-plugin-solid is installed, `solid-js` itself must be
 * resolvable. This is technically a transitive dependency of vite-plugin-solid
 * but since `@rozie/unplugin` declares `solid-js` as an optional peer dep,
 * we want a precise diagnostic when the consumer hasn't installed it.
 */
export function canResolveSolidJs(cwd?: string): boolean {
  const requireFn = cwd
    ? createRequire(cwd.endsWith('/') ? cwd : cwd + '/')
    : createRequire(import.meta.url);
  return canResolve(requireFn, 'solid-js');
}
