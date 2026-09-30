/**
 * Standard HTML tag names keyed by ALL THREE of React's intrinsic elements (via
 * `ComponentPropsWithoutRef<tag>`), Solid's `JSX.IntrinsicElements` (via
 * `ComponentProps<tag>`) and `svelte/elements` `SvelteHTMLElements`. A root tag
 * outside this set (custom elements, SVG, newer tags a floor version lacks)
 * falls back to the generic `HTMLAttributes<HTMLElement>` so the emitted
 * `extends` clause always compiles on the supported floors.
 *
 * @experimental — shape may change before v1.0
 */
export const HTML_INTRINSIC_TAGS: ReadonlySet<string> = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo',
  'blockquote', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em',
  'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'iframe', 'img', 'input', 'ins', 'kbd',
  'label', 'legend', 'li', 'main', 'map', 'mark', 'menu', 'meter', 'nav', 'object', 'ol',
  'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'section', 'select', 'small', 'source', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time',
  'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
]);

/**
 * Typed-surface P3 review fix — SVG root tags that React's intrinsic elements
 * (`ComponentPropsWithoutRef<'svg'>` → `SVGProps<SVGSVGElement>`) and Solid's
 * (`ComponentProps<'svg'>` → `SvgSVGAttributes`) both key. An `<svg>` root
 * (the common icon-component shape) must get SVG attributes (`fill`,
 * `viewBox`, …) — the generic `HTMLAttributes<HTMLElement>` fallback both
 * rejects them for the consumer and mistypes the component's own
 * `{...attrs}` spread onto the `<svg>`. Svelte needs no list: it indexes
 * `SvelteHTMLElements` by the real tag (catch-all entry for unknown tags).
 *
 * @experimental — shape may change before v1.0
 */
export const SVG_INTRINSIC_TAGS: ReadonlySet<string> = new Set(['svg']);
