/**
 * `rozieContext` — globalThis-backed Solid context registry (Phase 36, R11).
 *
 * The `$provide` / `$inject` sigils lower to Solid Context. A provider
 * component and a (possibly deeply nested) consumer component are compiled
 * into SEPARATE modules, yet must share the SAME Solid `Context` object for a
 * given string key — otherwise `useContext` reads the wrong context and
 * `$inject` resolves to the default (undefined).
 *
 * Identity is therefore carried by a PROCESS-GLOBAL registry keyed by the
 * author's string key:
 *
 *   `globalThis.__rozieCtx ??= new Map()`
 *
 * A per-module `const REGISTRY = new Map()` is FORBIDDEN (D-1 / REQ-28): each
 * separately-compiled module would mint its OWN Map and therefore its OWN
 * `createContext(...)` token, breaking cross-file identity. The `??=` against
 * `globalThis` guarantees one shared Map across all Rozie-emitted modules in
 * the same realm.
 *
 * The `__rozieCtx` namespace is shared with the React + Angular registries;
 * within a single bundle only one framework's `createContext` runs, so the
 * map's value type is framework-specific per realm. The collision is benign
 * same-origin app state (threat T-36-03, accepted) — never a security
 * boundary.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { createContext, type Context } from 'solid-js';

const REGISTRY: Map<string, Context<unknown>> = ((
  globalThis as Record<string, unknown>
).__rozieCtx ??= new Map()) as Map<string, Context<unknown>>;

/**
 * Look up — or create-and-store — the Solid Context object for `key`. Two
 * calls with the same `key` (even from separately-compiled modules) return the
 * identical reference.
 */
export function rozieContext(key: string): Context<unknown> {
  let ctx = REGISTRY.get(key);
  if (ctx === undefined) {
    ctx = createContext<unknown>(undefined);
    REGISTRY.set(key, ctx);
  }
  return ctx;
}
