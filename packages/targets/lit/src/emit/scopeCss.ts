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
import { toKebabCase } from './emitDecorator.js';

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
    // Phase 17 — ::part() cross-shadow bridge. ADDITIVE: only mutates
    // selectors that actually contain a `::part` pseudo, so `:deep` and
    // ordinary scoped rules are byte-identical (SPEC-R5).
    selectors.each((sel) => {
      liftPartName(sel, deepLifted);
    });
    selectors.each((sel) => {
      addScopeAttrToCompound(sel, attr, deepLifted);
    });
  });

  root.walkRules((rule) => {
    if (selectorIsShadowExempt(rule.selector)) return;
    rule.selector = transformer.processSync(rule.selector);
  });

  return root.toString();
}

/**
 * Phase 17 — Lit `::part()` cross-shadow-DOM styling bridge.
 *
 * When a consumer `<style>` selector contains `<child-selector>::part(name)`,
 * the rule must reach the child custom element's `part="name"` shadow element
 * across the child's one shadow boundary. Two strictly-additive adjustments,
 * mirroring the `:deep` `deepLifted` mechanism (we do NOT touch the `:deep`
 * functions' bodies — SPEC-R5):
 *
 *   1. **Part name is literal (SPEC-R6).** Add the `::part` pseudo AND its
 *      inner part-name selector node(s) to `deepLifted` so
 *      `addScopeAttrToCompound` does NOT append `[data-rozie-s]` inside or
 *      after the part name. The `<child-tag>` compound itself is NOT lifted —
 *      it keeps its scope attr (the cross-shadow match key,
 *      `emitTemplate.ts:1161-1166`). Because the compound walk inserts the
 *      attr BEFORE trailing pseudos (`insertIdx` scan), the result is exactly
 *      `<child-tag>[data-rozie-s-<hash>]::part(<name>)` (attr BEFORE `::part`).
 *
 *   2. **Child-tag lowered to the custom-element tag (SPEC-R2).** A consumer
 *      authors the child by its PascalCase component name (`PartCard::part(...)`),
 *      but the Lit emitter renders the invocation as the custom element
 *      `<rozie-part-card>` (`emitTemplate.ts:299-304`). A CSS tag selector of
 *      `PartCard` would never match `<rozie-part-card>` — the rule would
 *      silently no-op, defeating the phase. So the tag node immediately
 *      preceding the `::part` pseudo, if it is a PascalCase component-style
 *      tag, is rewritten to `rozie-<kebab>` to match the emitted element.
 *
 * `::part` is deliberately NOT routed through `selectorIsShadowExempt` — that
 * whole-rule exemption would strip the scope attr off the `<child-tag>`
 * compound (Pitfall 2). The plain `::part` rule still flows through the
 * normal scoped path (the `/:host\b|::slotted\b/` exemption regex does not
 * match `::part`).
 */
function liftPartName(
  selector: selectorParser.Selector,
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  for (let i = 0; i < selector.nodes.length; i++) {
    const node = selector.nodes[i];
    if (
      !node ||
      node.type !== 'pseudo' ||
      (node as selectorParser.Pseudo).value !== '::part'
    ) {
      continue;
    }
    const pseudo = node as selectorParser.Pseudo;

    // (1) Exempt the part name from scope-attribution — the pseudo itself and
    // every node of its inner part-name selector(s).
    deepLifted.add(pseudo);
    pseudo.nodes.forEach((inner) => {
      if (inner.type === 'selector') {
        (inner as selectorParser.Selector).nodes.forEach((n) =>
          deepLifted.add(n),
        );
      }
    });

    // (2) Lower the immediately-preceding tag compound from its author-form
    // PascalCase component name to the emitted custom-element tag.
    const prev = selector.nodes[i - 1];
    if (prev && prev.type === 'tag' && isComponentTag(prev.value)) {
      (prev as selectorParser.Tag).value = `rozie-${toKebabCase(prev.value)}`;
    }
  }
}

/**
 * A Rozie component reference in a CSS selector is its PascalCase component
 * name (e.g. `PartCard`). Plain HTML tag selectors (`div`, `card-body`) are
 * lowercase and must NOT be rewritten. Heuristic: contains an uppercase
 * letter (the PascalCase convention) — matches `emitTemplate.ts` component
 * tag derivation, which only kebab-rewrites `tagKind: 'component'` tags.
 */
function isComponentTag(tagValue: string): boolean {
  return /[A-Z]/.test(tagValue);
}

/**
 * Distribute `:deep(a, b)` by cloning the parent selector once per inner
 * branch. Quick task 260526-mk4 — mirrors react/solid/svelte handling.
 *
 * NOTE: `:deep()` on Lit works WITHIN one shadow root — lifting the scope
 * attr unlocks parent-to-child selectors inside the same shadow tree, but
 * does NOT cross shadow-DOM boundaries. Cross-shadow styling is `::part`
 * territory, out of scope here. See docs/guide/features.md.
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

function appendScopeToOneCompound(
  selector: selectorParser.Selector,
  start: number,
  end: number,
  attr: string,
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  // Recurse into nested-list pseudos first so e.g. `:not(.x)` becomes
  // `:not(.x[attr])`.
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
