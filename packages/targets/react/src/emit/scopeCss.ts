/**
 * scopeCss — rewrite a single CSS rule's selector list to scope each compound
 * selector to a component-specific attribute (e.g. `button` → `button[data-rozie-s-<hash>]`).
 *
 * Why this exists: React's CSS Modules pipeline only hashes class names. Bare
 * element selectors (`button { ... }`) survive un-prefixed and apply globally
 * across the page. That breaks the cross-target parity promise — Vue, Svelte,
 * Angular, and Lit all isolate each component's styles via framework-native
 * mechanisms (`<style scoped>`, class-hashing, `_ngcontent-*`, shadow DOM).
 *
 * This helper mirrors Vue's `<style scoped>` semantics manually: every
 * compound selector in every rule's selector list gets an attribute
 * selector appended, placed BEFORE any pseudo-classes/elements per the
 * CSS spec. Combinators are descended into so descendant/child/sibling
 * selectors get the scope on every compound, not just the rightmost one
 * (matches Vue scoped-CSS behavior).
 *
 * `:root` rules are NOT routed through this helper — `lowerStyles` splits
 * them into `rootRules` and they go to the sibling `.global.css` file
 * unchanged (the documented unscoped escape hatch).
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

  // Parse the CSS source. postcss accepts arbitrary CSS fragments — no need
  // to wrap in a wrapper rule.
  const root = postcss.parse(css);

  // Build a single selector-parser processor we can reuse.
  const transformer = selectorParser((selectors) => {
    selectors.each((sel) => {
      addScopeAttrToCompound(sel, attr);
    });
  });

  root.walkRules((rule) => {
    rule.selector = transformer.processSync(rule.selector);
  });

  // Re-stringify. postcss preserves comments/formatting reasonably well.
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
 * For example, `button:disabled` becomes `button[data-rozie-s-x]:disabled`,
 * NOT `button:disabled[data-rozie-s-x]` (the latter parses fine but reads
 * oddly and diverges from Vue's `data-v-*` placement).
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

  // Walk left→right, tracking the start index of each compound. A combinator
  // node marks the boundary between compounds.
  let compoundStart = 0;
  for (let i = 0; i <= nodes.length; i++) {
    const node = nodes[i];
    const isBoundary = !node || node.type === 'combinator';
    if (isBoundary) {
      // Process the [compoundStart, i) compound.
      if (i > compoundStart) {
        appendScopeToOneCompound(selector, compoundStart, i, attr);
      }
      compoundStart = i + 1; // skip the combinator itself
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
  // First pass: recurse into nested selector-list pseudos so the scope reaches
  // their inner selectors too (matches Vue scoped behavior).
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

  // Second pass: find the insertion point for THIS compound's scope attr —
  // the index of the first trailing pseudo-class/element. If none, insert at
  // the end (`end`). Scan from the right while the node is a pseudo.
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

  // Build the attribute node and insert it.
  const attrNode = selectorParser.attribute({
    attribute: attr,
    value: undefined,
    raws: {},
    quoteMark: null,
  });

  // postcss-selector-parser's container.insertBefore takes a reference node.
  if (insertIdx < selector.nodes.length) {
    const refNode = selector.nodes[insertIdx]!;
    selector.insertBefore(refNode, attrNode);
  } else {
    selector.append(attrNode);
  }
}

/**
 * Pseudo-classes that wrap a comma-separated nested selector list whose
 * inner selectors should themselves be scoped. Matches the SelectorListPseudo
 * set Vue's scoped-CSS rewriter uses.
 */
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
