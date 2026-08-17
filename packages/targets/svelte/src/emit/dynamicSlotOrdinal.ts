/**
 * dynamicSlotOrdinal — Svelte-target helper (Phase 79 Plan 10 Task 2).
 *
 * A producer `<slot :name="expr">` whose bound name does NOT constant-fold
 * keeps `SlotDecl.name === ''` (Phase 79 R1's Assumption A1, 79-06) — the
 * SAME sentinel a genuine default slot uses. Two independent dynamic-name
 * slots declared on ONE producer therefore both carry the identical ''
 * identity and cannot be told apart by name alone. This is the same
 * collision Lit's `slotIdentityKey.ts` documents and fixes for its own
 * architecture (Phase 79 Plan 08) — Svelte's fix mirrors it: key each
 * dynamic-name slot's `$derived` binding on its DECLARATION ORDINAL (its
 * position in `ir.slots`) instead of its name.
 *
 * The declaration side (`emitScript.ts`) always has the SlotDecl object
 * itself in hand, so it derives the ordinal directly via `ir.slots.indexOf`.
 * The invocation side (`emitSlotInvocation.ts`) only has the INVOCATION
 * node's own `dynamicNameExpr` — a SEPARATE AST parse of the SAME source
 * attribute text (lowerTemplate.ts parses the `:name` binding once for the
 * declaration in `lowerSlots.ts` and once for the invocation in
 * `lowerTemplate.ts`) — so it locates the matching SlotDecl by comparing
 * REWRITTEN expression TEXT rather than by name. `rewriteTemplateExpression`
 * is a deterministic pure function of (expression, ir): two independently-
 * parsed ASTs for the identical source expression always rewrite to
 * identical text, so this comparison reliably finds the right ordinal even
 * when a producer declares more than one dynamic-name slot.
 */
import type { Expression } from '@babel/types';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

/** The local `$derived` binding identifier for the dynamic-name slot at `ordinal` (its index in `ir.slots`). */
export function dynamicSlotBindingName(ordinal: number): string {
  return `__rozieDynSlot${ordinal}`;
}

/**
 * Find the ordinal (index into `ir.slots`) of the SlotDecl whose
 * `dynamicNameExpr` rewrites to the SAME text as `expr`. Returns -1 when no
 * match is found (should not happen for a well-formed IR — every dynamic
 * invocation node has a corresponding declaration produced from the same
 * `<slot>` element).
 */
export function findDynamicSlotOrdinal(ir: IRComponent, expr: Expression): number {
  const text = rewriteTemplateExpression(expr, ir);
  return ir.slots.findIndex(
    (s: SlotDecl) => s.dynamicNameExpr !== undefined && rewriteTemplateExpression(s.dynamicNameExpr, ir) === text,
  );
}
