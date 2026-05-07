/**
 * rewriteRozieImport — Phase 06.2 P2 Task 0 (D-118).
 *
 * Rewrites a `.rozie` import path to the target framework's expected file
 * extension per Phase 6 D-89 dist layout:
 *   - vue     → `.vue`     (extension included in import)
 *   - react   → `''`       (extension OMITTED — TS/bundler resolves `.tsx`)
 *   - svelte  → `.svelte`  (extension included)
 *   - angular → `''`       (extension OMITTED — TS resolves `.ts`)
 *
 * Single source of truth for all 4 per-target shell emitters per
 * CONTEXT.md D-118 (Claude's Discretion: shared helper recommended).
 *
 * Defensive: passes through paths that don't end in `.rozie` unchanged so
 * accidental misuse (e.g., on an already-rewritten or non-component path)
 * does not silently corrupt the import.
 *
 * @experimental — shape may change before v1.0
 */
export type RozieTarget = 'vue' | 'react' | 'svelte' | 'angular';

const TARGET_EXT_MAP: Record<RozieTarget, string> = {
  vue: '.vue',
  react: '', // bundler/TS resolver picks up the actual `.tsx`
  svelte: '.svelte',
  angular: '', // TS resolver picks up `.ts`
};

const ROZIE_EXT = '.rozie';

export function rewriteRozieImport(importPath: string, target: RozieTarget): string {
  if (!importPath.endsWith(ROZIE_EXT)) return importPath;
  const targetExt = TARGET_EXT_MAP[target];
  if (targetExt === undefined) {
    throw new Error(
      `rewriteRozieImport: unknown target '${target}' — expected one of vue|react|svelte|angular`,
    );
  }
  return importPath.slice(0, -ROZIE_EXT.length) + targetExt;
}
