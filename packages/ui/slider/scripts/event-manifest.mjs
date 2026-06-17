/**
 * Hand-kept event-description manifest for @rozie-ui/slider.
 *
 * Events are derived structurally from the source via `ir.emits` (`change`),
 * but their human-readable descriptions have no first-class `<emits>` IR source
 * — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  change:
    'Fired after the value changes (drag, keyboard, or a programmatic `increment`/`decrement` step). Payload `{ value }` — a scalar number in single mode, a sorted `[lo, hi]` array in range mode.',
};

export default eventManifest;
