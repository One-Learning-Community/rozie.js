/**
 * mergeListeners — Phase 15 (listener fallthrough) R6 source-order merge.
 *
 * The Phase 15 SPEC R6 all-fire rule: when multiple handlers bind the SAME
 * event on one element (either via `@event` + `r-on`, or via two `r-on`s),
 * ALL handlers fire in SOURCE ORDER — NOT the JSX/Vue/Svelte last-wins
 * default. Phase 14's class/style merge is the precedent: same idea, lifted
 * onto event listeners.
 *
 * When the emitter can see EVERY handler for an event statically (the
 * "all-literal" case — every contributor is an `@event` Listener or an
 * `r-on` literalKeys entry), the React/Solid emitter inlines a per-key
 * dispatcher arrow at compile time: `onClick={(e) => { f1(e); f2(e); }}`.
 *
 * When ANY contributor is an opaque dynamic `r-on` spread (no literalKeys
 * — the keys are not statically knowable), the all-fire merge has to happen
 * at RUNTIME. The emitter routes both the events-side partial AND each
 * dynamic-spread partial through this helper:
 *
 *   {...mergeListeners(
 *     { onClick: () => f1(...) },         // partial built from @event
 *     normalizeListeners(spreadObj),      // partial from dynamic r-on
 *   )}
 *
 * Each partial is a `Record<string, unknown>` whose values are EventListener
 * functions. For each key, mergeListeners walks the partials in array order
 * and, if a key collides, wraps the prior value and the current value into
 * a single dispatcher arrow that calls each in arrival order. Non-function
 * values pass through with last-wins semantics — calling a non-function
 * throws at the call site (React's existing behavior for `onClick={undefined}`
 * is a silent no-op; calling a non-function bubbles up loud at the host
 * reconciler).
 *
 * SECURITY (T-15-V5-03 — prototype pollution): the output is built on a
 * null-prototype object AND the FORBIDDEN_KEYS guard is applied to each
 * partial's keys before merging. Mirrors `normalizeListeners`'s guard.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */

/** Keys whose presence in attacker-controllable input is a pollution vector. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Merge an array of listener-partial objects into a single null-prototype
 * object whose colliding keys are wrapped into a source-order dispatcher
 * (R6 all-fire). Non-function values pass through with last-wins semantics.
 *
 * `mergeListeners({ onClick: f1 }, { onClick: f2 })` → `{ onClick: dispatch }`
 * where `dispatch(e)` calls `f1(e)` then `f2(e)`.
 *
 * `mergeListeners({ onClick: f1 }, { onMouseEnter: g })` → `{ onClick: f1,
 * onMouseEnter: g }` (no collision; both preserved).
 *
 * `mergeListeners({ onClick: f1 }, { onClick: f2 }, { onClick: f3 })` →
 * `{ onClick: dispatch }` where `dispatch(e)` calls all three in arrival
 * order.
 */
export function mergeListeners(
  ...partials: Array<Record<string, unknown>>
): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  for (const partial of partials) {
    if (partial === null || partial === undefined) continue;
    for (const key of Object.keys(partial)) {
      // SECURITY (T-15-V5-03) — never copy a pollution-vector key.
      if (FORBIDDEN_KEYS.has(key)) continue;
      const incoming = partial[key];
      const existing = out[key];
      if (existing === undefined) {
        out[key] = incoming;
        continue;
      }
      // Both function — wrap in a source-order dispatcher.
      if (typeof existing === 'function' && typeof incoming === 'function') {
        const prevFn = existing as (...args: unknown[]) => unknown;
        const newFn = incoming as (...args: unknown[]) => unknown;
        out[key] = (...args: unknown[]) => {
          prevFn(...args);
          newFn(...args);
        };
        continue;
      }
      // Non-function value (defensive — author may pass undefined or a
      // non-function). Last-wins matches React's existing semantics for
      // `onClick={undefined}` (silent no-op) and lets a calling code path
      // fail loud if a non-function value is invoked.
      out[key] = incoming;
    }
  }
  return out;
}
