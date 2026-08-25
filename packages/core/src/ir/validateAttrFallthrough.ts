/**
 * validateAttrFallthrough — Phase 14 Plan 14-02.
 *
 * Post-IR pass that enforces the two cross-framework attribute-fallthrough
 * validation rules (R8/R9):
 *
 *   - ROZ970 ATTR_FALLTHROUGH_MULTI_ROOT (R8 — error) — the template has more
 *     than one root element while `inheritAttrs !== false`. Auto-fallthrough
 *     applies inherited attributes to a single root element; a multi-root
 *     template has no single root to receive them. The author must either set
 *     `inherit-attrs="false"` on the `<rozie>` tag and apply `r-bind="$attrs"`
 *     manually to the intended element, or restructure to a single root.
 *
 *   - ROZ971 ATTR_DOUBLE_APPLY (R9 — warning) — a `spreadBinding` whose
 *     expression is a bare `$attrs` Identifier exists (a hand-written
 *     `r-bind="$attrs"`) while `inheritAttrs !== false`. The IR ALSO synthesizes
 *     an automatic `$attrs` spread onto the single root (RESEARCH.md Pattern 5),
 *     so the inherited attributes would be applied twice. The opt-out is
 *     `inherit-attrs="false"` — that suppresses the auto-synthesis, leaving the
 *     author's explicit `r-bind="$attrs"` as the single application.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failures push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) directly after
 * `validateClassSelector` — the single chokepoint both `compile()` and
 * `@rozie/unplugin` share — so a fallthrough problem is caught regardless of
 * entrypoint (Pitfall 1).
 *
 * @experimental — shape may change before v1.0
 */

import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent, TemplateNode } from './types.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as ir/validateClassSelector.ts and
// reactivity/computeDeps.ts. (Imported for shape-parity with the sibling IR
// validators; the R8/R9 checks below walk the IR tree directly, not a Babel
// Program, so `traverse` itself is not invoked here.)
type TraverseFn = typeof import('@babel/traverse').default;
const _traverseNormalized: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;
void _traverseNormalized;

/** The Phase 14 magic accessor whose bare-Identifier spread triggers R9. */
const ATTRS_ACCESSOR = '$attrs';

/**
 * Count the root-level `TemplateElement` nodes of the lowered template.
 *
 * A single-root template lowers to a `TemplateElement` directly (R8 never
 * fires). A multi-root template lowers to a `TemplateFragment` whose children
 * are the roots; cosmetic whitespace `TemplateStaticText` siblings do not
 * count.
 *
 * Phase 82 (D-01, Strategy B) element-plus-slots exception: when the
 * fragment's non-text children classify into EXACTLY one `TemplateElement`
 * and ZERO other structural sibling kinds, any number of
 * `TemplateSlotInvocation` siblings included, the template is treated as
 * single-root (returns 1) regardless of sibling order. A `<slot>` invocation
 * no longer disqualifies auto-fallthrough on its own — it renders nothing
 * itself, so the one real element is still the sole candidate to receive the
 * synthesized spread. This mirrors the portal-slot skip in
 * `lowerRootElementRef.resolveRootElement`, widened from portal-only slots to
 * ALL slot invocations. Two real elements, or an element plus any other
 * structural sibling (conditional / loop / match / interpolation), still
 * count every non-text child and remain multi-root (ROZ970).
 */
function countRootElements(template: TemplateNode | null): number {
  if (template === null) return 0;
  if (template.type !== 'TemplateFragment') return 1;

  let elementCount = 0;
  let slotCount = 0;
  let otherCount = 0;
  for (const child of template.children) {
    if (child.type === 'TemplateStaticText') continue; // cosmetic whitespace
    if (child.type === 'TemplateElement') {
      elementCount += 1;
    } else if (child.type === 'TemplateSlotInvocation') {
      slotCount += 1;
    } else {
      otherCount += 1;
    }
  }

  // Element-plus-slots exception: exactly one element, no other disqualifying
  // sibling kind — any number of slot siblings is tolerated.
  if (elementCount === 1 && otherCount === 0) return 1;

  return elementCount + slotCount + otherCount;
}

