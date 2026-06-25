/**
 * Hand-kept event-description manifest for @rozie-ui/date-picker.
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
    'Fired whenever the selected date changes — selecting a day, or a programmatic `clear()`. Payload `{ value }` — the new selected ISO `YYYY-MM-DD` string, or `""` when cleared. Not fired when the picked date equals the current selection.',
};

export default eventManifest;
