/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/tags.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`clear`, `focusInput` — the `$expose({ ... })` call in Tags.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - `clear` is collision-safe (NOT a host-element member).
 *   - the focus verb is `focusInput`, NOT `focus`: a `focus` verb would override
 *     the inherited `HTMLElement.focus` on the Lit custom element (warn-only
 *     ROZ137). otp/slider accept that warn; here we sidestep it with the
 *     collision-safe `focusInput` so codegen stays warning-clean.
 */
export const handleManifest = {
  clear:
    'Remove every token (emits `change` with `{ value: [] }`) and move DOM focus to the text input. Collision-safe — not a host-element member.',
  focusInput:
    'Move DOM focus to the inline text input. Named `focusInput` (not `focus`) so it does not override the inherited `HTMLElement.focus` on the Lit custom element.',
};

export default handleManifest;
