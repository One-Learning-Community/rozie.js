/**
 * resolveKeynavGroups — Phase 71 Plan 02 Task 2 whole-component pass
 * (SPEC.md §5-§7), reworked by Phase 77 Plan 02 Task 3 into per-root
 * CONTAINMENT-SCOPED multi-group (77-SPEC.md §6, §7.4, §10.5 amendment 1 —
 * "Gap C" in the plan).
 *
 * ASSOCIATION RULE (locked by 77-02-PLAN.md, cites 77-SPEC.md §6 and §7.4):
 *
 *   - A component with exactly ONE `r-keynav` root keeps the Phase-71 §7
 *     COMPONENT-MEMBERSHIP association verbatim: every `r-keynav-item` in
 *     the component associates to that one root, regardless of DOM
 *     containment. This is what keeps the `activedescendant`/combobox shape
 *     working — an `<input>` root and a `<ul>` of items living in a
 *     SEPARATE subtree (SPEC §3.1's second example) — and is why every
 *     existing single-root `.rozie` source keeps producing byte-identical
 *     IR after this rework (SPEC §7.4 additive invariant). `groupIndex` is
 *     left undefined on the root and every item in this case — that's the
 *     mechanism the additive-invariant gate depends on (see
 *     `KeynavRootIR.groupIndex`'s doc comment).
 *   - A component with TWO OR MORE `r-keynav` roots switches to
 *     NEAREST-ANCESTOR CONTAINMENT: each item associates to the closest
 *     `r-keynav` root enclosing it in the template tree. An item with no
 *     enclosing root is `KEYNAV_ORPHAN_ITEM` (ROZ984), reworded to the
 *     ancestor-containment rule. Containment is what disambiguates MULTIPLE
 *     groups — a single group has nothing to disambiguate, which is exactly
 *     why the single-root case above keeps the looser component-membership
 *     rule instead. Each root and its associated items are stamped with a
 *     `groupIndex` in document order.
 *   - Roots must be siblings or cousins, never ancestors of one another: a
 *     root found while the walk is already inside another root's subtree is
 *     `KEYNAV_NESTED_ROOTS` (ROZ996). Processing continues — collected-not-
 *     thrown (D-08) — the nested root still claims its own subtree's items
 *     normally; the component just also carries the diagnostic.
 *
 * `KEYNAV_MULTIPLE_ROOTS` (ROZ986) is RETIRED by this rework — multiple
 * roots are now the normal path, not an error — and has no emission site
 * left anywhere in `packages/core/src` (the code stays reserved/documented
 * as retired in `codes.ts`, append-only).
 *
 * Runs AFTER `lowerTemplate` (which lowers the three `r-keynav*` directives
 * into additive `keynavRoot?`/`keynavItem?` fields on `TemplateElementIR`):
 * walks the already-lowered `ir.template` tree tracking an ANCESTOR-ROOT
 * STACK as it descends (in addition to the nearest-enclosing-`r-for` tracking
 * inherited from Phase 71, still needed for `:source` synthesis), then:
 *
 *   1. Associates every item to a root per the rule above.
 *   2. Synthesizes each associated root's `sourceExpression`/`sourceDeps`
 *      when it carries no explicit `:source="…"` binding attribute: pulled
 *      from the nearest enclosing `r-for` of the FIRST item associated to
 *      THAT root (SPEC §5 sugar — now resolved per-root).
 *   3. Emits the `ROZ983`/`ROZ984`/`ROZ985`/`ROZ987` cluster plus the new
 *      `ROZ996` (nested roots). (`ROZ982` — `KEYNAV_UNKNOWN_MODIFIER` — is
 *      emitted at `lowerTemplate` time by `resolveKeynavModifiers`; this
 *      pass owns everything requiring the whole-component view a single
 *      element's lowering can't see.)
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `ir.template` in
 * place — stamping `sourceExpression`/`sourceDeps`/`groupIndex` onto the
 * `keynavRoot`/`keynavItem` markers it finds — mirroring
 * `annotateDisplayWrap`'s established "post-IR mutating pass" idiom. All
 * failures push a diagnostic and continue.
 *
 * NOTE for emitter plans (77-03+): this pass does NOT mint stable
 * group/item runtime ids beyond `groupIndex` — a per-target controller's own
 * instance identity stays each emitter's job. It also does NOT strip a
 * root's explicit `:source="…"` binding out of `attributes` — an emitter
 * that walks `attributes` for real DOM/component props must skip a
 * `binding` attr named `'source'` on a `keynavRoot` element itself (mirrors
 * how `<slot :params="…">` is stripped in `lowerBareElement`'s `<slot>`
 * branch, Pitfall to watch for when emitters land).
 *
 * Wired into `lowerToIR` immediately after the existing validate* block
 * (`packages/core/src/ir/lower.ts`) — the single chokepoint both `compile()`
 * and `@rozie/unplugin` share, so a bad keynav shape is caught regardless of
 * entrypoint.
 *
 * @experimental — shape may change before v1.0
 */
