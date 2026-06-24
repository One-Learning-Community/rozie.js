/**
 * Hand-kept event-description manifest for @rozie-ui/switch.
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
    'Fired whenever the switch is toggled — by a click, by Space/Enter, or by the programmatic `toggle()` handle. Payload `{ checked }` — the new boolean state. (No-op while `disabled` or `readonly`.)',
};

export default eventManifest;
