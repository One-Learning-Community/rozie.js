/**
 * resolveManifestProducer — Phase 75 Plan 02 (D-08/D-09/D-10).
 *
 * Wires the manifest contract (Plan 01's `buildManifest`/`parseManifest`)
 * into `@rozie/core`'s producer-resolution seam so a PUBLISHED cross-package
 * `<components>` specifier resolves a producer contract from a compiled
 * `rozie-manifest.json` instead of a `.rozie` source file.
 *
 * **COMP-04 bounded exception**: local `.rozie` composition (relative /
 * tsconfig-alias specifiers) still needs NO cross-`.rozie` IR type info and
 * keeps reading on-disk `.rozie` source unchanged via the existing
 * `resolver.resolveProducerPath` + `IRCache.getIRComponent` path. ONLY
 * published cross-PACKAGE specifiers (D-08's `@scope/pkg/Component.rozie`
 * shape) read this compiled manifest artifact. This module and its two
 * call-sites (threadParamTypes.ts, validateTwoWayBindings.ts) are the entire
 * surface of that exception.
 *
 * Convention-based per-target package derivation (D-08): for a published
 * specifier `@scope/pkg/Component.rozie`, the trailing `/Component.rozie`
 * segment is stripped to yield the base package `@scope/pkg`, then
 * `-${target}` is appended to yield the derived per-target package name
 * (e.g. `@rozie-ui/combobox` + `-react` → `@rozie-ui/combobox-react`).
 *
 * Location (D-10): the derived package is located via the SAME
 * `enhanced-resolve` layer `ProducerResolver` already uses for `.rozie`
 * producer resolution — walking `node_modules` from the consumer file's
 * directory (NOT from `ResolverOptions.root`, which feeds only the
 * tsconfig-paths matcher). Because a real per-target leaf's `package.json`
 * `exports` map does not (and need not) list `"./package.json"` or
 * `"./rozie-manifest.json"` as exported subpaths, this resolver deliberately
 * resolves the package's bare `"."` export entry (its normal `import`
 * condition target, e.g. `dist/index.mjs`) and then walks UP from that
 * resolved file to the nearest ancestor directory whose `package.json`
 * `name` matches the derived package name (T-75-04/T-75-05 — bounded walk,
 * name-verified, never an unauthenticated `../` traversal). The manifest is
 * then read at a FIXED literal relative path inside that directory
 * (`rozie-manifest.json`) — no specifier-derived path segment ever reaches
 * `readFileSync` (T-75-04).
 *
 * @experimental — shape may change before v1.0
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { RozieTarget } from '../codegen/rewriteRozieImport.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { ProducerResolver } from '../resolver/index.js';
import { parseManifest } from './readManifest.js';
import type { ManifestError, ProducerSurface } from './readManifest.js';

/** Tsconfig-alias-shaped prefix (empty npm scope, e.g. `@/components/Modal.rozie`). */
const TSCONFIG_ALIAS_PREFIX = '@/';

/**
 * True iff `specifier` is a PUBLISHED cross-package `<components>` specifier
 * (D-08 shape): ends in `.rozie`, is neither a relative/absolute path nor a
 * tsconfig `paths`-alias-shaped specifier.
 *
 * `isPublishedSpecifier` is a pure, syntactic classifier — it does not itself
 * consult a real tsconfig (that happens inside `ProducerResolver`'s local
 * COMP-04 path when this returns `false`). A leading `@/` is NOT a valid npm
 * scoped-package prefix (npm scopes require at least one character between
 * `@` and the following `/`), so it is the reliable syntactic signal that a
 * `@/...` specifier is tsconfig-alias-shaped rather than a real scoped
 * package — matching `ProducerResolver`'s own documented `@/components/Modal.rozie`
 * example of a tsconfig-paths alias.
 */
export function isPublishedSpecifier(specifier: string): boolean {
  if (!specifier.endsWith('.rozie')) return false;
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;
  if (specifier.startsWith(TSCONFIG_ALIAS_PREFIX)) return false;
  return true;
}

