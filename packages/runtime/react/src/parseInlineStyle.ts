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
 * Delegates to `style-to-js` (a ~1 KB inline-style parser built on
 * `inline-style-parser`) invoked with `{ reactCompat: true }`. That single
 * call subsumes both the declaration parse and the kebab→camel key
 * conversion this helper used to perform by hand:
 *   - parses the gotchas a naive split-on-`;` misses — quoted strings with
 *     semicolons (`content: 'foo;bar'`), `url(data:…;base64,…)` data URIs,
 *     inline comments, `!important`;
 *   - camelCases keys, capitalizing vendor prefixes the way React/Solid
 *     style objects expect (`-webkit-mask` → `WebkitMask`) and passing CSS
 *     custom properties (`--foo`) through verbatim.
 *
 * Replaced postcss (2026-06-04). postcss was the ONLY dependency these
 * runtime packages leaked into a consumer bundle (~24 KB gzip) and it was
 * reachable solely through this helper; style-to-js is ~1.5 KB gzip and
 * produces byte-identical output for the inline-declaration subset. A
 * differential test (`parseInlineStyle.parity.test.ts`) pins the new output
 * to the prior postcss implementation, kept as the oracle in devDependencies.
 *
 * Crash-safety (SPEC-1): the runtime path has no diagnostic stream, so a
 * parse failure must never escape as an exception — `style-to-js` throws on
 * some malformed input, so the call is wrapped to degrade to `{}`.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import styleToJS from 'style-to-js';

const KEBAB_TO_CAMEL_CACHE = new Map<string, string>();

/**
 * Convert kebab-case CSS property name to React/Vue/Solid style-object key:
 *   background-color   →  backgroundColor
 *   -webkit-mask       →  WebkitMask
 *   -moz-foo           →  MozFoo
 *   --custom-prop      →  --custom-prop   (CSS custom properties pass through)
 *   font-size          →  fontSize
 *
 * Retained as a public export (and used by the differential parity test's
 * oracle); the main `parseInlineStyle` path now gets key conversion from
 * `style-to-js` directly.
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
 * Parse an inline-style string into a style-object suitable for React /
 * Solid `style` props. Returns `{}` for empty, whitespace-only, or
 * unparseable input — never throws (see crash-safety note above).
 */
export function parseInlineStyle(text: string): Record<string, string> {
  if (text.length === 0 || /^\s*$/.test(text)) return {};
  try {
    return styleToJS(text, { reactCompat: true });
  } catch {
    return {};
  }
}
