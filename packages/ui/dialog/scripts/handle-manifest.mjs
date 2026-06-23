/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/dialog.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`show`, `hide` — the `$expose({ ... })` call in Dialog.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the verbs are `show` / `hide`, NOT `open` / `close`, ON PURPOSE: an `open`
 *     verb would collide with the `open` model prop (the data/model-key ==
 *     expose-verb class, listbox), and a `close` verb would collide with the
 *     `@close` EVENT (ROZ121 expose==event, TipTap). `show` / `hide` are clear,
 *     collision-free, and not inherited `HTMLElement` members (no ROZ137).
 */
export const handleManifest = {
  show:
    'Open the dialog imperatively (sets the two-way `open` model to `true`). Equivalent to a consumer write of `open = true`; the native `<dialog>.showModal()` runs on the next reconcile.',
  hide:
    'Close the dialog imperatively. Sets `open` to `false` and emits `close` with `{ reason: \'programmatic\' }`.',
};

export default handleManifest;
