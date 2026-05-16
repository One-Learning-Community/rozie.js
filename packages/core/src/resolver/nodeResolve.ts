/**
 * Internal wrapper around `enhanced-resolve` configured for `.rozie` producer
 * resolution.
 *
 * Phase 07.2 Plan 01 Task 3.
 *
 * Per RESEARCH §"Pattern 2: Module Resolver (D-02 + D-12)" + RESEARCH Pitfall 1:
 *   - extensions:    ['.rozie', '.ts', '.tsx', '.js', '.jsx', '.mjs']
 *   - conditionNames: ['rozie', 'import', 'default']
 *   - symlinks:       true                                    — pnpm-friendly
 *   - exportsFields: ['exports']
 *
 * The shape MUST be a pure function of `(specifier, fromFile, opts)` so all
 * four compile entrypoints (CLI / unplugin / babel-plugin / Vite-runtime) build
 * resolver instances with the same behavior — configuration drift across
 * entrypoints would silently break the 216-cell dist-parity gate (RESEARCH
 * Pitfall 1).
 *
 * `node:fs` is used as the file system; `enhanced-resolve`'s
 * `CachedInputFileSystem` is intentionally NOT introduced here to keep the
 * resolver behavior identical across entrypoints (caching state would leak
 * cross-resolver-instance per RESEARCH Pitfall 2 — cache fill order driving
 * output). Each `ProducerResolver` instance is per-compiler-instance and
 * short-lived; the cost of skipping CachedInputFileSystem is acceptable.
 *
 * @experimental — shape may change before v1.0
 */
import * as fs from 'node:fs';
import enhancedResolve from 'enhanced-resolve';

const { ResolverFactory } = enhancedResolve;

/**
 * The canonical resolver options shape. Documented here as the single source of
 * truth so unplugin / babel-plugin / CLI all construct resolvers identically.
 *
 * Exported as a frozen object via a function so each callsite gets a fresh
 * mutable copy (enhanced-resolve's ResolverFactory requires mutable arrays).
 */
export function getRozieResolverOptions(): {
  fileSystem: typeof fs;
  extensions: string[];
  conditionNames: string[];
  symlinks: boolean;
  exportsFields: string[];
  useSyncFileSystemCalls: boolean;
} {
  return {
    fileSystem: fs,
    extensions: ['.rozie', '.ts', '.tsx', '.js', '.jsx', '.mjs'],
    conditionNames: ['rozie', 'import', 'default'],
    symlinks: true,
    exportsFields: ['exports'],
    // useSyncFileSystemCalls is required when calling resolveSync against a sync FS.
    useSyncFileSystemCalls: true,
  };
}

/**
 * @deprecated Use `getRozieResolverOptions()` instead — the frozen-readonly
 * shape was incompatible with enhanced-resolve's mutable-options expectation.
 * Kept as a back-compat alias for direct shape introspection from tests.
 */
export const ROZIE_RESOLVER_OPTIONS = getRozieResolverOptions();

/**
 * Build a fresh `enhanced-resolve` Resolver wired for `.rozie` producer
 * resolution. Per-instance — no shared global state.
 */
export function createNodeResolver(): enhancedResolve.Resolver {
  return ResolverFactory.createResolver(getRozieResolverOptions());
}

/**
 * Wrap `resolver.resolveSync(...)` with collected-not-thrown discipline.
 * Returns the resolved absolute path on success, `null` on any failure
 * (including thrown errors from enhanced-resolve's internals).
 */
export function tryResolveSync(
  resolver: enhancedResolve.Resolver,
  fromDir: string,
  request: string,
): string | null {
  try {
    const result = resolver.resolveSync({}, fromDir, request);
    return result === false ? null : result;
  } catch {
    return null;
  }
}