import type { Expression } from '@babel/types';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { SignalRef } from '../reactivity/signalRef.js';
import type {
  IRComponent,
  KeynavRootIR,
  TemplateElementIR,
  TemplateLoopIR,
  TemplateNode,
} from './types.js';

interface FoundRoot {
  element: TemplateElementIR;
  keynavRoot: KeynavRootIR;
}

interface FoundItem {
  element: TemplateElementIR;
  enclosingLoop: TemplateLoopIR | null;
  /**
   * The nearest `r-keynav` root enclosing this item at its position in the
   * template tree, or `null` if none. Computed unconditionally during the
   * walk (cheap — a stack top-of read) even though it's only CONSUMED when
   * the component turns out to have 2+ roots; the single-root branch
   * ignores it entirely (component-membership association, SPEC §7.4).
   */
  nearestAncestorRoot: FoundRoot | null;
}

const VALID_FOCUS_MODELS = new Set<string>(['tabindex', 'activedescendant']);

/**
 * Walk the template tree tracking BOTH the nearest enclosing `r-for` loop
 * (for `:source` synthesis, unchanged from Phase 71) AND an ancestor-root
 * STACK (new — Phase 77 containment scoping), collecting every
 * `keynavRoot`/`keynavItem`-bearing element. Traverses the SAME node set as
 * `findRForSlotNameCollisions`'s walk (incl. `slotFillers` bodies and
 * `TemplateMatch.hostElement`) so no keynav marker inside a slot-fill body
 * or a match host is ever missed.
 *
 * Pushes `KEYNAV_NESTED_ROOTS` (ROZ996) inline when a root is encountered
 * while the ancestor-root stack is already non-empty — collected-not-thrown,
 * the walk still pushes the nested root onto both `roots` and the stack so
 * its own subtree's items associate to IT (nearest-ancestor, not the outer
 * root) exactly as they would for a legally-sibling root.
 */
function collectKeynavNodes(
  root: TemplateNode,
  diagnostics: Diagnostic[],
): {
  roots: FoundRoot[];
  items: FoundItem[];
} {
  const roots: FoundRoot[] = [];
  const items: FoundItem[] = [];

  const walk = (
    node: TemplateNode,
    enclosingLoop: TemplateLoopIR | null,
    ancestorRootStack: readonly FoundRoot[],
  ): void => {
    switch (node.type) {
      case 'TemplateElement': {
        let nextStack: readonly FoundRoot[] = ancestorRootStack;
        if (node.keynavRoot) {
          const found: FoundRoot = { element: node, keynavRoot: node.keynavRoot };
          if (ancestorRootStack.length > 0) {
            diagnostics.push({
              code: RozieErrorCode.KEYNAV_NESTED_ROOTS,
              severity: 'error',
              message:
                "r-keynav root found inside another r-keynav root's subtree — roots must be siblings or cousins, never ancestors of one another.",
              loc: node.keynavRoot.sourceLoc,
              hint: 'Move this root out of the enclosing root\'s subtree — sibling or cousin r-keynav roots are the supported multi-group shape.',
            });
          }
          roots.push(found);
          nextStack = [...ancestorRootStack, found];
        }
        if (node.keynavItem) {
          items.push({
            element: node,
            enclosingLoop,
            nearestAncestorRoot: nextStack.length > 0 ? nextStack[nextStack.length - 1]! : null,
          });
        }
        for (const child of node.children) walk(child, enclosingLoop, nextStack);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            for (const child of filler.body) walk(child, enclosingLoop, nextStack);
          }
        }
        break;
      }
      case 'TemplateLoop': {
        for (const child of node.body) walk(child, node, ancestorRootStack);
        break;
      }
      case 'TemplateFragment': {
        for (const child of node.children) walk(child, enclosingLoop, ancestorRootStack);
        break;
      }
      case 'TemplateConditional': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingLoop, ancestorRootStack);
        }
        break;
      }
      case 'TemplateMatch': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingLoop, ancestorRootStack);
        }
        if (node.hostElement) walk(node.hostElement, enclosingLoop, ancestorRootStack);
        break;
      }
      case 'TemplateSlotInvocation': {
        for (const child of node.fallback) walk(child, enclosingLoop, ancestorRootStack);
        break;
      }
      // TemplateInterpolation / TemplateStaticText — leaves, no children.
      default:
        break;
    }
  };

  walk(root, null, []);
  return { roots, items };
}

