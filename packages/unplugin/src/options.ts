/**
 * @rozie/unplugin options validation (D-49 / ROZ400+ / ROZ500+ / ROZ600+ / ROZ700+).
 *
 * `target` is REQUIRED per D-49. Phase 3 shipped `vue` only; Phase 4 (Plan
 * 04-05) extends to `react`; Phase 5 Plan 05-02b extends to `svelte`; Plan
 * 05-04b extends to `angular`. All four canonical targets are now shipped.
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
 * - `target: 'angular'` is accepted (Plan 05-04b); the factory raises
 *   ROZ700 when `@analogjs/vite-plugin-angular` is not resolvable from the
 *   consumer's cwd (D-72), ROZ701 when `@angular/core` is not resolvable,
 *   and ROZ702 when the consumer's Vite version is < 6 (analogjs 2.5.x
 *   requires vite ^6 || ^7 || ^8 per RESEARCH OQ6 RESOLVED).
 *
 * @experimental — shape may change before v1.0
 */

import { RozieErrorCode } from '../../core/src/diagnostics/codes.js';
import { detectReactPlugin, canResolveReact } from './react-detect.js';
import { detectSveltePlugin, canResolveSvelte } from './svelte-detect.js';
import { detectAnalogjs, canResolveAngularCore, detectViteMajor } from './analogjs-detect.js';
import { detectSolidPlugin, canResolveSolidJs } from './solid-detect.js';

export interface RozieOptions {
  /**
   * Target framework. Phase 3 shipped `vue`. Phase 4 (Plan 04-05) adds
   * `react`. Phase 5 Plan 05-02b adds `svelte`; Plan 05-04b adds `angular`.
   * All four canonical targets are now fully supported.
   */
  target: 'vue' | 'react' | 'svelte' | 'angular' | 'solid';
}

export type TargetValue = RozieOptions['target'];

/** All targets the registry knows about (validation allowlist). */
export const ALL_TARGETS: readonly TargetValue[] = ['vue', 'react', 'svelte', 'angular', 'solid'] as const;

/** Targets actually shipped in Phase 3. (Kept for diagnostic message clarity.) */
export const SUPPORTED_TARGETS_PHASE_3: readonly TargetValue[] = ['vue'] as const;

/**
 * Targets shipped through Phase 5 Plan 05-04b. All four canonical targets
 * are now supported (vue, react, svelte, angular).
 *
 * Plan 05-04b extends the prior PHASE_5 list (which Plan 05-02b set to
 * ['vue', 'react', 'svelte']) with 'angular'. Plan 06.3-01 adds 'solid'.
 * ROZ402 is no longer reachable in v1 — every value of
 * `RozieOptions['target']` is now in SUPPORTED_TARGETS_PHASE_5.
 * The constant is kept for diagnostic-message clarity; future phases may
 * add new optional targets that initially raise ROZ402 again.
 */
