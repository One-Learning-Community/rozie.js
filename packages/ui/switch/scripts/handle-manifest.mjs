/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/switch.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`focus`, `toggle` — the `$expose({ ... })` call in Switch.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the focus verb is `focus` — a DELIBERATE override of the inherited
 *     `HTMLElement.focus` on the Lit custom element. ROZ137 warns on this (it is
 *     warn-only and does NOT auto-rename), and the warn is ACCEPTED here: the
 *     public handle is intended to be the natural `focus()` verb. This mirrors
 *     the otp / number-field precedent. codegen's severity filter keeps only
 *     `error` diagnostics, so the deliberate ROZ137 `focus` warn never throws.
 *   - `toggle` is collision-safe: it is NOT an inherited HTMLElement /
 *     LitElement member, does not clash with the `change` emit, and does not
 *     clash with the React/Solid `setModelValue` model-setter. (The same `toggle`
 *     name is also handed to the scoped default slot as a param — a local
 *     closure binding, never a class field, so no slot/expose collision.)
 */
export const handleManifest = {
  focus:
    'Move DOM focus to the switch control. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended.',
  toggle:
    'Flip the on/off state (same funnel as a click / Space / Enter) and emit `change`. A no-op while `disabled` or `readonly`.',
};

export default handleManifest;
