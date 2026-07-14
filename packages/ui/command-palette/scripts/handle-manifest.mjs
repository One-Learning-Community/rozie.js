/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/command-palette.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`show`, `close`, `toggle`, `focus`, `goBack`, `openTo` — the
 * `$expose({ ... })` call in CommandPalette.rozie), but their prose has no
 * first-class IR source, so it lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the OPEN verb is `show` (NOT `open`): an `open` $expose verb collides with
 *     the `open` MODEL — both collapse onto React's generated open/setOpen state
 *     (the $data/model-key == $expose-verb class, listbox/dialog precedent).
 *   - the POP verb is `goBack` (NOT `back`): a `back()` $expose verb collides
 *     with the `back` EMIT (ROZ121: expose∩emits must be empty).
 *   - `close` / `toggle` / `openTo` are collision-safe (no event of those
 *     names is emitted).
 *   - the focus verb is `focus` — a DELIBERATE override of the inherited
 *     `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only;
 *     the public handle is intended — the otp/combobox/slider precedent).
 */
export const handleManifest = {
  show: 'Open the palette (writes the `open` model to `true`). Resets the highlight and focuses the search input; a pre-seeded query is preserved (the query resets on close, not open).',
  close: 'Close the palette (writes the `open` model to `false`). Resets the query and the level stack (`levelStack`) to root, so the next open starts fresh.',
  toggle: 'Toggle the palette open/closed (writes the `open` model to its negation).',
  focus:
    'Move DOM focus to the search input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended.',
  goBack:
    'Pop one nested level (restoring the parent query + input text, D-3 undo). A no-op at the root (an empty level stack). NOTE: named `goBack`, NOT `back` — a `back()` handle would collide with the `back` EMIT.',
  openTo:
    'Deep-link into a nested level: `openTo(path)`, where `path` is an array of item ids from the root. Opens the palette, resets to root, then drills through each id in turn — async-aware (awaits a Promise `source` before resolving the next hop). Stops silently at the first id that does not resolve in the current level.',
};

export default handleManifest;
