/**
 * `rozieStyle` — string|object `:style` normalizer for Svelte (quick task 260620-rta).
 *
 * Generalizes a dynamic `:style="expr"` binding to accept `string | object`
 * portably. Svelte's native attribute binding toString-coerces an object value
 * to `[object Object]`, so a dynamic OBJECT `:style` (e.g. `:style="$props.obj"`)
 * silently rendered garbage CSS. Svelte has no `styleMap` equivalent, so this
 * helper serializes an object value to a CSS declaration string; a string value
 * passes through verbatim.
 *
 * Behaviour (mirrors React/Solid `parseInlineStyle` + Vue `normalizeStyle`
 * acceptance, and the nullish-drop stance of `rozieAttr`):
 *   - `null` / `undefined` → `undefined` (Svelte omits an attribute bound to
 *     `undefined`).
 *   - string: empty / whitespace-only → `undefined`; else the string verbatim.
 *   - object: join own-enumerable entries whose value is non-nullish as
 *     `"<kebab(key)>: <value>"` with `"; "`; camelCase→kebab; `--custom-props`
 *     verbatim; vendor `WebkitX`→`-webkit-x` (the same kebab rule the Svelte
 *     emitter's `kebabizeStyleKey` applies to `style:` directive names). Empty
 *     result → `undefined`.
 *   - an ARRAY of the above (`:style="[a, b]"`, quick task 260717-uvk) → each
 *     element is normalized to its CSS-declaration string via the SAME
 *     per-element logic above (a string element verbatim, with any trailing
 *     `;` stripped so concatenation never produces a `;;` — the exact
 *     corruption class documented for Angular's `ɵɵstyleMap`; an object
 *     element via the same `kebabizeStyleKey` join), then concatenated
 *     left-to-right with `'; '`, skipping empty elements. Svelte has no
 *     styleMap-style per-property dedup, so a later duplicate declaration
 *     wins via the CSS cascade (the browser applies the LAST declaration for
 *     a given property) — the same "later wins" outcome as Vue's
 *     `normalizeStyle`, resolved by the browser rather than a JS merge.
 *     Empty result → `undefined`.
 *
 * Object keys are iterated via `Object.keys` (own-enumerable only) so a
 * `__proto__`/`constructor` literal key on a plain object is non-enumerable and
 * never emits a declaration — prototype-pollution-safe, no prototype walk.
 *
 * Pure and stateless: re-evaluating the call at a reactive binding site always
 * yields the current style string for the current inputs (the runtime half of
 * the reactivity guarantee — the compile-time inline-placement half lives in the
 * emitter, which keeps `rozieStyle(...)` as the DIRECT binding-site value, never
 * a hoisted const so Svelte 5 rune reactivity re-reads it).
 *
 * Dependency-free by design: this package must stay self-contained.
 *
 * @public — runtime API consumed by emitted `.svelte` files.
 */
type StyleValue = string | Record<string, string | number> | null | undefined;

/**
 * Convert a JS object-property key (camelCase or already-kebab) to kebab-case
 * for a CSS declaration name. Mirrors the Svelte emitter's `kebabizeStyleKey`:
 *   backgroundColor → background-color
 *   --custom-prop   → --custom-prop   (leading-dash preserved; vendor / CSS-var)
 *   WebkitMask      → -webkit-mask    (leading capital → leading dash)
 */
function kebabizeStyleKey(key: string): string {
  if (key.startsWith('--')) return key;
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * Normalize a single `:style` element (string | object | nullish) to its CSS
 * declaration string, or `''` when the element contributes nothing. Byte-
 * identical to the pre-array-merge single-value behavior below (a string
 * element is returned VERBATIM, not trimmed) — shared by the single-value
 * path and the array-merge branch so there is exactly one parse (no
 * duplicated logic).
 */
function normalizeStyleElement(v: StyleValue): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    return v.trim() === '' ? '' : v;
  }
  const decls: string[] = [];
  for (const key of Object.keys(v)) {
    const value = (v as Record<string, string | number>)[key];
    if (value == null) continue;
    decls.push(`${kebabizeStyleKey(key)}: ${value}`);
  }
  return decls.join('; ');
}

export function rozieStyle(v: StyleValue | Array<StyleValue>): string | undefined {
  if (Array.isArray(v)) {
    const decls = v
      .map((element) => normalizeStyleElement(element))
      // Strip a trailing `;` from each element's own declaration text ONLY
      // for the join — never left in place, or concatenating with the next
      // element's decl would produce a `;;` empty declaration (the exact
      // corruption class documented for Angular's `ɵɵstyleMap`). This only
      // affects the array-merge join; the single-value path below returns a
      // string element verbatim, unchanged from pre-array-merge behavior.
      .map((decl) => decl.trim().replace(/;+\s*$/, ''))
      .filter((decl) => decl !== '');
    return decls.length === 0 ? undefined : decls.join('; ');
  }
  const decl = normalizeStyleElement(v);
  return decl === '' ? undefined : decl;
}
