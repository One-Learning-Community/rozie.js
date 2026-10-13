/**
 * Hand-kept event-description manifest for @rozie-ui/select.
 *
 * Events are derived structurally from the source via `ir.emits`
 * (`open-change`, `change`), but their human-readable descriptions
 * have no first-class `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  'open-change':
    'Fired whenever the popup opens or closes. Payload `{ open: boolean }`.',
  change:
    'Fired after the selection changes. Payload `{ value, option }` — `value` is the new selected value (an array in multi-select), `option` is the toggled option (`null` when cleared).',
};

export default eventManifest;
