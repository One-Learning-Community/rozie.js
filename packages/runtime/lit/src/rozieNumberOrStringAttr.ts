/**
 * `rozieNumberOrStringAttr` — Lit attribute converter for a Number+String
 * union prop (quick 260930-814).
 *
 * A Rozie prop typed `[Number, String]` (in either member order) can arrive on
 * a Lit custom element as an HTML attribute string — `<x-cal height="600">` or
 * `<x-cal height="auto">`. Lit's built-in `type: Number` converter turns
 * `'auto'` into `NaN`, and `type: String` never yields a number, so the Lit
 * emitter wires this converter as `{ fromAttribute: rozieNumberOrStringAttr }`
 * instead, for both non-model props and the `_x_attr` mirror / attribute
 * coerce of `model: true` props.
 *
 * Rule:
 * - `null` (attribute removed) stays `null` — exactly what Lit's own Number and
 *   String converters produce on removal;
 * - a string whose trimmed form is non-empty and for which `Number(value)` is
 *   finite becomes `Number(value)`;
 * - every other string (`'auto'`, `'100%'`, `''`, `'Infinity'`) is returned
 *   unchanged.
 *
 * `Number(v)`-finite (rather than a stricter numeric regex) is deliberate:
 * every attribute value that the old `type: Number` converter turned into a
 * finite number keeps exactly the same number; only the values that used to
 * become `NaN` (the bug), plus `''` and `'Infinity'`, now pass through as
 * strings. `trim()` + `Number()` are linear — no regex backtracking — and the
 * string is never evaluated or JSON-parsed.
 *
 * @public — runtime API consumed by emitted Lit .ts files.
 */
export function rozieNumberOrStringAttr(value: string): number | string;
export function rozieNumberOrStringAttr(value: string | null): number | string | null;
export function rozieNumberOrStringAttr(value: string | null): number | string | null {
  if (value === null) return null;
  if (value.trim() === '') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}
