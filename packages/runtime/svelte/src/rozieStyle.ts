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

export function rozieStyle(v: StyleValue): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') {
    return v.trim() === '' ? undefined : v;
  }
  const decls: string[] = [];
  for (const key of Object.keys(v)) {
    const value = (v as Record<string, string | number>)[key];
    if (value == null) continue;
    decls.push(`${kebabizeStyleKey(key)}: ${value}`);
  }
  return decls.length === 0 ? undefined : decls.join('; ');
}
