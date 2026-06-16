/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/listbox.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`open`, `close`, `toggle`, `clear`, `focusControl` — the `$expose({ ... })`
 * call in Listbox.rozie), but their human-readable descriptions have no
 * first-class IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - `open`/`close`/`toggle`/`clear` do NOT collide with any prop or event
 *     (the `open` state lives under `$data.expanded`, the open event is
 *     `open-change`).
 *   - the focus verb is `focusControl`, NOT `focus`: a `focus` method on the Lit
 *     custom element would override the inherited `HTMLElement.focus`.
 */
export const handleManifest = {
  open: 'Open the popup (no-op when disabled or already open).',
  close: 'Close the popup.',
  toggle: 'Toggle the popup open/closed.',
  clear: 'Clear the selection (`null`, or `[]` in multi-select) and reset the combobox query.',
  focusControl: 'Move DOM focus to the control (the combobox input, or the select-only trigger button).',
};

export default handleManifest;
