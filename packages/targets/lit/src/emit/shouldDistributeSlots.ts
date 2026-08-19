/**
 * shouldDistributeSlots — the D5 compile-time gate (Quick 260808-iyh).
 *
 * `slotAssignment: 'manual'` converts the ENTIRE shadow root, and every
 * `<slot>` in it then needs `RozieSlotDistributor` to project anything at
 * all (native named assignment and manual assignment cannot be mixed in the
 * same shadow root). 18 of the 31 slot-bearing Lit leaves in the shipping
 * corpus gain nothing from manual assignment — a single, non-duplicated,
 * non-looped `<slot name="x">` already gets 100% of its matching light-DOM
 * children under NATIVE assignment. Flipping every component to manual mode
 * unconditionally would inherit the full regression surface (idempotence,
 * MutationObserver wiring, default-slot text projection) for zero behavior
 * change on those 18 leaves. This predicate is therefore a genuine
 * IR-SHAPE gate, inspecting the authored component's STRUCTURE at compile
 * time — never a runtime capability check — so it does not fall under the
 * `feedback_no_detection_when_universal` prohibition (that rule guards
 * against gating on a runtime feature-detection when the underlying
 * capability is actually universal; here the underlying capability
 * (`slotAssignment: 'manual'`) IS universal across every target browser,
 * but paying its regression-surface cost is only warranted when the
 * component structurally needs it).
 *
 * Trips when either:
 *   (a) any (non-portal) slot has `SlotDecl.inLoop === true` — a `<slot>`
 *       nested under `r-for` renders N times with no per-iteration identity
 *       under native assignment; or
 *   (b) any slot IDENTITY (INCLUDING the unnamed-slot key `''`) occurs two
 *       or more times across the (non-portal) slots — `emitSlotDecl` dedupes
 *       by identity, so two slots sharing one identity share ONE member
 *       identity on the emitted class and are exactly the same collision
 *       class as a duplicated authored name.
 *
 * Portal slots (`SlotDecl.isPortal === true`) never render a `<slot>`
 * element at all (Phase 37 / Spike 003 — a portal slot lowers to a
 * script-callable `$portals.<key>` closure, not template markup), so they
 * are excluded before either check runs — a component whose only repeated
 * slot is a portal slot must NOT trip this gate.
 *
 * Phase 79 Plan 08 (T-79-17): identity is `slotIdentityKey(slot, index)`,
 * NOT bare `slot.name`. Before this fix, a producer with ONE dynamic-name
 * slot plus a genuine default `<slot>` — both carrying `name === ''` — would
 * spuriously trip clause (b) even though nothing about the component
 * structurally needs manual assignment (confirmed by
 * `slotNameIdentityCollision.test.ts`'s Task 1 Probe B). Two genuinely
 * same-named STATIC slots still key identically and still trip the gate —
 * the pre-existing behaviour this gate was written for is preserved exactly.
 */
import type { IRComponent } from '@rozie/core';
import { slotIdentityKey } from './slotIdentityKey.js';

export function shouldDistributeSlots(ir: IRComponent): boolean {
  const slots = (ir.slots ?? []).filter((s) => s.isPortal !== true);
  if (slots.some((s) => s.inLoop === true)) return true;

  const seen = new Set<string>();
  for (const [index, slot] of slots.entries()) {
    const key = slotIdentityKey(slot, index);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
