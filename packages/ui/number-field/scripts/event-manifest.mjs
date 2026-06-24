/**
 * Hand-kept event-description manifest for @rozie-ui/number-field.
 *
 * The single emitted event is derived structurally from the source via
 * `ir.emits` (`change`), but its human-readable description has no first-class
 * `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  change:
    'Fired on every committed change — a typed value committed on blur/Enter, a step from the +/- buttons or the keyboard, a Home/End jump, a scrub, or a programmatic `increment`/`decrement`/`clear`. Payload `{ value }` — the new clamped + snapped number, or `null` when the field is empty.',
};

export default eventManifest;
