/**
 * pickListeners — runtime helper, React port of `@rozie/runtime-solid`'s
 * `pickListeners` (0cff671ed).
 *
 * React does not syntactically separate listener props from attribute props:
 * a consumer's `onClick` lands in the SAME `attrs` rest bucket as `className`
 * / `id` / `aria-*`. When a root element with auto attr fallthrough ALSO binds
 * its own `@event`, the emitter all-fires both handlers (R6) via
 *
 *   <el {...attrs} className={…merged…}
 *       {...mergeListeners({ onClick: own }, pickListeners(attrs))} />
 *
 * `mergeListeners` copies EVERY key of every partial, so handing it the whole
 * `attrs` bucket would re-apply `attrs.className` / `attrs.style` at the tail
 * of the JSX attribute list and clobber the merged value computed one
 * attribute earlier. This filters `attrs` down to its JSX-listener-shaped keys
 * (`on[A-Z]…`, function-valued) — every other key already reaches the DOM via
 * the element's own `{...attrs}` spread.
 *
 * SECURITY (T-15-V5-03 — prototype pollution): mirrors the FORBIDDEN_KEYS
 * guard used by `normalizeAttrs` / `normalizeListeners` / `mergeListeners`.
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
 * Return a null-prototype object containing only `attrs`'s JSX-listener-shaped
 * keys (`on[A-Z]…`, function-valued).
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
