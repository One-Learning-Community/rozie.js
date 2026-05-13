/**
 * lit-detect.ts — Plan 06.4-01 (D-LIT-20).
 *
 * Auto-detect whether the consumer has `lit` and `@lit-labs/preact-signals`
 * installed. Mirrors solid-detect.ts (createRequire pattern).
 *
 * Lit has NO host Vite plugin equivalent to `vite-plugin-solid` /
 * `@sveltejs/vite-plugin-svelte` / `@analogjs/vite-plugin-angular` — Lit
 * components are plain ES modules that call `customElements.define()` at
 * module load. The Rozie Lit branch's unplugin transformer therefore exposes
 * only `canResolveLit` (the `lit` runtime) and `canResolvePreactSignals`
 * (the SignalWatcher mixin source) — there is no `detectLitPlugin`.
 *
 * Implementation note: we use Node's `createRequire` to reach
 * `require.resolve` from this ESM module, scoped to a consumer cwd when
 * provided. The `paths: [cwd]` option restricts module resolution to the
 * consumer's `node_modules` tree.
 *
 * @experimental — shape may change before v1.0
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function canResolve(requireFn: NodeJS.Require, pkg: string): boolean {
  try {
    requireFn.resolve(pkg);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if `lit` (^3.2.0) is resolvable from `cwd`, false otherwise.
 *
 * @param cwd — consumer project root. When omitted, resolves from the current
 *   process's cwd (so test environments and CLI invocations behave naturally).
 */
export function canResolveLit(cwd?: string): boolean {
  // WR-06 fix: use pathToFileURL to normalize Windows paths (backslashes)
  // before passing to createRequire. cwd.endsWith('/') is false for C:\foo.
  const requireFn = cwd
    ? createRequire(pathToFileURL(cwd + '/').href)
    : createRequire(import.meta.url);
  return canResolve(requireFn, 'lit');
}

/**
 * Returns true if `@lit-labs/preact-signals` (^1.0.0) is resolvable from
 * `cwd`, false otherwise. Required because the Lit emitter wraps the base
 * class with `SignalWatcher(LitElement)` (D-LIT-08) and emits signal field
 * initializers using the `signal` / `computed` / `effect` exports.
 */
export function canResolvePreactSignals(cwd?: string): boolean {
  // WR-06 fix: use pathToFileURL to normalize Windows paths (backslashes)
  // before passing to createRequire. cwd.endsWith('/') is false for C:\foo.
  const requireFn = cwd
    ? createRequire(pathToFileURL(cwd + '/').href)
    : createRequire(import.meta.url);
  return canResolve(requireFn, '@lit-labs/preact-signals');
}
