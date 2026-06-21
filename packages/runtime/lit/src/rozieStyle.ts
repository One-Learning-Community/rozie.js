/**
 * `rozieStyle` — string|object `:style` normalizer for Lit (quick task 260620-rta).
 *
 * Generalizes a dynamic `:style="expr"` binding to accept `string | object`
 * portably. Lit's native attribute binding toString-coerces an object value to
 * `[object Object]`, so a dynamic OBJECT `:style` (e.g. `:style="$props.obj"`)
 * silently rendered garbage CSS. This helper routes the dynamic path through
 * Lit's `styleMap` directive when the value is an object (preserving Lit's
 * per-property diffing + camelCase→kebab CSS-key conversion), and passes a
 * string value through verbatim.
 *
 * Behaviour (mirrors React/Solid `parseInlineStyle` + Vue `normalizeStyle`
 * acceptance, and the nullish-drop stance of `rozieAttr`):
 *   - `null` / `undefined` → `nothing` (Lit DROPS the attribute — `undefined`
 *     would render `style=""`; only the `nothing` sentinel removes it, exactly
 *     as `rozieAttr` does).
 *   - string: empty / whitespace-only → `nothing`; else the string verbatim.
 *   - object with zero own-enumerable keys → `nothing`.
 *   - non-empty object → `styleMap(v)` (the DirectiveResult is a valid
 *     `style=${...}` binding value alongside the string / nothing branches).
 *
 * Object keys are iterated via `styleMap` itself, which uses own-enumerable
 * iteration — a non-enumerable `__proto__`/`constructor` literal key never emits
 * a declaration; prototype-pollution-safe, no prototype walk.
 *
 * Pure and stateless: re-evaluating the call at a reactive binding site always
 * yields the current style for the current inputs (the runtime half of the
 * reactivity guarantee — the compile-time inline-placement half lives in the
 * emitter, which keeps `rozieStyle(...)` as the DIRECT binding-site value, never
 * a hoisted const).
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import { nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

type StyleValue = string | Record<string, string | number> | null | undefined;

export function rozieStyle(
  v: StyleValue,
): string | ReturnType<typeof styleMap> | typeof nothing {
  if (v == null) return nothing;
  if (typeof v === 'string') {
    return v.trim() === '' ? nothing : v;
  }
  if (Object.keys(v).length === 0) return nothing;
  return styleMap(v);
}
