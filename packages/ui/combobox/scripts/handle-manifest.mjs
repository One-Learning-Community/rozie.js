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
 *   - `clear`, `seedQuery`, and `pinOpen` are collision-safe (NOT host-element
 *     members).
 */
export const handleManifest = {
  focus:
    'Move DOM focus to the text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended.',
  clear:
    'Reset the selection: clear `value` (emits `change` with `{ value: null }`) and empty the input text.',
  seedQuery:
    'Imperative-only: set the input text (`text ?? \'\'`, coerced to a string) without touching the `value` model or selection state — the typed query AND the filtered option list reflect it. Does not open the popup or emit `change`/`search`.',
  pinOpen:
    'Imperative-only: pin (or unpin) the popup open, coercing its argument to a boolean. While pinned, onBlur() early-returns so the popup does NOT collapse when a host sub-surface (e.g. an action flyout) moves DOM focus out of the input. pinOpen(false) only unpins — it does not itself close the popup or restore focus (the host does that). Render-neutral when never called.',
};

export default handleManifest;
