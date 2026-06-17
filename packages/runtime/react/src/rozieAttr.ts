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
 * On JSX targets, returning `undefined` omits the attribute from the rendered
 * element.
 *
 * Generic in the input so a string-literal union (e.g. an `aria-orientation`
 * value `'horizontal' | 'vertical'`) is PRESERVED through the wrap rather than
 * widened to `string`. React types narrow aria/enumerated attributes to literal
 * unions; widening to `string` here would make a provably-valid value
 * unassignable (TS2322). Non-string inputs (numbers/booleans/objects) are
 * stringified at runtime, so their wrapped type is `string`.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { rozieDisplay } from './rozieDisplay.js';

export function rozieAttr<T>(v: T): (T extends string ? T : string) | undefined {
  return (v == null ? undefined : rozieDisplay(v)) as (T extends string ? T : string) | undefined;
}
