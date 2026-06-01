/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/flatpickr.
 *
 * The exposed methods are derived structurally from the source via
 * `ir.expose` (`clear`, `openPicker`, `closePicker`, `selectDate`,
 * `jumpToDate` — the Phase 21 `$expose({ ... })` call in Flatpickr.rozie),
 * but their human-readable descriptions have no first-class IR source — so
 * the prose lives here. Mirrors event-manifest.mjs.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Naming note: `openPicker`/`closePicker` (not `open`/`close`) because the
 * component also EMITS `open`/`close` events — see the collision finding in
 * the Flatpickr.rozie header comment.
 */
export const handleManifest = {
  clear: 'Clear the selected date(s) and the bound input.',
  openPicker: 'Open the calendar popover.',
  closePicker: 'Close the calendar popover.',
  selectDate:
    'Set the selected date programmatically — `selectDate(date, triggerChange?)`. Pass `true` as the second argument to also fire `change`.',
  jumpToDate:
    'Navigate the calendar view to a date — `jumpToDate(date)` — without changing the selection.',
};

export default handleManifest;
