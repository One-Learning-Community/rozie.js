/**
 * `rozieAttr` — attribute-position display helper (nullish drop, 260608-sya).
 *
 * Companion to `rozieDisplay` for the WHOLE-VALUE one-way attribute-binding
 * position only. Unlike interpolation/text position (where `null`/`undefined`
 * stringify to `''`), a nullish *bound attribute value* must DROP the attribute
 * entirely — matching Vue's `:attr` binding (`patchAttr`: `value == null →
 * removeAttribute`) and the web platform.
 *
 * Drop predicate is `v == null` ONLY (null OR undefined) — `false` is NOT
 * dropped (it stringifies to `"false"` via `rozieDisplay`), so a11y-meaningful
 * values like `aria-expanded="false"` and presence selectors like
 * `data-x="false"` survive.
 *
 * Single evaluation: `v` is evaluated exactly once (an inline ternary at the
 * emit site would double-evaluate impure expressions like `keyFor(item, idx)`).
 *
 * On Svelte 5, an attribute bound to `undefined` is omitted from the element.
 *
 * Generic, input-type-preserving signature: `rozieAttr<T>(v: T)` returns
 * `Exclude<T, null | undefined> | undefined`. The non-nullish input type is
 * preserved (not widened to `string`) so a dynamic NUMERIC attribute like
 * `tabindex={rozieAttr(keyboardEnabled() ? 0 : null)}` stays assignable to
 * Svelte's DOM typing `tabindex: number | null | undefined`. (Widening to
 * `string` — the Solid `T extends string ? T : string` form — would reject
 * numeric attrs under svelte-check.) The RUNTIME still stringifies every
 * non-nullish value via `rozieDisplay`; only the static type is preserved, so
 * the `as` cast bridges the compile-time type to the stringified runtime value.
 *
 * @public — runtime API consumed by emitted .svelte files.
 */
import { rozieDisplay } from './rozieDisplay.js';

export function rozieAttr<T>(v: T): Exclude<T, null | undefined> | undefined {
  return (v == null ? undefined : rozieDisplay(v)) as Exclude<T, null | undefined> | undefined;
}
