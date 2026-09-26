/**
 * pickListeners — runtime helper, Solid (bugfix for the R6 auto-fallthrough
 * `mergeListeners(..., attrs)` merge-partial shape).
 *
 * BUG (confirmed by a solid-js 1.9.12 render audit): when a root element has
 * BOTH an owned `class`/`style` (computed by the component, e.g. `"rozie-
 * dialog" + (attrs.class ? …)`) AND a directly-bound `@event` listener, the
 * Phase 16 D-19 auto-fallthrough path merges the events partial with the
 * WHOLE `attrs` rest-of-props bucket via `mergeListeners({ onClick: … },
 * attrs)` so a consumer-supplied `onClick` (an UNDECLARED prop, indistinguish-
 * able at compile time from any other pass-through key) still fires
 * alongside the component's own handler (R6 all-fire).
 *
 * `mergeListeners` copies EVERY key of every partial (non-function values
 * last-wins — see its own doc comment). Since `attrs` also carries `class`,
 * `style`, and any other non-listener pass-through key, spreading the WHOLE
 * bucket as a merge partial re-introduces `attrs.class`/`attrs.style`
 * UNMODIFIED at the tail of the JSX attribute list — silently overwriting the
 * class/style value the emitter had already correctly merged one attribute
 * earlier (`class={"rozie-dialog" + (attrs.class ? …)}`). Verified result: a
 * consumer's `class="consumer-class"` REPLACED `"rozie-dialog"` instead of
 * appending to it.
 *
 * THE FIX: filter `attrs` down to just its listener-shaped keys — JSX
 * `on*`-prefixed keys whose value is a function — before handing it to
 * `mergeListeners`. Every other key (class, style, id, aria-*, data-*, …) is
 * already delivered to the DOM via the element's OWN `{...attrs}` spread (or
 * its per-attribute re-computation), so `mergeListeners` never needs to see
 * it — only the listener keys need R6 all-fire merge semantics.
 *
 * SECURITY (T-15-V5-03 — prototype pollution): mirrors the FORBIDDEN_KEYS
 * guard used by `normalizeAttrs`/`normalizeListeners`/`mergeListeners` —
 * skipped defensively even though a forbidden key is never function-typed
 * in practice.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */

/** Keys whose presence in attacker-controllable input is a pollution vector. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** JSX listener-prop naming convention: `onClick`, `onMouseEnter`, … */
const LISTENER_KEY_PATTERN = /^on[A-Z]/;

/**
 * Return a null-prototype object containing only `attrs`'s JSX-listener-
 * shaped keys (`on*`, function-valued). Every non-function / non-`on*` key
 * is dropped — it is not a listener and must not re-enter a
 * `mergeListeners(...)` call that sits AFTER the element's own class/style
 * attribute in source order.
 */
export function pickListeners(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(attrs)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (!LISTENER_KEY_PATTERN.test(key)) continue;
    const value = attrs[key];
    if (typeof value !== 'function') continue;
    out[key] = value;
  }
  return out;
}
