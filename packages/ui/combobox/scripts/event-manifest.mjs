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
    'Fired when the selected value changes — a user picks an option (toggling membership in `multiple` mode), commits free text (`delimiters` / `validate` / `splitPaste` / `commitOnBlur`), or `clear()` resets it. Payload `{ value, option, selected, text? }` (`ComboboxChangePayload`); `text` is set ONLY on free-text commits, where `option` is `null`; it is the stored string (what `validate` returned, when it returned one). `value` is always the model\'s NEW value — the whole array in `multiple` mode, the scalar (or `null`) in single mode. `option` is the raw source option that was just toggled (`null` after a `clear()`). `selected` names the direction of the toggle: `true` when the option was just added (and always `true` in single-select), `false` when it was just removed or after `clear()`.',
  search:
    'Fired whenever the input text changes. Payload `{ query }` — the current text. It fires on every keystroke, after a paste Combobox handles itself (with the resulting text), and with `{ query: \'\' }` whenever Combobox clears the input itself: a pick or create under `multiple`, a free-text commit (including one of a value that is already selected, which fires no `change`) and `clear()`. Pair it with `disableFilter` to drive async / server-side filtering: refetch `options` from the query and the popup re-renders the supplied list verbatim. `query()` on the handle reads the current text.',
  create:
    'Fired when `creatable` is set and the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization). Payload `{ query }` — the committed text. Combobox writes NOTHING to `value` when this fires — the consumer is responsible for adding the option to `options` and updating the model itself. Fires at most once per distinct query (a double-commit of the same text is a no-op); composes with `multiple` (`value` stays untouched there too).',
};

export default eventManifest;
