/**
 * resolveSass.ts — Phase 10 Plan 01 Task 2.
 *
 * Synchronous optional-dependency resolver for `sass` (dart-sass). `@rozie/core`
 * declares `sass` as an OPTIONAL peer dependency (SPEC-REQ-3) — a plain-CSS-only
 * consumer never installs it. The SCSS branch of `parseStyle` (Plan 10-03) calls
 * `loadSass()`; when it returns `null`, `parseStyle` emits `ROZ085` rather than
 * throwing (D-08 collected-not-thrown contract).
 *
 * Implementation note: mirrors `packages/unplugin/src/solid-detect.ts` — the
 * established `createRequire(import.meta.url)` optional-dependency idiom. The
 * difference: `solid-detect` only needs a boolean (`require.resolve`), so it can
 * stop at the resolve step; this resolver needs the module OBJECT, so it calls
 * `require('sass')` (resolve + load in one call). The `MODULE_NOT_FOUND` is
 * raised by the resolve step, so one try/catch covers both.
 *
 * `import.meta.url` is ESM-only; `@rozie/core` ships dual ESM + CJS via tsdown.
 * `solid-detect.ts` proves tsdown/Rolldown down-levels `createRequire(import.meta.url)`
 * correctly for the CJS build — do NOT hand-roll a CJS fallback.
 *
 * @experimental — shape may change before v1.0
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * The deterministic option subset of `compileString` the compiler relies on.
 *
 * Typing this explicitly (rather than a bare `object`) makes a typo such as
 * `charSet: false` a compile error. `charset: false` is LOAD-BEARING for the
 * dist-parity byte gate — it suppresses the `@charset`/BOM dart-sass would
 * otherwise inject; a silent revert to defaults would break byte parity.
 */
export interface SassCompileStringOptions {
  style?: 'expanded' | 'compressed';
  charset?: boolean;
  sourceMap?: boolean;
  logger?: object;
}

/**
 * The subset of the `sass` (dart-sass) public API the compiler uses.
 *
 * `compileString` is the modern synchronous API (stable since dart-sass 1.45.0);
 * `Logger.silent` suppresses dart-sass's deprecation warnings on stderr.
 *
 * `Exception` is dart-sass's invalid-SCSS error type. Its real constructor is
 * NOT zero-arg, so it is typed here as an opaque constructor only. Callers must
 * NOT use `new sass.Exception()` or `err instanceof sass.Exception` — `parseStyle`
 * deliberately duck-types `sassMessage`/`span` instead (a thrown error's `name`
 * is the generic `'Error'`, not `'Exception'`).
 */
export interface SassModule {
  compileString(
    source: string,
    options?: SassCompileStringOptions,
  ): { css: string };
  Exception: new (...args: never[]) => Error;
  Logger: { silent: object };
}

/**
 * Synchronously resolve the optional `sass` peer dependency.
 *
 * @returns the resolved `sass` module when installed; `null` when `sass` is
 *   absent (the `require('sass')` call throws an Error whose
 *   `code === 'MODULE_NOT_FOUND'`). Any OTHER error — a corrupt but installed
 *   `sass` — is re-thrown: a genuine load-time failure inside an installed
 *   package is a real bug, not a "missing peer" condition.
 */
export function loadSass(): SassModule | null {
  try {
    return require('sass') as SassModule;
  } catch (err: unknown) {
    // MODULE_NOT_FOUND → optional peer absent → caller emits ROZ085.
    if ((err as { code?: string }).code === 'MODULE_NOT_FOUND') return null;
    throw err;
  }
}
