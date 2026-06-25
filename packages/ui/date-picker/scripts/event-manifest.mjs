/**
 * Hand-kept event-description manifest for @rozie-ui/date-picker.
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
    'Fired whenever the selected value changes — selecting a day, applying a preset, or a programmatic `clear()`. Payload `{ value }` — the new value: in `single` mode the selected ISO `YYYY-MM-DD` string (or `""` when cleared); in `range` mode the `{ start, end }` object (an in-progress anchor is `{ start, end: "" }`; cleared is `{ start: "", end: "" }`). Not fired when the picked date equals the current selection.',
  rangeComplete:
    'Range mode only. Fired when a range selection **completes** — the second endpoint lands (the two-click commit) or a preset is applied. Payload `{ value }` — the ordered `{ start, end }` object (`start <= end`). NOT fired on the first (anchor-only) click. Per-target consumer prop casing differs: React `onRangeComplete`, Vue `@range-complete`, Svelte `onrangecomplete` (lowercased), Angular `(rangeComplete)`, Solid `onRangeComplete`, Lit `@rangeComplete`.',
};

export default eventManifest;
