/**
 * Hand-kept event-description manifest for @rozie-ui/flatpickr.
 *
 * Events are derived structurally from the source via `ir.emits`
 * (`change`, `ready`, `open`, `close`, `monthChange`, `yearChange`,
 * `valueUpdate`, `dayCreate`), but their human-readable descriptions have no
 * first-class `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every
 * emitted event name has an entry here and throws if one is missing.
 *
 * Payload note: `change`, `ready`, and `valueUpdate` carry
 * `{ value: string, selectedDates: Date[] }`; `dayCreate` carries the day
 * `HTMLElement`; the rest carry no payload.
 */
export const eventManifest = {
  change:
    'Fired when the selected date(s) change. Payload `{ value, selectedDates }`. In range mode the bound string commits only when the range is complete (2 dates) unless `commitOn: "change"`.',
  ready:
    'Fired once the calendar is initialised and mounted. Payload `{ value, selectedDates }`.',
  open: 'Fired when the calendar popover opens.',
  close: 'Fired when the calendar popover closes.',
  monthChange: 'Fired when the displayed month changes.',
  yearChange: 'Fired when the displayed year changes.',
  valueUpdate:
    'Fired on every internal value update (including partial range clicks), before the `change` commit. Payload `{ value, selectedDates }`.',
  dayCreate:
    'Fired for each day cell as the calendar renders. Payload is the day `HTMLElement`, for per-day decoration.',
};

export default eventManifest;
