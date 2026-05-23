/**
 * applyListeners — Phase 15 (listener fallthrough) Svelte 5 action helper.
 *
 * The Phase 15 D-11 lock: Svelte 5 has NO Vue-3-style `v-on="<obj>"` syntax,
 * so the only idiomatic shape for attaching a dynamic key-keyed event-listener
 * object to a node is a Svelte 5 ACTION. Phase 14 didn't need a Svelte
 * runtime helper for attributes because `{...obj}` is native Svelte spread;
 * Phase 15 needs `applyListeners` for listener fallthrough.
 *
 * Lifecycle (verified — https://svelte.dev/docs/svelte/svelte-action):
 *   - Action runs synchronously after the element is created
 *   - Returns `{ update?(params), destroy?() }`
 *   - `update(next)` runs when the action's parameter changes (by reference)
 *   - `destroy()` runs deterministically on (a) `{#if}` block removal,
 *     (b) component unmount, (c) parent destroy — A3 verified
 *
 * This is the FIRST real export from `@rozie/runtime-svelte` beyond the
 * existing `./PortalHost.svelte` entry — the runtime package transitions
 * from a documentation `export {};` stub to a real `applyListeners` export
 * (D-11 lock).
 *
 * Compile-time path (preferred — zero runtime cost):
 *   r-on="{ click: fn, mouseenter: hover }"  is a LITERAL — the Svelte
 *   emitter walks the ObjectExpression and emits per-key native
 *   `on:click={fn}` directives at compile time.
 *
 * Runtime path (this action — used only when the compile-time walk can't
 * apply, i.e. the `r-on` expression is NOT an object literal):
 *   r-on="someObj"          →  use:applyListeners={someObj}
 *   r-on="$listeners"       →  use:applyListeners={$listeners} (D-19 — the
 *                              action still runs because Svelte has no
 *                              object-form listener directive; the action
 *                              owns the attach/detach lifecycle; the
 *                              consumer's $listeners object is passed
 *                              unwrapped)
 *
 * SECURITY (T-15-V5-03 — prototype pollution): the keys of a dynamic `r-on`
 * object may be consumer- or data-controlled. Keys matching `__proto__`,
 * `constructor`, or `prototype` are SKIPPED — never attached to the node —
 * in both the initial-attach loop AND inside `update(next)`. Byte-equal
 * mirror of Phase 14's `normalizeAttrs` FORBIDDEN_KEYS guard.
 *
 * Cleanup discipline (T-15-V5-04 — listener leak): a per-action-instance
 * `disposers = new Map<string, EventListener>()` captures every attached
 * pair. `destroy()` iterates and `removeEventListener`s each one, then
 * clears the map; the Svelte runtime GCs the action closure once destroy()
 * returns. `update(next)` diffs prev vs next by reference and re-binds
 * deltas via `removeEventListener` + `addEventListener` (mirrors the Lit
 * `rozieSpread` directive's diff-on-update discipline).
 *
 * @public — runtime API consumed by emitted .svelte files.
 */

/** Keys whose presence in attacker-controllable input is a pollution vector. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Svelte 5 action: attach an event-listener object's entries to `node` via
 * `addEventListener`, capture disposers in a per-instance Map, and diff-on-
 * update + detach-on-destroy. Returns the standard Svelte 5 action shape
 * `{ update(next), destroy() }`.
 *
 * - Initial attach: walk `obj ?? {}` entries (skipping FORBIDDEN_KEYS) and
 *   call `node.addEventListener(k, v)` per entry; store `v` in `disposers`.
 * - `update(next)`: walk prev (disposers) vs next; remove keys that
 *   disappeared, re-bind keys whose handler reference changed, add new
 *   keys. FORBIDDEN_KEYS skipped on the next side.
 * - `destroy()`: iterate `disposers` and `removeEventListener` each pair,
 *   then `disposers.clear()`.
 *
 * Null/undefined safety: `obj` and `next` may both be null or undefined
 * (the action parameter type is `Record<string, EventListener> | null |
 * undefined`). Both branches resolve to an empty object so the iteration
 * paths are uniform (mirrors `rozieSpread`'s CR-03 null-safety convention).
 */
export function applyListeners(
  node: Element,
  // Plan 15-06 — relax the parameter type to `Record<string, unknown>`
  // so the Svelte emit can pass the consumer's combined attrs+listeners
  // cluster (`__rozieAttrs` — typed `Record<string, unknown>` because it
  // carries both `id`/`aria-*` style scalars and `onclick`-style
  // functions). The non-function values are silently skipped inside the
  // attach + update walks (typeof check below), so the relaxed type is
  // behaviorally identical to the narrower `Record<string, EventListener>`
  // shape. svelte-check's strict mode reported the mismatch on the typed
  // fixture set even though the dist-parity emit was byte-correct.
  obj: Record<string, unknown> | null | undefined,
): {
  update(next: Record<string, unknown> | null | undefined): void;
  destroy(): void;
} {
  // Per-action-instance disposer snapshot. The Svelte runtime GCs the closure
  // (and therefore this Map) when destroy() returns.
  const disposers = new Map<string, EventListener>();

  // Initial attach — walk obj ?? {}, skip FORBIDDEN_KEYS, capture handlers.
  // Non-function values (mixed-in attribute scalars like `id: "x"`) are
  // silently skipped — the consumer's combined attr+listener cluster
  // (Svelte's `__rozieAttrs`) carries both shapes and only the function
  // entries are listener candidates.
  const initial = obj ?? {};
  for (const [k, v] of Object.entries(initial)) {
    // SECURITY (T-15-V5-03) — never attach a pollution-vector key.
    if (FORBIDDEN_KEYS.has(k)) continue;
    if (typeof v !== 'function') continue;
    const fn = v as EventListener;
    node.addEventListener(k, fn);
    disposers.set(k, fn);
  }

  return {
    update(next) {
      const safeNext = next ?? {};
      // Pass 1: remove keys that disappeared from `safeNext` (or were
      // present in `disposers` but absent from the new object). The
      // FORBIDDEN_KEYS check is applied on the `safeNext` side so a
      // disposer captured under a forbidden key (defensive — would only
      // happen if a future caller bypassed the initial guard) still gets
      // removed.
      for (const [k, v] of disposers) {
        if (!(k in safeNext)) {
          node.removeEventListener(k, v);
          disposers.delete(k);
        }
      }
      // Pass 2: add new keys / re-bind changed-reference handlers.
      // Non-function values are skipped (mirror of the initial-attach walk).
      // If a key was previously a function and is now non-function (or
      // vanished), the pass-1 loop already detached it; we only add/replace
      // here when the new value is itself a function.
      for (const [k, v] of Object.entries(safeNext)) {
        // SECURITY (T-15-V5-03) — never attach a pollution-vector key.
        if (FORBIDDEN_KEYS.has(k)) continue;
        if (typeof v !== 'function') {
          // If the new value is non-function but a function was captured
          // under this key previously, detach it (parallels the pass-1
          // "key vanished" detach).
          const prev = disposers.get(k);
          if (prev !== undefined) {
            node.removeEventListener(k, prev);
            disposers.delete(k);
          }
          continue;
        }
        const fn = v as EventListener;
        const prev = disposers.get(k);
        if (prev !== fn) {
          if (prev !== undefined) node.removeEventListener(k, prev);
          node.addEventListener(k, fn);
          disposers.set(k, fn);
        }
      }
    },
    destroy() {
      // T-15-V5-04 — invoke every captured disposer and clear the map.
      for (const [k, v] of disposers) {
        node.removeEventListener(k, v);
      }
      disposers.clear();
    },
  };
}
