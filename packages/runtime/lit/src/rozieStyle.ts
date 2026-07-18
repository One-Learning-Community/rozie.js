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
 *   - an ARRAY of the above (`:style="[a, b]"`, quick task 260717-uvk) →
 *     each element is normalized into ONE merged plain object (a string
 *     element's declarations parsed into `{ prop: value }` entries — KEPT in
 *     whatever casing the author wrote, since `styleMap` itself dispatches
 *     per-key on `setProperty` (dash present) vs. direct property assignment,
 *     so both kebab and camelCase already apply correctly; an object
 *     element's own-enumerable entries copied verbatim) merged left-to-right
 *     via plain assignment — a later element overrides an earlier one for the
 *     same property, mirroring Vue's `normalizeStyle` semantics — then
 *     `styleMap(merged)` (or `nothing` when the merged object is empty).
 *
 * Object keys are iterated via `styleMap` itself, which uses own-enumerable
 * iteration — a non-enumerable `__proto__`/`constructor` literal key never emits
 * a declaration; prototype-pollution-safe, no prototype walk. The array-merge
 * branch above applies the same own-enumerable-only discipline via
 * `Object.keys`.
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

/**
 * Parse a CSS declaration string into `{ property: value }` entries, keeping
 * each property's original casing verbatim — `styleMap` itself decides
 * `setProperty` (kebab / any name containing a dash) vs. direct property
 * assignment (camelCase) per key, so no case conversion is needed here.
 * Malformed / colon-less segments are skipped; never throws.
 */
function parseStyleDeclarations(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    if (prop.length === 0 || value.length === 0) continue;
    out[prop] = value;
  }
  return out;
}

export function rozieStyle(
  v: StyleValue | Array<StyleValue>,
): string | ReturnType<typeof styleMap> | typeof nothing {
  if (Array.isArray(v)) {
    const merged: Record<string, string | number> = {};
    for (const element of v) {
      if (element == null) continue;
      if (typeof element === 'string') {
        Object.assign(merged, parseStyleDeclarations(element));
        continue;
      }
      for (const key of Object.keys(element)) {
        const value = element[key];
        if (value == null) continue;
        merged[key] = value;
      }
    }
    return Object.keys(merged).length === 0 ? nothing : styleMap(merged);
  }
  if (v == null) return nothing;
  if (typeof v === 'string') {
    return v.trim() === '' ? nothing : v;
  }
  if (Object.keys(v).length === 0) return nothing;
  return styleMap(v);
}
