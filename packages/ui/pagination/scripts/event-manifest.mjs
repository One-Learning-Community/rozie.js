/**
 * Hand-kept event-description manifest for @rozie-ui/pagination.
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
    'Fired whenever the current page changes (a page button, prev/next, or a programmatic `goto`/`next`/`prev`/`first`/`last`). Payload `{ page }` — the new clamped 1-based page. Not fired when the target page equals the current page.',
};

export default eventManifest;
