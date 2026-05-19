/**
 * scopeCss — Lit producer-side CSS scoping pass (Phase 07.6).
 *
 * Mirrors `packages/targets/{react,solid}/src/emit/scopeCss.ts` with two
 * Lit-specific exemptions:
 *   - `:host` (and `:host(...)`, `:host-context(...)`) — the producer
 *     custom element itself, NOT a shadow-DOM descendant. Stamping `[X]`
 *     onto `:host` would require the host element to bear our scope
 *     attribute, which we do not stamp (we only stamp internal template
 *     elements). Selectors starting with `:host` pass through unchanged.
 *   - `::slotted(...)` — matches light-DOM children projected through a
 *     `<slot>`. Those children come from the CONSUMER and never bear the
 *     producer's scope attribute. Selectors containing `::slotted(...)`
 *     pass through unchanged.
 *
 * Why we need this: post-ec24d26, consumer property-fill content renders
 * inside the producer's shadow root, where shadow CSS scoping is
 * shadow-tree-wide. A rule like `header h2 { ... }` matches BOTH the
 * producer's own `<h2>` and any consumer-projected `<h2>`. The other 5
 * targets' framework-native scoping (Vue `[data-v-X]`, etc.) automatically
 * confines producer rules to producer-template elements via attribute /
 * class hashing — only producer-rendered elements carry the marker. Lit
 * lacks this; we synthesize it.
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { scopeAttrName } from './scopeHash.js';

export function scopeCss(css: string, scopeHash: string): string {
  if (css.length === 0) return css;
  const attr = scopeAttrName(scopeHash);

  const root = postcss.parse(css);

  const transformer = selectorParser((selectors) => {
    selectors.each((sel) => {
      addScopeAttrToCompound(sel, attr);
    });
  });

  root.walkRules((rule) => {
    if (selectorIsShadowExempt(rule.selector)) return;
    rule.selector = transformer.processSync(rule.selector);
  });

  return root.toString();
}

/**
 * Lit-specific exemption: shadow-DOM selectors (`:host`, `:host(...)`,
 * `:host-context(...)`, `::slotted(...)`) target elements OUTSIDE the
 * scope-attribute regime (the host element itself OR consumer-projected
 * light-DOM children). Scoping them would force a `[data-rozie-s-X]`
 * requirement on elements that intentionally don't carry it.
 *
 * Conservative match: if the selector list contains a `:host`-family or
 * `::slotted` token, leave the WHOLE rule unscoped. A single selector list
 * mixing scoped and shadow-exempt parts is uncommon enough to not warrant
 * per-compound parsing here; if it materializes we can split.
 */
function selectorIsShadowExempt(selectorText: string): boolean {
  return /:host\b|::slotted\b/.test(selectorText);
}

function addScopeAttrToCompound(
  selector: selectorParser.Selector,
  attr: string,
): void {
  const nodes = selector.nodes;

  let compoundStart = 0;
  for (let i = 0; i <= nodes.length; i++) {
    const node = nodes[i];
    const isBoundary = !node || node.type === 'combinator';
    if (isBoundary) {
      if (i > compoundStart) {
        appendScopeToOneCompound(selector, compoundStart, i, attr);
      }
      compoundStart = i + 1;
    }
  }
}

function appendScopeToOneCompound(
  selector: selectorParser.Selector,
  start: number,
  end: number,
  attr: string,
): void {
  // Recurse into nested-list pseudos first so e.g. `:not(.x)` becomes
  // `:not(.x[attr])`.
  for (let i = start; i < end; i++) {
    const node = selector.nodes[i];
    if (node && node.type === 'pseudo' && hasNestedSelectorList(node)) {
      const pseudoNode = node as selectorParser.Pseudo;
      pseudoNode.nodes.forEach((innerSel) => {
        if (innerSel.type === 'selector') {
          addScopeAttrToCompound(innerSel as selectorParser.Selector, attr);
        }
      });
    }
  }

  let insertIdx = end;
  for (let i = end - 1; i >= start; i--) {
    const node = selector.nodes[i];
    if (!node) break;
    if (node.type === 'pseudo') {
      insertIdx = i;
      continue;
    }
    break;
  }

  const attrNode = selectorParser.attribute({
    attribute: attr,
    value: undefined,
    raws: {},
    quoteMark: null,
  });

  if (insertIdx < selector.nodes.length) {
    const refNode = selector.nodes[insertIdx]!;
    selector.insertBefore(refNode, attrNode);
  } else {
    selector.append(attrNode);
  }
}

const NESTED_LIST_PSEUDOS = new Set([
  ':not',
  ':is',
  ':where',
  ':has',
  ':matches',
  ':-webkit-any',
  ':-moz-any',
]);

function hasNestedSelectorList(node: selectorParser.Pseudo): boolean {
  return NESTED_LIST_PSEUDOS.has(node.value);
}