export const SUPPORTED_TARGETS_PHASE_5: readonly TargetValue[] = ['vue', 'react', 'svelte', 'angular', 'solid'] as const;

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
  // NOTE: SUPPORTED_TARGETS_PHASE_5 now equals ALL_TARGETS, so this branch
  // is currently unreachable. It is kept as a forward-compatibility guard for
  // future phases that may add new target strings to ALL_TARGETS before fully
  // implementing them. The message has been updated from "not yet supported"
  // to "unknown target" to avoid confusion if a typo slips through the
  // ALL_TARGETS check above. Closes IN-02.
  if (!SUPPORTED_TARGETS_PHASE_5.includes(target)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_TARGET_NOT_YET_SUPPORTED,
      `Unknown target '${target}'. Valid targets: ${SUPPORTED_TARGETS_PHASE_5.join(', ')}.`,
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

/**
 * Plan 05-04b — runtime peer-dep assertions for `target: 'angular'` (D-72).
 *
 * Mirrors `assertReactPeerDeps` / `assertSveltePeerDeps`. Called from the
 * factory after `validateOptions` succeeds when target === 'angular'.
 *
 * Three preconditions are checked in order:
 *
 *   1. ROZ700 — `@analogjs/vite-plugin-angular` resolvable from `cwd`.
 *      Per D-72, consumers add this explicitly to their `vite.config.ts`
 *      plugins array AFTER `Rozie({ target: 'angular' })`. Rozie does NOT
 *      auto-detect or chain into it.
 *   2. ROZ701 — `@angular/core` resolvable from `cwd`. Rozie's emitter
 *      output imports from `@angular/core`; without it the consumer's
 *      type-checker / runtime fails with cryptic errors.
 *   3. ROZ702 — consumer's installed Vite is >= 6 (analogjs 2.5.x peerDeps
 *      require `vite ^6 || ^7 || ^8` per RESEARCH OQ6 RESOLVED). When vite
 *      is not resolvable at all, `detectViteMajor` returns null and we
 *      skip this check (analogjs's own peer-dep machinery will surface
 *      the missing-vite error first).
 *
 * @throws ROZ700 — `@analogjs/vite-plugin-angular` not resolvable.
 * @throws ROZ701 — `@angular/core` not resolvable.
 * @throws ROZ702 — consumer's Vite < 6.
 */
export function assertAngularPeerDeps(cwd?: string): void {
  if (!detectAnalogjs(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_ANGULAR_PEER_DEP_MISSING,
      `target: 'angular' requires '@analogjs/vite-plugin-angular' (^2.5.0) installed in your project. ` +
        `Install: pnpm add -D @analogjs/vite-plugin-angular @angular-devkit/build-angular and add angular() to your vite.config.ts plugins array AFTER Rozie({ target: 'angular' }).`,
    );
  }
  if (!canResolveAngularCore(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_ANGULAR_DEP_MISSING,
      `target: 'angular' requires '@angular/core' (^17 || ^18 || ^19 || ^20 || ^21) installed in your project. ` +
        `Install: pnpm add @angular/core @angular/common @angular/platform-browser`,
    );
  }
  const viteMajor = detectViteMajor(cwd);
  if (viteMajor !== null && viteMajor < 6) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_ANGULAR_VITE_VERSION_TOO_LOW,
      `target: 'angular' requires Vite >= 6 (your project has Vite ${viteMajor}.x). ` +
        `@analogjs/vite-plugin-angular@^2.5.0 peerDeps require vite ^6 || ^7 || ^8. ` +
        `Upgrade: pnpm add -D vite@^6 (or ^7 / ^8).`,
    );
  }
}

/**
 * Plan 06.3-01 — runtime peer-dep assertions for `target: 'solid'` (D-139).
 *
 * Mirrors assertReactPeerDeps / assertSveltePeerDeps. Called from the factory
 * after `validateOptions` succeeds when target === 'solid'. Separated from
 * `validateOptions` so:
 *   - Pure-shape validation tests don't need to mock `require.resolve`.
 *   - The factory can choose whether to throw or `console.warn` based on
 *     environment (e.g., test runs vs. production builds).
 *
 * @throws ROZ810 — `vite-plugin-solid` is not resolvable from `cwd`.
 * @throws ROZ811 — `solid-js` itself is not resolvable.
 */
export function assertSolidPeerDeps(cwd?: string): void {
  if (!detectSolidPlugin(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_SOLID_PEER_DEP_MISSING,
      `target: 'solid' requires 'vite-plugin-solid' (^2.0) installed in your project. ` +
        `Install: pnpm add -D vite-plugin-solid and add solidPlugin() to your vite.config.ts plugins array AFTER Rozie({ target: 'solid' }).`,
    );
  }
  if (!canResolveSolidJs(cwd)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_SOLID_DEP_MISSING,
      `target: 'solid' requires 'solid-js' (^1.8) installed in your project. Install: pnpm add solid-js`,
    );
  }
}
