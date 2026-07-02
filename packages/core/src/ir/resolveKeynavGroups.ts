/**
 * resolveKeynavGroups — Phase 71 Plan 02 Task 2 whole-component pass
 * (SPEC.md §5-§7).
 *
 * Runs AFTER `lowerTemplate` (which lowers the three `r-keynav*` directives
 * into additive `keynavRoot?`/`keynavItem?` fields on `TemplateElementIR` —
 * Task 1): walks the already-lowered `ir.template` tree to find every
 * `keynavRoot`-bearing element and every `keynavItem`-bearing element, then:
 *
 *   1. Associates ALL items to THE root — v1 is one nav group per component
 *      (SPEC §7). Association is by COMPONENT MEMBERSHIP, never by
 *      comparing `:source` expressions or DOM containment — this is what
 *      makes the combobox case work (an `<input>` root and a `<ul>` of items
 *      living in a SEPARATE subtree, SPEC §3.1's second example).
 *   2. Synthesizes `keynavRoot.sourceExpression`/`sourceDeps` when the root
 *      carries no explicit `:source="…"` binding attribute: pulled from the
 *      nearest enclosing `r-for` of the first `keynavItem` element found
 *      (the `r-for` "producing the `r-keynav-item` elements", SPEC §5).
 *   3. Emits the `ROZ983`..`ROZ987` diagnostic cluster. (`ROZ982` —
 *      `KEYNAV_UNKNOWN_MODIFIER` — is emitted at `lowerTemplate` time by
 *      `resolveKeynavModifiers`, Task 1; this pass owns everything requiring
 *      the whole-component view a single element's lowering can't see.)
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `ir.template` in
 * place (stamping `sourceExpression`/`sourceDeps` onto the one found
 * `keynavRoot` — the ONLY IR mutation this pass makes; mirrors
 * `annotateDisplayWrap`'s established "post-IR mutating pass" idiom). All
 * failures push a diagnostic and continue.
 *
 * NOTE for emitter plans (71-04+, per the 71-02 threat register T-71-02-02):
 * this pass does NOT mint stable group/item ids — that stays each emitter's
 * job, keyed off finding the single `keynavRoot` element and every
 * `keynavItem` element in the already-validated component. It also does NOT
 * strip the root's explicit `:source="…"` binding out of `attributes` — an
 * emitter that walks `attributes` for real DOM/component props must skip a
 * `binding` attr named `'source'` on the `keynavRoot` element itself (mirrors
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
}

const VALID_FOCUS_MODELS = new Set<string>(['tabindex', 'activedescendant']);

/**
 * Walk the template tree tracking the nearest enclosing `r-for` loop (for
 * `:source` synthesis), collecting every `keynavRoot`/`keynavItem`-bearing
 * element. Traverses the SAME node set as `findRForSlotNameCollisions`'s
 * walk (incl. `slotFillers` bodies and `TemplateMatch.hostElement`) so no
 * keynav marker inside a slot-fill body or a match host is ever missed.
 */
function collectKeynavNodes(root: TemplateNode): {
  roots: FoundRoot[];
  items: FoundItem[];
} {
  const roots: FoundRoot[] = [];
  const items: FoundItem[] = [];

  const walk = (node: TemplateNode, enclosingLoop: TemplateLoopIR | null): void => {
    switch (node.type) {
      case 'TemplateElement': {
        if (node.keynavRoot) roots.push({ element: node, keynavRoot: node.keynavRoot });
        if (node.keynavItem) items.push({ element: node, enclosingLoop });
        for (const child of node.children) walk(child, enclosingLoop);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            for (const child of filler.body) walk(child, enclosingLoop);
          }
        }
        break;
      }
      case 'TemplateLoop': {
        for (const child of node.body) walk(child, node);
        break;
      }
      case 'TemplateFragment': {
        for (const child of node.children) walk(child, enclosingLoop);
        break;
      }
      case 'TemplateConditional': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingLoop);
        }
        break;
      }
      case 'TemplateMatch': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingLoop);
        }
        if (node.hostElement) walk(node.hostElement, enclosingLoop);
        break;
      }
      case 'TemplateSlotInvocation': {
        for (const child of node.fallback) walk(child, enclosingLoop);
        break;
      }
      // TemplateInterpolation / TemplateStaticText — leaves, no children.
      default:
        break;
    }
  };

  walk(root, null);
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
 * Whole-component keynav association + `:source` synthesis + diagnostics.
 * See the module doc comment for the full contract.
 */
export function resolveKeynavGroups(ir: IRComponent, diagnostics: Diagnostic[]): void {
  if (ir.template === null) return;
  const { roots, items } = collectKeynavNodes(ir.template);

  if (roots.length === 0) {
    // No root at all in the component — every found item is an orphan.
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

  if (roots.length > 1) {
    // v1 = one nav group per component (SPEC §7) — every root past the
    // first is an error. No items are associated to any of them until the
    // component's keynav wiring is unambiguous.
    for (const extra of roots.slice(1)) {
      diagnostics.push({
        code: RozieErrorCode.KEYNAV_MULTIPLE_ROOTS,
        severity: 'error',
        message:
          'Multiple r-keynav roots found in one component — v1 supports exactly one nav group per component.',
        loc: extra.keynavRoot.sourceLoc,
        hint: 'Named groups (multiple independent r-keynav lists in one component) are a deferred feature (SPEC §2) — split into separate components for now.',
      });
    }
    return;
  }

  const { element: rootElement, keynavRoot } = roots[0]!;

  if (!VALID_FOCUS_MODELS.has(keynavRoot.focusModel)) {
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

  // Every item associates to THE root — component membership alone (no
  // DOM-containment check, no `:source`-expression comparison).
  //
  // Explicit `:source="…"` on the root wins over synthesis.
  const explicitSource = findExplicitSource(rootElement);
  if (explicitSource) {
    keynavRoot.sourceExpression = explicitSource.expression;
    keynavRoot.sourceDeps = explicitSource.deps;
    return;
  }

  // Sugar (SPEC §5): synthesize `:source` from the nearest enclosing r-for
  // of the first item found — "the r-for producing the r-keynav-item
  // elements".
  const sourceLoop = items.find((i) => i.enclosingLoop !== null)?.enclosingLoop ?? null;
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
