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
 * Collision discipline (ROZ121): none of these 16 verbs collides with an
 * emitted event name (`eventClick,dateClick,eventDrop,eventResize,datesSet,
 * eventMouseEnter,eventMouseLeave,eventsSet,loading,select,unselect`) or a
 * declared prop. The selection verbs are NAMED `selectRange` (CalendarApi.select)
 * and `clearSelection` (CalendarApi.unselect) precisely because bare `select`/
 * `unselect` collide with the same-named emits — `prev`/`next`/`today` are safe.
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
  getDate: 'Return the calendar’s current anchor `Date` (the `view` model carries only the view type). null before mount.',
  getEvents: 'Return all current events as an `EventApi[]` (synchronous read; `eventsSet` is push-only). `[]` before mount.',
  scrollToTime: 'Scroll a timeGrid view to a time of day — `scrollToTime(duration)` (e.g. `"09:00"`).',
  updateSize: 'Force a relayout after the container resized outside FullCalendar’s knowledge (tab reveal, sidebar collapse).',
  prevYear: 'Navigate to the previous year.',
  nextYear: 'Navigate to the next year.',
  selectRange: 'Programmatically select a date/time range — `selectRange(dateOrObj, endDate?)` (CalendarApi.select).',
  clearSelection: 'Clear the current selection (CalendarApi.unselect).',
};

export default handleManifest;
