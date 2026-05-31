/**
 * Hand-kept event-description manifest for @rozie-ui/sortable-list.
 *
 * Events are derived structurally from the source via `ir.emits`
 * (`change`, `add`, `remove`, `start`, `end`), but their human-readable
 * descriptions have no first-class `<emits>` IR source — so the prose lives
 * here. CONTEXT § "Claude's Discretion" sanctions this small hand-kept map.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every
 * emitted event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  change: 'Fired after the list order changes (same-list reorder commit).',
  add: 'Fired when an item is added from another list (cross-list destination commit).',
  remove: 'Fired when an item is moved out to another list (cross-list source commit; not fired in clone mode).',
  start: 'Fired when dragging starts.',
  end: 'Fired when dragging ends (source side).',
};

export default eventManifest;