/**
 * Resolve the single structural root node of the template, for the D-02
 * gated-root check: the template itself when it is not a `TemplateFragment`,
 * or the sole non-`TemplateStaticText` child when the template is a fragment
 * with exactly one such child, or `null` otherwise (zero or multiple
 * structural children). Deliberately NOT slot-tolerant like
 * `countRootElements` above — this helper answers "is there exactly one
 * structural node at all", which is what determines whether a
 * `TemplateConditional` / `TemplateMatch` root has no sibling to disambiguate
 * it from being the template's only content.
 */
function resolveSingleStructuralRoot(template: TemplateNode | null): TemplateNode | null {
  if (template === null) return null;
  if (template.type !== 'TemplateFragment') return template;
  let only: TemplateNode | null = null;
  for (const child of template.children) {
    if (child.type === 'TemplateStaticText') continue; // cosmetic whitespace
    if (only !== null) return null; // more than one structural child
    only = child;
  }
  return only;
}

/**
 * Recursive template walker — visits every node so an explicit
 * `r-bind="$attrs"` spread is found wherever it sits (conditional / loop /
 * match / fragment / slot-invocation bodies and slot-filler bodies included).
 * Mirrors `validateClassSelector.walkTemplate`.
 */
function walkTemplate(node: TemplateNode | null, visit: (n: TemplateNode) => void): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const child of node.children) walkTemplate(child, visit);
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) walkTemplate(child, visit);
        }
      }
      break;
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) walkTemplate(child, visit);
      }
      // A `TemplateMatch` may carry a real-element wrapper (`<div r-match>`
      // rather than `<template r-match>`) whose attributes include any
      // `spreadBinding` entries the author wrote on the wrapper. Visit the
      // host so R9 detection (`r-bind="$attrs"` on the wrapper) fires.
      // (WR-02 — the wrapper for `TemplateConditional` does not carry
      // attributes, so this only applies to `TemplateMatch.hostElement`.)
      if (node.type === 'TemplateMatch' && node.hostElement) {
        walkTemplate(node.hostElement, visit);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walkTemplate(child, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walkTemplate(child, visit);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walkTemplate(child, visit);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

/** Whether a Babel expression is the bare `$attrs` Identifier. */
function isBareAttrsIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr) && expr.name === ATTRS_ACCESSOR;
}

/**
 * Validate the component's IR against the two attribute-fallthrough rules.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ970/971 pushed)
 */
