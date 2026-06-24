/**
 * Hand-kept event-description manifest for @rozie-ui/popover.
 *
 * The single emitted event is derived structurally from the source via
 * `ir.emits` (`change`); its human-readable description has no first-class
 * `<emits>` IR source, so the prose lives here.
 *
 * The emit is `change`, NOT `open` — a model-prop named the same as an emit
 * collapses on some targets (the MapLibre zoom/pitch lesson), so the two-way
 * `open` model and its change notification carry distinct names.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  change:
    'Fired whenever the open state changes — a click/hover/focus trigger gesture, an Escape or click-outside dismissal, or a programmatic `show`/`hide`/`toggle`. Payload is the new `open` boolean. The two-way `open` model is updated alongside it.',
};

export default eventManifest;
