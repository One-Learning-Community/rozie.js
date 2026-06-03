/**
 * scopeCss — rewrite a single CSS rule's selector list to scope each compound
 * selector to a component-specific attribute (e.g. `button` → `button[data-rozie-s-<hash>]`).
 *
 * Why this exists: React emits a plain sibling `.css` file with no native
 * scoping of its own — bare element selectors (`button { ... }`) would apply
 * globally across the page. That breaks the cross-target parity promise — Vue,
 * Svelte, Angular, and Lit all isolate each component's styles via
 * framework-native mechanisms (`<style scoped>`, class-hashing, `_ngcontent-*`,
 * shadow DOM). This pass gives React the same isolation via an attribute
 * selector appended to every compound — `[data-rozie-s-<hash>]` is React's
 * SOLE isolation layer (Phase 25 removed the redundant CSS-Modules routing;
 * React no longer hashes class names).
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
 * `:deep(...)` is the cross-component scoping escape hatch (quick task
 * 260526-mk4). The inner selector is HOISTED into the outer selector and
 * the scope attribute is NOT appended to any node that came from inside
 * a `:deep(...)`. Vue 3.4+ understands `:deep()` natively; this pass
 * mirrors those semantics for targets that do their own scope rewriting.
 *
 * Hash derivation: see `scopeHash.ts`.
 *
 * Examples:
 *   `button { ... }` → `button[data-rozie-s-abc] { ... }`
 *   `button:disabled { ... }` → `button[data-rozie-s-abc]:disabled { ... }`
 *   `.parent .child { ... }` → `.parent[data-rozie-s-abc] .child[data-rozie-s-abc] { ... }`
 *   `.a, .b { ... }` → `.a[data-rozie-s-abc], .b[data-rozie-s-abc] { ... }`
 *   `:root { ... }` → NOT touched (handled by isRootEscape branch upstream).
 *   `.outer :deep(.inner) { ... }` → `.outer[data-rozie-s-abc] .inner { ... }`
 *   `:deep(.x) { ... }` → `.x { ... }`
 *
 * React `:deep()` lowering (quick task 260526-no7, corrected in Phase 25): the
 * deep-lifted inner selector is UNWRAPPED to a bare selector — NOT wrapped in
 * CSS Modules' `:global(...)`. The `:global(...)` wrap originally opted the
 * lifted class out of CSS Modules hashing, back when React's `.module.css`
 * output ran through CSS Modules at bundle time. Phase 25 removed CSS Modules
 * (plain `.css`, scoped solely by `[data-rozie-s-<hash>]`), and in plain CSS
 * `:global(...)` is NOT a real selector — a non-CSS-Modules pipeline emits it
 * verbatim and the browser DROPS the whole rule, silently killing the
 * cross-component `:deep()` rule (e.g. the nested-Kanban grid). The bare
 * descendant selector crosses freely in React's light DOM, matching Vue /
 * Svelte / Angular / Solid. Solid injects CSS at runtime with literal class
 * names; Svelte wraps its scoped output in `:global { ... }` (valid Svelte
 * syntax its compiler understands); Lit is shadow-DOM and `:deep()` cannot
 * cross into a child component's shadow root (documented v1 parity gap —
 * `::part()` territory).
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
    // Phase 0: distribute `:deep(.a, .b)` and hoist inner selectors out
    // of every `:deep(...)` wrapper. The hoisted nodes are tagged in
    // `deepLifted` so the scope-attr pass skips them.
    const deepLifted = new WeakSet<selectorParser.Node>();
    expandDeepDistribution(selectors, deepLifted);
    selectors.each((sel) => {
      hoistDeep(sel, deepLifted);
    });
    // Phase 1: scope every compound that isn't fully deep-lifted.
    selectors.each((sel) => {
      addScopeAttrToCompound(sel, attr, deepLifted);
    });
  });

  root.walkRules((rule) => {
    // Phase 17 (SPEC-R1 non-Lit arm / SPEC-R4a): `::part(name)` is a
    // cross-shadow-DOM mechanism that only has meaning on Lit. Outside a shadow
    // boundary the selector is inert, so DROP the whole rule rather than
    // scope-mangle it into a `[data-rozie-s-<hash>]::part(...)` selector that
    // would leak broken/global CSS. Silent no-op — no diagnostic. This is
    // independent of the `:deep` lowering above (SPEC-R5 byte-identity).
    if (rule.selector.includes('::part(')) {
      rule.remove();
      return;
    }
    rule.selector = transformer.processSync(rule.selector);
  });

  // Re-stringify. postcss preserves comments/formatting reasonably well.
  return root.toString();
}

/**
 * If any top-level selector in the list contains a `:deep(a, b, ...)` with
 * MULTIPLE inner selectors, expand the parent by cloning it once per inner
 * selector — matching Vue's distributive semantics:
 *   `.outer :deep(.a, .b)` → `.outer :deep(.a), .outer :deep(.b)`
 * The subsequent hoist pass then unwraps each single-arg `:deep()`.
 *
 * Only handles the FIRST multi-arg `:deep()` per selector per iteration; we
 * re-scan after each expansion. Nested `:deep(:deep(...))` is undefined
 * behavior (postcss-selector-parser would yield it as a `pseudo` whose inner
 * selector contains another `pseudo` — we don't recurse here).
 */
