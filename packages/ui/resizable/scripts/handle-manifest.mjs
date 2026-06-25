/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/resizable.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`applySize`, `reset` — the `$expose({ ... })` call in Resizable.rozie), but
 * their human-readable descriptions have no first-class IR source — so the prose
 * lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - the set-size verb is `applySize`, NOT `setSize` — the model prop is `size`,
 *     so the React emitter auto-generates a `setSize` state setter; an `$expose`
 *     verb named `setSize` collapses onto it and trips ROZ524 (the deconfliction
 *     pass does not reach inside an `$expose`-verb closure). `apply<X>` is the
 *     listbox/data-table precedent.
 *   - `reset` is collision-safe (NOT a host-element member, NOT an emit name).
 */
export const handleManifest = {
  applySize:
    'Set the split position programmatically to `percent` (the first-panel size); clamped to `[min, max]` and emits `resize`. Named `applySize` rather than `setSize` to avoid the React state-setter generated for the `size` model prop (ROZ524).',
  reset:
    'Recentre the split to the midpoint of `[min, max]` (emits `resize`).',
};

export default handleManifest;