/** Find an explicit `:source="…"` binding attribute on the root element. */
function findExplicitSource(
  element: TemplateElementIR,
): { expression: Expression; deps: SignalRef[] } | null {
  for (const attr of element.attributes) {
    if (attr.kind === 'binding' && attr.name === 'source') {
      return { expression: attr.expression, deps: attr.deps };
    }
  }
  return null;
}

/**
 * Resolve `:source` for one root, given the items already associated to it
 * (order-preserved). Explicit `:source="…"` always wins; otherwise
 * synthesized from the nearest enclosing `r-for` of the FIRST associated
 * item — the "r-for producing the r-keynav-item elements" sugar (SPEC §5),
 * now resolved against THAT root's own item set rather than the whole
 * component's.
 */
function resolveSourceForRoot(
  rootElement: TemplateElementIR,
  keynavRoot: KeynavRootIR,
  itemsForRoot: readonly FoundItem[],
  diagnostics: Diagnostic[],
): void {
  const explicitSource = findExplicitSource(rootElement);
  if (explicitSource) {
    keynavRoot.sourceExpression = explicitSource.expression;
    keynavRoot.sourceDeps = explicitSource.deps;
    return;
  }
  const sourceLoop = itemsForRoot.find((i) => i.enclosingLoop !== null)?.enclosingLoop ?? null;
  if (sourceLoop === null) {
    diagnostics.push({
      code: RozieErrorCode.KEYNAV_SOURCE_UNRESOLVED,
      severity: 'error',
      message:
        'r-keynav has no :source binding and no co-located r-for to synthesize one from — the item set cannot be determined.',
      loc: keynavRoot.sourceLoc,
      hint: 'Add :source="<items array>" on the r-keynav root, or wrap the r-keynav-item elements in an r-for.',
    });
    return;
  }
  keynavRoot.sourceExpression = sourceLoop.iterableExpression;
  keynavRoot.sourceDeps = sourceLoop.iterableDeps;
}

/** Shared focus-model validity check — same code/message/hint for either arity branch. */
function validateFocusModel(keynavRoot: KeynavRootIR, diagnostics: Diagnostic[]): void {
  if (VALID_FOCUS_MODELS.has(keynavRoot.focusModel)) return;
  diagnostics.push({
    code: RozieErrorCode.KEYNAV_BAD_FOCUS_MODEL,
    severity: 'error',
    message: keynavRoot.focusModel
      ? `Unknown r-keynav focus-model 'r-keynav:${keynavRoot.focusModel}' — valid focus models are 'tabindex' and 'activedescendant'.`
      : "r-keynav requires a focus-model argument — write 'r-keynav:tabindex' or 'r-keynav:activedescendant'.",
    loc: keynavRoot.sourceLoc,
    hint: 'r-keynav:<focus-model>[.<modifier>…] — <focus-model> is tabindex or activedescendant.',
  });
}

