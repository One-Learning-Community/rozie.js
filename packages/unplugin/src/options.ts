/**
 * @rozie/unplugin options validation (D-49 / ROZ400+).
 *
 * `target` is REQUIRED per D-49. Phase 3 ships `vue` only; other targets
 * raise ROZ402 until later phases land them.
 *
 * Validation throws synchronously when `Rozie({ target: ... })` is called
 * at consumer-side, before any Vite hooks run — so config-load fails fast
 * with a code-bearing Error.
 *
 * @experimental — shape may change before v1.0
 */

import { RozieErrorCode } from '../../core/src/diagnostics/codes.js';

export interface RozieOptions {
  /**
   * Target framework. Phase 3 ships `vue` only. `react`/`svelte`/`angular`
   * raise ROZ402 until subsequent phases land them.
   */
  target: 'vue' | 'react' | 'svelte' | 'angular';
}

export type TargetValue = RozieOptions['target'];

/** All targets the registry knows about (validation allowlist). */
export const ALL_TARGETS: readonly TargetValue[] = ['vue', 'react', 'svelte', 'angular'] as const;

/** Targets actually shipped in Phase 3. */
export const SUPPORTED_TARGETS_PHASE_3: readonly TargetValue[] = ['vue'] as const;

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
 * @throws ROZ402 — `target` known but Phase 3 doesn't ship it yet
 *
 * @returns the same options object (narrowed) when validation passes
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
  if (!SUPPORTED_TARGETS_PHASE_3.includes(target)) {
    throw rozieError(
      RozieErrorCode.UNPLUGIN_TARGET_NOT_YET_SUPPORTED,
      `Target '${target}' is not yet supported. Phase 3 ships 'vue' only; later phases add react, svelte, angular.`,
    );
  }
  return { target };
}
