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
 * Naming note: `openPicker`/`closePicker`/`togglePicker` (not `open`/`close`/
 * `toggle`) for symmetry and because the component also EMITS `open`/`close`
 * events — see the collision finding in the Flatpickr.rozie header comment.
 * `changeMonth`/`changeYear` are ROZ121-clear (the emits are `monthChange`/
 * `yearChange`).
 */
export const handleManifest = {
  clear: 'Clear the selected date(s) and the bound input.',
  openPicker: 'Open the calendar popover.',
  closePicker: 'Close the calendar popover.',
  selectDate:
    'Set the selected date programmatically — `selectDate(date, triggerChange?)`. Pass `true` as the second argument to also fire `change`.',
  jumpToDate:
    'Navigate the calendar view to a date — `jumpToDate(date)` — without changing the selection.',
  getSelectedDates:
    'Return the currently selected dates as a `Date[]` on demand (the two-way `date` model is a formatted string; the parsed dates are otherwise only on the `change` payload). `[]` before mount.',
  togglePicker: 'Open the calendar if closed, close it if open — `togglePicker()` (single-trigger button).',
  changeMonth:
    'Move the calendar by `value` months (or to an absolute month) — `changeMonth(value, isOffset?)` (isOffset defaults to true).',
  changeYear: 'Jump the calendar to an absolute year — `changeYear(year)`.',
};

export default handleManifest;
