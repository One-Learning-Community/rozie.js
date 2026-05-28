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
 *
 * `:deep(...)` is the cross-component scoping escape hatch (quick task
 * 260526-mk4). The inner selector is HOISTED into the outer selector and
 * the scope attribute is NOT appended to any node that came from inside
 * a `:deep(...)`. Vue 3.4+ understands `:deep()` natively; this pass
 * mirrors those semantics. Multi-arg `:deep(a, b)` distributes via parent
 * selector cloning.
 */
export function scopeCss(css: string, scopeHash: string): string {
  if (css.length === 0) return css;
  const attr = scopeAttrName(scopeHash);

  const root = postcss.parse(css);

  const transformer = selectorParser((selectors) => {
    const deepLifted = new WeakSet<selectorParser.Node>();
    expandDeepDistribution(selectors);
    selectors.each((sel) => {
      hoistDeep(sel, deepLifted);
    });
    selectors.each((sel) => {
      addScopeAttrToCompound(sel, attr, deepLifted);
    });
  });

  root.walkRules((rule) => {
    // Phase 17 (SPEC-R1 non-Lit arm / SPEC-R4a): `::part(name)` is a
    // cross-shadow-DOM mechanism that only has meaning on Lit. Outside a shadow
    // boundary the selector is inert, so DROP the whole rule rather than
    // scope-mangle it. Silent no-op — no diagnostic. Independent of the `:deep`
    // lowering above (SPEC-R5 byte-identity).
    if (rule.selector.includes('::part(')) {
      rule.remove();
      return;
    }
    rule.selector = transformer.processSync(rule.selector);
  });

  return root.toString();
}

/**
 * Distribute `:deep(a, b)` by cloning the parent selector once per inner
 * branch — matches Vue's scoped-CSS distributive semantics. The subsequent
 * hoist pass unwraps each remaining single-arg `:deep()`.
 */
function expandDeepDistribution(root: selectorParser.Root): void {
  let changed = true;
  while (changed) {
    changed = false;
    const selectors = root.nodes.slice();
    for (const sel of selectors) {
      if (sel.type !== 'selector') continue;
      const distIdx = sel.nodes.findIndex(
        (n) =>
          n.type === 'pseudo' &&
          (n as selectorParser.Pseudo).value === ':deep' &&
          (n as selectorParser.Pseudo).nodes.length > 1,
      );
      if (distIdx === -1) continue;
      const pseudo = sel.nodes[distIdx] as selectorParser.Pseudo;
      const inners = pseudo.nodes.filter(
        (n) => n.type === 'selector',
      ) as selectorParser.Selector[];
      const expanded: selectorParser.Selector[] = inners.map((inner) => {
        const cloned = sel.clone({}) as selectorParser.Selector;
        const clonedPseudo = cloned.nodes[distIdx] as selectorParser.Pseudo;
        clonedPseudo.nodes = [inner.clone({}) as selectorParser.Selector];
        return cloned;
      });
      const selIdx = root.nodes.indexOf(sel);
      root.nodes.splice(selIdx, 1, ...expanded);
      changed = true;
      break;
    }
  }
}

/**
 * Splice the inner contents of each `:deep(X)` into the parent selector and
 * tag those spliced nodes as deep-lifted so the compound walk skips them.
 */
function hoistDeep(
  selector: selectorParser.Selector,
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  for (let i = selector.nodes.length - 1; i >= 0; i--) {
    const node = selector.nodes[i];
    if (
      node &&
      node.type === 'pseudo' &&
      (node as selectorParser.Pseudo).value === ':deep'
    ) {
      const pseudo = node as selectorParser.Pseudo;
      const inner = pseudo.nodes[0];
      if (inner && inner.type === 'selector') {
        const innerNodes = (inner as selectorParser.Selector).nodes;
        innerNodes.forEach((n) => deepLifted.add(n));
        selector.nodes.splice(i, 1, ...innerNodes);
      }
    }
  }
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
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  const nodes = selector.nodes;

  let compoundStart = 0;
  for (let i = 0; i <= nodes.length; i++) {
    const node = nodes[i];
    const isBoundary = !node || node.type === 'combinator';
    if (isBoundary) {
      if (i > compoundStart) {
        let allLifted = true;
        for (let j = compoundStart; j < i; j++) {
          const n = nodes[j];
          if (n && !deepLifted.has(n)) {
            allLifted = false;
            break;
          }
        }
        if (!allLifted) {
          appendScopeToOneCompound(selector, compoundStart, i, attr, deepLifted);
        }
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
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  for (let i = start; i < end; i++) {
    const node = selector.nodes[i];
    if (node && node.type === 'pseudo' && hasNestedSelectorList(node)) {
      const pseudoNode = node as selectorParser.Pseudo;
      pseudoNode.nodes.forEach((innerSel) => {
        if (innerSel.type === 'selector') {
          addScopeAttrToCompound(innerSel as selectorParser.Selector, attr, deepLifted);
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
