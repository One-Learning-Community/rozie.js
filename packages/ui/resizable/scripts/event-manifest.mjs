/**
 * Hand-kept event-description manifest for @rozie-ui/resizable.
 *
 * Events are derived structurally from the source via `ir.emits` (`resize`), but
 * their human-readable descriptions have no first-class `<emits>` IR source — so
 * the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  resize:
    'Fired on every committed size change (pointer drag, Arrow/Home/End keyboard nudge, or a programmatic `applySize` / `reset`). Payload `{ size }` — the new first-panel percent, already clamped to `[min, max]`. Funneled through one `commitSize` wrapper so the React prop-destructure hoists exactly once.',
};

export default eventManifest;
