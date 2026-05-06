/**
 * @rozie/unplugin options validation (D-49 / ROZ400+ / ROZ500+ / ROZ600+).
 *
 * `target` is REQUIRED per D-49. Phase 3 shipped `vue` only; Phase 4 (Plan
 * 04-05) extends to `react`; Phase 5 Plan 05-02b extends to `svelte`. The
 * remaining target (`angular`) raises ROZ402 until Plan 05-04b lands it.
 *
 * Validation throws synchronously when `Rozie({ target: ... })` is called
 * at consumer-side, before any Vite hooks run — so config-load fails fast
 * with a code-bearing Error.
 *
 * Phase 4 additions:
 * - `target: 'react'` is accepted; in addition to ROZ400/401 (shape), the
 *   factory raises ROZ500 when neither @vitejs/plugin-react nor
 *   @vitejs/plugin-react-swc is resolvable from the consumer's cwd, and
 *   ROZ501 when `react` itself is not resolvable. Detection happens at
 *   factory-call time, not at every transform — Pitfall 9 mitigation.
 *
 * Phase 5 additions:
 * - `target: 'svelte'` is accepted; the factory raises ROZ600 when
 *   `@sveltejs/vite-plugin-svelte` is not resolvable from the consumer's
 *   cwd, and ROZ601 when `svelte` itself is not resolvable. Detection
 *   happens at factory-call time (mirrors React's `assertReactPeerDeps`).
 *
 * @experimental — shape may change before v1.0
 */

import { RozieErrorCode } from '../../core/src/diagnostics/codes.js';
import { detectReactPlugin, canResolveReact } from './react-detect.js';
import { detectSveltePlugin, canResolveSvelte } from './svelte-detect.js';

export interface RozieOptions {
  /**
   * Target framework. Phase 3 shipped `vue`. Phase 4 (Plan 04-05) adds
   * `react`. Phase 5 (Plan 05-02b) adds `svelte`. `angular` raises ROZ402
   * until Plan 05-04b.
   */
  target: 'vue' | 'react' | 'svelte' | 'angular';
}

export type TargetValue = RozieOptions['target'];

/** All targets the registry knows about (validation allowlist). */
export const ALL_TARGETS: readonly TargetValue[] = ['vue', 'react', 'svelte', 'angular'] as const;

/** Targets actually shipped in Phase 3. (Kept for diagnostic message clarity.) */
export const SUPPORTED_TARGETS_PHASE_3: readonly TargetValue[] = ['vue'] as const;

/**
 * Targets shipped through Phase 5 Plan 05-02b. (Plan 05-04b adds `angular`.)
 *
 * Plan 05-02b renames the previous `SUPPORTED_TARGETS_PHASE_4` to
 * `SUPPORTED_TARGETS_PHASE_5` and adds 'svelte'. The PHASE_4 export was
 * removed — no consumer outside this file referenced it.
 */
export const SUPPORTED_TARGETS_PHASE_5: readonly TargetValue[] = ['vue', 'react', 'svelte'] as const;

interface RozieError extends Error {
  code: string;
}

function rozieError(code: string, message: string): RozieError {
  const err = new Error(`[${code}] ${message}`) as RozieError;
  err.code = code;
  return err;
}

/**
 * Validate the `RozieOptions` passed to the unplugin factory.
 *
 * @throws ROZ400 — `target` option missing
 * @throws ROZ401 — `target` value not in the known allowlist
 * @throws ROZ402 — `target` known but Phase 5 doesn't ship it yet (angular)
 *
 * @returns the same options object (narrowed) when validation passes
 *
 * Note: ROZ500/ROZ501 (React peer-dep checks) and ROZ600/ROZ601 (Svelte
 * peer-dep checks) are NOT raised here — they fire at factory-call time
 * via `assertReactPeerDeps()` / `assertSveltePeerDeps()` so unit tests
 * that synthesize options without a React or Svelte install can still
 * exercise validation.
 */
