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
 * On Solid's JSX, returning `undefined` skips the `setAttribute` call.
 *
 * Generic in the input so a string-literal union (e.g. an `aria-orientation`
 * value `'horizontal' | 'vertical'`) is PRESERVED through the wrap rather than
 * widened to `string`. Solid's JSX narrows aria/enumerated attributes to literal
 * unions; widening to `string` here would make a provably-valid value
 * unassignable (TS2322). Non-string inputs (numbers/booleans/objects) are
 * stringified at runtime, so their wrapped type is `string`.
 *
 * A NULLISH member of a MIXED union (e.g. `'tooltip' | 'dialog' | undefined` from
 * a role helper whose neutral case omits the attribute) maps to `never`, NOT
 * `string`: at runtime a nullish `v` is dropped, so the wrapped result for that
 * member is the outer `| undefined`. Distributing it to `string` (the old
 * else-branch) would widen the WHOLE union to `string` and defeat the literal
 * preservation above — the exact regression that broke `Popover`'s `role`.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { rozieDisplay } from './rozieDisplay.js';

export function rozieAttr<T>(
  v: T,
): (T extends string ? T : T extends null | undefined ? never : string) | undefined {
  return (v == null ? undefined : rozieDisplay(v)) as
    | (T extends string ? T : T extends null | undefined ? never : string)
    | undefined;
}
