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
 * mapping elsewhere and never reaches this helper with an empty name in the
 * collision check (a prop can't be named '').
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

/**
 * Return the Lit class-member identifier for a portal/scoped slot's
 * function-prop bridge. Suffixes with `Slot` iff the bare slot name collides
 * with a declared `<props>` entry; otherwise returns the bare name unchanged.
 */
export function portalSlotMemberName(slotName: string, ir: IRComponent): string {
  if (slotName === '') return slotName;
  const collides = (ir.props ?? []).some((p) => p.name === slotName);
  return collides ? slotName + 'Slot' : slotName;
}
