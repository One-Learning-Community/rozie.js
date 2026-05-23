/**
 * normalizeListeners — Phase 15 (listener fallthrough) runtime helper.
 *
 * The Phase 15 D-08 hybrid: a `.rozie` author's `r-on="<expr>"` object-spread
 * is delivered to Vue's native `v-on="<obj>"` directive. Vue 3's
 * native-element `v-on="<obj>"` documentation (A1 / Pitfall 8) explicitly
 * states the object keys MUST be in lowercase event-name form (`click`,
 * `mouseenter`, …); the `onCamelCase` form is component-prop-only, not
 * native-element. The dogfood ThemedButton's root is a `<button>` — a
 * native element — so the Vue helper degenerates to a FORBIDDEN_KEYS-skipping
 * identity over a null-prototype object.
 *
 * Compile-time path (preferred — zero runtime cost):
 *   r-on="{ click: fn, mouseenter: hover }"  is a LITERAL — the Vue emitter
 *   walks the ObjectExpression and emits per-key native `@event="fn"`
 *   template attributes at compile time (Pitfall A5: Vue's `v-on="obj"`
 *   does NOT support modifiers, so modifier-bearing literal keys MUST take
 *   this path).
 *
 * Runtime path (this helper — used only when the compile-time walk can't
 * apply, i.e. the `r-on` expression is NOT an object literal):
 *   r-on="someObj"          →  v-on="normalizeListeners(someObj)"
 *   r-on="cond ? a : b"     →  v-on="normalizeListeners(cond ? a : b)"
 *
 * The `$listeners` magic accessor is EXEMPT (D-19): a `$listeners` cluster
 * already carries target-native (lowercase) keys, so the Vue emitter
 * emits `v-on="$listeners"` directly WITHOUT a normalizeListeners wrap.
 *
 * SECURITY (T-15-V5-03 — prototype pollution): the keys of a dynamic `r-on`
 * object may be consumer- or data-controlled. Keys matching `__proto__`,
 * `constructor`, or `prototype` are SKIPPED — never copied to the output —
 * and the output is built on a null-prototype object. Byte-equal mirror of
 * Phase 14's `normalizeAttrs` FORBIDDEN_KEYS guard and Phase 15's React-
 * runtime `normalizeListeners` guard.
 *
 * @public — runtime API consumed by emitted .vue files.
 */

/** Keys whose presence in attacker-controllable input is a pollution vector. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Pass an `r-on` listener-object through to Vue's native `v-on="<obj>"`
 * directive. Vue 3's native-element `v-on="<obj>"` form takes lowercase
 * event-name keys (A1 / Pitfall 8 — verbatim from Vue 3 docs: "the object
 * keys should use the event name in lowercase"), so this helper applies NO
 * per-key remap — it is a null-prototype copy with the FORBIDDEN_KEYS skip.
 *
 * - All keys pass through verbatim (lowercase event names, kebab-case custom
 *   events, anything else the author shipped).
 * - `__proto__` / `constructor` / `prototype` keys are SKIPPED (T-15-V5-03).
 *
 * Returns a plain object suitable for a Vue `v-on="<obj>"` binding.
 */
export function normalizeListeners(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // Build on a null-prototype object so a copied key can never collide with
  // an inherited Object.prototype member.
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(obj)) {
    // SECURITY (T-15-V5-03) — never copy a pollution-vector key.
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = obj[key];
  }
  return out;
}
