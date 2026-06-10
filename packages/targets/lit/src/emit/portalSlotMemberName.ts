/**
 * portalSlotMemberName — Lit-target portal-slot member disambiguation.
 *
 * The Lit emitter bridges a `<slot name="X" portal />` to a function-typed
 * `@property` class member named `X` (the bare slot name), plus a `$portals`
 * closure that reads `this.X` to get the consumer-supplied render callback.
 *
 * When a component ALSO declares a `<props>` entry named `X`, the prop emits
 * its own `@property X` — two class members with the identical identifier `X`,
 * which is a hard rolldown parse error (`Identifier 'X' has already been
 * declared`) and refuses to build.
 *
 * The 5 other targets namespace these independently; Solid, for example,
 * suffixes EVERY slot render-prop with `Slot` (`X` → `XSlot`). Lit historically
 * used the bare name, which only breaks when a prop collides.
 *
 * COLLISION-GATED: to keep existing Lit fixtures byte-identical, we suffix the
 * portal-slot member with `Slot` ONLY when the slot name collides with a
 * declared prop name. Non-colliding portal slots keep their bare-name emission.
 *
 * This helper is the SINGLE source of truth for the member name; it MUST be
 * used at every site that references the portal-slot @property member:
 *   - emitSlotDecl.ts  (the `@property` declaration)
 *   - emitPortals.ts   (the `$portals` closure key + `this.<member>` read)
 *
 * Default slot (name === '') is handled by the `__rozieDefaultSlot__` sentinel
 * (the SAME sentinel emitSlotDecl/emitTemplate use for the non-portal default
 * slot). Phase 37 ($portals.default): a DEFAULT portal slot reads its content
 * from `this.__rozieDefaultSlot__`, so this helper returns that sentinel for
 * the empty name (the closure object KEY is the effective portalKey `default`,
 * computed by the caller via `portalKey()`).
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

/**
 * Return the Lit class-member identifier for a portal/scoped slot's
 * function-prop bridge. The DEFAULT slot (`name === ''`) maps to the
 * `__rozieDefaultSlot__` sentinel member. Otherwise suffixes with `Slot` iff the
 * bare slot name collides with a declared `<props>` entry; else the bare name.
 */
export function portalSlotMemberName(slotName: string, ir: IRComponent): string {
  if (slotName === '') return '__rozieDefaultSlot__';
  const collides = (ir.props ?? []).some((p) => p.name === slotName);
  return collides ? slotName + 'Slot' : slotName;
}
