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
 * Lit's `nothing` sentinel in an `attr=${...}` binding removes the attribute.
 *
 * @public — runtime API consumed by emitted Lit .ts files.
 */
import { nothing } from 'lit';
import { rozieDisplay } from './rozieDisplay.js';

export function rozieAttr(v: unknown): string | typeof nothing {
  return v == null ? nothing : rozieDisplay(v);
}
