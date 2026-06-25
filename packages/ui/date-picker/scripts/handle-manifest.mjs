/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/date-picker.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`focus`, `goToToday`, `clear` — the `$expose({ ... })` call in
 * DatePicker.rozie), but their human-readable descriptions have no first-class
 * IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline: `focus` DELIBERATELY overrides the inherited
 * `HTMLElement.focus` on the Lit custom element (warn-only ROZ137, accepted; the
 * public focus() handle is intended). `goToToday`/`clear` are collision-safe
 * (not host-element members) and do not collide with the single emit name
 * (`change`) or the React generated `value` model setter (`setValue`).
 */
export const handleManifest = {
  focus:
    'Move keyboard focus into the calendar grid — onto the selected day, else today (when in view), else the first visible day. Useful right after the picker becomes visible.',
  goToToday:
    "Swing the displayed month to today's month without changing the selection (a view-only navigation).",
  clear:
    'Deselect the current date (sets `value` to `""`). Emits `change` with an empty value unless nothing is selected.',
};

export default handleManifest;