/**
 * Whole-component keynav association + `:source` synthesis + diagnostics.
 * See the module doc comment for the full contract.
 */
export function resolveKeynavGroups(ir: IRComponent, diagnostics: Diagnostic[]): void {
  if (ir.template === null) return;
  const { roots, items } = collectKeynavNodes(ir.template, diagnostics);

  if (roots.length === 0) {
    // No root at all in the component — every found item is an orphan.
    // Unchanged from Phase 71 — this branch's wording stays generic (not
    // ancestor-containment specific) because there's no containment
    // question when there's no root anywhere to contain anything.
    for (const { element } of items) {
      diagnostics.push({
        code: RozieErrorCode.KEYNAV_ORPHAN_ITEM,
        severity: 'error',
        message:
          'r-keynav-item has no r-keynav root in this component — an r-keynav-item must be paired with an r-keynav:<focus-model> directive elsewhere in the same component.',
        loc: element.keynavItem!.sourceLoc,
        hint: "Add r-keynav:tabindex=\"…\" (or r-keynav:activedescendant=\"…\") to the list/menu root element.",
      });
    }
    return;
  }

  if (roots.length === 1) {
    // Phase 71 §7 path, preserved verbatim — component-membership
    // association (no containment check, no groupIndex stamping). This is
    // what keeps the activedescendant/combobox cross-subtree shape and
    // every pre-Phase-77 single-root source's IR byte-identical (SPEC §7.4).
    const { element: rootElement, keynavRoot } = roots[0]!;

    validateFocusModel(keynavRoot, diagnostics);

    if (items.length === 0) {
      diagnostics.push({
        code: RozieErrorCode.KEYNAV_NO_ITEMS,
        severity: 'error',
        message:
          'r-keynav root has no r-keynav-item elements in this component — a nav group needs at least one item to navigate.',
        loc: keynavRoot.sourceLoc,
        hint: 'Tag each rendered row with r-keynav-item="{ label?, disabled? }" (typically on the r-for element).',
      });
      return;
    }

    resolveSourceForRoot(rootElement, keynavRoot, items, diagnostics);
    return;
  }

  // Two or more roots — containment-scoped multi-group (SPEC §6). Each root
  // is validated and resolved independently against ONLY the items whose
  // nearest ancestor root (computed during the walk above) is that root.
  roots.forEach((found, idx) => {
    const { element: rootElement, keynavRoot } = found;
    keynavRoot.groupIndex = idx;

    validateFocusModel(keynavRoot, diagnostics);

    const itemsForRoot = items.filter((i) => i.nearestAncestorRoot === found);
    if (itemsForRoot.length === 0) {
      diagnostics.push({
        code: RozieErrorCode.KEYNAV_NO_ITEMS,
        severity: 'error',
        message:
          'r-keynav root has no r-keynav-item elements in this component — a nav group needs at least one item to navigate.',
        loc: keynavRoot.sourceLoc,
        hint: 'Tag each rendered row with r-keynav-item="{ label?, disabled? }" (typically on the r-for element).',
      });
      return;
    }

    for (const item of itemsForRoot) {
      item.element.keynavItem!.groupIndex = idx;
    }

    resolveSourceForRoot(rootElement, keynavRoot, itemsForRoot, diagnostics);
  });

  // Any item whose nearest-ancestor-root walk came up empty is an orphan —
  // ROZ984, reworded to the ancestor-containment rule (SPEC §6/§8): with
  // multiple roots present, containment is what disambiguates which group an
  // item belongs to, so an item outside every root's subtree is unresolvable.
  for (const item of items) {
    if (item.nearestAncestorRoot !== null) continue;
    diagnostics.push({
      code: RozieErrorCode.KEYNAV_ORPHAN_ITEM,
      severity: 'error',
      message:
        'r-keynav-item has no enclosing r-keynav root — with multiple r-keynav roots in this component, each item must be a descendant of the root it belongs to.',
      loc: item.element.keynavItem!.sourceLoc,
      hint: "Move this item inside an r-keynav root's subtree.",
    });
  }
}
