/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/popover.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`show`, `hide`, `toggle`, `reposition` — the `$expose({ ... })` call in
 * Popover.rozie), but their human-readable descriptions have no first-class IR
 * source, so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the reposition verb is `reposition`, NOT `update` — `update` is a reserved
 *     Lit `ReactiveElement` lifecycle method and a bare `update` $expose verb
 *     would clobber it (Cropper enumerates it among the Lit-reserved names).
 *   - `show`/`hide` are NOT inherited `HTMLElement` members (they live on
 *     `<dialog>`/`<details>`), and `toggle` is not an element member either, so
 *     all four are collision-safe on the Lit custom element. None collides with
 *     the `change` emit or the `open` model's React `setOpen` setter.
 */
export const handleManifest = {
  show: 'Open the floating content (no-op when `disabled`). Emits `change` and updates the `open` model.',
  hide: 'Close the floating content. Emits `change` and updates the `open` model.',
  toggle: 'Flip the open state (no-op when `disabled`). Emits `change` and updates the `open` model.',
  reposition:
    'Recompute the floating position immediately (the Floating UI `computePosition` pass). Useful after content size changes that `autoUpdate` does not observe.',
};

export default handleManifest;
