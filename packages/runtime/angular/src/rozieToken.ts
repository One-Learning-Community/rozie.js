import { InjectionToken } from '@angular/core';

/**
 * `rozieToken` — cross-package deduped `InjectionToken` minting (Phase 36
 * `$provide`/`$inject` context primitive, D-1/REQ-28).
 *
 * The registry is seeded from `globalThis.__rozieCtx` rather than a
 * module-local `Map`. This is LOAD-BEARING for cross-package token identity:
 * two separately-compiled Angular components (e.g. a provider in one
 * `@rozie-ui/*` leaf and a consumer in another) each import this module as
 * their own dependency, which under Angular's build graph can resolve to two
 * distinct loaded copies. A module-local `Map` would mint a DISTINCT
 * `InjectionToken` per copy, silently breaking hierarchical DI — `inject(...)`
 * would resolve to `undefined` through the unaware passthrough. Keying the
 * registry on `globalThis` guarantees every loaded copy shares the identical
 * token for the same string key, regardless of how many times this module is
 * bundled. Do NOT convert this to a module-local `Map`.
 *
 * Quick task 260819-qo8 — this used to be inlined at module scope in every
 * emitted Angular component that used `$provide`/`$inject`
 * (`INLINE_ROZIE_TOKEN_FN`, `packages/targets/angular/src/emit/emitContext.ts`).
 * `@rozie/runtime-angular` now ships it as a real export; the emitted
 * component imports it directly (`import { rozieToken } from
 * '@rozie/runtime-angular';`, no alias needed — the emitted call sites already
 * spell it `rozieToken('key')`).
 *
 * @public — runtime API consumed by emitted Angular .ts files.
 */
const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> = ((
  globalThis as Record<string, unknown>
).__rozieCtx ??= new Map()) as Map<string, InjectionToken<unknown>>;

export function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}