export function validateAttrFallthrough(ir: IRComponent, diagnostics: Diagnostic[]): void {
  // Fallthrough is OFF — neither rule applies. The author opted out, so a
  // multi-root template is fine and an explicit `r-bind="$attrs"` is the
  // single (intended) application.
  if (ir.inheritAttrs === false) return;

  // ----- R8: ROZ970 — multi-root template with auto-fallthrough enabled. -----
  let multiRootFired = false;
  if (countRootElements(ir.template) > 1) {
    multiRootFired = true;
    const loc: SourceLoc = ir.template?.sourceLoc ?? ir.sourceLoc;
    diagnostics.push({
      code: RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT,
      severity: 'error',
      message:
        'A multi-root template cannot auto-inherit attributes — there is no single root element to receive them.',
      loc,
      hint: 'Set inherit-attrs="false" on the <rozie> tag and apply r-bind="$attrs" to the intended element, or restructure the template to a single root.',
    });
  }

  // ----- D-02: ROZ098 — a single structural root gated by a conditional or
  // match has no unconditional element to attach the inherited attributes
  // to, so auto-fallthrough silently drops them (`examples/Modal.rozie`,
  // `examples/PortalOverlay.rozie` are live instances). Diagnosed now;
  // branch-descent synthesis is DEFERRED (D-02). Structurally mutually
  // exclusive with ROZ970: a shape that already fired R8 above cannot also
  // resolve to a single structural root here (a multi-root fragment has more
  // than one structural child, so `resolveSingleStructuralRoot` returns
  // `null` for it), but the `multiRootFired` guard makes that exclusion
  // explicit rather than incidental.
  if (!multiRootFired) {
    const singleRoot = resolveSingleStructuralRoot(ir.template);
    // WR-01: a `TemplateMatch` is only element-less when its host is the
    // non-rendering `<template r-match>` form. `<div r-match>` carries a real
    // wrapper in `hostElement` (types.ts:1334) that renders UNCONDITIONALLY —
    // only the content nested inside it varies per branch — so the
    // gated-root wording would be false for it, and the synthesizer lands the
    // spread on that host instead (lowerTemplate.ts).
    //
    // The exemption keys on `tagKind === 'html'`, NOT on host presence, so it
    // is the SAME predicate the synthesizer uses. Keying on presence alone
    // would exempt a component-tag host that the synthesizer still skips
    // (Plan 14-05 — the spread would land as a prop on the inner component,
    // not as a DOM attribute), silently dropping the consumer's attributes:
    // exactly the validator-vs-synthesizer drift that produced WR-01 in the
    // first place. `TemplateConditional` has no host at all.
    if (
      singleRoot !== null &&
      (singleRoot.type === 'TemplateConditional' ||
        (singleRoot.type === 'TemplateMatch' && singleRoot.hostElement?.tagKind !== 'html'))
    ) {
      const loc: SourceLoc = singleRoot.sourceLoc ?? ir.sourceLoc;
      // Two distinct shapes reach here and they are NOT the same defect, so
      // they do not share wording. A component-tag host renders
      // unconditionally — claiming otherwise is the WR-01 mistake repeated —
      // it just is not an element the spread can land on.
      const componentHost =
        singleRoot.type === 'TemplateMatch' && singleRoot.hostElement !== undefined;
      diagnostics.push({
        code: RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT,
        severity: 'warning',
        message: componentHost
          ? "The template's only root is a component tag, so auto-fallthrough has no HTML element to attach the inherited attributes to — they are dropped."
          : "The template's only root is gated by a conditional, so auto-fallthrough has no unconditional element to attach the inherited attributes to — they are dropped.",
        loc,
        hint: componentHost
          ? 'Move the r-match onto a wrapping HTML element, or set inherit-attrs="false" on the <rozie> tag — a component-tag root owns its own fallthrough surface, so the spread would land as a prop on the inner component rather than as a DOM attribute.'
          : 'Move the gating condition onto a child so the root element is unconditional, or set inherit-attrs="false" on the <rozie> tag and apply the manual r-bind="$attrs" spread inside the branch.',
      });
    }
  }

  // ----- R9: ROZ971 — explicit r-bind="$attrs" while auto-fallthrough on. ----
  // The IR synthesizes an automatic `$attrs` spread onto the single root
  // (synthesizeAttrsFallthrough); a hand-written `r-bind="$attrs"` would then
  // apply the inherited attributes a second time.
  walkTemplate(ir.template, (node) => {
    if (node.type !== 'TemplateElement') return;
    for (const attr of node.attributes) {
      if (attr.kind !== 'spreadBinding') continue;
      if (!isBareAttrsIdentifier(attr.expression)) continue;
      diagnostics.push({
        code: RozieErrorCode.ATTR_DOUBLE_APPLY,
        severity: 'warning',
        message:
          'r-bind="$attrs" applies the inherited attributes, but auto-fallthrough is still on — the attributes would be applied twice.',
        loc: attr.sourceLoc,
        hint: 'Set inherit-attrs="false" on the <rozie> tag to opt out of auto-fallthrough and keep this explicit r-bind="$attrs" as the single application.',
      });
    }
  });
}
