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
    "Fired on every edit (type, paste, backspace, or a programmatic `clear`) that actually changes the code — a write that produces the same value does not re-emit. Payload `{ value }` — the new contiguous code string (0..`length` chars). Funneled through one `commitValue` wrapper so the React prop-destructure hoists exactly once.",
  complete:
    'Fired on the not-full → full transition, i.e. the code reaches `length` characters. Editing a cell of an already-complete code does not re-fire it, and `clear()` never fires it. Payload `{ value }` — the complete code string. Use it to auto-submit a verification flow.',
};

export default eventManifest;
