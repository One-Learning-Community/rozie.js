/**
 * react-detect.ts — Plan 04-05 Task 2 (D-59).
 *
 * Auto-detect which Vite React plugin the consumer has installed:
 *   - `@vitejs/plugin-react` (Babel-based; Fast Refresh + JSX transform)
 *   - `@vitejs/plugin-react-swc` (SWC-based; faster, source-map preservation
 *     verified in 04-05-SPIKE.md)
 *   - neither (consumer needs to install one — raises ROZ500)
 *
 * Per D-59 (research line 38): if BOTH are installed, prefer
 * `@vitejs/plugin-react` for v1 (Babel chain is the better-tested path).
 * Consumer's `vite.config.ts` ultimately decides which plugin runs; this
 * detection only affects diagnostic messaging — `@rozie/unplugin` does NOT
 * load either plugin itself.
 *
 * Implementation note: we use Node's `createRequire` to reach `require.resolve`
 * from this ESM module, scoped to a consumer cwd when provided. The
 * `paths: [cwd]` option restricts module resolution to the consumer's
 * `node_modules` tree — important for testing in-tree without polluting
 * the result with our own monorepo's resolution.
 *
 * @experimental — shape may change before v1.0
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export type ReactPluginChoice = 'plugin-react' | 'plugin-react-swc' | null;

/**
 * Returns the chosen plugin name, or `null` if neither is resolvable from `cwd`.
 *
 * @param cwd — consumer project root. When omitted, resolves from the current
 *   process's cwd (so test environments and CLI invocations behave naturally).
 */
export function detectReactPlugin(cwd?: string): ReactPluginChoice {
  // createRequire scoped to a consumer-side path. Falls back to import.meta.url
  // (this file) when cwd is omitted — enough for monorepo-internal probes.
  const requireFn = cwd
    ? createRequire(pathToFileURL(cwd + '/').href)
    : createRequire(import.meta.url);

  // D-59 preference order: plugin-react first, then plugin-react-swc.
  if (canResolve(requireFn, '@vitejs/plugin-react')) {
    return 'plugin-react';
  }
  if (canResolve(requireFn, '@vitejs/plugin-react-swc')) {
    return 'plugin-react-swc';
  }
  return null;
}

/**
 * `react` peer dep resolution check (D-59 sub-step / ROZ501).
 *
 * Even when one of the plugin-react variants is installed, `react` itself
 * must be resolvable. This is technically a transitive dependency of the
 * Vite plugins — but since `@rozie/unplugin` declares `react` as an optional
 * peer dep, we want a precise diagnostic when the consumer hasn't installed
 * it (rather than the cryptic "Cannot find module 'react'" stack trace from
 * downstream JSX evaluation).
 */
export function canResolveReact(cwd?: string): boolean {
  const requireFn = cwd
    ? createRequire(pathToFileURL(cwd + '/').href)
    : createRequire(import.meta.url);
  return canResolve(requireFn, 'react');
}

function canResolve(requireFn: NodeJS.Require, id: string): boolean {
  try {
    requireFn.resolve(id);
    return true;
  } catch {
    return false;
  }
}
