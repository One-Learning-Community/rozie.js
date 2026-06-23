/**
 * Hand-kept event-description manifest for @rozie-ui/otp.
 *
 * Events are derived structurally from the source via `ir.emits` (`change`,
 * `complete`), but their human-readable descriptions have no first-class
 * `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  change:
    'Fired on every edit (type, paste, backspace, or a programmatic `clear`). Payload `{ value }` — the new contiguous code string (0..`length` chars).',
  complete:
    'Fired when the last cell is filled, i.e. the code reaches `length` characters. Payload `{ value }` — the complete code string. Use it to auto-submit a verification flow.',
};

export default eventManifest;