export function validateOptions(options: Partial<RozieOptions> | undefined): RozieOptions {
  if (!options || typeof options.target !== 'string') {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_TARGET_REQUIRED,
      "Rozie() requires the `target` option. Example: Rozie({ target: 'vue' })",
    );
  }
  const target = options.target as TargetValue;
  if (!ALL_TARGETS.includes(target)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_TARGET_UNKNOWN,
      `Unknown target '${options.target}'. Supported: ${ALL_TARGETS.join(', ')}.`,
    );
  }
  if (!SUPPORTED_TARGETS_PHASE_5.includes(target)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_TARGET_NOT_YET_SUPPORTED,
      `Target '${target}' is not yet supported. Phase 5 ships 'vue', 'react', 'svelte'; angular is added in Plan 05-04b.`,
    );
  }
  return { target };
}

/**
 * Plan 04-05 — runtime peer-dep assertions for `target: 'react'`.
 *
 * Called from the factory after `validateOptions` succeeds. Separated from
 * `validateOptions` so:
 *   - Pure-shape validation tests don't need to mock `require.resolve`.
 *   - The factory can choose whether to throw or `console.warn` based on
 *     environment (e.g., test runs vs. production builds).
 *
 * @throws ROZ500 — neither @vitejs/plugin-react nor @vitejs/plugin-react-swc
 *   is resolvable from `cwd` (D-59 / Pitfall 9).
 * @throws ROZ501 — `react` itself is not resolvable.
 *
 * Note: ROZ502 (plugin-chain misorder — @rozie/unplugin not declared with
 * `enforce: 'pre'`) is enforced at the createUnplugin factory level by
 * always returning `enforce: 'pre'` — there is no consumer-side knob that
 * can break the chain.
 */
export function assertReactPeerDeps(cwd?: string): void {
  const choice = detectReactPlugin(cwd);
  if (choice === null) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_REACT_PEER_DEP_MISSING,
      `target: 'react' requires either '@vitejs/plugin-react' (^4 || ^5) or '@vitejs/plugin-react-swc' (^3 || ^4) installed in your project. ` +
        `Install one and add it to your vite.config.ts plugins array AFTER Rozie({ target: 'react' }).`,
    );
  }
  if (!canResolveReact(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_REACT_DEP_MISSING,
      `target: 'react' requires 'react' (^18.2 || ^19) installed in your project. Install: pnpm add react react-dom`,
    );
  }
}

/**
 * Plan 05-02b — runtime peer-dep assertions for `target: 'svelte'`.
 *
 * Mirrors `assertReactPeerDeps`. Called from the factory after
 * `validateOptions` succeeds when target === 'svelte'. Separated from
 * `validateOptions` so:
 *   - Pure-shape validation tests don't need to mock `require.resolve`.
 *   - The factory can choose whether to throw or `console.warn` based on
 *     environment.
 *
 * @throws ROZ600 — `@sveltejs/vite-plugin-svelte` is not resolvable from `cwd`.
 * @throws ROZ601 — `svelte` itself is not resolvable.
 *
 * Note: ROZ602 (plugin-chain misorder — @rozie/unplugin not declared with
 * `enforce: 'pre'`) is enforced at the createUnplugin factory level by
 * always returning `enforce: 'pre'` — there is no consumer-side knob that
 * can break the chain. Reserved code-only.
 */
export function assertSveltePeerDeps(cwd?: string): void {
  if (!detectSveltePlugin(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_SVELTE_PEER_DEP_MISSING,
      `target: 'svelte' requires '@sveltejs/vite-plugin-svelte' (^5.1.1) installed in your project. ` +
        `Install: pnpm add -D @sveltejs/vite-plugin-svelte and add svelte() to your vite.config.ts plugins array AFTER Rozie({ target: 'svelte' }).`,
    );
  }
  if (!canResolveSvelte(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_SVELTE_DEP_MISSING,
      `target: 'svelte' requires 'svelte' (^5.0.0) installed in your project. Install: pnpm add svelte`,
    );
  }
}
