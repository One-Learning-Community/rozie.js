/**
 * Hand-kept event-description manifest for @rozie-ui/command-palette.
 *
 * Events are derived structurally from the source via `ir.emits` (`select`), but
 * their human-readable descriptions have no first-class `<emits>` IR source — so
 * the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 *
 * Note: `open` and `query` are two-way MODELS (write-back via `r-model`), not
 * emits — they are not listed here.
 */
export const eventManifest = {
  select:
    'Fired when the user chooses a command (clicks it, or highlights it and presses Enter). Payload `{ id, label, group }` — the chosen item. If `closeOnSelect` is true (the default) the palette also closes (its `open` model is written `false`).',
};

export default eventManifest;
