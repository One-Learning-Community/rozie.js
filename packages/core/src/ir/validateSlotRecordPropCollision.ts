/**
 * validateSlotRecordPropCollision — Phase 79 Plan 01 Task 2 (R13, D-06/D-07).
 *
 * Post-IR pass that flags every `<props>` key exactly equal to one of the four
 * slot-record property names the compiler synthesizes on a target's consumer
 * surface: `slots` (React/Solid), `snippets` (Svelte), `templates` (Angular),
 * `rozieSlots` (Lit). A component whose own author-declared prop shares one of
 * these exact names would collide with the synthesized member on the affected
 * target(s):
 *
 *   - React/Solid: a duplicate `slots` member on the generated props interface
 *     (TS2300) — the author's prop type AND the slot-record type both claim
 *     the same key.
 *   - Svelte: a duplicate `snippets` interface member PLUS a duplicate binding
 *     inside the `$props()` destructure, with the slot lookup silently reading
 *     the author's prop value instead of the synthesized snippet record — a
 *     live silent-wrong-behavior bug, not merely a type error.
 *   - Angular: a duplicate `templates` class member / `@Input()`.
 *   - Lit: a duplicate `rozieSlots` `@property`-decorated class field.
 *
 * Per D-07 this is a HARD ERROR, not the collision-gated rename
 * `packages/targets/lit/src/emit/portalSlotMemberName.ts` uses for portal slot
 * member names — these four names are public consumer API (the slot-record
 * prop every consumer imports types against), so a silent rename would change
 * the component's published surface without the author's consent.
 *
 * The validator fires TARGET-AGNOSTICALLY from `lowerToIR` because a single
 * `.rozie` file compiles to all six targets; the message names which
 * target(s) the collision actually breaks. This is intentionally a superset
 * of "hard error only on its owning target" — the only correct behavior for a
 * write-once-ship-six compiler.
 *
 * Scope discipline (see .planning/todos/pending/prop-emit-model-companion-field-collision.md):
 * the reserved set is EXACTLY these four strings. Names the compiler derives
 * PER SLOT for a specific target (a Pascal-cased render-prop callback, a
 * per-slot suffixed member on Solid/Angular, a per-model-prop companion
 * callback field) are ROZ148's parked sibling axes with an unmeasured
 * false-positive profile against already-shipping `@rozie-ui` prop names —
 * deliberately NOT covered here.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All collisions push a
 * diagnostic and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a colliding
 * `.rozie` fails regardless of entrypoint.
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent } from './types.js';

/**
 * Reserved slot-record `<props>` property name → the target(s) whose
 * synthesized consumer-surface member it collides with. Exactly four exact
 * strings — no fuzzy match, no derived-name axes (see the module doc's scope
 * discipline note).
 */
const RESERVED_SLOT_RECORD_PROP_NAMES: ReadonlyMap<string, string> = new Map([
  ['slots', 'React, Solid'],
  ['snippets', 'Svelte'],
  ['templates', 'Angular'],
  ['rozieSlots', 'Lit'],
]);

/**
 * Validate every declared `<props>` key against the four reserved
 * slot-record property names.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ095 pushed per collision)
 */
export function validateSlotRecordPropCollision(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  for (const prop of ir.props) {
    const targets = RESERVED_SLOT_RECORD_PROP_NAMES.get(prop.name);
    if (targets === undefined) continue;

    const breakage =
      prop.name === 'snippets'
        ? `On Svelte this collides with the synthesized slot-record \`$props()\` binding: the regenerated Svelte leaf declares '${prop.name}' TWICE (once as the author's prop type, once as the slot-record type) sourcing from the SAME destructured key, so the slot lookup silently reads the author's prop value instead of the slot record. On ${targets}, it produces a duplicate interface member (TS2300).`
        : `The emitted ${targets} consumer surface would declare '${prop.name}' twice — once as the author's declared prop, once as the compiler-synthesized slot-record property — a duplicate member (TS2300).`;

    diagnostics.push({
      code: RozieErrorCode.SLOT_RECORD_PROP_NAME_RESERVED,
      severity: 'error',
      message: `<props> key '${prop.name}' is reserved — it is the slot-record property name the compiler synthesizes on the ${targets} consumer surface. ${breakage}`,
      loc: prop.sourceLoc,
      hint: `Rename the '${prop.name}' prop to a non-reserved name (e.g. '${prop.name}Data' or a domain-specific name) — 'slots', 'snippets', 'templates', and 'rozieSlots' are reserved across all six targets' slot-record surfaces.`,
    });
  }
}
