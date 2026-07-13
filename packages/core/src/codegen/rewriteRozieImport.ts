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
 * Phase 75 (D-08/D-09, Option A published composition): a PUBLISHED
 * cross-package `<components>` specifier (e.g.
 * `@rozie-ui/combobox/Combobox.rozie`) is rewritten to the derived
 * per-target package's bare specifier (`@rozie-ui/combobox-<target>`)
 * instead of a plain `.rozie`→extension swap — the extension-swap rule only
 * makes sense for LOCAL (relative / tsconfig-alias) specifiers, where the
 * producer's compiled sibling lives next to the consumer. A published
 * specifier has no local sibling: the derived per-target package's own
 * bare `"."` export IS the compiled component (D-08's same convention
 * `resolveManifestProducer.ts` already uses for manifest lookup — mirrored
 * here, not imported, to keep this module dependency-free per its existing
 * "single source of truth for import-path shape" responsibility).
 *
 * @experimental — shape may change before v1.0
 */
export type RozieTarget = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

const TARGET_EXT_MAP: Record<RozieTarget, string> = {
  vue: '.vue',
  react: '', // bundler/TS resolver picks up the actual `.tsx`
  svelte: '.svelte',
  angular: '', // TS resolver picks up `.ts`
  solid: '', // bundler/TS resolver picks up the actual `.tsx`
  lit: '', // TS resolver picks up the actual `.ts` (same as Angular)
};

const ROZIE_EXT = '.rozie';

/** Tsconfig-alias-shaped prefix (empty npm scope, e.g. `@/components/Modal.rozie`). */
const TSCONFIG_ALIAS_PREFIX = '@/';

/**
 * True iff `importPath` is a PUBLISHED cross-package `<components>`
 * specifier (D-08 shape): ends in `.rozie`, is neither a relative/absolute
 * path nor a tsconfig `paths`-alias-shaped specifier. Mirrors
 * `resolveManifestProducer.ts`'s `isPublishedSpecifier` (kept duplicated,
 * not imported, so this module stays dependency-free — both are tiny, pure,
 * syntactic classifiers over the same D-08 specifier shape and must be kept
 * in lockstep if that shape ever changes).
 *
 * Exported so callers that do NOT already route an import path through
 * `rewriteRozieImport` (e.g. the Lit emitter's side-effect/type-only
 * composed-component imports, which deliberately leave a LOCAL `.rozie`
 * specifier verbatim for the unplugin-consumer-coexist flow) can still
 * gate a published-specifier rewrite without duplicating this check.
 */
export function isPublishedSpecifier(importPath: string): boolean {
  if (!importPath.endsWith(ROZIE_EXT)) return false;
  if (importPath.startsWith('.') || importPath.startsWith('/')) return false;
  if (importPath.startsWith(TSCONFIG_ALIAS_PREFIX)) return false;
  return true;
}

export function rewriteRozieImport(importPath: string, target: RozieTarget): string {
  if (!importPath.endsWith(ROZIE_EXT)) return importPath;
  const targetExt = TARGET_EXT_MAP[target];
  if (targetExt === undefined) {
    throw new Error(
      `rewriteRozieImport: unknown target '${target}' — expected one of vue|react|svelte|angular|solid|lit`,
    );
  }
  if (isPublishedSpecifier(importPath)) {
    // Derive `${basePkg}-${target}` (D-08) — strip the trailing
    // `/<Component>.rozie` leaf, append `-${target}` to the base package.
    // The derived package's bare `"."` export is the compiled component;
    // no extension is appended (unlike the local-sibling swap below).
    const lastSlash = importPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const basePkg = importPath.slice(0, lastSlash);
      return `${basePkg}-${target}`;
    }
  }
  return importPath.slice(0, -ROZIE_EXT.length) + targetExt;
}
