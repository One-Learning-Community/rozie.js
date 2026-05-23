/**
 * validateListenerFallthrough — Phase 15 Plan 15-02 (D-17 parallel-functions).
 *
 * Post-IR pass that enforces the two cross-framework listener-fallthrough
 * validation rules (R8/R9):
 *
 *   - ROZ973 LISTENER_FALLTHROUGH_MULTI_ROOT (R8 — error) — the template has
 *     more than one root element while `inheritListeners !== false`. Auto-
 *     fallthrough applies inherited listeners to a single root element; a
 *     multi-root template has no single root to receive them. The author must
 *     either set `inherit-listeners="false"` on the `<rozie>` tag and apply
 *     `r-on="$listeners"` manually to the intended element, or restructure to
 *     a single root.
 *
 *     INDEPENDENT of ROZ970 per SPEC R8: a multi-root template with
 *     `inherit-attrs="false"` but default `inherit-listeners` produces ROZ973
 *     (not ROZ970), and vice versa.
 *
 *   - ROZ974 LISTENER_DOUBLE_APPLY (R9 — warning) — a `ListenerSpreadIR` whose
 *     expression is a bare `$listeners` Identifier exists (a hand-written
 *     `r-on="$listeners"`) while `inheritListeners !== false`. The IR ALSO
 *     synthesizes an automatic `$listeners` spread onto the single root, so
 *     the inherited listeners would be applied twice. The opt-out is
 *     `inherit-listeners="false"` — that suppresses the auto-synthesis,
 *     leaving the author's explicit `r-on="$listeners"` as the single
 *     application.
 *
 *     INDEPENDENT of ROZ971 per SPEC R9: a `r-bind="$attrs"` + `r-on="$listeners"`
 *     combo on the same root produces BOTH ROZ971 AND ROZ974 — the two warnings
 *     do not coalesce.
 *
 * Mirrors `validateAttrFallthrough.ts` 1:1 with the substitutions:
 *   `$attrs` → `$listeners`; `inheritAttrs` → `inheritListeners`;
 *   `node.attributes` (AttributeBinding[]) → `node.listenerSpreads`
 *   (ListenerSpreadIR[]); the kind-discriminant guard
 *   `attr.kind === 'spreadBinding'` is DROPPED — every entry in
 *   `listenerSpreads` IS a `ListenerSpreadIR`.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failures push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * ORDERING — wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) BEFORE
 * `synthesizeListenersFallthrough` so the validator does not observe the
 * synthesized bare-`$listeners` spread (which would be a false-positive
 * ROZ974 self-warning).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { SourceLoc } from '../ast/types.js';
import type { IRComponent, TemplateNode } from './types.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as ir/validateClassSelector.ts,
// ir/validateAttrFallthrough.ts, and reactivity/computeDeps.ts. (Imported for
// shape-parity with the sibling IR validators; the R8/R9 checks below walk
// the IR tree directly, not a Babel Program, so `traverse` itself is not
// invoked here.)
type TraverseFn = typeof import('@babel/traverse').default;
const _traverseNormalized: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;
void _traverseNormalized;

/** The Phase 15 magic accessor whose bare-Identifier spread triggers R9. */
const LISTENERS_ACCESSOR = '$listeners';

/**
 * Count the root-level `TemplateElement` nodes of the lowered template.
 *
 * Mirrors `validateAttrFallthrough.countRootElements`. A single-root template
 * lowers to a `TemplateElement` directly (R8 never fires). A multi-root
 * template lowers to a `TemplateFragment` whose children are the roots;
 * cosmetic whitespace `TemplateStaticText` siblings do not count.
 */
function countRootElements(template: TemplateNode | null): number {
  if (template === null) return 0;
  if (template.type !== 'TemplateFragment') return 1;
  let count = 0;
  for (const child of template.children) {
    if (child.type === 'TemplateStaticText') continue; // cosmetic whitespace
    count += 1;
  }
  return count;
}

/**
 * Recursive template walker — visits every node so an explicit
 * `r-on="$listeners"` spread is found wherever it sits (conditional / loop /
 * match / fragment / slot-invocation bodies and slot-filler bodies included).
 * Mirrors `validateAttrFallthrough.walkTemplate` — the WR-02
 * `TemplateMatch.hostElement` walk is load-bearing and copied verbatim.
 */
function walkTemplate(
  node: TemplateNode | null,
  visit: (n: TemplateNode) => void,
): void {
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
      // rather than `<template r-match>`) whose `listenerSpreads` include any
      // `r-on` entries the author wrote on the wrapper. Visit the host so R9
      // detection (`r-on="$listeners"` on the wrapper) fires. (WR-02 — the
      // wrapper for `TemplateConditional` does not carry attributes, so this
      // only applies to `TemplateMatch.hostElement`.)
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

/** Whether a Babel expression is the bare `$listeners` Identifier. */
function isBareListenersIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr) && expr.name === LISTENERS_ACCESSOR;
}

/**
 * Validate the component's IR against the two listener-fallthrough rules.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ973/974 pushed)
 */
export function validateListenerFallthrough(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // Fallthrough is OFF — neither rule applies. The author opted out, so a
  // multi-root template is fine and an explicit `r-on="$listeners"` is the
  // single (intended) application.
  if (ir.inheritListeners === false) return;

  // ----- R8: ROZ973 — multi-root template with auto-fallthrough enabled. ----
  // INDEPENDENT of ROZ970 — validateAttrFallthrough's check is gated on
  // `inheritAttrs`; this one is gated on `inheritListeners`. The two run side
  // by side in lower.ts; either, neither, or both can fire on the same IR.
  if (countRootElements(ir.template) > 1) {
    const loc: SourceLoc = ir.template?.sourceLoc ?? ir.sourceLoc;
    diagnostics.push({
      code: RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
      severity: 'error',
      message:
        'A multi-root template cannot auto-inherit listeners — there is no single root element to receive them.',
      loc,
      hint: 'Set inherit-listeners="false" on the <rozie> tag and apply r-on="$listeners" to the intended element, or restructure the template to a single root.',
    });
  }

  // ----- R9: ROZ974 — explicit r-on="$listeners" while auto-fallthrough on.
  // The IR synthesizes an automatic `$listeners` spread onto the single root
  // (synthesizeListenersFallthrough); a hand-written `r-on="$listeners"`
  // would then apply the inherited listeners a second time.
  //
  // ORDERING NOTE — `lower.ts` runs THIS validator BEFORE
  // `synthesizeListenersFallthrough` so the synthesized bare-$listeners spread
  // is invisible here (no false-positive self-warning).
  //
  // INDEPENDENT of ROZ971 — a single root with both `r-bind="$attrs"` and
  // `r-on="$listeners"` produces BOTH warnings; the two codes do not coalesce.
  walkTemplate(ir.template, (node) => {
    if (node.type !== 'TemplateElement') return;
    for (const spread of node.listenerSpreads) {
      if (!isBareListenersIdentifier(spread.expression)) continue;
      diagnostics.push({
        code: RozieErrorCode.LISTENER_DOUBLE_APPLY,
        severity: 'warning',
        message:
          'r-on="$listeners" applies the inherited listeners, but auto-fallthrough is still on — the listeners would be applied twice.',
        loc: spread.sourceLoc,
        hint: 'Set inherit-listeners="false" on the <rozie> tag to opt out of auto-fallthrough and keep this explicit r-on="$listeners" as the single application.',
      });
    }
  });
}
