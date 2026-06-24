/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/pagination.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`goto`, `next`, `prev`, `first`, `last` — the `$expose({ ... })` call in
 * Pagination.rozie), but their human-readable descriptions have no first-class
 * IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline: none of these verbs collide with the single emit name
 * (`change`) or the React generated model setter (`setModelValue`). `next`/`prev`
 * double as both the imperative handle and the prev/next slot names — slot name
 * == expose verb is NOT a collision (ROZ127 only fires on slot == PROP name).
 */
export const handleManifest = {
  goto:
    'Go to a specific 1-based page; the argument is clamped into `[1, totalPages]`. Emits `change` unless the target equals the current page.',
  next:
    'Advance to the next page (no-op at the last page). Emits `change` on success.',
  prev:
    'Go back to the previous page (no-op at the first page). Emits `change` on success.',
  first:
    'Jump to the first page (page 1). Emits `change` unless already there.',
  last:
    'Jump to the last page (the effective `totalPages`). Emits `change` unless already there.',
};

export default handleManifest;
