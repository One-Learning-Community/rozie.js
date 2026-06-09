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
 * @public — runtime API consumed by emitted .svelte files.
 */
import { rozieDisplay } from './rozieDisplay.js';

export function rozieAttr(v: unknown): string | undefined {
  return v == null ? undefined : rozieDisplay(v);
}
