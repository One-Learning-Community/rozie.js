/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/slider.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`focus`, `increment`, `decrement` — the `$expose({ ... })` call in
 * Slider.rozie), but their human-readable descriptions have no first-class IR
 * source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the focus verb is `focus` — a DELIBERATE override of the inherited
 *     `HTMLElement.focus` on the Lit custom element. ROZ137 warns on this (it is
 *     warn-only and does NOT auto-rename), and the warn is ACCEPTED here: the
 *     public handle is intended to be the natural `focus()` verb (D-05). This
 *     INVERTS the listbox precedent, which named its focus verb `focusControl`
 *     to AVOID the override. codegen's severity filter keeps only `error`
 *     diagnostics, so the deliberate ROZ137 `focus` warn never throws codegen.
 *   - `increment`/`decrement` are collision-safe (NOT host-element members);
 *     they take an optional thumb arg (`'lo'`|`'hi'`, default `'lo'`) in range
 *     mode.
 */
export const handleManifest = {
  focus:
    'Move DOM focus to the slider thumb (the native range input). NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended (D-05).',
  increment:
    'Increase the (optionally specified) thumb by one `step`, clamped to `[min, max]`. In range mode pass `\'lo\'` or `\'hi\'` (default `\'lo\'`).',
  decrement:
    'Decrease the (optionally specified) thumb by one `step`, clamped to `[min, max]`. In range mode pass `\'lo\'` or `\'hi\'` (default `\'lo\'`).',
};

export default handleManifest;
