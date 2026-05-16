/**
 * scopeCss — rewrite a single CSS rule's selector list to scope each compound
 * selector to a component-specific attribute (e.g. `button` → `button[data-rozie-s-<hash>]`).
 *
 * Why this exists: Solid has no Vite-CSS-Modules-equivalent pipeline. The
 * Solid emitter inlines CSS in a `<style>` JSX element; without selector
 * rewriting, bare element selectors leak globally. This helper mirrors
 * Vue's `<style scoped>` semantics so Solid components have the same
 * isolation as Vue/Svelte/Angular/Lit.
 *
 * Every compound selector in every rule's selector list gets an attribute
 * selector appended, placed BEFORE any pseudo-classes/elements per the
 * CSS spec. Combinators are descended into so descendant/child/sibling
 * selectors get the scope on every compound, not just the rightmost one
 * (matches Vue scoped-CSS behavior).
 *
 * `:root` rules are NOT routed through this helper — `lowerStyles` splits
 * them into `rootRules` and they go into a separate unscoped `<style>` JSX
 * element unchanged (the documented unscoped escape hatch).
 *
 * Hash derivation: see `scopeHash.ts`.
 *
 * Examples:
 *   `button { ... }` → `button[data-rozie-s-abc] { ... }`
 *   `button:disabled { ... }` → `button[data-rozie-s-abc]:disabled { ... }`
 *   `.parent .child { ... }` → `.parent[data-rozie-s-abc] .child[data-rozie-s-abc] { ... }`
 *   `.a, .b { ... }` → `.a[data-rozie-s-abc], .b[data-rozie-s-abc] { ... }`
 *   `:root { ... }` → NOT touched (handled by isRootEscape branch upstream).
 *
 * Kept symmetric with `packages/targets/react/src/emit/scopeCss.ts`. The two
 * files are intentionally duplicated rather than shared — extracting to core
 * would require either a runtime dep on postcss-selector-parser from `core`
 * (a much larger blast radius) or a circular target↔core graph. The duplication
 * is small (~120 LOC) and the targets evolve independently.
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { scopeAttrName } from './scopeHash.js';

/**
 * Rewrite a CSS source string so every scoped rule's selectors include the
 * component scope attribute. Caller is expected to have already filtered out
 * `:root` rules (they should NOT be passed here).
 */
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
    rule.selector = transformer.processSync(rule.selector);
  });

  return root.toString();
}

/**
 * Walk a single selector (one entry from the comma-separated selector list)
 * and append `[<attr>]` to each compound selector. A "compound" here is a run
 * of simple selectors that targets a single element — combinators (descendant
 * space, `>`, `+`, `~`) separate compounds.
 *
 * Within a compound, the scope attribute is placed BEFORE any trailing
 * pseudo-classes/pseudo-elements so the CSS-spec ordering is preserved.
 *
 * Special pseudo-classes that contain nested selector lists (`:not(...)`,
 * `:is(...)`, `:where(...)`, `:has(...)`, etc.) are processed recursively so
 * their inner selectors also get scoped — matching Vue scoped-CSS behavior.
 */
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

/**
 * Insert an `[<attr>]` attribute selector node into the compound spanning
 * [start, end) within `selector`. Insertion goes BEFORE the first trailing
 * pseudo-class/element node so the attribute precedes pseudos.
 *
 * Also descends into pseudo-classes that have nested selector lists (`:not`,
 * `:is`, `:where`, `:has`) and scopes their inner selectors recursively.
 */
function appendScopeToOneCompound(
  selector: selectorParser.Selector,
  start: number,
  end: number,
  attr: string,
): void {
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
