/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/combobox.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`focus`, `clear` — the `$expose({ ... })` call in Combobox.rozie), but their
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
 *     the slider/otp precedent (listbox took the other branch, `focusControl`).
 *     codegen's severity filter keeps only `error` diagnostics, so the
 *     deliberate ROZ137 `focus` warn never throws codegen.
 *   - `clear` is collision-safe (NOT a host-element member).
 */
export const handleManifest = {
  focus:
    'Move DOM focus to the text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended.',
  clear:
    'Reset the selection: clear `value` (emits `change` with `{ value: null }`) and empty the input text.',
};

export default handleManifest;
