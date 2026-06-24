/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/number-field.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`focus`, `increment`, `decrement`, `clear` — the `$expose({ ... })` call in
 * NumberField.rozie), but their human-readable descriptions have no first-class
 * IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the focus verb is `focus` — a DELIBERATE override of the inherited
 *     `HTMLElement.focus` on the Lit custom element. ROZ137 warns on this (it is
 *     warn-only and does NOT auto-rename), and the warn is ACCEPTED here: the
 *     public handle is intended to be the natural `focus()` verb. This mirrors
 *     the slider/otp precedent. codegen's severity filter keeps only `error`
 *     diagnostics, so the deliberate ROZ137 `focus` warn never throws codegen.
 *   - `increment` / `decrement` / `clear` are collision-safe (not host-element
 *     members, no emit/model-setter clash).
 */
export const handleManifest = {
  focus:
    'Move DOM focus to the input and select its text. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended.',
  increment:
    'Step the value up by one `step` (clamped to `max`, snapped to `step`). A `null` value seeds from `min` (or `0`). Emits `change`.',
  decrement:
    'Step the value down by one `step` (clamped to `min`, snapped to `step`). A `null` value seeds from `min` (or `0`). Emits `change`.',
  clear:
    'Set the value to `null` (the empty field) and clear the edit buffer. Emits `change` with `{ value: null }`.',
};

export default handleManifest;
