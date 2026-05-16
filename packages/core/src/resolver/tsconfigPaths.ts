/**
 * Internal wrapper around `get-tsconfig` for D-12 tsconfig `paths` resolution.
 *
 * Phase 07.2 Plan 01 Task 3.
 *
 * Loads the consumer's tsconfig.json once at `ProducerResolver` construction
 * time and caches the resulting `PathsMatcher`. Per RESEARCH §"Pattern 2":
 * `createPathsMatcher` returns a function `(specifier: string) => string[]` of
 * candidate filesystem paths the inner node resolver then walks.
 *
 * Returns `null` (not throws) when no tsconfig is found — the resolver then
 * skips the tsconfig-paths leg and falls through to relative/bare resolution.
 *
 * @experimental — shape may change before v1.0
 */
import { getTsconfig, createPathsMatcher } from 'get-tsconfig';
import type { PathsMatcher } from 'get-tsconfig';

/**
 * Build a `paths` matcher for the tsconfig discovered from `root`. Returns
 * `null` when no tsconfig is found, or when the tsconfig has no `paths`
 * configuration — both legitimate "no tsconfig-paths leg" outcomes.
 */
export function createTsconfigPathsMatcher(root: string): PathsMatcher | null {
  try {
    const tsconfigResult = getTsconfig(root);
    if (!tsconfigResult) return null;
    return createPathsMatcher(tsconfigResult);
  } catch {
    // Defensive: get-tsconfig is collected-not-thrown internally, but guard
    // against any unexpected runtime surface on the I/O path.
    return null;
  }
}

export type { PathsMatcher } from 'get-tsconfig';
