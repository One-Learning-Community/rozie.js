/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/command-palette.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`show`, `close`, `toggle`, `focus` — the `$expose({ ... })` call in
 * CommandPalette.rozie), but their prose has no first-class IR source, so it
 * lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the OPEN verb is `show` (NOT `open`): an `open` $expose verb collides with
 *     the `open` MODEL — both collapse onto React's generated open/setOpen state
 *     (the $data/model-key == $expose-verb class, listbox/dialog precedent).
 *   - `close` / `toggle` are collision-safe (no `@close` event is emitted; the
 *     only emit is `select`).
 *   - the focus verb is `focus` — a DELIBERATE override of the inherited
 *     `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only;
 *     the public handle is intended — the otp/combobox/slider precedent).
 */
export const handleManifest = {
  show: 'Open the palette (writes the `open` model to `true`). Clears the query, resets the highlight, and focuses the search input.',
  close: 'Close the palette (writes the `open` model to `false`).',
  toggle: 'Toggle the palette open/closed (writes the `open` model to its negation).',
  focus:
    'Move DOM focus to the search input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended.',
};

export default handleManifest;
