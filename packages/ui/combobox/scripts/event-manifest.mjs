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
    'Fired when the selected value changes — a user picks an option (toggling membership in `multiple` mode), or `clear()` resets it. Payload `{ value, option, selected }`. `value` is always the model\'s NEW value — the whole array in `multiple` mode, the scalar (or `null`) in single mode. `option` is the raw source option that was just toggled (`null` after a `clear()`). `selected` names the direction of the toggle: `true` when the option was just added (and always `true` in single-select), `false` when it was just removed or after `clear()`.',
  search:
    'Fired on every keystroke in the input. Payload `{ query }` — the current text. Pair it with `disableFilter` to drive async / server-side filtering: refetch `options` from the query and the popup re-renders the supplied list verbatim.',
  create:
    'Fired when `creatable` is set and the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization). Payload `{ query }` — the committed text. Combobox writes NOTHING to `value` when this fires — the consumer is responsible for adding the option to `options` and updating the model itself. Fires at most once per distinct query (a double-commit of the same text is a no-op); composes with `multiple` (`value` stays untouched there too).',
};

export default eventManifest;
