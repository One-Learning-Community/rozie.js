/**
 * ProducerResolver — Phase 07.2 Plan 01 Task 3 (D-02 + D-12).
 *
 * Two-layer module resolver:
 *
 *  1. tsconfig `paths` aliases (D-12)        — via `get-tsconfig.createPathsMatcher`
 *  2. relative/absolute/bare specifier (D-02) — via `enhanced-resolve`
 *
 * Resolves `<components>` import paths from a `.rozie` consumer file to an
 * absolute filesystem path the IR cache can read + lower. Failure returns
 * `null`; the caller (e.g., `threadParamTypes`) emits ROZ945
 * `CROSS_PACKAGE_LOOKUP_FAILED` at the `<components>` source loc.
 *
 * Per-compiler-instance (D-01 invariant). No shared global state — each
 * entrypoint (CLI / unplugin / babel-plugin / Vite-runtime) constructs its
 * own `ProducerResolver` per compile-session, and all four entrypoints MUST
 * use the same `ROZIE_RESOLVER_OPTIONS` shape (RESEARCH Pitfall 1).
 *
 * The two-layer split is per RESEARCH §"Pattern 2: Module Resolver":
 *   - tsconfig paths map a specifier to one-or-more candidate paths; each
 *     candidate is then fed through the node resolver to handle the actual
 *     filesystem walk (extensions, exports field, pnpm symlinks).
 *   - When tsconfig paths produce no candidates (or no tsconfig is present),
 *     the specifier is fed directly into the node resolver.
 *
 * Threat model T-072-02 (information disclosure): the node resolver does NOT
 * traverse arbitrary parent paths — it walks the `fromDir` chain looking for
 * `node_modules` and a matching package; for `../` specifiers it resolves
 * relative to `fromDir` only. Specifiers like `../../../etc/passwd` resolve
 * to the actual file path on disk, but the IR cache then attempts to parse
 * it as a `.rozie` source; non-`.rozie` files fail parsing and return null,
 * so no source content surfaces outside diagnostics. Tests cover this.
 *
 * @experimental — shape may change before v1.0
 */
import { dirname, isAbsolute } from 'node:path';
import type enhancedResolve from 'enhanced-resolve';
import {
  createNodeResolver,
  tryResolveSync,
  ROZIE_RESOLVER_OPTIONS,
} from './nodeResolve.js';
import {
  createTsconfigPathsMatcher,
  type PathsMatcher,
} from './tsconfigPaths.js';

export { ROZIE_RESOLVER_OPTIONS } from './nodeResolve.js';

/**
 * Options for `ProducerResolver`.
 */
export interface ResolverOptions {
  /**
   * Root directory for tsconfig discovery. Usually `process.cwd()` (CLI),
   * `viteConfig.root` (unplugin), or `dirname(state.file.opts.filename)`
   * (babel-plugin). All four entrypoints MUST derive this consistently from
   * the same `CompileOptions.resolverRoot` to preserve dist-parity.
   */
  root: string;
}

/**
 * Per-compiler-instance resolver. Tries tsconfig paths first then npm/relative
 * resolution. Failure returns `null`; never throws.
 */
export class ProducerResolver {
  private readonly nodeResolver: enhancedResolve.Resolver;
  private readonly pathsMatcher: PathsMatcher | null;

  constructor(opts: ResolverOptions) {
    this.nodeResolver = createNodeResolver();
    this.pathsMatcher = createTsconfigPathsMatcher(opts.root);
  }

  /**
   * Resolve a `.rozie` producer specifier relative to a consumer file.
   *
   * Resolution order:
   *  1. tsconfig `paths` (D-12) — feed each candidate through the node resolver
   *  2. relative / absolute path — directly via the node resolver
   *  3. bare specifier (npm / pnpm) — directly via the node resolver
   *
   * Returns null on failure; caller emits ROZ945.
   *
   * @param specifier - the raw `<components>` import path (e.g.,
   *   `'./Modal.rozie'`, `'@my-design-system/modal.rozie'`, `'@/components/Modal.rozie'`).
   * @param fromFile  - the absolute path of the consumer `.rozie` file. Used
   *   as the `fromDir` for relative resolution + as the npm walk root.
   */
  resolveProducerPath(specifier: string, fromFile: string): string | null {
    // Per JSDoc contract: fromFile must be an absolute path. All callers (CLI,
    // unplugin, babel-plugin) derive fromFile from the compiler's file option,
    // which is always absolute. If a relative path is ever passed, enhanced-resolve
    // would receive a non-absolute fromDir and may resolve incorrectly.
    const fromDir = dirname(fromFile);

    // 1. tsconfig paths (D-12) — try first so `@/components/Modal.rozie` maps
    //    to the configured alias before bare-spec / relative paths apply.
    if (this.pathsMatcher) {
      const candidates = this.pathsMatcher(specifier);
      for (const candidate of candidates) {
        const resolved = tryResolveSync(this.nodeResolver, fromDir, candidate);
        if (resolved !== null) return resolved;
      }
    }

    // 2. relative / absolute / 3. bare — single call into the node resolver
    //    covers both cases. enhanced-resolve's resolveSync handles `./`, `../`,
    //    absolute paths, and bare specifiers (walks `fromDir` → `/` for
    //    `node_modules`) in one entry point.
    return tryResolveSync(this.nodeResolver, fromDir, specifier);
  }
}
