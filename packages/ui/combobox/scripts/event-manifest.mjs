/**
 * Hand-kept event-description manifest for @rozie-ui/combobox.
 *
 * Events are derived structurally from the source via `ir.emits` (`change`,
 * `search`), but their human-readable descriptions have no first-class
 * `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  change:
    'Fired when the selected value changes — a user picks an option, or `clear()` resets it. Payload `{ value }` — the newly-selected option value (or `null` after a clear). This is the two-way `value` write-back funneled through one wrapper.',
  search:
    'Fired on every keystroke in the input. Payload `{ query }` — the current text. Pair it with `disableFilter` to drive async / server-side filtering: refetch `options` from the query and the popup re-renders the supplied list verbatim.',
};

export default eventManifest;
