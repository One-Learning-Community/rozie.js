/**
 * parseInlineStyle — Spike 004 runtime helper for dynamic :style string exprs.
 *
 * Compile-time path (preferred — zero runtime cost):
 *   :style="'background: red'"  is a string LITERAL — the compiler
 *   pre-parses with postcss and emits the object form directly:
 *     style={{ background: 'red' }}
 *
 * Runtime path (this helper — used only when compile-time pre-parse
 * can't apply, i.e. the expression isn't a string literal):
 *   :style="'opacity: ' + (cond ? '0.5' : '1') + '; ...'"
 *   :style="someStringProp"
 *
 * PostCSS handles all the gotchas naive split-on-`;` misses:
 *   - quoted strings containing semicolons (`content: 'foo;bar'`)
 *   - url(...) and other functions with internal punctuation
 *   - inline comments
 *   - !important flag extraction
 *
 * Why postcss and not a hand-rolled scanner: postcss is already a
 * project dep (see CLAUDE.md tech stack), and a hand-rolled scanner
 * would re-implement quoted-string + paren-balance state machines
 * that postcss already battle-tests.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import postcss from 'postcss';

const KEBAB_TO_CAMEL_CACHE = new Map<string, string>();

/**
 * Convert kebab-case CSS property name to React/Vue/Solid style-object key:
 *   background-color   →  backgroundColor
 *   -webkit-mask       →  WebkitMask
 *   -moz-foo           →  MozFoo
 *   --custom-prop      →  --custom-prop   (CSS custom properties pass through)
 *   font-size          →  fontSize
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
 * Vue / Solid `style` props. PostCSS does the heavy lifting; we walk
 * the declarations and produce the object.
 *
 * `!important` is preserved by appending it to the value, BUT React's
 * style-object form silently drops it. The compile-time path emits a
 * ROZ083 warning when this is detected in a string-LITERAL fragment;
 * the runtime path can't warn (no diagnostic stream), so it just
 * preserves whatever postcss produced.
 */
export function parseInlineStyle(text: string): Record<string, string> {
  // PostCSS parses bare declaration lists by default. Empty / whitespace
  // input yields a root with no decls — return empty object.
  if (text.length === 0 || /^\s*$/.test(text)) return {};

  const obj: Record<string, string> = {};
  try {
    const root = postcss.parse(text);
    root.walkDecls((decl) => {
      const key = toStyleObjectKey(decl.prop);
      obj[key] = decl.important ? `${decl.value} !important` : decl.value;
    });
  } catch (_err) {
    // Parse failure at runtime — return empty object rather than throw.
    // The compile-time path catches malformed style strings via ROZ08x;
    // the runtime path only ever sees expressions that produced valid
    // CSS at authoring time (or the author is responsible).
  }
  return obj;
}
