/**
 * validateDefaultPortalCollision — Phase 37 ($portals.default reserved key).
 *
 * Post-IR pass that flags the collision between a DEFAULT portal slot and a
 * slot literally `name="default"`.
 *
 * The `$portals.default` feature (Phase 37) makes the DEFAULT (unnamed) slot
 * addressable under the reserved portal key `"default"` (see `portalKey()` in
 * `ir/types.ts` — `slot.name || 'default'`). A component that ALSO declares a
 * slot whose authored name is literally `"default"` would produce TWO portal
 * closure entries keyed the same `$portals.default` — the second silently
 * shadows the first, a collision invisible at compile time.
 *
 * Per the project's "make the unrepresentable a loud compile error" discipline
 * this turns it into a hard ERROR (ROZ979 DEFAULT_PORTAL_NAME_RESERVED). It
 * fires ONLY when BOTH are present: a default portal slot AND a
 * `name="default"` slot. A `name="default"` slot on a component with NO default
 * portal slot is fine (it keys `$portals.default` uniquely — no shadow); a
 * default portal slot on a component with no `name="default"` slot is the
 * normal, intended case.
 *
 * Diagnostic shape — a DUAL code-frame (mirrors validateSlotPropCollision's
 * ROZ127):
 *   - primary frame at the `name="default"` slot declaration loc;
 *   - `related[]` secondary frame at the default portal slot's decl loc.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `diagnostics` in place;
 * NEVER mutates `ir`. Wired into `lowerToIR` (the single chokepoint both
 * `compile()` and `@rozie/unplugin` share).
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent } from './types.js';

/**
 * Validate that a component does not declare BOTH a default portal slot and a
 * slot literally named `"default"` (both would key `$portals.default`).
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ979 pushed on collision)
 */
export function validateDefaultPortalCollision(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // A default portal slot is an unnamed slot (`name === ''`) carrying isPortal.
  const defaultPortal = ir.slots.find((s) => s.name === '' && s.isPortal === true);
  if (defaultPortal === undefined) return;

  // Only a literal `name="default"` slot collides — its authored name keys the
  // SAME $portals.default entry the default portal slot reserves.
  for (const slot of ir.slots) {
    if (slot.name !== 'default') continue;

    diagnostics.push({
      code: RozieErrorCode.DEFAULT_PORTAL_NAME_RESERVED,
      severity: 'error',
      message: `<slot name="default"> collides with the default portal slot — the unnamed \`<slot portal />\` reserves the portal key "default" (\`$portals.default\`), so a slot literally named "default" would key the same closure entry and one would silently shadow the other.`,
      loc: slot.sourceLoc,
      hint: `Rename the name="default" slot so it differs from the reserved default-portal key — e.g. name="defaultContent". The default portal slot keeps its $portals.default addressing.`,
      related: [
        {
          message: `default portal slot declared here (reserves the "default" key)`,
          loc: defaultPortal.sourceLoc,
        },
      ],
    });
  }
}
