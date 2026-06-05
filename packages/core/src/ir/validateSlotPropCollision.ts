/**
 * validateSlotPropCollision — Phase 28 (slot/prop same-name collision class).
 *
 * Post-IR pass that flags every `<slot name="X">` whose `X` equals a declared
 * `<props>` key. Such a component is unsupportable uniformly across the six
 * targets:
 *
 *   - Svelte 5 unifies snippets and props into ONE `$props()` namespace. The
 *     regenerated Svelte leaf's `Props` interface would declare `X` TWICE —
 *     once with the prop's type, once as a `Snippet` — and BOTH would source
 *     from the same `props.X` key, so setting the prop value poisons the slot
 *     derivation (a runtime collision invisible at compile time).
 *
 *   - The other five targets keep prop and slot in distinct consumer
 *     namespaces (React `slots={{}}`, Vue `#slot`, Angular contentChild, Solid
 *     `XSlot`, Lit `.XSlot`) and are immune.
 *
 * That asymmetry is a silent cross-target divergence on 1 of 6 targets, so per
 * the project's "make the unrepresentable a loud compile error" discipline this
 * pass turns it into a hard ERROR (ROZ127 SLOT_PROP_NAME_COLLISION).
 *
 * Diagnostic shape — a DUAL code-frame (mirrors validateTwoWayBindings' ROZ949):
 *   - primary frame at the `<slot>` declaration loc;
 *   - `related[]` secondary frame at the colliding `<props>` declaration loc.
 * The message explains WHY (Svelte 5's unified `$props` namespace) and the
 * REMEDIATION (rename the slot — append `Content` / the engine hook name).
 *
 * Case-sensitive (`X` ≠ `x`) — the per-target namespaces are case-sensitive.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All collisions push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a colliding
 * `.rozie` fails regardless of entrypoint (it must fail in a Vite build, not
 * just `compile()`).
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent } from './types.js';

/**
 * Validate every declared slot name against the component's `<props>` keys.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ127 pushed per collision)
 */
export function validateSlotPropCollision(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // Build a name → PropDecl lookup once. `<props>` keys are unique, so a Map is
  // the right shape; the value carries the colliding prop's sourceLoc for the
  // secondary code-frame.
  const propByName = new Map<string, (typeof ir.props)[number]>();
  for (const prop of ir.props) {
    propByName.set(prop.name, prop);
  }

  for (const slot of ir.slots) {
    // The default-slot sentinel is the empty string — a `<props>` key can never
    // be the empty string, so it can never collide. Skip defensively anyway.
    if (slot.name === '') continue;

    const collidingProp = propByName.get(slot.name);
    if (collidingProp === undefined) continue;

    diagnostics.push({
      code: RozieErrorCode.SLOT_PROP_NAME_COLLISION,
      severity: 'error',
      message: `<slot name="${slot.name}"> collides with the declared prop '${slot.name}' — a slot and a prop cannot share a name. Svelte 5 unifies snippets and props into ONE \`$props\` namespace, so the regenerated Svelte target would declare '${slot.name}' twice (the prop type AND a Snippet) and source both from the same key, poisoning the slot.`,
      loc: slot.sourceLoc,
      hint: `Rename the slot so its name differs from every <props> key — e.g. append 'Content' or use the engine hook name (name="${slot.name}Content"). The boolean/value prop keeps its name.`,
      related: [
        {
          message: `prop '${slot.name}' declared here`,
          loc: collidingProp.sourceLoc,
        },
      ],
    });
  }
}
