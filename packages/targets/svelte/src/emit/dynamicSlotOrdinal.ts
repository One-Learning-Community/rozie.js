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
 * The invocation side (`emitSlotInvocation.ts`) locates the matching SlotDecl
 * via DECLARATION-SITE `sourceLoc` identity (WR-01, quick task 260817-buk —
 * replaces the prior rewritten-expression-TEXT comparison, which collided
 * whenever two independently-declared dynamic-name `<slot>` sites happened to
 * bind the IDENTICAL source expression). The declaration and the invocation
 * are lowered from the SAME `<slot>` element AST node (`node.loc` in
 * `lowerSlots.ts`, `el.loc` in `lowerTemplate.ts`), so their `sourceLoc` byte
 * offsets are identical by construction — and because two distinct `<slot>`
 * elements cannot begin at the same byte offset, this identity is unique
 * across declaration sites and independent of the order in which either
 * lowering walk visits the tree. Expression text is NOT unique — that was
 * the defect. An emitter-re-derived traversal ordinal was rejected because
 * the two lowering walks resolve `:name` at different points relative to
 * their children recursion and would not agree.
 */
import type { IRComponent, SlotDecl, SourceLoc } from '@rozie/core';

/** The local `$derived` binding identifier for the dynamic-name slot at `ordinal` (its index in `ir.slots`). */
export function dynamicSlotBindingName(ordinal: number): string {
  return `__rozieDynSlot${ordinal}`;
}

/**
 * Find the ordinal (index into `ir.slots`) of the SlotDecl whose
 * `sourceLoc` matches `loc` on all three fields (`start`, `end`,
 * `filename`). Returns -1 when no match is found (should not happen for a
 * well-formed IR — every dynamic invocation node has a corresponding
 * declaration produced from the same `<slot>` element).
 */
export function findDynamicSlotOrdinal(ir: IRComponent, loc: SourceLoc): number {
  return ir.slots.findIndex(
    (s: SlotDecl) =>
      s.dynamicNameExpr !== undefined &&
      s.sourceLoc.start === loc.start &&
      s.sourceLoc.end === loc.end &&
      s.sourceLoc.filename === loc.filename,
  );
}
