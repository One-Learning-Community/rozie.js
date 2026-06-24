/**
 * Hand-kept event-description manifest for @rozie-ui/tags.
 *
 * Events are derived structurally from the source via `ir.emits` (`add`,
 * `remove`, `change`), but their human-readable descriptions have no first-class
 * `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  add:
    'Fired when a token is committed (an accepted Enter/comma/paste add). Payload `{ value, tokens }` — `value` is the newly added token string, `tokens` the fresh full array. Rejected candidates (duplicate, failed `validate`, over `max`) do NOT fire it.',
  remove:
    'Fired when a token is removed (a chip remove-button click or Backspace in an empty input). Payload `{ value, index, tokens }` — the removed token, its former index, and the fresh full array.',
  change:
    'Fired on every committed-list mutation (add, remove, paste-bulk-add, or a programmatic `clear`). Payload `{ value }` — the new full tokens array. Use it to observe the list without two-way binding.',
};

export default eventManifest;
