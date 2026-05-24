/**
 * scopeCss — rewrite a single CSS rule's selector list to scope each compound
 * selector to a component-specific attribute (e.g. `button` →
 * `button[data-rozie-s-<hash>]`). Mirrors the React/Solid/Lit shared
 * implementation deliberately — the Svelte target previously delegated scoping
 * to Svelte 5's native class-hash compiler (`.foo.svelte-<hash>`), but that
 * mechanism only stamps its hash on elements that lexically live in the same
 * SFC compile unit, breaking cross-SFC class-on-component-invocation rules
 * (the closing fix for matrix.spec.ts's PHASE_14_1_FOLLOWUP Svelte arm).
 *
 * Why mirror react/solid/lit rather than re-export from a shared helper:
 * keeping a per-target copy preserves the "no shared per-target CSS pipeline"
 * project axis — each target owns its complete scope-rewrite chain, so a
 * future target-specific divergence (e.g. handling Svelte 5's `:global`
 * selector quirks) has a single touchpoint without affecting the other
 * targets' pipelines.
 *
 * Caller wraps the returned source in Svelte 5's `:global { ... }` block to
 * opt out of Svelte's native scoper for the rewritten rules — see emitStyle.
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const ATTR_PREFIX = 'data-rozie-s-';

/** Build the full attribute name: `data-rozie-s-<hash>`. */
export function scopeAttrName(scopeHash: string): string {
  return ATTR_PREFIX + scopeHash;
}

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
  // First pass: recurse into nested selector-list pseudos.
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

  // Second pass: find the insertion point — the index of the first trailing
  // pseudo-class/element. If none, insert at end.
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