/**
 * Strip the trailing `/<Component>.rozie` leaf off a published specifier to
 * derive the base package name (e.g. `@rozie-ui/combobox/Combobox.rozie` →
 * `@rozie-ui/combobox`). Returns `null` when the specifier has no `/`
 * separating a package from a leaf (malformed — never a valid published
 * specifier in practice, since `isPublishedSpecifier` requires `.rozie`).
 */
function deriveBasePackageName(specifier: string): string | null {
  const lastSlash = specifier.lastIndexOf('/');
  if (lastSlash <= 0) return null;
  return specifier.slice(0, lastSlash);
}

/**
 * Walk UP from a resolved entry-file path to the nearest ancestor directory
 * whose `package.json` `name` field equals `expectedName`. Bounded to 10
 * levels (T-75-05 — a real per-target leaf's package root sits 1-3 levels
 * above its resolved `dist/*` entry; 10 is a generous, still-finite bound
 * that can never escape into an unrelated ancestor tree undetected, since
 * EVERY level is name-verified before being accepted).
 */
function findPackageRoot(entryFilePath: string, expectedName: string): string | null {
  let dir = dirname(entryFilePath);
  for (let i = 0; i < 10; i++) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as unknown;
      if (
        typeof raw === 'object' &&
        raw !== null &&
        (raw as Record<string, unknown>).name === expectedName
      ) {
        return dir;
      }
    } catch {
      // No package.json at this level, or it doesn't parse — keep walking up.
    }
    const parent = dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
  return null;
}

export interface ResolveManifestProducerArgs {
  /** The raw `<components>` import path (e.g. `'@rozie-ui/combobox/Combobox.rozie'`). */
  specifier: string;
  /** The per-call compile target — selects the derived per-target package. */
  target: RozieTarget;
  /** Absolute path of the consumer `.rozie` file (resolver `fromFile` root). */
  fromFile: string;
  /** Per-compiler-instance resolver — reused for the enhanced-resolve layer (D-10). */
  resolver: ProducerResolver;
}

export interface ResolveManifestProducerResult {
  surface: ProducerSurface | null;
  error: ManifestError | null;
}

function lookupFailed(pkgLabel: string): ResolveManifestProducerResult {
  return {
    surface: null,
    error: {
      code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
      message: `Cannot locate a published manifest for '${pkgLabel}'. Verify the per-target package is installed as a dependency reachable from the consumer file and ships a rozie-manifest.json.`,
    },
  };
}

/**
 * Derive the per-target package for a published `<components>` specifier,
 * locate its installed `rozie-manifest.json` via node module resolution, and
 * validate + deserialize it into a `ProducerSurface` (D-08/D-09/D-10/D-04).
 *
 * Never throws — every failure mode returns `{ surface: null, error }`.
 */
export function resolveManifestProducer(
  args: ResolveManifestProducerArgs,
): ResolveManifestProducerResult {
  const { specifier, target, fromFile, resolver } = args;

  const basePkg = deriveBasePackageName(specifier);
  if (basePkg === null) {
    return lookupFailed(specifier);
  }
  const derivedPkg = `${basePkg}-${target}`;

  // Resolve the derived package's bare `"."` export entry (D-10) — reuses
  // the SAME enhanced-resolve layer as local `.rozie` producer resolution,
  // walking node_modules from dirname(fromFile), NOT from ResolverOptions.root.
  const entryFilePath = resolver.resolveProducerPath(derivedPkg, fromFile);
  if (entryFilePath === null) {
    return lookupFailed(derivedPkg);
  }

  const packageDir = findPackageRoot(entryFilePath, derivedPkg);
  if (packageDir === null) {
    return lookupFailed(derivedPkg);
  }

  // T-75-04 — FIXED literal relative path; no specifier-derived segment ever
  // reaches readFileSync. `packageDir` itself is a filesystem truth (verified
  // by matching `package.json` "name"), not raw specifier text.
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(packageDir, 'rozie-manifest.json'), 'utf-8'));
  } catch {
    return lookupFailed(derivedPkg);
  }

  // D-04 — parseManifest validates schemaVersion FIRST and fails closed.
  return parseManifest(raw, { packageName: derivedPkg });
}