function expandDeepDistribution(
  root: selectorParser.Root,
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  void deepLifted; // tagging happens during the subsequent hoist pass
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
 * For each `:deep(X)` pseudo in `selector` (where X is a single inner
 * selector — post-`expandDeepDistribution`), UNWRAP it to the bare inner
 * selector nodes spliced into the parent in place. Each lifted node is tagged
 * in `deepLifted` so the compound walk skips appending the scope attribute to
 * it — the deep payload matches a CHILD component's DOM, which does NOT carry
 * this component's `[data-rozie-s-<hash>]` attribute.
 *
 * Plain bare unwrap, NO `:global(...)` wrapper (Phase 25). Earlier (quick task
 * 260526-no7) the inner was wrapped in CSS Modules' `:global(...)` to opt it out
 * of class-name hashing, back when React's `.module.css` output ran through CSS
 * Modules at bundle time. Phase 25 removed CSS Modules — React emits a plain
 * `.css` file scoped solely by `[data-rozie-s-<hash>]` attributes. In plain CSS
 * `:global(...)` is NOT a real selector: a non-CSS-Modules pipeline emits it
 * verbatim and the browser DROPS the whole rule (it never matches), silently
 * killing every `:deep()` cross-component rule (e.g. the nested-Kanban grid
 * layout). Unwrapping to the bare selector produces a standard descendant
 * selector that crosses freely in React's light DOM, matching what Vue / Svelte
 * / Angular / Solid already do.
 *
 * Combinators inside the original `:deep()` payload are spliced in verbatim:
 * `.outer > :deep(.a > .b)` becomes `.outer[scope] > .a > .b` — every lifted
 * compound opts out of the scope attr.
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
        // Splice the inner selector's child nodes in place of the `:deep(...)`
        // pseudo (clone so the moved nodes don't keep a stale parent pointer),
        // tagging each as deep-lifted so the scope-attr pass skips it.
        const lifted = (inner as selectorParser.Selector).nodes.map((n) => {
          const cloned = n.clone({}) as selectorParser.Node;
          deepLifted.add(cloned);
          return cloned;
        });
        selector.nodes.splice(i, 1, ...lifted);
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
  deepLifted: WeakSet<selectorParser.Node>,
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
        // Skip the scope-attr append if EVERY non-combinator node in this
        // compound came from inside a `:deep(...)` wrapper.
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
  deepLifted: WeakSet<selectorParser.Node>,
): void {
  // First pass: recurse into nested selector-list pseudos so the scope reaches
  // their inner selectors too (matches Vue scoped behavior).
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
