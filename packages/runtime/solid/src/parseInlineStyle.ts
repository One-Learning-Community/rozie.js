/**
 * parseInlineStyle — runtime helper for dynamic `:style` string expressions.
 *
 * Compile-time path (preferred — zero runtime cost):
 *   :style="'background: red'"  is a string LITERAL — the compiler
 *   pre-parses it and emits the object form directly:
 *     style={{ background: 'red' }}
 *
 * Runtime path (this helper — used only when the compile-time pre-parse
 * can't apply, i.e. the expression isn't a string literal):
 *   :style="'opacity: ' + (cond ? '0.5' : '1') + '; ...'"
 *   :style="someStringProp"
 *
 * SOLID DIFFERENCE (LB6 SEAM 3) — a CSS STRING is passed through VERBATIM and
 * left for Solid's own `style()` runtime helper to apply. Solid applies an
 * object-form `style` by iterating keys into `CSSStyleDeclaration.setProperty(
 * key, value)`, which requires a KEBAB-case CSS property name — a camelCased
 * key (`paddingLeft`) is a silent no-op (verified against solid-js@1.9.x
 * `web.cjs` `style()`). Earlier this helper camelCased declarations (via
 * `style-to-js`'s `reactCompat: true`), so a dynamic `:style` returning
 * `'padding-left:1.75rem'` became `{ paddingLeft: '1.75rem' }` → DROPPED on
 * Solid (single-word props like `overflow` survived; the data-table expander
 * depth-indent `padding-left` did not). Solid's `style()` routes a STRING to
 * `node.style.cssText`, where the browser's own CSS parser handles every
 * declaration correctly — so passing the string through is both simpler and
 * strictly more correct than re-parsing into a camelCased object the Solid
 * runtime then mis-applies.
 *
 * An already-built style OBJECT (a `$computed` returning a CSS-custom-property
 * map such as `{ '--rozie-slider-fill-start': '50%' }`) is passed through
 * unchanged — Solid's `setProperty` handles custom properties regardless of
 * casing.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import type { JSX } from 'solid-js';

const KEBAB_TO_CAMEL_CACHE = new Map<string, string>();

/**
 * Convert kebab-case CSS property name to React/Vue/Solid style-object key:
 *   background-color   →  backgroundColor
 *   -webkit-mask       →  WebkitMask
 *   -moz-foo           →  MozFoo
 *   --custom-prop      →  --custom-prop   (CSS custom properties pass through)
 *   font-size          →  fontSize
 *
 * Retained as a public kebab→camel utility. NOTE (LB6 SEAM 3): the
 * `parseInlineStyle` path no longer camelCases at all — a CSS string is handed
 * to Solid's `style()` (cssText) verbatim, so this helper is no longer on that
 * path. It stays exported for tooling / consumers that key a Solid style object
 * directly. (Solid's `setProperty` actually wants KEBAB keys, so prefer the raw
 * CSS property name for Solid style objects — this camelCaser is React-shaped.)
 */
export function toStyleObjectKey(prop: string): string {
  const cached = KEBAB_TO_CAMEL_CACHE.get(prop);
  if (cached !== undefined) return cached;

  let out: string;
  if (prop.startsWith('--')) {
    // CSS custom properties pass through verbatim.
    out = prop;
  } else if (prop.startsWith('-')) {
    // Vendor prefix: drop leading dash, capitalize first char, then
    // camelCase the rest.
    const stripped = prop.slice(1);
    const camelized = stripped.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out = camelized.charAt(0).toUpperCase() + camelized.slice(1);
  } else {
    // Standard property: camelCase.
    out = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }

  KEBAB_TO_CAMEL_CACHE.set(prop, out);
  return out;
}

/**
 * Parse an inline-style value into a style-object suitable for Solid's
 * `style` prop.
 *
 * A dynamic `:style` binding's runtime value is NOT statically known to the
 * emitter, so this helper accepts the union the author may produce:
 *   - a CSS string (`'opacity: 0.5; color: red'`) → passed through VERBATIM so
 *     Solid's `style()` helper applies it via `cssText` (LB6 SEAM 3);
 *   - an already-built style object (a `$computed` returning a
 *     CSS-custom-property map such as `{ '--rozie-slider-fill-start': '50%' }`,
 *     or a plain style object) → passed through verbatim;
 *   - `null` / `undefined` → `{}`.
 *
 * The return type `string | JSX.CSSProperties` is exactly Solid's `style` JSX
 * prop type, so the emitted `style={parseInlineStyle(<expr>)}` is well-typed.
 * Returns `{}` for empty / whitespace-only input — never throws.
 */
export function parseInlineStyle(
  value: string | JSX.CSSProperties | Record<string, string | number> | null | undefined,
): JSX.CSSProperties | string {
  if (value == null) return {};
  // Already an object (e.g. a CSS-custom-property map from a `$computed`) —
  // pass through; Solid's `style` prop accepts custom properties.
  if (typeof value === 'object') return value as JSX.CSSProperties;
  if (value.length === 0 || /^\s*$/.test(value)) return {};
  // A CSS string — hand it to Solid's `style()` runtime, which sets it via
  // `node.style.cssText`. The browser's CSS parser applies every (kebab-case)
  // declaration correctly, including multi-word props like `padding-left` that
  // a camelCased `setProperty` key would silently drop.
  return value;
}
