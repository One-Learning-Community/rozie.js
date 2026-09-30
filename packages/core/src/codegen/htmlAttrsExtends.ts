/**
 * renderHtmlAttrsExtends — typed public surface phase 3 (spec §5).
 *
 * When auto-fallthrough fires (single html root, inherit-attrs on — the SAME
 * predicate `synthesizeAttrsFallthrough` uses, via `resolveAttrsFallthroughRoot`),
 * a consumer's undeclared attributes land on that root at runtime. This renders
 * the `extends Omit<RootAttrs, OwnKeys | ContentOwnedKeys>` clause that makes
 * the props interface accept them:
 *   - `Omit` of the component's own member names makes own props win on a
 *     collision (and avoids TS2430 "incorrectly extends");
 *   - content-owned keys (`children`, `innerHTML`, Solid `ref`, …) stay
 *     rejected — spreading them onto the root would replace its content or
 *     hijack its ref.
 * Returns '' when fallthrough does not fire, so those components stay
 * byte-identical.
 *
 * Listeners are NOT omitted for `inherit-listeners="false"`: on React, Solid and
 * Svelte the consumer's `on*` keys ride the same attrs rest/spread and still
 * reach the root at runtime (verified by emit probe, typed-surface P3 Task 3).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../ir/types.js';
import { resolveAttrsFallthroughRoot } from '../ir/lowerers/lowerTemplate.js';
import { escapeSingleQuotedKey } from './escapeSingleQuotedKey.js';
import { HTML_INTRINSIC_TAGS, SVG_INTRINSIC_TAGS } from './htmlIntrinsicTags.js';

/**
 * The targets whose props interfaces need the `extends` clause. Vue, Angular
 * and Lit accept pass-through attributes natively.
 *
 * @experimental — shape may change before v1.0
 */
export type HtmlAttrsTarget = 'react' | 'solid' | 'svelte';

const CONTENT_OWNED_KEYS: Readonly<Record<HtmlAttrsTarget, readonly string[]>> = {
  react: ['children', 'dangerouslySetInnerHTML'],
  solid: ['children', 'innerHTML', 'innerText', 'textContent', 'ref'],
  svelte: ['children'],
};

/**
 * The attribute type of a root `tag` on `target` — element-specific for a
 * standard HTML tag, the generic `HTMLAttributes<HTMLElement>` otherwise.
 * Shared by the props-interface `extends` clause and React's typed R6
 * all-fire merge partial, so both name the same element surface.
 *
 * @experimental — shape may change before v1.0
 */
export function renderHtmlAttrsBaseType(target: HtmlAttrsTarget, tag: string): string {
  return attrsBaseType(target, tag.toLowerCase());
}

function attrsBaseType(target: HtmlAttrsTarget, tag: string): string {
  const known = HTML_INTRINSIC_TAGS.has(tag) || SVG_INTRINSIC_TAGS.has(tag);
  switch (target) {
    case 'react':
      return known
        ? `import('react').ComponentPropsWithoutRef<'${tag}'>`
        : `import('react').HTMLAttributes<HTMLElement>`;
    case 'solid':
      return known
        ? `import('solid-js').ComponentProps<'${tag}'>`
        : `import('solid-js').JSX.HTMLAttributes<HTMLElement>`;
    case 'svelte':
      // Always index by the real tag: `SvelteHTMLElements` types every HTML
      // and SVG element, and its catch-all `[name: string]: { [name: string]:
      // any }` entry covers custom elements — so the component's own
      // `{...__rozieAttrs}` spread onto the root always svelte-checks.
      return `import('svelte/elements').SvelteHTMLElements['${tag}']`;
  }
}

// Top-level interface member: exactly two-space indent, optional `readonly`,
// then a quoted or identifier key, optional `?`, then `:`. JSDoc (`  /**`,
// `   *`), nested object lines (4+ spaces) and index signatures (`  [`) never
// match.
const MEMBER_RE = /^ {2}(?:readonly )?(?:'((?:[^'\\]|\\.)*)'|"([^"]*)"|([A-Za-z_$][\w$]*))\??:/;

/**
 * The top-level member names of a props-interface body, in declaration order.
 * Each entry may itself span several `\n`-joined lines (a JSDoc block).
 *
 * @experimental — shape may change before v1.0
 */
export function collectInterfaceMemberNames(fieldLines: readonly string[]): string[] {
  const names: string[] = [];
  for (const entry of fieldLines) {
    for (const line of entry.split('\n')) {
      const m = MEMBER_RE.exec(line);
      if (m === null) continue;
      names.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : (m[2] ?? m[3]!));
    }
  }
  return names;
}

/**
 * ` extends Omit<…>` for a props interface whose body is `fieldLines`, or ''
 * when attribute auto-fallthrough does not fire for `ir`.
 *
 * @experimental — shape may change before v1.0
 */
export function renderHtmlAttrsExtends(
  ir: IRComponent,
  target: HtmlAttrsTarget,
  fieldLines: readonly string[],
): string {
  const root = resolveAttrsFallthroughRoot(ir.template, ir.inheritAttrs);
  if (root === null) return '';
  const tag = root.tagName.toLowerCase();
  const keys = new Set<string>([
    ...collectInterfaceMemberNames(fieldLines),
    ...CONTENT_OWNED_KEYS[target],
  ]);
  const omitted = [...keys].map((k) => `'${escapeSingleQuotedKey(k)}'`).join(' | ');
  return ` extends Omit<${attrsBaseType(target, tag)}, ${omitted}>`;
}
