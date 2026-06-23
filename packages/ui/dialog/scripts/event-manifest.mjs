/**
 * Hand-kept event-description manifest for @rozie-ui/dialog.
 *
 * Events are derived structurally from the source via `ir.emits` (`close`), but
 * their human-readable descriptions have no first-class `<emits>` IR source — so
 * the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  close:
    'Fired whenever the dialog dismisses — through a backdrop click, the Escape key, or a programmatic `hide()`. Payload `{ reason }` where `reason` is `\'backdrop\'`, `\'escape\'`, or `\'programmatic\'`. The two-way `open` model is set to `false` on the same tick, so you usually only need this to learn *why* it closed (e.g. to skip a confirmation on an explicit Cancel).',
};

export default eventManifest;
