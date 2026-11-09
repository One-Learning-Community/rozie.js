/**
 * Hand-kept event-description manifest for @rozie-ui/sortable-list.
 *
 * Events are derived structurally from the source via `ir.emits`
 * (`reorder`, `add`, `remove`, `start`, `end`), but their human-readable
 * descriptions have no first-class `<emits>` IR source — so the prose lives
 * here. CONTEXT § "Claude's Discretion" sanctions this small hand-kept map.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every
 * emitted event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  reorder: 'Fired after a row moves within the list: a drag, or each keyboard move. Not fired for a drop back in place.',
  add: 'Fired by the destination list when a row arrives from another list (a clone copy included).',
  remove: 'Fired by the source list when a row leaves it for another list. A clone source keeps its row and does not fire it; cancelling a keyboard clone copy fires it from the list the copy leaves.',
  start: 'Fired when a drag starts or a row is lifted by keyboard, from the origin list.',
  end: 'Fired once when a drag or keyboard lift ends, from the list the row ends up in, after the bound arrays are written.',
};

export default eventManifest;
