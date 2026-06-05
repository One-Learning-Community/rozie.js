/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/fullcalendar.
 *
 * The exposed methods are derived structurally from the source via
 * `ir.expose` (`getApi`, `changeView`, `addEvent`, `removeEvent`, `today`,
 * `prev`, `next`, `gotoDate` — the Phase 21 `$expose({ ... })` call in
 * FullCalendar.rozie), but their human-readable descriptions have no
 * first-class IR source — so the prose lives here. Mirrors event-manifest.mjs.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121): none of these 8 verbs collides with an
 * emitted event name (`eventClick,dateClick,eventDrop,select,eventResize,
 * datesSet`) or a declared prop name — `prev`/`next`/`today` are confirmed safe.
 */
export const handleManifest = {
  getApi: 'Return the underlying FullCalendar `Calendar` instance for direct API access.',
  changeView: 'Switch the active view — `changeView(viewName, dateOrRange?)`.',
  addEvent: 'Add an event — `addEvent(eventInput, source?)`.',
  removeEvent: 'Remove an event by id — `removeEvent(id)`.',
  today: 'Navigate to today.',
  prev: 'Navigate to the previous date range.',
  next: 'Navigate to the next date range.',
  gotoDate: 'Navigate to a specific date — `gotoDate(date)`.',
};

export default handleManifest;
